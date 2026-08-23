import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { conversationsApi } from '../api/conversations.js';
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { getSocket } from '../realtime/socket.js';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M4 app screen 4 — the chat thread; the app's hardest screen (brief §5.4).
 * One design, both roles (M4-36): the server composes everything for the
 * viewer, and "mine" is simply `senderType === my side`.
 *
 * Mechanics, each one a contract not a choice:
 * - INVERTED FlatList: the server returns newest-first, which is exactly the
 *   order an inverted list wants — no client re-sort.
 * - RUNS (§0.2): consecutive same-sender messages show the company name once
 *   at the top and the clock once at the bottom; a >5-minute gap breaks the
 *   run. In inverted order: name when the OLDER neighbour differs, clock
 *   when the NEWER neighbour differs.
 * - OPTIMISTIC SEND with the failure ON the message (§0.2): the bubble stays
 *   with "Not sent · Retry", never a detached toast. Send is REST; the
 *   server broadcast echoes it back over the socket, so everything merges
 *   by SERVER id — the echo and the response de-duplicate (§0.1).
 * - FREEZE replaces the composer with the server's own label; a typed draft
 *   stays visible in state and comes back if the thread unfreezes (§0.2 —
 *   "never silently eat what someone typed"). Both parties may see
 *   `blockedReason`; the acting admin never leaves the server.
 * - RESYNC: on socket reconnect and on screen focus the newest page is
 *   refetched and merged — the socket is delivery, never the only source.
 * - Read tracking: mark-read on open and on every incoming message while the
 *   screen is focused; the tab badge refreshes after each.
 */
const PAGE_LIMIT = 30;
const RUN_GAP_MS = 5 * 60 * 1000;

