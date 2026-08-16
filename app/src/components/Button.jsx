import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';

/**
 * Button — primary | secondary | ghost | danger, with loading and disabled.
 *
 * A loading button is also disabled: every form submit in this app must be
 * un-double-tappable, because a duplicate OTP verify or signup is a real bug,
 * not a cosmetic one.
 *
 * `icon` (optional, 2026-08-16): an Ionicons name rendered before the label.
 * Additive — every existing call site omits it and renders exactly as before.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityHint,
  style,
}) {
  const isInactive = disabled || loading;
  const palette = VARIANTS[variant] ?? VARIANTS.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        SIZES[size] ?? SIZES.md,
        { backgroundColor: palette.bg, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        pressed && !isInactive && { backgroundColor: palette.bgPressed },
        isInactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={palette.fg} accessible={false} /> : null}
          <Text numberOfLines={1} style={[typography.bodyStrong, { color: palette.fg }]}>
            {label}
          </Text>
        </>
      )}
      {/* Reserves the label's slot while the spinner shows, so the button does
          not resize mid-submit and shift the layout under the user's thumb. */}
      {loading ? <View style={styles.spacer} /> : null}
    </Pressable>
  );
}

const VARIANTS = {
  primary: {
    bg: colors.primary[600],
    bgPressed: colors.primary[700],
    fg: colors.white,
    border: 'transparent',
  },
  secondary: {
    bg: colors.surface.DEFAULT,
    bgPressed: colors.primary[50],
    fg: colors.primary[700],
    border: colors.primary[600],
  },
  ghost: {
    bg: 'transparent',
    bgPressed: colors.primary[50],
    fg: colors.primary[700],
    border: 'transparent',
  },
  danger: {
    bg: colors.danger.DEFAULT,
    bgPressed: '#B42318',
    fg: colors.white,
    border: 'transparent',
  },
};

const SIZES = {
  sm: { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing[3] },
  md: { minHeight: 48, paddingHorizontal: spacing[5] },
  lg: { minHeight: 54, paddingHorizontal: spacing[6] },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  fullWidth: { alignSelf: 'stretch' },
  inactive: { opacity: 0.5 },
  spacer: { width: 0 },
});
