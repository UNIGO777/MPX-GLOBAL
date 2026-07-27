import { verifyAccessToken } from '../services/token.service.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

// Populates req.user from the DATABASE on every request — nothing role-related is
// ever read from the request body or headers. Also enforces tokenVersion, so a
// bumped version (password change, role change, deactivation, logout) kills the
// session on its next call. The _id load here is the identity of a
// cryptographically-verified token subject, not an ownership-scoped resource read.
export async function authenticate(req, _res, next) {
  try {
    const [scheme, token] = String(req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw AppError.unauthorized('missing bearer token', 'Not authenticated.');
    }

    const payload = verifyAccessToken(token);
    const user = await User.findOne({ _id: payload.sub, isActive: true }).select(
      'role permissions orgId tokenVersion mustChangePassword',
    );
    if (!user) throw AppError.unauthorized('user not found', 'Not authenticated.');
    if (user.tokenVersion !== payload.tv) {
      throw AppError.unauthorized('token version mismatch', 'Session expired. Please sign in again.');
    }

    req.user = {
      userId: String(user._id),
      orgId: user.orgId ? String(user.orgId) : null,
      role: user.role,
      permissions: user.permissions ?? [],
      mustChangePassword: Boolean(user.mustChangePassword),
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Tag so the startup route-guard treats an authenticated route as declared.
authenticate.__auth = true;
