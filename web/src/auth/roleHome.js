import { consoleBaseFor } from '../lib/consolePath.js';

/**
 * Post-login landing per role (plan §2). Staff land on THEIR console's
 * dashboard — `/admin/dashboard` for the super admin, `/staff/dashboard` for
 * an employee (split by role, owner 2026-09-24). The dashboard adapts to the
 * person's permissions and says so plainly when they have none.
 */
export function roleHome(user) {
  if (!user) return '/signin';
  switch (user.role) {
    case 'buyer':
      return '/buyer/verification';
    // The dashboard is a seller's home — always, including straight after
    // signup, where the button says "Go to your dashboard" (owner, 2026-09-23).
    // Verification is one click away in the sidebar.
    case 'exporter':
      return '/exporter/dashboard';
    case 'superadmin':
    case 'employee':
      return `${consoleBaseFor(user.role)}/dashboard`;
    default:
      return '/signin';
  }
}

export const isStaff = (user) => user?.role === 'employee' || user?.role === 'superadmin';

/** Sidebar/route visibility — presentation only; the server re-checks everything. */
export function can(user, ...permissions) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const held = new Set(user.permissions ?? []);
  return permissions.some((p) => held.has(p));
}
