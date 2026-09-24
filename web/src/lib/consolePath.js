/**
 * Console URLs are split by role (owner, 2026-09-24): the super admin works
 * under `/admin/*`, employees under `/staff/*` — same screens, and each person
 * only ever sees their own prefix. The router mounts the console under both and
 * moves anyone on the wrong one (`ConsoleArea`).
 *
 * Links in the console are written once as `/admin/...` and passed through
 * `cp()`, which swaps the prefix to match the console the viewer is IN — read
 * from the current URL at call time, so it is always right after a sign-out /
 * sign-in as another role. Call it while rendering, never at module level.
 *
 * Presentation only — the server authorises every request by role and
 * permission, whatever the URL.
 */
export const ADMIN_BASE = '/admin';
export const STAFF_BASE = '/staff';

export function consoleBaseFor(role) {
  return role === 'superadmin' ? ADMIN_BASE : STAFF_BASE;
}

function currentBase() {
  if (typeof window === 'undefined') return ADMIN_BASE;
  return window.location.pathname.startsWith(`${STAFF_BASE}/`) || window.location.pathname === STAFF_BASE ? STAFF_BASE : ADMIN_BASE;
}

/** `/admin/support/1` → `/staff/support/1` inside the staff console. Other paths pass through. */
export function cp(path) {
  if (typeof path !== 'string' || !path.startsWith(ADMIN_BASE)) return path;
  const rest = path.slice(ADMIN_BASE.length);
  if (rest && !rest.startsWith('/') && !rest.startsWith('?')) return path;
  return `${currentBase()}${rest}`;
}
