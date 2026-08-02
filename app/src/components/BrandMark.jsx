import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../theme/index.js';

/**
 * The white rounded tile carrying the network glyph, as drawn on the splash.
 * One definition so the mark cannot drift between screens.
 */
export function BrandMark({ size = 116, tilted = true }) {
  const glyph = Math.round(size * 0.52);

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.28 },
        // The mockup's slight rotation. Purely decorative, so it is hidden from
        // the accessibility tree along with the rest of the mark.
        tilted && { transform: [{ rotate: '-8deg' }] },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <MaterialCommunityIcons
        name="graph-outline"
        size={glyph}
        color={colors.primary[800]}
        style={tilted ? { transform: [{ rotate: '8deg' }] } : null}
      />
    </View>
  );
}

/** The "MPX" wordmark used in the navy header bar. */
export function BrandWordmark({ tone = 'onNavy', style }) {
  return (
    <Text
      style={[
        styles.wordmark,
        { color: tone === 'onNavy' ? colors.white : colors.primary[800] },
        style,
      ]}
      accessibilityRole="header"
    >
      MPX
    </Text>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  wordmark: {
    ...typography.h2,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
});
