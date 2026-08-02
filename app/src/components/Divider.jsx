import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/index.js';

/** Hairline rule, optionally with a centred label ("or"). */
export function Divider({ label, style }) {
  if (!label) return <View style={[styles.rule, style]} />;

  return (
    <View style={[styles.labelled, style]}>
      <View style={styles.grow} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.grow} />
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surface.border },
  labelled: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  grow: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.surface.border },
  label: { ...typography.caption, color: colors.muted },
});
