import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { authApi } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { cp } from '../../lib/consolePath.js';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import { PERMISSION_GROUPS } from '../../lib/permissions.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { initialsOf } from '../../components/chat/CompanyAvatar.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FlashMessage } from '../../components/ui/FlashMessage.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { CheckIcon, ClockIcon, KeyIcon, LockIcon, MailIcon, PhoneIcon, ShieldIcon, UserIcon } from '../../components/ui/icons.jsx';

/**
 * `/admin/account` · `/staff/account` — every staff member's own page
 * (owner, 2026-09-24: "for employees there is nowhere to change password").
 *
 *  - Profile: read-only. A staff account's name / email / mobile are set by a
 *    super admin (they are identity, and the staff email is exclusive — A21).
 *    Shows the account's own dates from `/auth/me` (member since, this sign-in).
 *  - Password: the existing `POST /auth/change-password` (current + new). The
 *    server rotates this session and signs out every other one. Folded behind
 *    a button — it is used rarely. (A temporary password never reaches this
 *    page: the console routes that account to its own "Set a new password"
 *    screen first.)
 *  - Your access: the permissions this person holds, grouped as on the Staff
 *    page — read from `/auth/me`, so it is always the server's current truth.
 *
 * 2026-09-25 redesign (owner: "fix my account screen for admin and staff").
 */

/** Display-only phone formatting: groups an Indian number, leaves others as stored. */
function formatMobile(e164) {
  if (!e164) return null;
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

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

      {me.error && (
        <Alert tone="danger" className="mb-4">
          {apiError(me.error, 'We couldn’t refresh your account details.').message}
        </Alert>
      )}

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <section className="mb-5 overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-4 lg:w-80 lg:shrink-0">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-xl font-bold text-white"
            >
              {initialsOf(profile?.name ?? '')}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-ink-900">{profile?.name}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2 py-0.5 text-[12px] font-semibold text-ink-700">
                <ShieldIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {isSuper ? 'Super admin' : 'Employee'} · MPX Global
              </p>
            </div>
          </div>

          {me.isLoading ? (
            <div className="flex-1"><SkeletonRows rows={2} /></div>
          ) : (
            <dl className="grid flex-1 gap-x-6 gap-y-4 border-t border-surface-border pt-5 sm:grid-cols-2 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <Fact Icon={MailIcon} label="Email">
                <span className="break-all">{profile?.email}</span>
              </Fact>
              <Fact Icon={PhoneIcon} label="Mobile">{formatMobile(profile?.mobile) ?? <span className="text-muted">Not set</span>}</Fact>
              <Fact Icon={UserIcon} label="Member since">
                {profile?.memberSince ? formatDate(profile.memberSince) : <span className="text-muted">—</span>}
              </Fact>
              <Fact Icon={ClockIcon} label="Last sign-in">
                {profile?.lastLoginAt ? `${formatDate(profile.lastLoginAt)}, ${formatTime(profile.lastLoginAt)}` : <span className="text-muted">—</span>}
              </Fact>
            </dl>
          )}
        </div>
        {!isSuper && (
          <p className="border-t border-surface-border bg-surface-subtle/60 px-5 py-3 text-[12.5px] text-muted sm:px-6">
            Your name, email and mobile are managed by a super admin — ask one if anything here is wrong.
          </p>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <PasswordCard />
        <YourAccess perms={profile?.permissions ?? []} isSuper={isSuper} loading={me.isLoading} />
      </div>
    </AdminLayout>
  );
}

function Fact({ Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="mt-0.5 text-[14px] font-semibold text-ink-900">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Password — folded to one row with a "Change password" button (it is used
 * rarely, and open it took half the page).
 */
function PasswordCard() {
  const { applyNewTokens } = useAuth();
  const [open, setOpen] = useState(false);
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

  const reset = () => { setCurrentPassword(''); setNewPassword(''); setConfirm(''); setError(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setLoading(true);
    try {
      const tokens = await authApi.changePassword({ currentPassword, newPassword });
      // The server rotated this session — keep it, and every other one is gone.
      applyNewTokens(tokens);
      reset();
      setOpen(false);
      setDone(true);
    } catch (err) {
      setError(apiError(err, 'Could not change your password.').message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
            <KeyIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Password
          </h2>
          <p className="mt-1 text-[13px] text-muted">Changing it signs you out on every other device.</p>
        </div>
        {!open && (
          <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setDone(false); }}>
            Change password
          </Button>
        )}
      </div>

      {done && (
        <FlashMessage className="mt-4" onDismiss={() => setDone(false)}>
          Password changed. Every other session has been signed out.
        </FlashMessage>
      )}

      {open && (
        <form onSubmit={submit} noValidate className="mt-5 space-y-4 border-t border-surface-border pt-5">
          {error && <Alert tone="danger">{error}</Alert>}
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
            autoFocus
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
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => { reset(); setOpen(false); }} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!ready}>
              Change password
            </Button>
          </div>
          <p className="text-[12px] text-muted">
            Forgot your current password? Sign out, then use “Forgot password” on the staff sign-in page.
          </p>
        </form>
      )}
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
  const total = PERMISSION_GROUPS.reduce((n, g) => n + g.items.length, 0);
  const groups = PERMISSION_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => held.has(i.value)) })).filter((g) => g.items.length);
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
          <ShieldIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Your access
        </h2>
        {!loading && (
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[12px] font-semibold text-ink-700">
            {isSuper ? 'Everything' : `${count} of ${total} permissions`}
          </span>
        )}
      </div>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : isSuper ? (
        <>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">
            As a super admin you can open every screen and take every action. Two things only you can do:
          </p>
          <ul className="mt-3 space-y-2">
            <AccessLink to={cp('/admin/staff')} Icon={UserIcon} title="Staff & permissions" text="Add employees and choose what each can do." />
            <AccessLink to={cp('/admin/settings')} Icon={LockIcon} title="Platform settings" text="Support contact, AI limit, ticket auto-close and company details." />
          </ul>
        </>
      ) : groups.length === 0 ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">
          You have no permissions yet, so the console has nothing for you to work on. Ask a super admin to grant
          access — it takes effect straight away.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-muted">Set by a super admin. The menu shows only the screens these open.</p>
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
          <p className="mt-4 border-t border-surface-border pt-3 text-[12px] text-muted">
            Need something else? Ask a super admin — new access works straight away, no need to sign in again.
          </p>
        </>
      )}
    </section>
  );
}

function AccessLink({ to, Icon, title, text }) {
  return (
    <li>
      <Link
        to={to}
        className="group flex items-start gap-3 rounded-xl border border-surface-border p-3 transition-colors hover:border-primary-300 hover:bg-primary-50/40"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-ink-900 group-hover:text-primary-700">{title}</span>
          <span className="block text-[12px] text-muted">{text}</span>
        </span>
      </Link>
    </li>
  );
}
