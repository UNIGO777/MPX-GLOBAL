/**
 * Post-login landing per role (plan §2). An employee lands on the first admin
 * screen their granted permissions can actually open — in the sidebar's own
 * order — and an employee with no relevant grant gets the calm no-access page
 * (a normal state, not an error).
 */
const QUEUE_PERMISSIONS = ['organisation:read', 'buyer:approve', 'exporter:verify'];

export function roleHome(user) {
  if (!user) return '/signin';
  switch (user.role) {
    case 'buyer':
      return '/buyer/verification';
    // The dashboard is a seller's everyday home. Verification is the FIRST stop
    // only, straight after signup — see `firstRunHome` (owner, 2026-09-23).
    case 'exporter':
      return '/exporter/dashboard';
    case 'superadmin':
      return '/admin/users';
    case 'employee': {
      const held = new Set(user.permissions ?? []);
      if (held.has('user:read')) return '/admin/users';
      if (QUEUE_PERMISSIONS.some((p) => held.has(p))) return '/admin/verification';
      return '/admin/no-access';
    }
    default:
      return '/signin';
  }
}

/**
 * Where a brand-new account lands from the signup success screen. A new seller
 * goes to Verification first, to start the tick; every later sign-in uses
 * `roleHome`.
 */
export function firstRunHome(user) {
  return user?.role === 'exporter' ? '/exporter/verification' : roleHome(user);
}

export const isStaff = (user) => user?.role === 'employee' || user?.role === 'superadmin';

/** Sidebar/route visibility — presentation only; the server re-checks everything. */
export function can(user, ...permissions) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const held = new Set(user.permissions ?? []);
  return permissions.some((p) => held.has(p));
}
