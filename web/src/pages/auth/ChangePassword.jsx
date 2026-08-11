import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { isStaff, roleHome } from '../../auth/roleHome.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
import { CheckCircleIcon, KeyIcon } from '../../components/ui/icons.jsx';

/** Live requirement row — quiet until typing starts, green when satisfied. */
function Requirement({ met, started, children }) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      {met ? (
        <CheckCircleIcon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <span
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 rounded-full border-[1.5px] ${started ? 'border-ink-400' : 'border-ink-300'}`}
        />
      )}
      <span className={met ? 'text-ink-800' : 'text-muted'}>{children}</span>
    </li>
  );
}

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
    // This screen is reachable by ANY signed-in role, not just staff — a buyer
    // changing their password voluntarily must not be dropped on the staff
    // portal, where their credentials would be refused.
    const signin = isStaff(user) ? '/signin/staff' : '/signin';
    await signOut();
    navigate(signin, { replace: true });
  };

  return (
    <AuthLayout
      headline="One more step before you start."
      sub="Temporary passwords are single-use by design — pick your own and every other session signs out."
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <KeyIcon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-[28px] font-bold text-ink-900">Set a new password</h2>
      <p className="mt-2 text-sm text-muted">
        {forced
          ? `You're signed in with a temporary password${user?.name ? `, ${user.name}` : ''}. Choose your own to continue — nothing else is accessible until you do.`
          : 'Choose a new password. Your other sessions will be signed out.'}
      </p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
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
          showStrength
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
        />

        {/* The submit-time checks, visible as they're satisfied — nobody
            should learn a rule from a rejection. */}
        <ul className="space-y-1.5 rounded-lg bg-surface-subtle px-4 py-3">
          <Requirement met={newPassword.length >= 8} started={newPassword.length > 0}>
            At least 8 characters
          </Requirement>
          <Requirement
            met={newPassword.length > 0 && newPassword !== currentPassword}
            started={newPassword.length > 0}
          >
            Different from your current password
          </Requirement>
          <Requirement
            met={confirm.length > 0 && confirm === newPassword}
            started={confirm.length > 0}
          >
            Both entries match
          </Requirement>
        </ul>

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

        <div className="pt-3">
          <Button type="submit" fullWidth loading={loading}>
            Change password and continue
          </Button>
        </div>
      </form>

      <p className="mt-7 border-t border-surface-border pt-5 text-center text-sm">
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
