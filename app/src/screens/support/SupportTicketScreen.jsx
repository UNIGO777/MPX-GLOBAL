import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORY_LABEL, TICKET_STATUS, supportApi } from '../../api/support.js';
import { Badge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { ChatAttachment } from '../../components/chat/ChatAttachment.jsx';
import { ErrorState, Spinner } from '../../components/Feedback.jsx';
import { FormError } from '../../components/FormError.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { pickSupportFile } from '../../components/support/pickSupportFile.js';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';

/**
 * One support ticket (Step 1b). Staff replies read "MPX Global Support" — the
 * server never sends this account an employee's name.
 */
export function SupportTicketScreen({ navigation, route }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      setData(await supportApi.myTicket(id));
    } catch (err) {
      setLoadError(toAppError(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const attach = async (kind) => {
    const res = await pickSupportFile(kind);
    if (res?.problem) setSendError({ message: res.problem });
    if (res?.file) setFile(res.file);
  };

  const send = async () => {
    if (!body.trim() && !file) return;
    setSending(true);
    setSendError(null);
    try {
      setData(await supportApi.reply(id, { body: body.trim(), file }));
      setBody('');
      setFile(null);
    } catch (err) {
      const e = toAppError(err);
      setSendError(e);
      // Staff closed it while the screen was open — reload into the closed bar.
      if (e.code === 'TICKET_CLOSED') load();
    } finally {
      setSending(false);
    }
  };

  const t = data?.ticket;
  const status = t ? TICKET_STATUS[t.status] : null;

  // "Mark as solved" — confirm first: it closes the ticket to replies.
  const markSolved = () => {
    Alert.alert('Mark this ticket as solved?', 'The ticket closes and replies are turned off. If the problem comes back, raise a new ticket linked to this one.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: "Yes, it's solved",
        onPress: async () => {
          try {
            setData(await supportApi.close(id));
          } catch (err) {
            setSendError(toAppError(err));
          }
        },
      },
    ]);
  };

  return (
    <NavyCanopy
      title={t ? t.ref : 'Ticket'}
      subtitle={t ? CATEGORY_LABEL[t.category] : undefined}
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      refreshing={refreshing}
      onRefresh={refresh}
      footer={
        t && t.status === 'resolved' ? (
          // Resolved = closed (owner, 2026-09-24): no composer. The server refuses
          // the reply too (TICKET_CLOSED).
          <View style={styles.closedBar}>
            <View style={styles.closedRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.ink[700]} accessible={false} />
              <Text style={styles.closedText}>{closedLine(t)} Replies are turned off.</Text>
            </View>
            <Button
              label="Raise a new ticket"
              icon="add"
              onPress={() => navigation.navigate('NewTicket', { followUpOf: t.id, followUpRef: t.ref })}
            />
          </View>
        ) : t ? (
          <View style={styles.composer}>
            {file ? (
              <View style={styles.fileChip}>
                <Ionicons name="attach-outline" size={16} color={colors.ink[700]} accessible={false} />
                <Text style={styles.fileChipText} numberOfLines={1}>{file.name}</Text>
                <Pressable onPress={() => setFile(null)} accessibilityLabel="Remove file" hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.ink[500]} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <Pressable onPress={() => attach('image')} accessibilityLabel="Attach a photo" hitSlop={6} style={styles.iconBtn}>
                <Ionicons name="image-outline" size={22} color={colors.ink[600]} />
              </Pressable>
              <Pressable onPress={() => attach('document')} accessibilityLabel="Attach a document" hitSlop={6} style={styles.iconBtn}>
                <Ionicons name="document-attach-outline" size={22} color={colors.ink[600]} />
              </Pressable>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Write a reply…"
                placeholderTextColor={colors.ink[400]}
                multiline
                maxLength={2000}
                style={styles.input}
                accessibilityLabel="Reply"
              />
              <Pressable
                onPress={send}
                disabled={sending || (!body.trim() && !file)}
                accessibilityLabel="Send reply"
                style={[styles.sendBtn, (sending || (!body.trim() && !file)) && styles.sendOff]}
              >
                <Ionicons name="send" size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>
        ) : null
      }
    >
      {!data && !loadError ? <Spinner label="Loading…" /> : null}
      {loadError ? <ErrorState error={loadError} onRetry={load} /> : null}
      {t ? (
        <View style={styles.body}>
          <View style={styles.head}>
            <Text style={styles.subject}>{t.subject}</Text>
            {status ? <Badge label={status.label} tone={status.tone} /> : null}
            {t.followUpOf ? (
              <Pressable onPress={() => navigation.push('SupportTicket', { id: t.followUpOf.id })} accessibilityRole="link">
                <Text style={styles.followUpLink}>Follow-up to {t.followUpOf.ref}</Text>
              </Pressable>
            ) : null}
            {t.status !== 'resolved' ? (
              <Pressable onPress={markSolved} accessibilityRole="button" style={styles.solvedBtn} hitSlop={6}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.ink[700]} />
                <Text style={styles.solvedText}>Mark as solved</Text>
              </Pressable>
            ) : null}
          </View>
          <FormError error={sendError} />
          {data.messages.map((m) => {
            const mine = m.authorType === 'company';
            return (
              <View key={m.id} style={[styles.msgWrap, mine ? styles.right : styles.left]}>
                <Text style={[styles.who, !mine && styles.whoStaff]}>
                  {mine ? 'You' : 'MPX Global Support'}
                </Text>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {m.body ? <Text style={mine ? styles.mineText : styles.theirText}>{m.body}</Text> : null}
                  {m.attachment ? <ChatAttachment message={m} mine={mine} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </NavyCanopy>
  );
}

/** Says WHO closed it, so an automatic close is never a surprise. */
function closedLine(t) {
  if (t.closedBy === 'company') return 'You marked this ticket as solved.';
  // The count in force when it closed (Settings-editable since 2026-09-25); 14 for older tickets.
  if (t.closedBy === 'auto') return `Closed automatically — we had no reply for ${t.autoClosedAfterDays ?? 14} days.`;
  return 'This ticket is resolved and closed.';
}

const styles = StyleSheet.create({
  followUpLink: { ...typography.caption, color: colors.primary[700], fontWeight: '600' },
  solvedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.white,
  },
  solvedText: { ...typography.caption, color: colors.ink[800], fontWeight: '600' },
  body: { gap: spacing[3] },
  head: { gap: spacing[2], alignItems: 'flex-start' },
  subject: { ...typography.h3, color: colors.ink[900] },
  closedBar: { gap: spacing[3] },
  closedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  closedText: { ...typography.caption, color: colors.ink[700], flexShrink: 1 },
  msgWrap: { maxWidth: '88%', gap: 4 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  who: { ...typography.caption, color: colors.ink[500] },
  whoStaff: { color: colors.primary[700], fontWeight: '600' },
  bubble: { borderRadius: radii.lg, paddingVertical: spacing[2], paddingHorizontal: spacing[3], gap: spacing[2] },
  mine: { backgroundColor: colors.primary[600] },
  theirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary[100] },
  mineText: { ...typography.body, color: colors.white },
  theirText: { ...typography.body, color: colors.ink[900] },
  composer: { gap: spacing[2] },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1] },
  iconBtn: { padding: spacing[2] },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    ...typography.body,
    color: colors.ink[900],
    backgroundColor: colors.white,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 4,
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.ink[100],
  },
  fileChipText: { ...typography.caption, color: colors.ink[800], flexShrink: 1 },
});