export function ChatThreadScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { refreshUnread } = useChat();
  const { id } = route.params ?? {};
  const mySide = role === 'exporter' ? 'exporter' : 'buyer';

  const [conversation, setConversation] = useState(null);
  // The product this thread is anchored to (M4-4 — every thread has exactly
  // one). The conversation payload carries only {id, slug, name}, so the
  // image and price come from the public product read.
  const [product, setProduct] = useState(null);
  const [messages, setMessages] = useState([]); // newest-first; may hold {pending|failed} locals
  const [boot, setBoot] = useState({ loading: true, error: null });
  const [nextBefore, setNextBefore] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const idsRef = useRef(new Set()); // server ids seen — the de-dup ledger
  const focusedRef = useRef(false);

  /** Merge server messages (newest-first) into state, skipping ids already
   *  present and dropping any local copy they replace. */
  const mergeIncoming = useCallback((incoming) => {
    setMessages((current) => {
      const fresh = incoming.filter((m) => !idsRef.current.has(m.id));
      if (fresh.length === 0) return current;
      for (const m of fresh) idsRef.current.add(m.id);
      const merged = [...fresh, ...current];
      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return merged;
    });
  }, []);

  const load = useCallback(async () => {
    setBoot({ loading: true, error: null });
    try {
      const [conv, page] = await Promise.all([conversationsApi.get(id), conversationsApi.messages(id, { limit: PAGE_LIMIT })]);
      idsRef.current = new Set((page.messages ?? []).map((m) => m.id));
      setConversation(conv);
      setMessages(page.messages ?? []);
      setNextBefore(page.nextBefore ?? null);
      setBoot({ loading: false, error: null });
      conversationsApi.markRead(id).then(refreshUnread).catch(() => {});
      // Product context — never blocks the thread. A purged product has a
      // null id (M4-22) and a taken-down one 404s publicly; either way the
      // card simply doesn't render and the thread still works.
      const ref = conv?.product?.slug ?? conv?.product?.id;
      if (ref) catalogueApi.product(ref).then(setProduct).catch(() => setProduct(null));
    } catch (error) {
      setBoot({ loading: false, error: toAppError(error) });
    }
  }, [id, refreshUnread]);

  useEffect(() => {
    load();
  }, [load]);

  // Live wiring — this thread's messages and freeze flips; a reconnect
  // refetches the newest page (bounded resync, §7.1's "REST still works").
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      const socket = getSocket();
      // Joins the room when this thread was created after the socket connected.
      socket.emit('conversation:open', { conversationId: id });

      /**
       * 🔴 Tell the server this thread is ON SCREEN, so it suppresses a push
       * that would fire for a message the user is already watching arrive.
       *
       * It must be CLEARED on leaving and on backgrounding — a phone left on a
       * thread in the background is exactly when the push is wanted. Before
       * this existed the server inferred "watching" from socket connection
       * alone, which silenced notifications for anyone with the app open.
       */
      const setViewing = (on) =>
        socket.emit('conversation:viewing', { conversationId: on ? id : null });
      setViewing(true);

      const onAppState = (next) => setViewing(next === 'active');
      const appStateSub = AppState.addEventListener('change', onAppState);

      const onMessage = (payload) => {
        if (String(payload?.conversationId) !== String(id) || !payload?.message) return;
        mergeIncoming([payload.message]);
        if (focusedRef.current) conversationsApi.markRead(id).then(refreshUnread).catch(() => {});
      };
      const onFrozen = ({ conversationId }) => {
        if (String(conversationId) !== String(id)) return;
        // The freeze reason/label are view-composed — re-fetch rather than guess.
        conversationsApi.get(id).then(setConversation).catch(() => {});
      };
      const onReconnect = async () => {
        socket.emit('conversation:open', { conversationId: id });
        // A reconnect is a NEW socket server-side, so the viewing flag is gone
        // with the old one and has to be re-declared.
        setViewing(AppState.currentState === 'active');
        try {
          const page = await conversationsApi.messages(id, { limit: PAGE_LIMIT });
          mergeIncoming(page.messages ?? []);
        } catch {
          // still on the last-known state; the next action retries
        }
      };

      socket.on('message:new', onMessage);
      socket.on('conversation:frozen', onFrozen);
      socket.on('conversation:unfrozen', onFrozen);
      socket.on('connect', onReconnect);
      return () => {
        focusedRef.current = false;
        // Leaving the screen: the user is no longer watching, so pushes for
        // this thread must resume immediately.
        setViewing(false);
        appStateSub.remove();
        socket.off('message:new', onMessage);
        socket.off('conversation:frozen', onFrozen);
        socket.off('conversation:unfrozen', onFrozen);
        socket.off('connect', onReconnect);
      };
    }, [id, mergeIncoming, refreshUnread]),
  );

  const loadOlder = useCallback(async () => {
    if (!nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await conversationsApi.messages(id, { limit: PAGE_LIMIT, before: nextBefore });
      const older = (page.messages ?? []).filter((m) => !idsRef.current.has(m.id));
      for (const m of older) idsRef.current.add(m.id);
      setMessages((current) => [...current, ...older]);
      setNextBefore(page.nextBefore ?? null);
    } catch {
      // scroll again to retry
    } finally {
      setLoadingOlder(false);
    }
  }, [id, nextBefore, loadingOlder]);

  const send = useCallback(
    async (retryLocal) => {
      const body = (retryLocal?.body ?? draft).trim();
      if (!body || body.length > 200) return;
      const localId = retryLocal?.localId ?? `local-${Date.now()}`;
      const optimistic = {
        id: localId,
        localId,
        senderType: mySide,
        body,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((current) => [optimistic, ...current.filter((m) => m.localId !== localId)]);
      if (!retryLocal) setDraft('');
      setSending(true);
      try {
        const message = await conversationsApi.send(id, body);
        setMessages((current) => {
          const withoutLocal = current.filter((m) => m.localId !== localId);
          if (idsRef.current.has(message.id)) return withoutLocal; // socket echo won
          idsRef.current.add(message.id);
          return [message, ...withoutLocal];
        });
      } catch (error) {
        // The failure lives ON the message (§0.2) — never a detached toast.
        const reason = toAppError(error).message;
        setMessages((current) =>
          current.map((m) => (m.localId === localId ? { ...m, pending: false, failed: true, failReason: reason } : m)),
        );
      } finally {
        setSending(false);
      }
    },
    [draft, id, mySide],
  );

  const removeFailed = (localId) =>
    setMessages((current) => current.filter((m) => m.localId !== localId));

  if (boot.loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <Spinner label="Opening conversation…" />
      </View>
    );
  }
  if (boot.error) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <ErrorState error={boot.error} onRetry={load} />
      </View>
    );
  }

  const decorated = decorateRuns(messages);
  const frozen = Boolean(conversation?.frozen);
  const freezeLabel = conversation?.frozenLabel;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Header — counterparty company + product; tap the product line to
            open its page while it still exists (null once purged, M4-22). */}
        <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
          <Pressable
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.ink[900]} />
          </Pressable>
          <View style={styles.headerAvatar}>
            {conversation?.counterparty?.logo ? (
              <Image source={{ uri: conversation.counterparty.logo }} style={styles.headerAvatarImage} />
            ) : (
              <Text style={styles.headerMonogram}>{initials(conversation?.counterparty?.name)}</Text>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {conversation?.counterparty?.name ?? 'Conversation'}
            </Text>
            <Pressable
              disabled={!conversation?.product?.slug && !conversation?.product?.id}
              onPress={() =>
                navigation.navigate('ProductDetail', {
                  idOrSlug: conversation.product.slug ?? conversation.product.id,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Product: ${conversation?.product?.name ?? ''}`}
              hitSlop={6}
            >
              <Text style={styles.headerProduct} numberOfLines={1}>
                {conversation?.product?.name ?? ''}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Product context — pinned under the header (owner, 2026-08-20:
            "show the product details in the chat"). Every thread is anchored
            to exactly one product (M4-4), so this is the thread's subject,
            not decoration: photo, name, price. Taps through to the product
            page. Absent when the product was purged — never a dead link to a
            page that no longer exists (M4-22). */}
        {conversation?.product?.name ? (
          <Pressable
            onPress={() =>
              (conversation.product.slug || conversation.product.id) &&
              navigation.navigate('ProductDetail', {
                idOrSlug: conversation.product.slug ?? conversation.product.id,
              })
            }
            disabled={!conversation.product.slug && !conversation.product.id}
            accessibilityRole="button"
            accessibilityLabel={`Product: ${conversation.product.name}`}
            style={({ pressed }) => [styles.productBar, pressed && styles.productBarPressed]}
          >
            {product?.images?.[0] ? (
              <Image source={{ uri: product.images[0] }} style={styles.productThumb} />
            ) : (
              <View style={[styles.productThumb, styles.productThumbFallback]}>
                <Ionicons name="cube-outline" size={18} color={colors.ink[400]} accessible={false} />
              </View>
            )}
            <View style={styles.productBarText}>
              <Text style={styles.productBarLabel}>THIS CONVERSATION IS ABOUT</Text>
              <Text style={styles.productBarName} numberOfLines={1}>
                {conversation.product.name}
              </Text>
              {product?.price ? (
                <Text style={styles.productBarPrice} numberOfLines={1}>
                  {formatPrice(product.price, product.unit)}
                </Text>
              ) : null}
            </View>
            {conversation.product.slug || conversation.product.id ? (
              <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
            ) : null}
          </Pressable>
        ) : null}

        {/* Freeze banner ABOVE the thread when frozen — the label is the
            server's, tone + text together (M4-19). */}
        {frozen && freezeLabel?.text ? (
          <View style={[styles.freezeBanner, freezeLabel.tone === 'red' ? styles.freezeRed : styles.freezeYellow]}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={freezeLabel.tone === 'red' ? '#912018' : '#93370D'}
              accessible={false}
            />
            <Text
              style={[styles.freezeBannerText, { color: freezeLabel.tone === 'red' ? '#912018' : '#93370D' }]}
            >
              {freezeLabel.text}
              {conversation?.blockedReason ? ` — ${conversation.blockedReason}` : ''}
            </Text>
          </View>
        ) : null}

        <FlatList
          data={decorated}
          keyExtractor={(m) => m.id}
          inverted
          renderItem={({ item }) => <MessageRow message={item} mySide={mySide} onRetry={send} onDiscard={removeFailed} conversation={conversation} />}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingOlder ? (
              <View style={styles.olderLoading}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
              </View>
            ) : null
          }
          contentContainerStyle={styles.threadContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        />

        {/* Composer — or the freeze notice in its place. The draft is kept in
            state either way, so unfreezing hands the words back. */}
        {frozen ? (
          <View style={[styles.frozenComposer, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
            <Text style={styles.frozenComposerText}>
              {freezeLabel?.tone === 'red'
                ? 'This conversation is closed to new messages.'
                : 'Messaging is paused while this is under review.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={colors.ink[400]}
              style={styles.input}
              accessibilityLabel="Message"
              multiline
              maxLength={200}
            />
            <Pressable
              onPress={() => send()}
              disabled={sending || draft.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={[styles.sendButton, (sending || draft.trim().length === 0) && styles.sendButtonOff]}
            >
              <Ionicons name="arrow-up" size={20} color={colors.white} accessible={false} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Run decoration over the newest-first array: in inverted order the OLDER
 * neighbour is index+1 and the NEWER is index-1. Name goes where the older
 * neighbour differs (run start); clock where the newer differs (run end).
 * System messages stand alone and never join a run.
 */
function decorateRuns(messages) {
  return messages.map((m, i) => {
    if (m.senderType === 'system') return { ...m, showName: false, showClock: true };
    const older = messages[i + 1];
    const newer = messages[i - 1];
    const startsRun =
      !older ||
      older.senderType !== m.senderType ||
      new Date(m.createdAt) - new Date(older.createdAt) > RUN_GAP_MS;
    const endsRun =
      !newer ||
      newer.senderType !== m.senderType ||
      new Date(newer.createdAt) - new Date(m.createdAt) > RUN_GAP_MS;
    return { ...m, showName: startsRun, showClock: endsRun };
  });
}

/**
 * The platform's own voice — web's hard-won vocabulary ported verbatim
 * (`MessageBubble.jsx` SystemNotice, four failed attempts documented there):
 * SIGNAGE, not speech. An inset card with a solid accent bar down the leading
 * edge, a tinted fill, and an uppercase tracked label + time — every part of
 * it a thing a chat bubble never has, so the platform can never read as a
 * third sender. `systemKind` picks the tone; the label is a CATEGORY, not a
 * name (M4-17 — the platform, never a person; the copy itself already says
 * "MPX Global").
 */
const NOTICE_DEFAULT = { label: 'Platform notice', icon: 'shield-checkmark-outline', bar: colors.primary[600], bg: colors.primary[50], fg: colors.primary[700] };
const NOTICE_KINDS = {
  welcome: NOTICE_DEFAULT,
  blocked: { label: 'Conversation blocked', icon: 'ban-outline', bar: colors.danger.DEFAULT, bg: colors.danger[50], fg: '#912018' },
  unblocked: { label: 'Conversation reopened', icon: 'checkmark-circle-outline', bar: colors.success, bg: '#E7F7EF', fg: '#05603A' },
  product_takedown: { label: 'Product under review', icon: 'alert-circle-outline', bar: colors.warning, bg: '#FEF0DC', fg: '#93370D' },
  product_restored: { label: 'Product available again', icon: 'checkmark-circle-outline', bar: colors.success, bg: '#E7F7EF', fg: '#05603A' },
  // Neutral on purpose (F1-B): the account cascade must not say anything
  // about the other party's account status — not even in colour.
  account_paused: { label: 'Conversation paused', icon: 'shield-outline', bar: colors.ink[300], bg: colors.ink[100], fg: colors.ink[600] },
  account_restored: { label: 'Conversation resumed', icon: 'checkmark-circle-outline', bar: colors.success, bg: '#E7F7EF', fg: '#05603A' },
};

function SystemNotice({ message }) {
  const kind = NOTICE_KINDS[message.systemKind] ?? NOTICE_DEFAULT;
  return (
    <View style={styles.noticeWrap}>
      <View style={[styles.notice, { backgroundColor: kind.bg }]}>
        <View style={[styles.noticeBar, { backgroundColor: kind.bar }]} />
        <View style={styles.noticeBody}>
          <View style={styles.noticeHead}>
            <Ionicons name={kind.icon} size={13} color={kind.fg} accessible={false} />
            <Text style={[styles.noticeLabel, { color: kind.fg }]}>{kind.label.toUpperCase()}</Text>
            <Text style={[styles.noticeDot, { color: kind.fg }]}>·</Text>
            <Text style={[styles.noticeTime, { color: kind.fg }]}>{clock(message.createdAt)}</Text>
          </View>
          <Text style={styles.noticeText}>{message.body}</Text>
        </View>
      </View>
    </View>
  );
}

function MessageRow({ message: m, mySide, onRetry, onDiscard, conversation }) {
  if (m.senderType === 'system') {
    return <SystemNotice message={m} />;
  }
  const mine = m.senderType === mySide;
  const senderName = mine
    ? 'You'
    : conversation?.counterparty?.name ?? (m.senderType === 'buyer' ? 'Buyer' : 'Seller');
  return (
    <View style={[styles.messageWrap, mine ? styles.mineWrap : styles.theirsWrap]}>
      {m.showName ? <Text style={styles.senderName}>{senderName}</Text> : null}
      <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirsBubble, m.failed && styles.failedBubble]}>
        <Text style={[styles.bubbleText, mine && styles.mineText]}>{m.body}</Text>
      </View>
      {m.pending ? <Text style={styles.metaLine}>Sending…</Text> : null}
      {m.failed ? (
        <View style={styles.failedRow}>
          <Text style={styles.failedText}>Not sent</Text>
          <Pressable onPress={() => onRetry(m)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
          <Pressable onPress={() => onDiscard(m.localId)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.discardText}>Discard</Text>
          </Pressable>
        </View>
      ) : null}
      {m.showClock && !m.pending && !m.failed ? (
        <Text style={styles.metaLine}>{clock(m.createdAt)}</Text>
      ) : null}
    </View>
  );
}

/** Same three modes as every other price in the app (§A27.1 — no currency
 *  conversion exists; print the ISO code as-is). */
function formatPrice(price, unit) {
  const { mode, min, max, currency } = price ?? {};
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);
  const suffix = unit ? ` / ${unit}` : '';
  if (mode === 'on_request' || (min == null && max == null)) return 'Price on request';
  if (mode === 'range') return `${currency} ${fmt(min)}–${fmt(max)}${suffix}`;
  return `${currency} ${fmt(min)}${suffix}`;
}

function clock(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  backButton: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'flex-start', justifyContent: 'center' },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: 40, height: 40 },
  headerMonogram: { ...typography.label, color: colors.primary[700] },
  headerText: { flex: 1 },
  headerName: { ...typography.bodyStrong, color: colors.ink[900] },
  headerProduct: { ...typography.tiny, color: colors.primary[700], marginTop: 1 },

  productBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    backgroundColor: colors.ink[50],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  productBarPressed: { backgroundColor: colors.ink[100] },
  productThumb: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface.DEFAULT },
  productThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productBarText: { flex: 1 },
  productBarLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: colors.muted },
  productBarName: { ...typography.caption, fontWeight: '600', color: colors.ink[900], marginTop: 1 },
  productBarPrice: { ...typography.tiny, color: colors.primary[700], fontWeight: '600' },

  freezeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  freezeYellow: { backgroundColor: '#FEF0DC' },
  freezeRed: { backgroundColor: colors.danger[50] },
  freezeBannerText: { ...typography.tiny, flex: 1, fontWeight: '600' },

  threadContent: { paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  olderLoading: { paddingVertical: spacing[3], alignItems: 'center' },

  // Signage, not speech — see SystemNotice's own note.
  noticeWrap: { alignItems: 'center', marginVertical: spacing[3] },
  notice: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 480,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  noticeBar: { width: 3 },
  noticeBody: { flex: 1, paddingVertical: spacing[2], paddingHorizontal: spacing[3], gap: 2 },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noticeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  noticeDot: { fontSize: 10, opacity: 0.5 },
  noticeTime: { fontSize: 10, fontWeight: '600' },
  noticeText: { ...typography.caption, color: colors.ink[800] },

  messageWrap: { marginVertical: 1, maxWidth: '82%' },
  mineWrap: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirsWrap: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { ...typography.tiny, color: colors.muted, marginTop: spacing[2], marginBottom: 2 },
  bubble: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  mineBubble: { backgroundColor: colors.primary[600], borderBottomRightRadius: radii.sm },
  theirsBubble: { backgroundColor: colors.ink[100], borderBottomLeftRadius: radii.sm },
  failedBubble: { opacity: 0.6 },
  bubbleText: { ...typography.body, color: colors.ink[900] },
  mineText: { color: colors.white },
  metaLine: { ...typography.tiny, color: colors.ink[400], marginTop: 2, marginBottom: spacing[1] },
  failedRow: { flexDirection: 'row', gap: spacing[3], marginTop: 2, marginBottom: spacing[1] },
  failedText: { ...typography.tiny, color: colors.danger.DEFAULT, fontWeight: '600' },
  retryText: { ...typography.tiny, color: colors.primary[700], fontWeight: '700' },
  discardText: { ...typography.tiny, color: colors.muted },

  frozenComposer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.ink[50],
  },
  frozenComposerText: { ...typography.caption, color: colors.ink[600], textAlign: 'center' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.ink[900],
    maxHeight: 110,
    borderRadius: radii.lg,
    backgroundColor: colors.ink[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonOff: { backgroundColor: colors.ink[200] },
});
