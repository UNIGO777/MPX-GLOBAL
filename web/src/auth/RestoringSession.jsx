import { Spinner } from '../components/ui/Spinner.jsx';

/**
 * Shown for the one moment between "page loaded" and "we know whether the
 * httpOnly refresh cookie yields a session" (A2).
 *
 * 🔴 This is not decoration. Without it, RequireAuth reads `user === null` on
 * the first render of every page load and redirects a perfectly valid session to
 * /signin — the exact bug that makes a reload feel like being logged out.
 */
export function RestoringSession() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-surface-subtle"
      role="status"
      aria-live="polite"
    >
      <Spinner className="h-6 w-6 text-primary-600" />
      <span className="sr-only">Restoring your session…</span>
    </div>
  );
}
