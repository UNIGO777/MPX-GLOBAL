import { AppError } from '../utils/AppError.js';

// Default-deny RBAC (auth-sessions A5). Mount after `authenticate`. Superadmin is
// all-access. Every protected route must declare one of these. The returned
// middleware is tagged `__rbac` so the startup route-guard recognises it as an
// access-control declaration.

export function requireRole(...roles) {
  const allowed = new Set(roles);
  const mw = (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized('no auth', 'Not authenticated.'));
    if (req.user.role === 'superadmin' || allowed.has(req.user.role)) return next();
    return next(AppError.forbidden('role not allowed', 'Not allowed.'));
  };
  mw.__rbac = true;
  return mw;
}

export function requirePermissions(...perms) {
  const mw = (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized('no auth', 'Not authenticated.'));
    if (req.user.role === 'superadmin') return next();
    const held = new Set(req.user.permissions ?? []);
    if (perms.every((p) => held.has(p))) return next();
    return next(AppError.forbidden('missing permission', 'Not allowed.'));
  };
  mw.__rbac = true;
  return mw;
}
