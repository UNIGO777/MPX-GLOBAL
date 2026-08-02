import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';

/**
 * The blocking change-password gate. No mockup exists for it, but the staff
 * temp-password flow is unusable without it: an account with
 * `mustChangePassword` gets 403s on everything else (backend authorize gate),
 * and RequireAuth mirrors that by redirecting every route here.
 *
 * POST /auth/change-password bumps tokenVersion and revokes every session, then
 * returns a fresh pair — applyNewTokens swaps them in, so the user continues
 * without re-signing-in.
 */
export function ChangePassword() {
  const navigate = useNavigate();
  const { user, applyNewTokens, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [mismatch, setMismatch] = useState(false);
  const [loading, setLoading] = useState(false);

  const forced = Boolean(user?.mustChangePassword);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setMismatch(false);
    if (!currentPassword || !newPassword) {
      setError('Fill in your current and new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Your new password needs at least 8 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Your new password must be different from the current one.');
      return;
    }
    if (newPassword !== confirm) {
      setMismatch(true);
      return;
    }
    setLoading(true);
    try {
      const tokens = await authApi.changePassword({ currentPassword, newPassword });
      applyNewTokens(tokens);
      navigate(roleHome({ ...user, mustChangePassword: false }), { replace: true });
    } catch (err) {
      setError(apiError(err, 'Could not change your password.').message);
      setLoading(false);
    }
  };

  const startOver = async () => {
    await signOut();
    navigate('/signin/staff', { replace: true });
  };

  return (
    <AuthLayout
      headline="One more step before you start."
      sub="Temporary passwords are single-use by design — pick your own and every other session signs out."
    >
      <h2 className="text-[28px] font-bold text-ink-900">Set a new password</h2>
      <p className="mt-1 text-sm text-muted">
        {forced
          ? `You're signed in with a temporary password${user?.name ? `, ${user.name}` : ''}. Choose your own to continue — nothing else is accessible until you do.`
          : 'Choose a new password. Your other sessions will be signed out.'}
      </p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}

        <PasswordInput
          label={forced ? 'Temporary password' : 'Current password'}
          autoComplete="current-password"
          placeholder="••••••••"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={loading}
        />

        <PasswordInput
          label="New password"
          autoComplete="new-password"
          placeholder="••••••••"
          helper="At least 8 characters."
          showStrength
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
        />

        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={mismatch ? "Passwords don't match." : undefined}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setMismatch(false);
          }}
          disabled={loading}
        />

        <Button type="submit" fullWidth loading={loading}>
          Change password and continue
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <button
          type="button"
          onClick={startOver}
          className="font-medium text-muted underline hover:text-ink-800"
        >
          Sign out and start over
        </button>
      </p>
    </AuthLayout>
  );
}
