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
  tabBarStyle: { borderTopColor: colors.surface.border },
  tabBarLabelStyle: { ...typography.tiny, fontWeight: '600' },
};
