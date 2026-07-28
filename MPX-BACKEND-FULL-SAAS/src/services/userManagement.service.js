import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';

// Platform-staff operation (M1-E). The superadmin (and employees granted
// user:read) manage users across tenants, so access is governed by RBAC (route
// guards), not org-ownership — the reads below intentionally fetch by _id without
// an org filter. A missing record is 404, never 403.

// Escape regex metacharacters so a user-supplied search string is matched
// LITERALLY (never compiled as a pattern) — no ReDoS, no unintended matches.
function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// List + search the user directory, joined to each user's organisation for its
// kycStatus. Curated projection only — passwordHash / permissions / tokens never
// leave the aggregation. pageSize is already capped by the validator.
export async function listUsers({ role, kycStatus, q, page, pageSize }) {
  const match = {};
  if (role) match.role = role;
  if (q) {
    // Anchored, case-insensitive prefix match on the escaped input.
    const rx = new RegExp(`^${escapeRegex(q)}`, 'i');
    match.$or = [{ name: rx }, { email: rx }, { 'mobile.e164': rx }];
  }

  const pipeline = [
    { $match: match },
    { $lookup: { from: 'organisations', localField: 'orgId', foreignField: '_id', as: 'org' } },
    { $unwind: { path: '$org', preserveNullAndEmptyArrays: true } },
    ...(kycStatus ? [{ $match: { 'org.kycStatus': kycStatus } }] : []),
    // _id tiebreaker keeps pagination stable when createdAt values collide.
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        rows: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            // Inclusion projection: only these fields ever surface.
            $project: {
              _id: 0,
              id: '$_id',
              name: 1,
              email: 1,
              mobile: '$mobile.e164',
              role: 1,
              isActive: 1,
              orgId: 1,
              kycStatus: '$org.kycStatus',
              createdAt: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await User.aggregate(pipeline);
  return { rows: result.rows, total: result.total[0]?.count ?? 0, page, pageSize };
}

// One user + a summary of its organisation (for the KYC/verify context). Curated
// in the controller; org is populated with public-safe fields only.
export async function getUser({ id }) {
  const user = await User.findOne({ _id: id }).populate({
    path: 'orgId',
    select: 'name type kycStatus verifiedAt',
  });
  if (!user) throw AppError.notFound('user not found', 'Not found.');
  return user;
}

// Activate / deactivate a user. Deactivation sets isActive=false AND bumps
// tokenVersion — that (not any org flag) is what kills live sessions and blocks
// login (auth-sessions A7). Uses updateOne (not doc.save) so the un-selected,
// required passwordHash never trips validation. Caller is always a superadmin
// (hard route gate); the guards below stop a superadmin from locking itself out
// or taking down a peer.
export async function setUserActive({ id, active, actor, meta }) {
  const user = await User.findOne({ _id: id });
  if (!user) throw AppError.notFound('user not found', 'Not found.');

  // Self-protection: never change your own active state (avoids self-lockout).
  if (String(user._id) === String(actor.userId)) {
    throw AppError.forbidden('cannot change own state', 'You cannot change your own account status.');
  }
  // A superadmin is never deactivatable through this endpoint — one superadmin
  // must never be able to lock out another.
  if (user.role === 'superadmin') {
    throw AppError.forbidden('cannot modify superadmin', 'Not allowed.');
  }

  const before = { isActive: user.isActive };
  const update = { $set: { isActive: active } };
  if (!active) update.$inc = { tokenVersion: 1 };
  await User.updateOne({ _id: user._id }, update);

  await recordAudit({
    actor,
    action: active ? 'user.activate' : 'user.deactivate',
    entityType: 'User',
    entityId: user._id,
    orgId: user.orgId,
    before,
    after: { isActive: active },
    meta,
  });

  // Reflect the new state on the in-memory doc for the response view.
  user.isActive = active;
  return user;
}

// Replace an employee's permission set (M1-F). Superadmin-only (enforced by the
// route's hard role gate). Target must be an employee — anything else is 404 (do
// not reveal that a non-employee id exists / its role).
//
// tokenVersion is intentionally NOT bumped: `authenticate` reads `permissions`
// from the DB on every request, so a grant/revoke takes effect on the employee's
// very next call with no re-login. (auth-sessions A7 bumps tokenVersion on role
// change / deactivation — not on a permission edit. Bumping here would only force
// an unnecessary logout without any enforcement benefit.)
export async function setEmployeePermissions({ id, permissions, actor, meta }) {
  const user = await User.findOne({ _id: id });
  if (!user || user.role !== 'employee') {
    throw AppError.notFound('employee not found', 'Not found.');
  }

  const unique = [...new Set(permissions)];
  // Snapshot a PLAIN copy (not the live MongooseArray) so the append-only audit
  // record can never be affected by later mutation of the document.
  const before = { permissions: [...(user.permissions ?? [])] };
  await User.updateOne({ _id: user._id }, { $set: { permissions: unique } });

  await recordAudit({
    actor,
    action: 'employee.permissions.update',
    entityType: 'User',
    entityId: user._id,
    orgId: user.orgId,
    before,
    after: { permissions: unique },
    meta,
  });

  user.permissions = unique;
  return user;
}
