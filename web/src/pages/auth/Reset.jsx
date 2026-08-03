import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { config } from '../../config.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { OtpInput } from '../../components/ui/OtpInput.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
import { PortalToggle } from '../../components/ui/PortalToggle.jsx';
import { CheckCircleIcon } from '../../components/ui/icons.jsx';

/**
 * Reset password. Mockup: mpx_global_password_reset_alignment_fixed.
 * Identifier arrives prefilled from Forgot (editable); the code boxes are the
 * shared OtpInput. Party flow carries the portal; `?staff=1` uses the staff
 * endpoint. Success copy is literal truth: the backend revokes every session.
 */
export function Reset() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const staff = params.get('staff') === '1';

  const [portal, setPortal] = useState(location.state?.portal ?? 'buyer');
  const [identifier, setIdentifier] = useState(location.state?.identifier ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [mismatch, setMismatch] = useState(false);
  // Tracked apart from `error`: a password-length complaint must not paint the
  // code boxes red, which told the user the wrong field was wrong.
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const backTo = staff ? '/signin/staff' : '/signin';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setMismatch(false);
    setCodeInvalid(false);
    if (!identifier.trim() || code.length !== 6 || !newPassword) {
      setError('Fill in the code and your new password.');
      setCodeInvalid(code.length !== 6);
      return;
    }
    if (newPassword.length < 8) {
      setError('Your new password needs at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setMismatch(true);
      return;
    }
    setLoading(true);
    try {
      const payload = { identifier: identifier.trim(), code, newPassword };
      if (staff) await authApi.staffResetPassword(payload);
      else await authApi.resetPassword({ ...payload, portal });
      setDone(true);
    } catch (err) {
      // The server answers the same way for a wrong code, an expired code and
      // an unknown account — so the code is the field to flag and clear.
      setError(apiError(err, 'Invalid or expired code.').message);
      setCodeInvalid(true);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline="Pick a new password and you're back."
      sub="Choose something you don't use anywhere else. We'll sign you out everywhere else once it's changed."
    >
      {done ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-success">
            <CheckCircleIcon className="h-6 w-6" />
          </div>
          <h2 className="text-[28px] font-bold text-ink-900">Password changed</h2>
          <p className="mt-2 text-sm text-muted">
            You&apos;ve been signed out on all your other devices. Sign in with your new password to
            continue.
          </p>
          <Button fullWidth className="mt-6" onClick={() => navigate(backTo, { replace: true })}>
            Go to sign in
          </Button>
        </div>
      ) : (
        <>
          <h2 className="text-[28px] font-bold text-ink-900">Set a new password</h2>
          <p className="mt-2 text-sm text-muted">
            Enter the code we sent you, then choose your new password.
          </p>

          {/* Same rhythm as the other auth screens (owner, 2026-08-02). */}
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

            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-900">Reset code</span>
              {/* Focus the code only when the identifier arrived prefilled from
                  Forgot — on a cold hit, the identifier is what's needed first. */}
              <OtpInput
                autoFocus={Boolean(location.state?.identifier)}
                value={code}
                onChange={setCode}
                disabled={loading}
                error={codeInvalid}
              />
              {/* The code IS an OTP, so it dies on the same clock. There is no
                  resend endpoint for this purpose (that one needs a loginToken),
                  so a fresh code means walking back through Forgot. */}
              <p className="text-[13px] font-medium text-ink-600">
                Valid for {Math.round(config.otp.ttlSeconds / 60)} minutes.{' '}
                <Link
                  to={staff ? '/forgot?staff=1' : '/forgot'}
                  state={{ portal: staff ? null : portal, identifier: identifier.trim() || undefined }}
                  className="font-medium text-primary-600 hover:text-primary-700"
                >
                  Send a new code
                </Link>
              </p>
            </div>

            <PasswordInput
              label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              helper="At least 8 characters."
              showStrength
              disabled={loading}
            />

            <PasswordInput
              label="Confirm new password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setMismatch(false);
              }}
              autoComplete="new-password"
              placeholder="••••••••"
              error={mismatch ? "Passwords don't match." : undefined}
              disabled={loading}
            />

            <div className="pt-3">
              <Button type="submit" fullWidth loading={loading}>
                Reset password
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
