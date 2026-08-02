import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { config } from '../../config.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';
import { apiError, maskIdentifier } from '../../lib/format.js';
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
  const [loginToken, setLoginToken] = useState(flow.loginToken);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
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
      const { message } = apiError(err, 'Invalid or expired code.');
      // The login-pending token lives 5 minutes; once it dies the only path is
      // starting over — say so instead of an endlessly failing code box.
      if (/sign in again/i.test(message)) {
        setSessionDead(true);
      }
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
      const { message } = apiError(err, 'Could not resend the code.');
      if (/sign in again/i.test(message)) setSessionDead(true);
      setError(message);
    }
  };

  const locked = /too many attempts/i.test(error ?? '');
  const backTo = flow.backTo ?? '/signin';
  const backLabel = flow.backLabel ?? 'Back to sign in';

  return (
    <AuthLayout
      headline="One quick check, and you're in."
      sub="We send a code every time you sign in, so your account stays yours even if your password gets out."
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Step {flow.step ?? '2 of 2'}
      </p>
      <h2 className="mt-1 text-[28px] font-bold text-ink-900">Enter your code</h2>
      <p className="mt-1 text-sm text-muted">
        We sent a 6-digit code to{' '}
        <span className="font-medium text-ink-800">{maskIdentifier(flow.identifier)}</span>
      </p>

      <div className="mt-6 space-y-5">
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
              <p className="text-xs text-muted" aria-live="polite">
                {expiresIn > 0 ? `Code expires in ${mmss(expiresIn)}` : 'That code has expired. Request a new one.'}
              </p>
            </div>

            <Button fullWidth loading={loading} disabled={code.length !== 6 || locked} onClick={() => verify()}>
              Verify and continue
            </Button>

            {/* Mockup: resend is a full-width pill under the CTA — grey while
                cooling down, accent when live. */}
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
