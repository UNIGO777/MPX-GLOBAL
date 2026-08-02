import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Password strength meter.
 *
 * ⚠️ This is UX guidance, not a security control. The authoritative rule is the
 * backend's (`auth.validators.js`: minimum 8 characters), and the password is
 * hashed with argon2id server-side. Nothing here gates submission beyond the
 * server's own minimum, and the password never leaves the component tree — it
 * is not logged, not measured remotely, not persisted.
 */

export const PASSWORD_MIN_LENGTH = 8;

const LEVELS = [
  { label: 'Too short', color: colors.surface.border },
  { label: 'Weak', color: colors.danger.DEFAULT },
  { label: 'Fair', color: colors.warning },
  { label: 'Good', color: colors.primary[600] },
  { label: 'Strong', color: colors.success },
];

/** @returns {number} 0–4 */
export function scorePassword(password) {
  if (!password || password.length < PASSWORD_MIN_LENGTH) return 0;

  let score = 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 14 && score < 4) score += 1;

  return Math.min(score, 4);
}

export function PasswordStrength({ password, style }) {
  const score = scorePassword(password);
  const level = LEVELS[score];

  // Nothing to say before the user has typed.
  if (!password) return null;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[styles.bar, { backgroundColor: step <= score ? level.color : colors.ink[200] }]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: score === 0 ? colors.muted : level.color }]}>
        {level.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  bars: { flex: 1, flexDirection: 'row', gap: spacing[1] },
  bar: { flex: 1, height: 4, borderRadius: radii.full },
  label: { ...typography.tiny, fontWeight: '600', minWidth: 64, textAlign: 'right' },
});
