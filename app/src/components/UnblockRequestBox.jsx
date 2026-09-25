import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { sellerProductsApi } from '../api/sellerProducts.js';
import { colors, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';
import { Button } from './Button.jsx';
import { Input } from './Input.jsx';

/**
 * D6 · "Request unblock" on a taken-down product — the app twin of the web's
 * `UnblockRequest` (owner, 2026-09-25: build it for the app too).
 *
 * The seller only ASKS; MPX staff approve (the product comes back) or decline
 * with a reason. One request at a time, a 7-day wait after a decline. The
 * server enforces every rule — this renders what it returns and shows its
 * refusals verbatim. 🔴 A9: never who decided (the server doesn't send it).
 *
 * No push or in-app notice here: the app notification centre is still guarded
 * (owner: "no app touch"), so the app shows the status on the product only.
 */
function day(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function UnblockRequestBox({ productId, request, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [now] = useState(() => Date.now());

  const status = request?.status ?? null;
  const waitUntil = request?.canAskAgainAt ? new Date(request.canAskAgainAt) : null;
  const mustWait = status === 'rejected' && waitUntil && waitUntil.getTime() > now;
  const canAsk = status !== 'pending' && !mustWait;
  const ok = message.trim().length >= 10;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const product = await sellerProductsApi.requestUnblock(productId, message.trim());
      setOpen(false);
      setMessage('');
      onUpdated?.(product);
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      {status === 'pending' ? (
        <Text style={styles.text}>
          <Text style={styles.strong}>Unblock requested {day(request.at)}.</Text> The MPX team will review it.
          It won’t be deleted while it’s waiting.
        </Text>
      ) : null}
      {status === 'rejected' ? (
        <View style={styles.gap}>
          <Text style={[styles.text, styles.strong]}>Your unblock request was declined {day(request.decidedAt)}.</Text>
          {request.rejectReason ? <Text style={styles.text}>{request.rejectReason}</Text> : null}
          {mustWait ? <Text style={styles.muted}>You can ask again from {day(waitUntil)}.</Text> : null}
        </View>
      ) : null}
      {canAsk ? (
        <View style={styles.gap}>
          <Text style={styles.text}>Fixed the problem? Ask the MPX team to put it back.</Text>
          <Button
            label="Request unblock"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => {
              setError(null);
              setOpen(true);
            }}
          />
        </View>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Ask for this product to be unblocked</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.ink[600]} />
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Input
            label="What did you change?"
            value={message}
            onChangeText={setMessage}
            placeholder="Tell the team what you fixed"
            helperText={`At least 10 characters · ${message.length}/1000`}
            maxLength={1000}
            multiline
          />

          <Text style={styles.muted}>
            The product stays down until the team approves it. If they decline, you’ll see why and can ask
            again after 7 days.
          </Text>

          <Button label="Send request" onPress={send} loading={busy} disabled={!ok} />
          <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.danger[200],
    gap: spacing[2],
  },
  gap: { gap: spacing[2], alignItems: 'flex-start' },
  text: { ...typography.caption, color: colors.ink[800] },
  strong: { fontWeight: '700' },
  muted: { fontSize: 12, color: colors.ink[500], lineHeight: 18 },
  error: { fontSize: 13, color: colors.danger.DEFAULT },
  sheet: { padding: spacing[4], paddingBottom: spacing[6], gap: spacing[3], backgroundColor: colors.white, flexGrow: 1 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  sheetTitle: { ...typography.h2, color: colors.ink[900], flex: 1 },
});
