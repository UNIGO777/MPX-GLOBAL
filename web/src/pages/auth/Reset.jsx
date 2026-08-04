import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { config } from '../../config.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { OtpInput } from '../../components/ui/OtpInput.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
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

  // Both arrive from Forgot in router state. They are the ONLY way this screen
  // knows which account the code belongs to, which is why their absence means
  // there is nothing to reset (see the guard below).
  const carriedPortal = location.state?.portal ?? null;
  const carriedIdentifier = location.state?.identifier ?? null;
  // Fixed by Forgot; there is no cold-hit path that could change it.
  const portal = carriedPortal ?? 'buyer';
  const [identifier, setIdentifier] = useState(carriedIdentifier ?? '');
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

  // 🔴 No direct access. A reset code is issued against one portal + identifier
  // pair by Forgot, and that pair travels in router state — so a cold hit (or a
  // refresh, which drops the state) has no code context at all. Send them to
  // request one rather than render a form whose values can only be wrong. Same
  // rule as /otp and /signup/verify.
  if (!carriedIdentifier) {
    return <Navigate to={staff ? '/forgot?staff=1' : '/forgot'} replace />;
  }

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
            {/* The code was issued against one exact portal + identifier pair,
                so neither can be changed here: switching either could only make
                the lookup miss and return "Invalid or expired code", blaming the
                code for what is really a wrong account. Arriving from Forgot the
                portal is simply STATED and the identifier is shown disabled; on
                a cold hit or refresh both are unknown, so both are editable. */}
            {staff ? (
              // Staff have no portal to choose — a staff email is exclusive
              // (A21) — but say which console this is resetting, so someone who
              // followed the wrong recovery link notices before spending a code.
              <p className="text-[13px] text-muted">
                Resetting the password for your{' '}
                <span className="font-semibold text-ink-900">staff</span> account on the MPX Global
                admin console.
              </p>
            ) : (
              <p className="text-[13px] text-muted">
                Resetting the password for your{' '}
                <span className="font-semibold text-ink-900">
                  {carriedPortal === 'exporter' ? 'Exporter' : 'Buyer'}
                </span>{' '}
                account.
              </p>
            )}
            {error && <Alert tone="danger">{error}</Alert>}

            <Input
              label="Email or mobile"
              type="text"
              autoComplete="username"
              placeholder="Enter email or phone number"
              helper="Mobile must include country code, e.g. +91 98765 43210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled
            />

            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-900">Reset code</span>
              {/* Focus the code when the identifier came with us — on a cold
                  hit the identifier field is what needs filling first. */}
              <OtpInput
                label="Reset code"
                autoFocus
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

          {/* `replace` so leaving does not leave this screen — with the account
              being recovered on display — sitting in history behind a Back
              press. The code is single-use and short-lived, so returning here
              grants nothing; this is about not showing the identifier again. */}
          <p className="mt-7 border-t border-surface-border pt-5 text-center text-sm">
            <Link to={backTo} replace className="font-medium text-primary-600 hover:text-primary-700">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
