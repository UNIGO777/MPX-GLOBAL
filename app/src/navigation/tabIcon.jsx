import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '../theme/index.js';

/**
 * Builds a `tabBarIcon` renderer for a bottom-tab screen.
 *
 * Bottom tabs need an icon: React Navigation draws a placeholder glyph when one
 * is missing, which renders as an empty box on Android. Labels alone are not
 * enough — the placeholder is not "no icon", it is a broken icon.
 *
 * Filled when focused, outline when not — the standard iOS/Android idiom, and
 * it means the active tab is signalled by shape as well as colour rather than
 * by colour alone.
 *
 * 🆕 2026-08-16 — the FOCUSED icon sits inside a raised, filled circle (owner
 * mockup) instead of just recolouring — shared by every `<Tab.Screen>` on both
 * navigators (this is the one `tabIcon` helper both use), so all five tabs get
 * the same treatment consistently rather than a one-off for Profile.
 */
export function tabIcon(name) {
  return function TabBarIcon({ color, size, focused }) {
    if (!focused) {
      return <Ionicons name={`${name}-outline`} size={size} color={color} />;
    }
    return (
      <View style={styles.activeCircle}>
        <Ionicons name={name} size={size} color={colors.white} />
      </View>
    );
  };
}

const CIRCLE = 40;

const styles = StyleSheet.create({
  activeCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10, // lifts the active tab above the bar's baseline
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
});
