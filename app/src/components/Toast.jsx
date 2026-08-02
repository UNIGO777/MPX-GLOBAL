import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadows, spacing, typography } from '../theme/index.js';

/**
 * Transient message surface.
 *
 * Provided app-wide so non-screen code can speak to the user — the one that
 * matters is "your session expired", raised by AuthContext when a refresh
 * fails. Returning a user to sign-in with no explanation looks like a crash.
 *
 * Toasts carry user-facing copy only. Never pass a raw error, a token, an OTP
 * or a server payload into one.
 */

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
      setToast(null),
    );
  }, [opacity]);

  const show = useCallback(
    (message, { tone = 'neutral', duration = DEFAULT_DURATION } = {}) => {
      if (!message) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast({ message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timerRef.current = setTimeout(hide, duration);
    },
    [hide, opacity],
  );

  // A pending timer must not fire into an unmounted tree.
  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView toast={toast} opacity={opacity} onPress={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, opacity, onPress }) {
  const insets = useSafeAreaInsets();
  const palette = TONES[toast.tone] ?? TONES.neutral;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { opacity, bottom: insets.bottom + spacing[6] }]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: palette.bg }]}
      >
        <Text style={[typography.body, { color: palette.fg }]}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

const TONES = {
  neutral: { bg: colors.ink[800], fg: colors.white },
  success: { bg: '#05603A', fg: colors.white },
  danger: { bg: colors.danger.DEFAULT, fg: colors.white },
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing[5], right: spacing[5] },
  toast: { padding: spacing[4], borderRadius: radii.md, ...shadows.card },
});
