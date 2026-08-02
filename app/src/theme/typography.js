import { Platform } from 'react-native';

/**
 * Type ramp — the web's Inter scale adapted to mobile sizes.
 *
 * The system font is used deliberately: bundling Inter costs startup time and a
 * font-loading state on every screen. If the owner requires exact brand type on
 * mobile, that is a deliberate change here (add `expo-font`), not a per-screen
 * override.
 */
const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const fontFamilyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export const typography = {
  fontFamily,
  fontFamilyMedium,

  // display — screen titles
  display: { fontFamily: fontFamilyMedium, fontSize: 28, lineHeight: 36, fontWeight: '700' },
  h1: { fontFamily: fontFamilyMedium, fontSize: 24, lineHeight: 32, fontWeight: '700' },
  h2: { fontFamily: fontFamilyMedium, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  h3: { fontFamily: fontFamilyMedium, fontSize: 17, lineHeight: 24, fontWeight: '600' },

  // body
  body: { fontFamily, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontFamily: fontFamilyMedium, fontSize: 15, lineHeight: 22, fontWeight: '600' },

  // supporting
  label: { fontFamily: fontFamilyMedium, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  tiny: { fontFamily, fontSize: 11, lineHeight: 16, fontWeight: '400' },
};
