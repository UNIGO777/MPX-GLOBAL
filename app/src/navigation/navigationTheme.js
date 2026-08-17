import { DefaultTheme } from '@react-navigation/native';

import { colors, typography } from '../theme/index.js';

/**
 * React Navigation's theme, driven by the same tokens as everything else, so
 * headers and tab bars match the web rather than falling back to platform blue.
 */
export const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary[600],
    background: colors.surface.DEFAULT,
    card: colors.surface.DEFAULT,
    text: colors.ink[900],
    border: colors.surface.border,
    notification: colors.danger.DEFAULT,
  },
};

/** Shared header treatment — consistent across both role navigators. */
export const screenHeaderOptions = {
  headerStyle: { backgroundColor: colors.surface.DEFAULT },
  headerTintColor: colors.ink[900],
  headerTitleStyle: { ...typography.h3, color: colors.ink[900] },
  headerShadowVisible: false,
};

export const tabBarOptions = {
  tabBarActiveTintColor: colors.primary[600],
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { ...typography.tiny, fontWeight: '600' },
  // tabBarStyle is NOT set here — see `buildTabBarStyle` below.
};

/**
 * 🔴 2026-08-17 (owner-caught bug, "safe area not fixed") — `tabBarStyle`
 * cannot be a static export if it sets an explicit `height`. By default
 * `@react-navigation/bottom-tabs` measures the safe-area bottom inset itself
 * and pads the bar for it automatically (clearing a gesture-nav home
 * indicator) — but the MOMENT a caller sets its own `height`, that automatic
 * behaviour is disabled, and the caller becomes fully responsible for the
 * inset itself. The 2026-08-16 fixed `height: 64` (for the raised-circle
 * active-tab icon) did exactly that and nobody added the inset back — invisible
 * on a 3-button-nav device (inset is 0 there) but would sit the bar's content
 * under a gesture-nav home indicator on any phone that has one.
 *
 * Call this from EACH navigator (`BuyerNavigator`/`ExporterNavigator`) with
 * `useSafeAreaInsets().bottom` — it has to be a hook call in a component, not
 * a static value here, since insets aren't known until render.
 */
export function buildTabBarStyle(insetsBottom = 0) {
  return {
    borderTopColor: colors.surface.border,
    // A touch taller than the platform default (2026-08-16) — the focused
    // tab's icon sits in a raised circle (`tabIcon.jsx`) that needs breathing
    // room above the label so it doesn't crowd the bar's top edge.
    height: 64 + insetsBottom,
    paddingTop: 10,
    paddingBottom: 10 + insetsBottom,
  };
}
