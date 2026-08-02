import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { OtpInput } from '../../components/OtpInput.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { colors, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { maskDestination } from '../../utils/mask.js';
import { validateOtp } from '../../utils/validation.js';

/**
 * Screen 4 · OTP verify.
 *
 * Two contexts reach this screen — after login and after signup — because both
 * end in the same `{ loginToken, method }` challenge and both complete through
 * `POST /auth/verify-otp`.
 *
 * The brief calls for a third context, password reset. That one is NOT routed
 * here: `POST /auth/reset-password` takes the code and the new password in a
 * single call, so its code entry lives on the reset screen using the same
 * `OtpInput` primitive. Sending it here would mean holding a reset code in
 * navigation state while the user walks to another screen.
 *
 * 🔴 No "attempts remaining" counter anywhere (brief rule 4). The backend locks
 * the account after five failures; the screen shows the server's lockout
 * message and nothing that helps an attacker count down to it.
 *
 * Verifying establishes the session, so there is no success navigation here —
 * `RootNavigator` swaps the whole tree once `isAuthenticated` flips.
 */

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const EXPIRY_SECONDS = 5 * 60; // matches the backend's 5-minute OTP window

export function OtpScreen({ navigation, route }) {
  const { loginToken, destination, context = 'login' } = route.params ?? {};
  const { verifyOtp } = useAuth();
  const toast = useToast();

  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [expiresIn, setExpiresIn] = useState(EXPIRY_SECONDS);

  // One interval drives both counters; a second timer would drift against it.
  useEffect(() => {
    const id = setInterval(() => {
      setCooldown((v) => (v > 0 ? v - 1 : 0));
      setExpiresIn((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Guards a state update if verification resolves after the tree has swapped.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const submit = useCallback(
    async (submittedCode) => {
      const value = submittedCode ?? code;
      const invalid = validateOtp(value, CODE_LENGTH);
      if (invalid) {
        setError({ message: invalid });
        return;
      }

      setError(null);
      setSubmitting(true);
      try {
        await verifyOtp({ loginToken, code: value });
        // Success: AuthContext flips isAuthenticated and RootNavigator takes over.
      } catch (err) {
        if (!mountedRef.current) return;
        setError(toAppError(err));
        // Clear the boxes so the next attempt starts clean rather than the user
        // having to backspace six times.
        setCode('');
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [code, loginToken, verifyOtp],
  );

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      await authApi.resendOtp({ loginToken });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setExpiresIn(EXPIRY_SECONDS);
      setCode('');
      toast.show('A new code has been sent.', { tone: 'success' });
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setResending(false);
    }
  };

  const expired = expiresIn === 0;
  const canResend = cooldown === 0 && !resending && !submitting;

  // 🔴 The backend ALWAYS delivers the OTP to the account's mobile
  // (`auth.service.js` passes `channel: 'mobile'` on every path), even when the
  // user signed in with an email. Echoing the typed email here would send them
  // to their inbox to wait for something that will never arrive.
  //
  // So: if we know the destination is a mobile, mask and show it. If the user
  // identified themselves by email we do NOT know their number — and must not
  // guess — so the copy names the channel without the value.
  const destinationLabel =
    destination && !String(destination).includes('@')
      ? maskDestination(destination)
      : 'the mobile number registered on your account';

  return (
    <NavyCanopy
      eyebrow={context === 'signup' ? 'STEP 2 OF 2' : undefined}
      title="Verify it's you"
      subtitle={`We sent a ${CODE_LENGTH}-digit code to ${destinationLabel}`}
      onBack={() => navigation.goBack()}
      footer={
        <Button
          label="Verify"
          onPress={() => submit()}
          loading={submitting}
          disabled={submitting || code.length !== CODE_LENGTH}
        />
      }
    >
      {/* The keypad opens immediately on this screen, so the boxes must sit in
          the upper half of the sheet — hence no leading spacer here. */}
      <View style={styles.body}>
        <FormError error={error} />

        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={submit}
          length={CODE_LENGTH}
          disabled={submitting}
          autoFocus
        />

        {expired ? (
          <Text style={styles.expired}>
            This code has expired. Request a new one to continue.
          </Text>
        ) : (
          <Text style={styles.countdown}>Code expires in {formatDuration(expiresIn)}</Text>
        )}

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn&apos;t get it?</Text>
          <Pressable
            onPress={resend}
            disabled={!canResend}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canResend }}
          >
            <Text style={[styles.link, !canResend && styles.linkDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </View>
    </NavyCanopy>
  );
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  countdown: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  expired: { ...typography.caption, color: colors.warning, textAlign: 'center' },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  resendLabel: { ...typography.caption, color: colors.ink[700] },
  link: { ...typography.label, color: colors.primary[600] },
  linkDisabled: { color: colors.ink[400] },
});
