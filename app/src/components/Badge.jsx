import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Status pill.
 *
 * 🔴 Verification rule (CLAUDE.md, design brief §1.2): there is ONE badge — a
 * verified tick, shown when the server says `verified` is true. There is no
 * "not verified" badge, no red cross, no rejection reason on any public
 * surface. Absence of the tick is the only signal.
 *
 * `VerifiedBadge` below is the sanctioned way to render it, so no screen has to
 * decide the rule for itself. Never drive it from a raw `kycStatus`.
 */
export function Badge({ label, tone = 'neutral', style }) {
  const palette = TONES[tone] ?? TONES.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[typography.label, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * @param {boolean} verified  server-derived flag — NOT a kycStatus string
 * @param {string}  [since]   optional pre-formatted date, e.g. "Mar 2026"
 */
export function VerifiedBadge({ verified, since, style }) {
  if (!verified) return null;
  return <Badge label={since ? `✓ Verified since ${since}` : '✓ Verified'} tone="success" style={style} />;
}

const TONES = {
  neutral: { bg: colors.ink[100], fg: colors.ink[700] },
  success: { bg: '#E7F7EF', fg: '#05603A' },
  warning: { bg: '#FEF0DC', fg: '#93370D' },
  danger: { bg: colors.danger[50], fg: '#912018' },
  info: { bg: colors.primary[50], fg: colors.primary[800] },
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
  },
});
