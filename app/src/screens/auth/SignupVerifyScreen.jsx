import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { OtpInput } from '../../components/OtpInput.jsx';
import { useToast } from '../../components/Toast.jsx';
import { colors, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { validateOtp } from '../../utils/validation.js';
import { signupDraft } from './signupDraft.js';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const EXPIRY_SECONDS = 5 * 60;

/**
 * Screen 7b · Signup verification — BOTH channels, email first then phone, one
 * at a time (owner decision: two sequential steps rather than one combined
 * screen).
 *
 * Why it exists: signup used to create the account and only then send a single
 * MOBILE code, so the email was never proved at all. Since `(email, role)` and
 * `(mobile, role)` are uniquely indexed, that let a stranger's address be
 * permanently taken. Nothing exists server-side until both of these pass and the
 * company step completes.
 *
 * The two codes are INDEPENDENT challenges — separate expiry, separate resend
 * cooldown, separate attempt lock. Five wrong email codes lock the email step
 * only; the phone step is untouched.
 */
export function SignupVerifyScreen({ navigation, route }) {
  const portal = route.params?.portal ?? 'buyer';
  const toast = useToast();

  // The token lives in the in-memory holder, never a navigation param
  // (signupDraft.js). Read once — a re-read after `clear()` would be undefined.
  const draftRef = useRef(signupDraft.get());
  const draft = draftRef.current;

  // 'email' → 'mobile'. Advanced only by a SERVER-confirmed verification, never
  // by the client deciding it is done.
  const [channel, setChannel] = useState('email');
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

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reached without completing step 1 (a deep link, or a back-navigation after
  // the draft was cleared) — there is nothing to verify.
  useEffect(() => {
    if (!draft?.signupToken) navigation.replace('SignupAccount', { portal });
  }, [draft, navigation, portal]);

  const isEmail = channel === 'email';

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
        const state = await authApi.signupVerify({
          signupToken: draft.signupToken,
          channel,
          code: value,
        });
        if (!mountedRef.current) return;

        if (state.complete) {
          navigation.navigate('SignupCompany', { portal });
          return;
        }
        if (channel === 'email' && state.emailVerified) {
          setChannel('mobile');
          setCode('');
          setCooldown(RESEND_COOLDOWN_SECONDS);
          // The phone code was issued back at step 1, alongside the email one,
          // so its clock started then — do NOT reset `expiresIn` here or the
          // screen would promise time the server will not honour.
          toast.show('Email verified. Now the code we sent to your phone.', { tone: 'success' });
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setError(toAppError(err));
        // Clear the boxes so the next attempt starts clean.
        setCode('');
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [channel, code, draft, navigation, portal, toast],
  );

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      await authApi.signupResend({ signupToken: draft.signupToken, channel });
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
  // Already masked by the server — this screen never holds the raw address.
  const destinationLabel = isEmail ? draft?.email : draft?.mobile;

  return (
    <NavyCanopy
      eyebrow={isEmail ? 'STEP 2 OF 4' : 'STEP 3 OF 4'}
      title={isEmail ? 'Verify your email' : 'Verify your phone'}
      subtitle={`We sent a ${CODE_LENGTH}-digit code to ${destinationLabel}`}
      onBack={() => navigation.goBack()}
      footer={
        <Button
          label={isEmail ? 'Verify email' : 'Verify phone'}
          onPress={() => submit()}
          loading={submitting}
          disabled={submitting || code.length !== CODE_LENGTH}
        />
      }
    >
      <View style={styles.body}>
        <FormError error={error} />

        {/* Progress is spelled out, not signalled by colour alone. */}
        <View style={styles.steps} accessibilityLabel="Verification progress">
          <Text style={[styles.step, !isEmail && styles.stepDone]}>
            {isEmail ? '1. Email' : '1. Email ✓'}
          </Text>
          <Text style={[styles.step, !isEmail && styles.stepActive]}>2. Phone</Text>
        </View>

        <OtpInput
          // Remount per channel so the boxes clear and focus moves to the new
          // step rather than keeping the previous code's cursor.
          key={channel}
          value={code}
          onChange={setCode}
          onComplete={submit}
          length={CODE_LENGTH}
          disabled={submitting}
          autoFocus
        />

        {expired ? (
          <Text style={styles.expired}>This code has expired. Request a new one to continue.</Text>
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
  steps: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3] },
  step: { ...typography.caption, color: colors.muted },
  stepActive: { color: colors.primary[600] },
  stepDone: { color: colors.success ?? colors.primary[600] },
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
  linkDisabled: { color: colors.muted },
});
