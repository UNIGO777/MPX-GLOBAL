import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/index.js';
import {
  KYC_STATE_TITLE,
  KYC_STATE_SUBTITLE,
  verificationAttention,
} from '../utils/verificationCopy.js';

/**
 * Condensed verification status card — Home's entry point into the full
 * Verification hub (design brief M1 §9/§13: "a prominent verification card,
 * action per state"). Deliberately dumb: it shows the SAME headline/body as
 * the hub (shared copy, see `verificationCopy.js`) and always taps through to
 * it rather than re-implementing the hub's next-step routing here — the hub
 * already owns the `profileIncomplete` gate and the entity-type-first logic,
 * and duplicating that decision in two places is exactly how they'd drift.
 *
 * Not gated on `verified` — like the hub itself, a verified company can still
 * open this and see its tick and documents.
 */
export function VerificationSummaryCard({ status, verification, onPress }) {
  // 🔴 An outstanding document request or a parked profile change outranks the
  // plain status (2026-08-23). A VERIFIED company can be the one being waited
  // on, and keying off `kycStatus` alone would show "Verified — nothing to do"
  // while a reviewer waits for a document. See `verificationAttention`.
  const attention = verificationAttention(verification);
  const icon = attention
    ? ICON[attention.tone === 'danger' ? 'rejected' : 'submitted']
    : (ICON[status] ?? ICON.pending);

  const title = attention?.title ?? KYC_STATE_TITLE[status] ?? 'Verification';
  const body = attention?.body ?? KYC_STATE_SUBTITLE[status] ?? '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Verification: ${title}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={22} color={icon.fg} accessible={false} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {body}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
    </Pressable>
  );
}

const ICON = {
  pending: { name: 'shield-outline', bg: colors.ink[100], fg: colors.ink[600] },
  submitted: { name: 'time-outline', bg: '#FEF0DC', fg: '#93370D' },
  verified: { name: 'shield-checkmark', bg: '#E7F7EF', fg: '#05603A' },
  rejected: { name: 'alert-circle', bg: colors.danger[50], fg: '#912018' },
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    padding: spacing[4],
  },
  pressed: { backgroundColor: colors.ink[50] },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.label, color: colors.ink[900] },
  subtitle: { ...typography.caption, color: colors.muted },
});
