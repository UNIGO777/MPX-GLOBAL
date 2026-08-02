import { Ionicons } from '@expo/vector-icons';

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
 */
export function tabIcon(name) {
  return function TabBarIcon({ color, size, focused }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;
  };
}
