import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { config } from '../../config.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';
import { ERROR_CODES, apiError, isErrorCode } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { OtpInput } from '../../components/ui/OtpInput.jsx';

// Both mirror the server's OTP policy (A3) — see config.js.
const { ttlSeconds: OTP_TTL_SECONDS, resendCooldownSeconds: RESEND_COOLDOWN_SECONDS } = config.otp;

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The second factor — ONE screen for every flow that lands here (party login,
 * staff login, and both signups: A21 §4a means signup also ends in an OTP
 * exchange). Arrives with router state {loginToken, identifier, from, backTo,
 * step, backLabel}; a direct hit with no state goes back to sign-in.
 *
 * `step` and `backLabel` exist because the flows have different lengths and
 * different origins: sign-in is 2 of 2 and goes back to sign-in, exporter
 * signup is 4 of 4 and goes back to the signup form. Everything else about
 * the exchange is identical, so it stays one screen.
 *
 * Mockup: mpx_global_otp_verification_states. No attempts-remaining counter
 * exists anywhere — the server is deliberately generic per failure (design §3).
 */
export function Otp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { completeSignIn } = useAuth();

  const flow = location.state ?? {};
  // Held in state (not read straight from `flow`) so the token this screen was
  // opened with survives any re-render that replaces location.state.
  const [loginToken] = useState(flow.loginToken);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [notice, setNotice] = useState(flow.notice ?? null);
  const [loading, setLoading] = useState(false);
  const [sessionDead, setSessionDead] = useState(false);

  // Deadlines, not tick-counters: a backgrounded tab has its timers throttled,
  // so decrementing once per tick drifts and the screen would claim minutes
  // remain on a code the server already expired.
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

  if (!flow.loginToken) return <Navigate to="/signin" replace />;

  const verify = async (submitted = code) => {
    if (submitted.length !== 6 || submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.verifyOtp({ loginToken, code: submitted });
      const user = await completeSignIn(result);
      if (user.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(flow.from ?? roleHome(user), { replace: true });
      }
    } catch (err) {
      const { message, code } = apiError(err, 'Invalid or expired code.');
      // The login-pending token lives 5 minutes; once it dies the only path is
      // starting over — say so instead of an endlessly failing code box.
      // Branch on the CODE; the prose match is a shim for servers without it.
      if (isErrorCode(err, ERROR_CODES.LOGIN_SESSION_EXPIRED, /sign in again/i)) {
        setSessionDead(true);
      }
      setErrorCode(code);
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
      await authApi.resendOtp({ loginToken });
      setNotice('A new code has been sent.');
      setCode('');
      setExpiresAt(Date.now() + OTP_TTL_SECONDS * 1000);
      setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (err) {
      const { message, code } = apiError(err, 'Could not resend the code.');
      if (isErrorCode(err, ERROR_CODES.LOGIN_SESSION_EXPIRED, /sign in again/i)) setSessionDead(true);
      setErrorCode(code);
      setError(message);
    }
  };

  const locked = errorCode ? errorCode === ERROR_CODES.OTP_LOCKED : /too many attempts/i.test(error ?? '');
  const backTo = flow.backTo ?? '/signin';
  const backLabel = flow.backLabel ?? 'Back to sign in';

  return (
    <AuthLayout
      headline="One quick check, and you're in."
      sub="We send a code every time you sign in, so your account stays yours even if your password gets out."
    >
      {/* Mockup eyebrow: 13px, ACCENT blue, uppercase, widest tracking — it is
          a progress marker, not muted secondary text. */}
      <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-600">
        Step {flow.step ?? '2 of 2'}
      </p>
      <h2 className="mt-1 text-[28px] font-bold text-ink-900">Enter your code</h2>
      {/* 🔴 The code goes to the MOBILE on every path (`channel: 'mobile'` in
          auth.service.js), whatever the user typed to sign in. This used to
          render `maskIdentifier(flow.identifier)` — so anyone signing in with an
          email was told to check their inbox for a code sent to their phone.
          `sentTo` is the server's mask of the real destination. */}
      <p className="mt-2 text-sm text-muted">
        We sent a 6-digit code to your registered mobile{' '}
        <span className="font-medium text-ink-800">{flow.sentTo ?? 'number'}</span>
      </p>

      {/* Same rhythm as the other auth screens (owner, 2026-08-02). */}
      <div className="mt-5 space-y-4">
        {notice && !error && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        {sessionDead ? (
          <Button fullWidth onClick={() => navigate(backTo, { replace: true })}>
            {backLabel}
          </Button>
        ) : (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-800">Verification code</span>
              <OtpInput
                autoFocus
                value={code}
                onChange={setCode}
                onComplete={verify}
                disabled={loading || locked}
                error={Boolean(error)}
              />
              <p className="text-[13px] font-medium text-ink-600" aria-live="polite">
                {expiresIn > 0 ? `Code expires in ${mmss(expiresIn)}` : 'That code has expired. Request a new one.'}
              </p>
            </div>

            {/* Mockup groups the two pills tighter than the gap that separates
                them from the code boxes (mb-lg → space-y-md). */}
            <div className="space-y-3 pt-2">
              <Button fullWidth loading={loading} disabled={code.length !== 6 || locked} onClick={() => verify()}>
                Verify and continue
              </Button>

              {/* Resend is a full-width pill under the CTA — grey while cooling
                  down, navy when live. */}
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
                {resendIn > 0 ? `Didn't get it? Resend in ${resendIn}s` : "Didn't get it? Resend code"}
              </button>
            </div>

            <p className="text-center">
              <Link
                to={backTo}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                ← {backLabel}
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
