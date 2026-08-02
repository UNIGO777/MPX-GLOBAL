/**
 * Spacing scale — Tailwind's 4px rhythm, so a `p-4` on web is `spacing[4]` here.
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const radii = {
  none: 0,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

/**
 * Minimum touch target (design brief §1.1). Any pressable smaller than this
 * needs `hitSlop` to make up the difference — hover does not exist here, so a
 * missed tap is a dead end.
 */
export const MIN_TOUCH_TARGET = 44;
