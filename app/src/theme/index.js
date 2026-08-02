import { Platform } from 'react-native';

import { colors } from './colors.js';
import { spacing, radii, MIN_TOUCH_TARGET } from './spacing.js';
import { typography } from './typography.js';

/**
 * The one card elevation the "Precision" spec allows — soft and navy-tinted, so
 * it reads the same as the web's `shadow-card`.
 */
export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: colors.ink[900],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 20,
    },
    android: { elevation: 2 },
    default: {},
  }),
};

export const theme = { colors, spacing, radii, typography, shadows, MIN_TOUCH_TARGET };

export { colors, spacing, radii, typography, MIN_TOUCH_TARGET };
