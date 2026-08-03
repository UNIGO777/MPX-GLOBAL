import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { config } from '../../config.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PortalToggle } from '../../components/ui/PortalToggle.jsx';
import { CheckCircleIcon } from '../../components/ui/icons.jsx';

/**
 * Forgot password. Mockup: mpx_global_password_recovery_page.
 *
 * The mockup had no portal control — the shipped backend REQUIRES one on the
 * party endpoint (a wrong portal silently sends nothing, by design), so the
 * same toggle as sign-in is added here. `?staff=1` is the staff variant: no
 * portal, hits /auth/staff/forgot-password.
 *
 * The confirmation is always the same neutral line — it must not reveal
 * whether the account exists.
 */
export function Forgot() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const staff = params.get('staff') === '1';

  // Sign-in hands over what the user already chose and typed — making them
  // pick the portal again invites a wrong choice, which silently sends nothing.
  const [portal, setPortal] = useState(location.state?.portal ?? 'buyer');
  const [identifier, setIdentifier] = useState(location.state?.identifier ?? '');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const backTo = staff ? '/signin/staff' : '/signin';

  const submit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Enter the email or mobile on your account.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (staff) await authApi.staffForgotPassword({ identifier: identifier.trim() });
      else await authApi.forgotPassword({ identifier: identifier.trim(), portal });
      setSent(true);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline="Locked out? Let's fix that."
      sub="Tell us the email or mobile number on your account and we'll text you a code to set a new password."
    >
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-success">
            <CheckCircleIcon className="h-6 w-6" />
          </div>
          <h2 className="text-[28px] font-bold text-ink-900">Check your messages</h2>
          {/* The reset code IS an OTP (purpose: forgot_password), so it lives
              exactly as long as any other — never state a longer window than
              the server honours. */}
          <p className="mt-2 text-sm text-muted">
            If an account exists for that email or mobile, we&apos;ve texted a reset code to the
            mobile number on it. The code is valid for{' '}
            {Math.round(config.otp.ttlSeconds / 60)} minutes.
          </p>
          <Button
            fullWidth
            className="mt-6"
            onClick={() =>
              navigate(staff ? '/reset?staff=1' : '/reset', {
                state: { identifier: identifier.trim(), portal: staff ? null : portal },
              })
            }
          >
            Enter reset code
          </Button>
          {/* A typo in the identifier used to be a dead end: the panel replaces
              the form, and the neutral copy can't tell them they mistyped. */}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 block w-full text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Use a different email or mobile
          </button>
          <Link to={backTo} className="mt-4 inline-block text-sm font-medium text-ink-600 hover:text-ink-900">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-[28px] font-bold text-ink-900">Reset your password</h2>
          {/* Delivery is SMS-only: forgotWithRole() hardcodes channel:'mobile'.
              You may IDENTIFY yourself with either, but the code is texted —
              saying "email or mobile" here sent people to an empty inbox. */}
          <p className="mt-2 text-sm text-muted">
            Tell us the email or mobile on your account. We&apos;ll text a 6-digit code to the
            mobile number registered to it.
          </p>

          {/* Same rhythm as the two sign-in screens — these four auth pages
              must measure identically (owner, 2026-08-02). */}
          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            {!staff && <PortalToggle value={portal} onChange={setPortal} disabled={loading} />}
            {error && <Alert tone="danger">{error}</Alert>}

            <Input
              label="Email or mobile"
              type="text"
              autoComplete="username"
              placeholder="Enter email or phone number"
              helper="Mobile must include country code, e.g. +91 98765 43210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
            />

            <div className="pt-3">
              <Button type="submit" fullWidth loading={loading}>
                Send reset code
              </Button>
            </div>
          </form>

          <p className="mt-7 border-t border-surface-border pt-5 text-center text-sm">
            <Link to={backTo} className="font-medium text-primary-600 hover:text-primary-700">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
