import { verifyAccessToken } from '../services/token.service.js';
import { User } from '../models/User.js';

/**
 * Public route that is nicer when it knows who you are.
 *
 * Unlike `authenticate`, this NEVER throws: a missing, malformed, expired or
 * stale token simply leaves `req.user` undefined and the request continues as a
 * guest. Used by AI search, which guests may call but which keys its rate limit
 * and per-organisation quota per user when one is signed in.
 *
 * Carries the `__public` marker so the boot route-guard counts it as an
 * access-control declaration (the route IS public — that is the declaration).
 */
export async function optionalAuthenticate(req, _res, next) {
  try {
    const [scheme, token] = String(req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return next();

    const payload = verifyAccessToken(token);
    const user = await User.findOne({ _id: payload.sub, isActive: true }).select(
      'role permissions orgId tokenVersion mustChangePassword',
    );
    // Same tokenVersion rule as `authenticate` — a revoked session is a guest
    // here, never a partially-trusted caller.
    if (user && user.tokenVersion === payload.tv) {
      req.user = {
        userId: String(user._id),
        orgId: user.orgId ? String(user.orgId) : null,
        role: user.role,
        permissions: user.permissions ?? [],
        mustChangePassword: Boolean(user.mustChangePassword),
      };
    }
  } catch {
    // Deliberately swallowed: an invalid token downgrades to guest, it does not
    // fail the request.
  }
  return next();
}

optionalAuthenticate.__public = true;
