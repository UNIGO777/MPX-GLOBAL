import { Link } from 'react-router-dom';

import { cp } from '../../lib/consolePath.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { ClockIcon, ShieldIcon } from '../../components/ui/icons.jsx';

/**
 * Designed placeholder for admin areas outside the M1 web set (Dashboard,
 * Audit log, Settings — backend exists for some, the screens don't yet).
 * Each route using this is logged in docs/UiWebNotes.md.
 */
export function ComingSoon({ title, note }) {
  return (
    <AdminLayout>
      <div className="mx-auto mt-12 max-w-md rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <ClockIcon className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-ink-900">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {note ?? 'This area is on the roadmap and not part of the current release.'}
        </p>
      </div>
    </AdminLayout>
  );
}

/**
 * Calm landing for an employee whose grants open none of the M1 screens — or,
 * with `page`, for ONE console page they were linked to or typed without the
 * permission it needs (owner, 2026-09-25: those used to draw a half-page of
 * controls over a "couldn't load" error). The server's 403 is still the lock.
 */
export function NoAccess({ page = false }) {
  return (
    <AdminLayout>
      <div className="mx-auto mt-12 max-w-md rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
        {/* Same medallion as ComingSoon: this is a normal state for a narrowly
            granted employee, not a failure, and a bare card reads as an error. */}
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <ShieldIcon className="h-6 w-6" />
        </div>
        {page ? (
          <>
            <h1 className="mt-4 text-xl font-bold text-ink-900">This page isn&apos;t part of your access</h1>
            <p className="mt-2 text-sm text-muted">
              Ask a Super Admin if you need it — a new permission takes effect straight away, no
              re-sign-in needed.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link to={cp('/admin/dashboard')} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                Go to your dashboard
              </Link>
              <Link to={cp('/admin/account')} className="rounded-full border border-surface-border px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50">
                See your access
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-bold text-ink-900">Nothing here for you yet</h1>
            <p className="mt-2 text-sm text-muted">
              Your account is active, but none of the currently available admin areas are in your
              permissions. Ask a Super Admin to grant you access to the modules you need — changes take
              effect immediately, no re-sign-in needed.
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
