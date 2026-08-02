import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, shadows, spacing } from '../theme/index.js';

/** Card — white surface on the pale canvas, one allowed elevation. */
export function Card({ children, onPress, padded = true, style }) {
  const content = <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    ...shadows.card,
  },
  padded: { padding: spacing[4] },
  pressed: { opacity: 0.9 },
});
