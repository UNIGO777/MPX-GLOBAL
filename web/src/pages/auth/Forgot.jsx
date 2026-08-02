import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
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
  const [params] = useSearchParams();
  const staff = params.get('staff') === '1';

  const [portal, setPortal] = useState('buyer');
  const [identifier, setIdentifier] = useState('');
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
      sub="Tell us the email or mobile number on your account and we'll send a code to set a new password."
    >
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-success">
            <CheckCircleIcon className="h-6 w-6" />
          </div>
          <h2 className="text-[28px] font-bold text-ink-900">Check your messages</h2>
          <p className="mt-2 text-sm text-muted">
            If an account exists for that email or mobile, a reset code has been sent. The code is
            valid for 10 minutes.
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
          <Link to={backTo} className="mt-4 inline-block text-sm font-medium text-primary-600 hover:text-primary-700">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-[28px] font-bold text-ink-900">Reset your password</h2>
          <p className="mt-1 text-sm text-muted">
            We&apos;ll send a 6-digit code to the email or mobile on your account.
          </p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-5">
            {!staff && <PortalToggle value={portal} onChange={setPortal} disabled={loading} />}
            {error && <Alert tone="danger">{error}</Alert>}

            <Input
              label="Email or mobile"
              type="text"
              autoComplete="username"
              placeholder="name@company.com"
              helper="Mobile must include country code, e.g. +91 98765 43210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
            />

            <Button type="submit" fullWidth loading={loading}>
              Send reset code
            </Button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link to={backTo} className="font-medium text-primary-600 hover:text-primary-700">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
