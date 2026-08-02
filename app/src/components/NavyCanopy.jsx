import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandWordmark } from './BrandMark.jsx';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';

/**
 * Direction B1 · "Navy Canopy" — the chosen visual direction (owner, 2026-08-02).
 *
 * Navy occupies the top third and carries the wordmark, screen title and any
 * context (portal identity, step indicator). A white sheet with a large corner
 * radius rises over it and holds the form.
 *
 * Keyboard behaviour is the reason the navy block sits INSIDE the ScrollView
 * rather than pinned above it: when the keyboard opens the canopy scrolls away,
 * so the focused input and its primary button stay reachable on a 375pt phone.
 * The footer is pinned outside the scroll area so the primary action never
 * hides behind the keyboard.
 *
 * @param {string} title       large heading, on navy
 * @param {string} subtitle    supporting line, on navy
 * @param {string} eyebrow     small caps line above the title, e.g. "STEP 1 OF 2"
 * @param {func}   onBack      renders the back affordance when provided
 * @param {node}   footer      pinned above the keyboard and home indicator
 * @param {'plain'|'subtle'} sheetTone  white (default) or the pale canvas tint
 */
export function NavyCanopy({
  title,
  subtitle,
  eyebrow,
  onBack,
  footer,
  children,
  sheetTone = 'plain',
  showWordmark = true,
}) {
  const insets = useSafeAreaInsets();
  const sheetBackground = sheetTone === 'subtle' ? colors.ink[50] : colors.surface.DEFAULT;

  return (
    <View style={styles.root}>
      {/* `padding` on BOTH platforms. Android's `adjustResize` alone is not
          enough here: Expo draws edge-to-edge (transparent system bars), so the
          window does not actually shrink under the keyboard and a pinned footer
          would sit behind it — leaving the primary button unreachable, which is
          exactly what the brief forbids. Verified on a device. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.canopy, { paddingTop: insets.top + spacing[2] }]}>
            <View style={styles.bar}>
              {onBack ? (
                <Pressable
                  onPress={onBack}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.white} />
                </Pressable>
              ) : (
                <View style={styles.backButton} />
              )}

              {showWordmark ? <BrandWordmark /> : <View />}

              {/* Balances the back button so the wordmark stays optically centred. */}
              <View style={styles.backButton} />
            </View>

            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={[styles.sheet, { backgroundColor: sheetBackground }]}>{children}</View>
        </ScrollView>

        {footer ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: sheetBackground,
                paddingBottom: Math.max(insets.bottom, spacing[4]),
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const SHEET_RADIUS = 28;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary[800] },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  canopy: {
    backgroundColor: colors.primary[800],
    paddingHorizontal: spacing[5],
    // The sheet rises over the canopy by SHEET_RADIUS, so the VISIBLE gap under
    // the subtitle is (paddingBottom − SHEET_RADIUS). At spacing[8] that left
    // only 4px and the description read as touching the sheet edge.
    paddingBottom: spacing[12] + SHEET_RADIUS,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
  },
  backButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  eyebrow: {
    ...typography.label,
    color: colors.primary[200],
    letterSpacing: 1.2,
    marginBottom: spacing[2],
  },
  title: { ...typography.display, color: colors.white },
  subtitle: {
    ...typography.body,
    color: colors.primary[100],
    marginTop: spacing[2],
    maxWidth: 320,
  },

  sheet: {
    flexGrow: 1,
    marginTop: -SHEET_RADIUS,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
  },
});
