import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme/index.js';

/**
 * Every screen's outer shell. Built first, on purpose: keyboard handling is a
 * design requirement on mobile, not a bug fix, and safe areas are not optional
 * on notched devices. Screens inherit both by using this instead of a bare View.
 *
 * @param {boolean} scroll     content scrolls (default) — set false for a screen that manages its own list
 * @param {node}    footer     pinned above the keyboard and the home indicator; where a primary button belongs
 * @param {boolean} padded     apply the standard horizontal gutter (default true)
 */
export function ScreenContainer({
  children,
  scroll = true,
  footer = null,
  padded = true,
  contentContainerStyle,
  style,
}) {
  const insets = useSafeAreaInsets();

  const contentStyle = [
    padded && styles.padded,
    scroll && styles.scrollContent,
    contentContainerStyle,
  ];

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }, style]}>
      {/* `padding` on both platforms — see the note in NavyCanopy.jsx: Expo's
          edge-to-edge Android window does not shrink under the keyboard, so
          relying on `adjustResize` alone leaves the footer unreachable. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {body}
        {footer ? (
          <View
            style={[
              styles.footer,
              // Clear the home indicator, but keep a sensible minimum on
              // devices that report no bottom inset.
              { paddingBottom: Math.max(insets.bottom, spacing[4]) },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing[5] },
  scrollContent: { flexGrow: 1, paddingVertical: spacing[5] },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },
});
