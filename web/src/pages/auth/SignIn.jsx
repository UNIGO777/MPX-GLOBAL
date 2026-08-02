import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
import { PortalToggle } from '../../components/ui/PortalToggle.jsx';

/**
 * Party sign-in (buyer + exporter share this screen; the portal is the field
 * change — A21). Staff have their own page, deliberately separate.
 *
 * Mockup: mpx_global_sign_in_default_loading_states (its "buyers, exporters
 * and staff all sign in here" line is pre-A21 and replaced by the toggle).
 * Error copy comes from the SERVER verbatim — one slot above the form, never
 * attached to a field (that would reveal which one was wrong).
 */
export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();

  const [portal, setPortal] = useState('buyer');
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
      const { loginToken, method } = await authApi.login({
        identifier: identifier.trim(),
        password,
        portal,
      });
      navigate('/otp', {
        state: {
          loginToken,
          method,
          identifier: identifier.trim(),
          from: location.state?.from ?? null,
          backTo: '/signin',
        },
      });
    } catch (err) {
      setError(apiError(err, 'Invalid credentials.').message);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline="Where Indian exporters meet international buyers."
      sub="Sign in to discover verified suppliers, send enquiries, and talk to them directly."
    >
      <h2 className="text-[28px] font-bold text-ink-900">Sign in</h2>
      <p className="mt-1 text-sm text-muted">Choose your account type, then sign in.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        <PortalToggle value={portal} onChange={setPortal} disabled={loading} />

        {sessionNote && !error && <Alert tone="info">{sessionNote}</Alert>}
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

        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••••"
          disabled={loading}
          trailing={
            <Link to="/forgot" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Forgot password?
            </Link>
          }
        />

        <Button type="submit" fullWidth loading={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 border-t border-surface-border pt-5 text-center text-sm text-muted">
        <p>
          Don&apos;t have an account?{' '}
          <Link to="/signup/buyer" className="font-semibold text-primary-600 hover:text-primary-700">
            Sign up as Buyer
          </Link>{' '}
          ·{' '}
          <Link to="/signup/exporter" className="font-semibold text-primary-600 hover:text-primary-700">
            Sign up as Exporter
          </Link>
        </p>
        <p className="mt-2">
          Work at MPX Global?{' '}
          <Link to="/signin/staff" className="font-medium text-ink-600 underline hover:text-ink-900">
            Staff sign-in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
