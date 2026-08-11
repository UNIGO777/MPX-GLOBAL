import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
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
 * 🔴 LAYOUT CHANGED (owner, 2026-08-03): the navy canopy is now STATIC and the
 * white sheet is the only thing that scrolls. Previously the canopy sat inside
 * the ScrollView so it would scroll away when the keyboard opened, keeping the
 * focused input reachable on a 375pt phone. That trade is now reversed by
 * request — the header stays put, and the sheet scrolls within whatever height
 * is left.
 *
 * ⚠️ That trade DID read as too cramped — verified on a Mi A3 (2026-08-03): with
 * the keyboard up, a full-height canopy left the sheet showing exactly ONE field
 * and clipped the next label. So the canopy now COMPACTS while the keyboard is
 * open — subtitle and eyebrow drop out, the title shrinks, the padding tightens
 * — which returns most of that height to the form. The header still never
 * scrolls; it just gets out of the way while typing.
 *
 * Do NOT "simplify" this by putting the canopy back inside the ScrollView: the
 * owner asked for a static header, and this is how a static header stays usable
 * on a short screen.
 *
 * The footer stays pinned outside the scroll area either way, so the primary
 * action never hides behind the keyboard.
 *
 * @param {string} title       large heading, on navy
 * @param {string} subtitle    supporting line, on navy
 * @param {string} eyebrow     small caps line above the title, e.g. "STEP 1 OF 2"
 * @param {func}   onBack      renders the back affordance when provided
 * @param {node}   footer      pinned above the keyboard and home indicator
 * @param {'plain'|'subtle'} sheetTone  white (default) or the pale canvas tint
 * @param {boolean} [refreshing]  pull-to-refresh spinner state — omit both this
 *   and `onRefresh` to leave the sheet non-refreshable (every existing caller)
 * @param {func}   [onRefresh]  enables RefreshControl on the sheet when provided
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
  refreshing = false,
  onRefresh,
}) {
  const insets = useSafeAreaInsets();
  const sheetBackground = sheetTone === 'subtle' ? colors.ink[50] : colors.surface.DEFAULT;

  // `keyboardDidShow` / `keyboardDidHide` rather than the `Will` pair: the `Will`
  // events are iOS-only, and this layout's problem case is Android.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View style={styles.root}>
      {/* `padding` on BOTH platforms. Android's `adjustResize` alone is not
          enough here: Expo draws edge-to-edge (transparent system bars), so the
          window does not actually shrink under the keyboard and a pinned footer
          would sit behind it — leaving the primary button unreachable, which is
          exactly what the brief forbids. Verified on a device. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* STATIC — outside the ScrollView, so it never moves. It only COMPACTS
            while the keyboard is up, to hand that height back to the form. */}
        <View
          style={[
            styles.canopy,
            { paddingTop: insets.top + spacing[2] },
            keyboardOpen && styles.canopyCompact,
          ]}
        >
          <View style={[styles.bar, keyboardOpen && styles.barCompact]}>
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

          {/* Eyebrow and subtitle are orientation, not instruction — once the
              user is typing they have already read them, so they yield first.
              The title stays (shrunk) so the screen never loses its identity. */}
          {eyebrow && !keyboardOpen ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? (
            <Text style={[styles.title, keyboardOpen && styles.titleCompact]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle && !keyboardOpen ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {/* The sheet FRAME is static and owns the rounded top + the overlap onto
            the canopy; only its contents scroll. Putting the radius on the
            scrolling content instead would drag the rounded edge away on the
            first swipe and leave a square white block sitting over the navy.
            `overflow: hidden` is what clips the scrolling children to the curve. */}
        <View style={[styles.sheetFrame, { backgroundColor: sheetBackground }]}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        </View>

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

  canopy: {
    backgroundColor: colors.primary[800],
    paddingHorizontal: spacing[5],
    // The sheet rises over the canopy by SHEET_RADIUS, so the VISIBLE gap under
    // the subtitle is (paddingBottom − SHEET_RADIUS). At spacing[8] that left
    // only 4px and the description read as touching the sheet edge.
    paddingBottom: spacing[12] + SHEET_RADIUS,
    // Static now, so it must not be squeezed when the sheet's content is tall —
    // without this, flex would shrink the header instead of scrolling the sheet.
    flexShrink: 0,
  },
  // Keyboard up: give the height back to the form. The sheet still overlaps by
  // SHEET_RADIUS, so this padding cannot go below it or the title would collide
  // with the sheet's rounded edge.
  canopyCompact: {
    paddingBottom: spacing[3] + SHEET_RADIUS,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
  },
  barCompact: { marginBottom: spacing[2] },
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
  titleCompact: { ...typography.h2, color: colors.white },
  subtitle: {
    ...typography.body,
    color: colors.primary[100],
    marginTop: spacing[2],
    maxWidth: 320,
  },

  // Static frame: owns the curve, the overlap onto the canopy, and the clip.
  sheetFrame: {
    flex: 1,
    marginTop: -SHEET_RADIUS,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: 'hidden',
  },
  // The scrolling part. Padding lives here rather than on the frame so the
  // content can scroll fully under the rounded top edge instead of being
  // clipped with a permanent inset.
  sheetContent: {
    flexGrow: 1,
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
