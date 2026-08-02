import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
import { ShieldIcon } from '../../components/ui/icons.jsx';

/**
 * Staff sign-in (employee + superadmin share this screen). Deliberately its own
 * page, fully separate from the party side: no portal control anywhere (A21 — a
 * staff email is exclusive), its own route, hits POST /auth/staff/login.
 * A signup link would be wrong here — staff accounts are created by the
 * superadmin — so there is none.
 */
export function StaffSignIn() {
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const sessionNote = location.state?.sessionNote;

  const submit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Enter your email or mobile, and your password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { loginToken, method } = await authApi.staffLogin({
        identifier: identifier.trim(),
        password,
      });
      navigate('/otp', {
        state: {
          loginToken,
          method,
          identifier: identifier.trim(),
          from: location.state?.from ?? null,
          backTo: '/signin/staff',
        },
      });
    } catch (err) {
      setError(apiError(err, 'Invalid credentials.').message);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline="The team behind the marketplace."
      sub="Verification, buyer support and platform governance — sign in to the staff console."
    >
      <div className="flex items-center gap-2">
        <ShieldIcon className="h-5 w-5 text-primary-700" />
        <h2 className="text-[28px] font-bold text-ink-900">Staff sign-in</h2>
      </div>
      <p className="mt-1 text-sm text-muted">For MPX Global employees and administrators.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        {sessionNote && !error && <Alert tone="info">{sessionNote}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <Input
          label="Email or mobile"
          type="text"
          autoComplete="username"
          placeholder="you@mpxglobal.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={loading}
        />

        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••••"
          disabled={loading}
          trailing={
            <Link
              to="/forgot?staff=1"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Forgot password?
            </Link>
          }
        />

        <Button type="submit" fullWidth loading={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 border-t border-surface-border pt-5 text-center text-sm text-muted">
        Not staff?{' '}
        <Link to="/signin" className="font-medium text-primary-600 hover:text-primary-700">
          Buyer &amp; Exporter sign-in
        </Link>
      </p>
    </AuthLayout>
  );
}
