import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { authApi } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError } from '../../lib/format.js';
import { PERMISSION_GROUPS } from '../../lib/permissions.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { initialsOf } from '../../components/chat/CompanyAvatar.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FlashMessage } from '../../components/ui/FlashMessage.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { CheckIcon, KeyIcon, MailIcon, PhoneIcon, ShieldIcon, UserIcon } from '../../components/ui/icons.jsx';

/**
 * `/admin/account` · `/staff/account` — every staff member's own page
 * (owner, 2026-09-24: "for employees there is nowhere to change password").
 *
 *  - Profile: read-only. A staff account's name / email / mobile are set by a
 *    super admin (they are identity, and the staff email is exclusive — A21).
 *  - Change password: the existing `POST /auth/change-password` (current +
 *    new). The server rotates the session and signs out every other one.
 *  - Your access: the permissions this person holds, grouped as on the Staff
 *    page — read from `/auth/me`, so it is always the server's current truth.
 */
export function Account() {
  const { user } = useAuth();

  useEffect(() => {
    const previous = document.title;
    document.title = 'My account — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const me = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });
  const profile = me.data ?? user;
  const isSuper = profile?.role === 'superadmin';

  return (
    <AdminLayout>
      <header className="mb-5">
        <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">My account</h1>
        <p className="mt-1 text-sm text-muted">Your details, your password, and what you can do in the console.</p>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-lg font-bold text-white"
              >
                {initialsOf(profile?.name ?? '')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-ink-900">{profile?.name}</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2 py-0.5 text-[12px] font-semibold text-ink-700">
                  <ShieldIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {isSuper ? 'Super admin' : 'Employee'} · MPX Global
                </p>
              </div>
            </div>
            {me.isLoading ? (
              <SkeletonRows rows={2} />
            ) : (
              <dl className="divide-y divide-surface-border border-t border-surface-border text-[13.5px]">
                <Detail Icon={UserIcon} label="Name">{profile?.name}</Detail>
                <Detail Icon={MailIcon} label="Email">{profile?.email}</Detail>
                <Detail Icon={PhoneIcon} label="Mobile">{profile?.mobile ?? '—'}</Detail>
              </dl>
            )}
            {!isSuper && (
              <p className="border-t border-surface-border bg-surface-subtle/60 px-5 py-3 text-[12.5px] text-muted sm:px-6">
                To change your name, email or mobile, ask a super admin.
              </p>
            )}
          </section>

          <ChangePasswordCard />
        </div>

        <YourAccess perms={profile?.permissions ?? []} isSuper={isSuper} loading={me.isLoading} />
      </div>
    </AdminLayout>
  );
}

function Detail({ Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 sm:px-6">
      <Icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-ink-900">{children}</dd>
    </div>
  );
}

function ChangePasswordCard() {
  const { applyNewTokens } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const longEnough = newPassword.length >= 8;
  const different = newPassword.length > 0 && newPassword !== currentPassword;
  const matches = confirm.length > 0 && confirm === newPassword;
  const ready = currentPassword && longEnough && different && matches;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setLoading(true);
    try {
      const tokens = await authApi.changePassword({ currentPassword, newPassword });
      // The server rotated this session — keep it, and every other one is gone.
      applyNewTokens(tokens);
      setCurrentPassword(''); setNewPassword(''); setConfirm('');
      setDone(true);
    } catch (err) {
      setError(apiError(err, 'Could not change your password.').message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
        <KeyIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
        Change password
      </h2>
      <p className="mt-1 text-[13px] text-muted">Your other sessions sign out when you change it.</p>

      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        {done && (
          <FlashMessage onDismiss={() => setDone(false)}>
            Password changed. Every other session has been signed out.
          </FlashMessage>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => { setCurrentPassword(e.target.value); setDone(false); }}
          disabled={loading}
        />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          showStrength
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
        />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          error={confirm.length > 0 && !matches ? "Passwords don't match." : undefined}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading}
        />
        <ul className="space-y-1 rounded-lg bg-surface-subtle px-4 py-3 text-[12.5px]">
          <Rule met={longEnough} started={newPassword.length > 0}>At least 8 characters</Rule>
          <Rule met={different} started={newPassword.length > 0}>Different from your current password</Rule>
          <Rule met={matches} started={confirm.length > 0}>Both entries match</Rule>
        </ul>
        <Button type="submit" loading={loading} disabled={!ready}>
          Change password
        </Button>
      </form>
    </section>
  );
}

function Rule({ met, started, children }) {
  return (
    <li className={`flex items-center gap-2 ${met ? 'text-success-700' : started ? 'text-ink-700' : 'text-muted'}`}>
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded-full ${met ? 'bg-success-600 text-white' : 'bg-ink-200'}`}
      >
        {met && <CheckIcon className="h-3 w-3" />}
      </span>
      {children}
      <span className="sr-only">{met ? '— done' : '— not yet'}</span>
    </li>
  );
}

function YourAccess({ perms, isSuper, loading }) {
  const held = new Set(perms);
  const groups = PERMISSION_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => held.has(i.value)) })).filter((g) => g.items.length);

  return (
    <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
        <ShieldIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
        Your access
      </h2>
      {loading ? (
        <SkeletonRows rows={3} />
      ) : isSuper ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">
          <b>Full access.</b> As a super admin you can open every screen and take every action, including
          staff, permissions and platform settings.
        </p>
      ) : groups.length === 0 ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">
          You have no permissions yet, so the console has nothing for you to work on. Ask a super admin to grant
          access — it takes effect straight away.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-muted">
            Set by a super admin. The menu shows only the screens these open.
          </p>
          <div className="mt-4 space-y-4">
            {groups.map((g) => (
              <div key={g.group}>
                <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-500">{g.group}</p>
                <ul className="space-y-1.5">
                  {g.items.map((i) => (
                    <li key={i.value} className="flex items-start gap-2.5">
                      <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink-900">{i.label}</span>
                        <span className="block text-[12px] leading-snug text-muted">{i.help}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
