import { Image, StyleSheet, View } from 'react-native';

import { colors, radii } from '../theme/index.js';

/**
 * The brand, from the real logo files — never redrawn.
 *
 * Both components used to fake it: `BrandMark` was a vector glyph in a rounded
 * tile and `BrandWordmark` was the literal text "MPX". Neither matched the
 * supplied artwork, so every screen carried a slightly different brand. These
 * now render `assets/ColoredLogo.jpg` / `assets/LogoWhite.png` and nothing else.
 *
 * ⚠️ The two files are NOT interchangeable:
 * - `LogoWhite.png` is white on TRANSPARENT — it vanishes on a light surface and
 *   must only sit on navy.
 * - `ColoredLogo.jpg` is a JPG, so it carries a WHITE BACKGROUND it cannot shed.
 *   On navy it would show as a white rectangle; it belongs on white/light only.
 *
 * That is why `tone` exists, and why the plate below stays white — a white plate
 * is what lets the coloured lockup sit on a navy screen without a visible seam.
 */
const COLOURED = require('../../assets/ColoredLogo.jpg');
const WHITE = require('../../assets/LogoWhite.png');

// The artwork is a wide lockup (wordmark with "GLOBAL" beneath).
const LOCKUP_RATIO = 2.6;

/**
 * 🔴 Both source files are mostly EMPTY MARGIN — the mark occupies roughly a
 * third of a 2000×1125 canvas, centred. `resizeMode: contain` fits that whole
 * canvas, so the visible logo came out about a third of the size the caller
 * asked for (on device it read as a speck inside a big white tile).
 *
 * The fix is to render the image deliberately OVERSIZED and let a clipping
 * wrapper cut the margin away. Clipping is invisible here because the margin is
 * white and so is every surface the coloured file sits on.
 *
 * If a tightly-cropped export of the artwork ever lands, drop this zoom back to
 * 1 rather than compensating twice.
 */
const ART_ZOOM = 3;

/**
 * The logo on its own plate — splash, welcome, anywhere it is the hero.
 * `size` is the plate's height.
 */
export function BrandMark({ size = 116, tilted = true, tone = 'onNavy' }) {
  // On navy the white artwork sits straight on the background — the white plate
  // existed only to give the COLOURED (JPG, opaque-white) file something to sit
  // on. Keeping the plate here would box the logo in for no reason.
  if (tone === 'onNavy') {
    // A WIDE box, not a square: the artwork is a wide lockup, so a square box
    // wasted most of its width on the transparent margin and the mark came out
    // small. The margin here is transparent (PNG), so it costs nothing visually
    // and needs no clipping — only the box has to be generous enough.
    return (
      <Image
        source={WHITE}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="MPX Global"
        style={{ width: size * 6, height: size * 3.4 }}
      />
    );
  }

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.28 },
        tilted && { transform: [{ rotate: '-8deg' }] },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={COLOURED}
        resizeMode="contain"
        style={[
          // Oversized on purpose — the plate's `overflow: hidden` crops the
          // artwork's white margin so the mark itself fills the tile.
          { width: size * ART_ZOOM, height: size * ART_ZOOM },
          tilted && { transform: [{ rotate: '8deg' }] },
        ]}
      />
    </View>
  );
}

/**
 * The inline lockup used in headers. `tone` picks the artwork, so a caller can
 * never land the transparent-white file on a white surface.
 */
export function BrandWordmark({ tone = 'onNavy', height = 30, style }) {
  const w = height * LOCKUP_RATIO;
  return (
    <View
      style={[styles.lockup, { height, width: w }, style]}
      accessibilityRole="image"
      accessibilityLabel="MPX Global"
    >
      <Image
        source={tone === 'onNavy' ? WHITE : COLOURED}
        resizeMode="contain"
        // Same trick as the plate: zoom past the artwork's empty margin, and let
        // the wrapper clip it back to the intended box.
        style={{ height: height * ART_ZOOM, width: w * ART_ZOOM }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    // Kept white on purpose: the coloured artwork is a JPG and brings its own
    // white background, so the plate hides that edge rather than fighting it.
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    // Required: the artwork inside is 3x the plate so its margin can be cropped.
    overflow: 'hidden',
  },
});
