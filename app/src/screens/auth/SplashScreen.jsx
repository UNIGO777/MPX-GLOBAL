import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button.jsx';
import { BrandMark } from '../../components/BrandMark.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';

/**
 * Screen 1 · Splash / session restore.
 *
 * Held on screen while `AuthContext` restores the session, so a returning user
 * never sees the sign-in screen flash past. It renders no controls in the
 * loading state on purpose — there is nothing to do but wait.
 *
 * The offline state is the important one: a dropped network during restore must
 * end in a message and a retry, never an indefinite hang.
 */
export function SplashScreen({ offline = false, onRetry }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (offline) return undefined;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [offline, progress]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['15%', '100%'] });

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <BrandMark />
        <Text style={styles.brand}>MPX Global</Text>
        <Text style={styles.tagline}>INSTITUTIONAL B2B NETWORK</Text>
      </View>

      <View style={styles.bottom}>
        {offline ? (
          <>
            <Text style={styles.offlineTitle}>You&apos;re offline</Text>
            <Text style={styles.offlineBody}>
              We couldn&apos;t reach MPX Global. Check your connection and try again.
            </Text>
            {onRetry ? (
              <Button label="Try again" onPress={onRetry} variant="secondary" style={styles.retry} />
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.track}>
              <Animated.View style={[styles.bar, { width: barWidth }]} />
            </View>
            <Text style={styles.status}>SECURING GLOBAL GATEWAY…</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary[800],
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[12],
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  brand: { ...typography.display, color: colors.white, marginTop: spacing[2] },
  tagline: {
    ...typography.caption,
    color: colors.primary[200],
    letterSpacing: 2,
    marginTop: -spacing[2],
  },

  bottom: { alignItems: 'center', gap: spacing[3], minHeight: 96, justifyContent: 'flex-end' },
  track: {
    width: '60%',
    height: 2,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  bar: { height: 2, borderRadius: radii.full, backgroundColor: colors.white },
  status: { ...typography.tiny, color: colors.primary[200], letterSpacing: 2 },

  offlineTitle: { ...typography.h3, color: colors.white },
  offlineBody: { ...typography.caption, color: colors.primary[100], textAlign: 'center' },
  retry: { marginTop: spacing[2], alignSelf: 'stretch' },
});
