import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';

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

/**
 * The AI tab's icon — the ONE permanently-raised tab (owner, 2026-08-20:
 * "one more tab in center for ai… good looking also highlighted").
 *
 * Every other tab earns its raised circle only when focused; this one always
 * wears it, which is exactly what marks it as the bar's primary action rather
 * than a fifth peer. It sits at index 2 of five, so the lift reads as
 * deliberate centre-stage rather than a tab that forgot to settle.
 *
 * Bigger circle, deeper lift and a stronger glow than `tabIcon`'s focused
 * state — the difference has to be visible while ANOTHER tab is focused and
 * wearing its own circle, or the two read as the same thing.
 */
export function aiTabIcon() {
  return function AiTabIcon({ focused }) {
    // 🔴 Deliberately NOT the press-bounce every other tab uses (owner,
    // 2026-08-20: "not like other tabs click animation"). This is a slow
    // radar PULSE that runs on its own — a halo expanding out of the circle
    // and fading — so the tab advertises itself while you are elsewhere,
    // rather than only reacting once you have already tapped it.
    //
    // It STOPS while focused: an attention-getter still pulsing after you
    // have arrived is just noise. Transform + opacity only, so it runs on
    // the native driver and never touches the JS thread.
    const pulse = useRef(new Animated.Value(0)).current;
    const [reduceMotion, setReduceMotion] = useState(false);

    // Honour the OS "reduce motion" setting — a looping animation is exactly
    // what that switch exists to silence (web-design.md says the same).
    useEffect(() => {
      let alive = true;
      AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
      const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
      return () => {
        alive = false;
        sub?.remove?.();
      };
    }, []);

    useEffect(() => {
      if (focused || reduceMotion) {
        pulse.setValue(0);
        return undefined;
      }
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
          // Snap back invisibly, then rest — a ping every ~2.4s, not a strobe.
          Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(800),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }, [focused, reduceMotion, pulse]);

    return (
      <View style={styles.aiOuter}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.aiHalo,
            {
              opacity: pulse.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.4, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.5] }) }],
            },
          ]}
        />
        <View style={[styles.aiCircle, focused && styles.aiCircleFocused]}>
          <Ionicons name="sparkles" size={22} color={colors.white} />
        </View>
      </View>
    );
  };
}

/**
 * The AI tab's BUTTON — a plain `Pressable` replacing React Navigation's
 * default `PlatformPressable`.
 *
 * 🔴 Owner, 2026-08-20: "remove normal animation of clicking animation on ai
 * search tab". The default tab button fades its whole content on press (iOS)
 * and draws an Android ripple, both of which fought the raised circle: the
 * ripple is a rectangle clipped to the tab's box, so it painted a grey square
 * across a circular, overhanging icon.
 *
 * The pulse in `aiTabIcon` is this tab's only motion now — which is the point:
 * it advertises itself on its own rather than reacting to a tap the user has
 * already committed to.
 */
export function aiTabButton(props) {
  const { children, style, onPress, onLongPress, accessibilityState, accessibilityLabel, testID } = props;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      // Both are required: `android_ripple={null}` kills the square ripple,
      // and Pressable (unlike the default) does not dim its children.
      android_ripple={null}
      style={style}
    >
      {children}
    </Pressable>
  );
}

const CIRCLE = 40;
const AI_CIRCLE = 52;

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

  // A white ring around the circle so the lift reads against the bar's own
  // top border — without it the circle looks glued to the edge rather than
  // floating over it.
  aiOuter: {
    width: AI_CIRCLE + 8,
    height: AI_CIRCLE + 8,
    borderRadius: radii.full,
    backgroundColor: colors.surface.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifted further (owner, 2026-08-20: "thoda or upar utha do"). This is
    // about as far as it can go before the circle's top clears the bar
    // entirely and starts overlapping page content instead of straddling
    // the edge, which is the effect that makes it read as attached.
    marginTop: -28,
  },
  // The pulse itself — sits BEHIND the circle and is never tappable.
  aiHalo: {
    position: 'absolute',
    width: AI_CIRCLE,
    height: AI_CIRCLE,
    borderRadius: radii.full,
    backgroundColor: colors.primary[400],
  },
  aiCircle: {
    width: AI_CIRCLE,
    height: AI_CIRCLE,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary[700],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  // Focused: darker fill + tighter, stronger shadow — pressed-in rather than
  // bigger, so the bar's height never shifts between tabs.
  aiCircleFocused: {
    backgroundColor: colors.primary[700],
    shadowOpacity: 0.55,
    shadowRadius: 14,
  },
});
