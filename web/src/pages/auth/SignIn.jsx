import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
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
 *
 * NO link to the staff console from here (owner, 2026-08-02). Staff auth is its
 * own module and its own audience; the public sign-in must not advertise the
 * admin door. Staff reach /signin/staff by knowing the URL.
 */
export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();

  const [portal, setPortal] = useState('buyer');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Why a session ended mid-use is held in auth state, not route state: the api
  // client kills the session from an interceptor, so nothing navigates here
  // with a message. Reading location.state left the user silently bounced.
  const { sessionNote } = useAuth();

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
      {/* Mockup rhythm: 8px under the title, 24px from the sub-line to the form. */}
      <h2 className="text-[28px] font-bold text-ink-900">Sign in</h2>
      <p className="mt-2 text-sm text-muted">Choose your account type, then sign in.</p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
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

        {/* Recovery link sits UNDER the field, right-aligned (owner, 2026-08-02
            — the mockup has it in the label row). The link carries the portal:
            recovery REQUIRES one, and a wrong portal there silently sends
            nothing by design, so making the user re-pick is a trap. */}
        <div className="space-y-2">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••••"
            disabled={loading}
          />
          <div className="flex justify-end">
            <Link
              to="/forgot"
              state={{ portal, identifier: identifier.trim() || undefined }}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* The CTA gets more air than the field gaps — it ends the form rather
            than continuing it (owner, 2026-08-02). */}
        <div className="pt-3">
          <Button type="submit" fullWidth loading={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>

      {/* Footer: compact by intent (owner, 2026-08-02) — 28px above the rule,
          20px below, so the whole card reads as ONE block that centres in the
          pane instead of stretching edge to edge. The two signup links sit
          side by side split by a hairline, stacking on the narrowest widths. */}
      <div className="mt-7 border-t border-surface-border pt-5 text-center text-sm">
        <div className="flex flex-col items-center gap-2.5">
          <span className="text-muted">Don&apos;t have an account?</span>
          <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:gap-5">
            <Link
              to="/signup/buyer"
              className="whitespace-nowrap font-semibold text-primary-600 hover:underline"
            >
              Sign up as Buyer
            </Link>
            <span aria-hidden="true" className="hidden h-3.5 w-px bg-ink-300 sm:block" />
            <Link
              to="/signup/exporter"
              className="whitespace-nowrap font-semibold text-primary-600 hover:underline"
            >
              Sign up as Exporter
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
