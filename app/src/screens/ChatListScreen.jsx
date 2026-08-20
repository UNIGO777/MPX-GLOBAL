import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { conversationsApi } from '../api/conversations.js';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { getSocket } from '../realtime/socket.js';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M4 app screen 3 — the Chats tab, WhatsApp-style (M4-37). ONE design, two
 * instances (M4-36): buyer and exporter differ only in empty-state copy —
 * the rows themselves are already role-aware server-side (the title and
 * counterparty are composed for the viewer).
 *
 * There is NO separate enquiries list (M4-35 — an enquiry and its thread are
 * one-to-one; two lists would show the same rows twice). This tab REPLACED
 * the M1 shells' separate "Enquiries" and "Messages" placeholder tabs, the
 * consolidation the M4 brief carried to the owner.
 *
 * Identity is COMPANY-level everywhere (M4-17): counterparty name + logo,
 * never a person. Freeze states render as the server's own label
 * (`frozenLabel {tone, text}` — colour never carries meaning alone, M4-19).
 *
 * Live: `message:new` / `conversation:updated` just mean "re-ask page 1" —
 * the reorder, preview and unread flags are all server-derived; recomputing
 * them locally is how a client drifts from the list it claims to show.
 */
const PAGE_LIMIT = 20;

export function ChatListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { refreshUnread } = useChat();
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: null, rows: [], nextCursor: null });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const queryRef = useRef('');
  queryRef.current = query;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setState((s) => ({ ...s, loading: s.rows.length === 0, error: null }));
    try {
      const q = queryRef.current.trim();
      const res = await conversationsApi.list({ limit: PAGE_LIMIT, ...(q ? { q } : {}) });
      setState({ loading: false, error: null, rows: res.conversations ?? [], nextCursor: res.nextCursor ?? null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  // Refresh on focus AND live while focused — a new message reorders the
  // list, updates the preview and flips unread, all server-side.
  useFocusEffect(
    useCallback(() => {
      load();
      const socket = getSocket();
      const onDelta = () => load();
      socket.on('message:new', onDelta);
      socket.on('conversation:updated', onDelta);
      socket.on('conversation:frozen', onDelta);
      socket.on('conversation:unfrozen', onDelta);
      return () => {
        socket.off('message:new', onDelta);
        socket.off('conversation:updated', onDelta);
        socket.off('conversation:frozen', onDelta);
        socket.off('conversation:unfrozen', onDelta);
      };
    }, [load]),
  );

  const loadMore = useCallback(async () => {
    const cursor = state.nextCursor;
    if (loadingMoreRef.current || !cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const q = queryRef.current.trim();
      const res = await conversationsApi.list({ limit: PAGE_LIMIT, cursor, ...(q ? { q } : {}) });
      setState((s) => ({
        ...s,
        rows: [...s.rows, ...(res.conversations ?? [])],
        nextCursor: res.nextCursor ?? null,
      }));
    } catch {
      // next scroll retries; everything fetched so far stays on screen
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [state.nextCursor]);

  const openThread = (c) => {
    navigation.navigate('ChatThread', { id: c.id });
    // Opening marks it read server-side; the badge catches up right after.
    setTimeout(refreshUnread, 800);
  };

  const { loading, error, rows } = state;
  const isBuyer = role === 'buyer';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={styles.title}>Chats</Text>
        <View style={styles.searchPill}>
          <Ionicons name="search" size={18} color={colors.ink[500]} accessible={false} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => load()}
            placeholder="Search by company or product…"
            placeholderTextColor={colors.ink[400]}
            style={styles.searchInput}
            accessibilityLabel="Search chats"
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                queryRef.current = '';
                load();
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.ink[400]} accessible={false} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading && rows.length === 0 ? (
        <View style={styles.skeletonWrap} accessibilityRole="progressbar" accessibilityLabel="Loading chats">
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={48} height={48} radius={radii.full} />
              <View style={styles.skeletonText}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="80%" height={12} style={{ marginTop: spacing[2] }} />
              </View>
            </View>
          ))}
        </View>
      ) : error && rows.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ThreadRow conversation={item} onPress={() => openThread(item)} />}
          ListEmptyComponent={
            isBuyer ? (
              <EmptyState
                icon="chatbubbles-outline"
                title="No conversations yet"
                message="Find a product and send an enquiry — the seller's reply lands here."
                actionLabel="Start browsing"
                onAction={() => navigation.navigate('BuyerSearch')}
              />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="No enquiries yet"
                message="When a buyer enquires about one of your products, the conversation starts here."
              />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function ThreadRow({ conversation: c, onPress }) {
  const frozen = c.frozenLabel?.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={c.title}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.avatar}>
        {c.counterparty?.logo ? (
          <Image source={{ uri: c.counterparty.logo }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.monogram}>{initials(c.counterparty?.name)}</Text>
        )}
      </View>
      <View style={styles.rowText}>
        {/* WhatsApp vocabulary for unread (owner, 2026-08-20): bolder name,
            dark preview, ACCENT time and a filled badge. The badge carries no
            number — the server derives a per-thread unread BOOLEAN (§7.5),
            not a message count, and inventing one would be a lie. */}
        <View style={styles.rowTop}>
          <Text style={[styles.name, c.unread && styles.nameUnread]} numberOfLines={1}>
            {c.counterparty?.name ?? '—'}
          </Text>
          <Text style={[styles.time, c.unread && styles.timeUnread]}>{relativeTime(c.lastMessageAt)}</Text>
        </View>
        <Text style={styles.product} numberOfLines={1}>
          {c.product?.name ?? ''}
        </Text>
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, c.unread && styles.previewUnread]} numberOfLines={1}>
            {c.lastMessagePreview ?? ''}
          </Text>
          {c.unread ? <View style={styles.unreadDot} /> : null}
        </View>
        {frozen ? (
          <View style={[styles.freezeChip, c.frozenLabel.tone === 'red' ? styles.freezeRed : styles.freezeYellow]}>
            <Text
              style={[
                styles.freezeText,
                c.frozenLabel.tone === 'red' ? styles.freezeTextRed : styles.freezeTextYellow,
              ]}
              numberOfLines={1}
            >
              {frozen}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
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

/** WhatsApp-style compact time: today → HH:MM, this week → weekday, else date. */
function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const days = (now - d) / 86400000;
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },

  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    gap: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  title: { ...typography.h1, color: colors.ink[900] },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
    paddingHorizontal: spacing[4],
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink[900], paddingVertical: spacing[2] },

  listContent: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  rowPressed: { backgroundColor: colors.ink[50] },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 48, height: 48 },
  monogram: { ...typography.label, color: colors.primary[700] },
  rowText: { flex: 1, gap: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  name: { ...typography.bodyStrong, color: colors.ink[900], flexShrink: 1 },
  nameUnread: { fontWeight: '700' },
  time: { ...typography.tiny, color: colors.muted },
  timeUnread: { color: colors.primary[600], fontWeight: '700' },
  product: { ...typography.tiny, color: colors.primary[700] },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  preview: { ...typography.caption, color: colors.muted, flex: 1 },
  previewUnread: { color: colors.ink[900], fontWeight: '600' },
  unreadDot: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
  },

  freezeChip: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    marginTop: 3,
  },
  freezeYellow: { backgroundColor: '#FEF0DC' },
  freezeRed: { backgroundColor: colors.danger[50] },
  freezeText: { ...typography.tiny, fontWeight: '600' },
  freezeTextYellow: { color: '#93370D' },
  freezeTextRed: { color: '#912018' },

  skeletonWrap: { paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  skeletonText: { flex: 1 },
  footerLoading: { paddingVertical: spacing[4], alignItems: 'center' },
});
