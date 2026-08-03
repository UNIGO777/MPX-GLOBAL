import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { config } from '../../config.js';
import { ERROR_CODES, apiError, isErrorCode } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { OtpInput } from '../../components/ui/OtpInput.jsx';

const { ttlSeconds: OTP_TTL_SECONDS, resendCooldownSeconds: RESEND_COOLDOWN_SECONDS } = config.otp;

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * A21 signup · verify BOTH channels — email first, then phone, one at a time
 * (owner decision: two sequential screens rather than one combined form).
 *
 * Why this screen exists at all: signup used to create the account and only then
 * send a single MOBILE code, so the email was never proved and a stranger's
 * address could be permanently taken. Nothing exists server-side until both of
 * these pass and the company step completes.
 *
 * The two codes are INDEPENDENT — separate challenges with their own expiry,
 * their own resend cooldown and their own attempt lock. Failing the email code
 * five times locks the email step only; the phone step is untouched.
 *
 * Arrives with router state { signupToken, email, mobile, role, signupPath, next }
 * from step 1. A direct hit with no token goes back to sign-in, exactly like the
 * login OTP screen.
 */
export function SignupVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const flow = location.state ?? {};

  // 'email' → 'mobile'. Advanced only by a server-confirmed verification, never
  // by the client deciding it is done.
  const [channel, setChannel] = useState('email');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionDead, setSessionDead] = useState(false);

  // Deadlines, not tick-counters: a backgrounded tab has its timers throttled,
  // so counting down per tick would claim time remains on an expired code.
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + OTP_TTL_SECONDS * 1000);
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const submitting = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expiresIn = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  if (!flow.signupToken) return <Navigate to="/signin" replace />;

  const isEmail = channel === 'email';
  // Already masked by the server — this screen never holds the raw address.
  const target = isEmail ? flow.email : flow.mobile;

  const advance = () => {
    setChannel('mobile');
    setCode('');
    setNotice('Email verified. Now the code we sent to your phone.');
    // The phone code was issued at step 1 alongside the email one, so its clock
    // started then — do NOT reset the expiry here or the screen would promise
    // time the server will not honour. Only the resend cooldown restarts.
    setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
  };

  const verify = async (submitted = code) => {
    if (submitted.length !== 6 || submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const state = await authApi.signupVerify({
        signupToken: flow.signupToken,
        channel,
        code: submitted,
      });
      setLoading(false);
      submitting.current = false;

      if (state.complete) {
        navigate(flow.next ?? '/signup/company', { replace: true, state: flow });
        return;
      }
      // The SERVER owns which channels are done. Advancing only on the email
      // branch meant a success the server reported any other way (a resumed
      // session, a retry after a dropped response) left the screen sitting
      // there with a stale code and no feedback at all.
      if (channel === 'email' && state.emailVerified) advance();
      else setCode('');
    } catch (err) {
      const { message, code } = apiError(err, 'Invalid or expired code.');
      setErrorCode(code);
      // The signup session has its own lifetime; once it dies the only way
      // forward is starting over, so say that instead of a failing code box.
      if (isErrorCode(err, ERROR_CODES.SIGNUP_SESSION_EXPIRED, /start again/i)) setSessionDead(true);
      setError(message);
      setCode('');
      setLoading(false);
      submitting.current = false;
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    setError(null);
    setNotice(null);
    try {
      await authApi.signupResend({ signupToken: flow.signupToken, channel });
      setNotice('A new code has been sent.');
      setCode('');
      setExpiresAt(Date.now() + OTP_TTL_SECONDS * 1000);
      setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (err) {
      const { message, code } = apiError(err, 'Could not resend the code.');
      setErrorCode(code);
      if (isErrorCode(err, ERROR_CODES.SIGNUP_SESSION_EXPIRED, /start again/i)) setSessionDead(true);
      setError(message);
    }
  };

  const locked = errorCode ? errorCode === ERROR_CODES.OTP_LOCKED : /too many attempts/i.test(error ?? '');
  const backTo = flow.signupPath ?? '/signup/buyer';
  // Exporter signup carries an extra company step, so its rails are longer.
  const totalSteps = flow.role === 'exporter' ? 5 : 4;
  const stepNumber = isEmail ? 2 : 3;

  return (
    <AuthLayout
      headline="Two quick checks, and your account is yours."
      sub="We verify both your email and your phone at signup, so nobody can register an account in your name."
    >
      <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-600">
        Step {stepNumber} of {totalSteps}
      </p>
      <h2 className="mt-1 text-[28px] font-bold text-ink-900">
        {isEmail ? 'Verify your email' : 'Verify your phone'}
      </h2>
      <p className="mt-2 text-sm text-muted">
        We sent a 6-digit code to <span className="font-medium text-ink-800">{target}</span>
      </p>

      {/* Progress is spelled out, not just coloured — colour alone must never be
          the only signal (web-design). */}
      <ol className="mt-4 flex gap-2 text-xs font-medium" aria-label="Verification progress">
        <li
          className={`flex-1 rounded-full px-3 py-1.5 text-center ${
            // `success` is a FLAT token in tailwind.config, not a scale —
            // bg-success-100/text-success-800 compiled to nothing, so the
            // completed step rendered with no fill at all.
            isEmail ? 'bg-primary-100 text-primary-800' : 'bg-emerald-50 text-success'
          }`}
        >
          {isEmail ? '1. Email' : '1. Email ✓'}
        </li>
        <li
          className={`flex-1 rounded-full px-3 py-1.5 text-center ${
            isEmail ? 'bg-ink-100 text-ink-500' : 'bg-primary-100 text-primary-800'
          }`}
        >
          2. Phone
        </li>
      </ol>

      {/* Same rhythm as the other auth screens (owner, 2026-08-02). */}
      <div className="mt-5 space-y-4">
        {notice && !error && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        {sessionDead ? (
          <Button fullWidth onClick={() => navigate(backTo, { replace: true })}>
            Start signup again
          </Button>
        ) : (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-800">
                {isEmail ? 'Email verification code' : 'Phone verification code'}
              </span>
              <OtpInput
                // Remount per channel so the boxes clear and focus moves to the
                // new step rather than keeping the previous code's cursor.
                key={channel}
                autoFocus
                value={code}
                onChange={setCode}
                onComplete={verify}
                disabled={loading || locked}
                error={Boolean(error)}
              />
              <p className="text-[13px] font-medium text-ink-600" aria-live="polite">
                {expiresIn > 0
                  ? `Code expires in ${mmss(expiresIn)}`
                  : 'That code has expired. Request a new one.'}
              </p>
            </div>

            {/* The two pills group tighter to each other than to the code boxes
                — same treatment as the login OTP screen. */}
            <div className="space-y-3 pt-2">
              <Button
                fullWidth
                loading={loading}
                disabled={code.length !== 6 || locked}
                onClick={() => verify()}
              >
                {isEmail ? 'Verify email' : 'Verify phone'}
              </Button>

              <button
                type="button"
                onClick={resend}
                disabled={resendIn > 0 || locked}
                className={`h-12 w-full rounded-full text-sm font-medium transition-all ${
                  resendIn > 0 || locked
                    ? 'cursor-not-allowed bg-ink-100 text-ink-500'
                    : 'bg-primary-800 text-white hover:bg-primary-700 active:scale-[0.98]'
                }`}
              >
                {resendIn > 0
                  ? `Didn't get it? Resend in ${resendIn}s`
                  : "Didn't get it? Resend code"}
              </button>
            </div>

            {/* Locking one channel does not lock the other, so the phone step is
                still reachable after five bad email codes. */}
            {locked && isEmail && (
              <p className="text-center text-xs text-muted">
                Too many attempts on the email code. Your phone code is unaffected — wait for the
                lock to clear, or start again.
              </p>
            )}

            <p className="text-center">
              <Link
                to={backTo}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                ← Back to signup
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
