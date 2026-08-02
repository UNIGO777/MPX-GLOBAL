import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { ClockIcon } from '../../components/ui/icons.jsx';

/**
 * Designed placeholder for admin areas outside the M1 web set (Dashboard,
 * Audit log, Settings — backend exists for some, the screens don't yet).
 * Each route using this is logged in docs/UiWebNotes.md.
 */
export function ComingSoon({ title, note }) {
  return (
    <AdminLayout>
      <div className="mx-auto mt-12 max-w-md rounded-lg border border-surface-border bg-white p-8 text-center shadow-card">
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

/** Calm landing for an employee whose grants open none of the M1 screens. */
export function NoAccess() {
  return (
    <AdminLayout>
      <div className="mx-auto mt-12 max-w-md rounded-lg border border-surface-border bg-white p-8 text-center shadow-card">
        <h1 className="text-xl font-bold text-ink-900">Nothing here for you yet</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is active, but none of the currently available admin areas are in your
          permissions. Ask a Super Admin to grant you access to the modules you need — changes take
          effect immediately, no re-sign-in needed.
        </p>
      </div>
    </AdminLayout>
  );
}
