/**
 * The backend returns the caller in two different shapes, and neither is a
 * superset of the other:
 *
 *   /auth/verify-otp and the signup endpoints → `authUserView`
 *     { id, name, email, mobile, role, orgId, isActive, mustChangePassword }
 *
 *   /auth/me → `req.user` straight from `authenticate`
 *     { userId, orgId, role, permissions, mustChangePassword }
 *
 * So a session established by signing in has the name and email but no
 * permissions, and a session restored at launch has permissions but no name or
 * email. This normalises both into one shape so no screen has to know which
 * path it came from.
 *
 * `permissions` is render-only, exactly as received. It is never consulted to
 * grant anything — the server re-checks every request.
 */
export function normalizeUser(raw) {
  if (!raw) return null;

  return {
    id: raw.id ?? raw.userId ?? null,
    name: raw.name ?? null,
    email: raw.email ?? null,
    mobile: raw.mobile ?? null,
    role: raw.role ?? null,
    orgId: raw.orgId ?? null,
    permissions: raw.permissions ?? [],
    mustChangePassword: Boolean(raw.mustChangePassword),
  };
}

/**
 * Merges the two views into one complete user. Later sources win, but only
 * where they actually carry a value — `/auth/me` must not blank out the name
 * and email that verify-otp supplied.
 */
export function mergeUser(base, extra) {
  const a = normalizeUser(base);
  const b = normalizeUser(extra);
  if (!a) return b;
  if (!b) return a;

  return {
    id: b.id ?? a.id,
    name: b.name ?? a.name,
    email: b.email ?? a.email,
    mobile: b.mobile ?? a.mobile,
    role: b.role ?? a.role,
    orgId: b.orgId ?? a.orgId,
    permissions: b.permissions.length ? b.permissions : a.permissions,
    mustChangePassword: b.mustChangePassword,
  };
}
