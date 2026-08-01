import mongoose from 'mongoose';

import { ErrorLog } from '../models/ErrorLog.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

/**
 * FINALIZE F5 — the error log viewer.
 *
 * Read-only, like the audit viewer, but for a different reason. The audit trail
 * is immutable because it is evidence; this collection is immutable from the
 * application's side because there is simply no reason to edit an error, and a
 * "clear the errors" button is how a bad week stops being visible. Retention is
 * the TTL's job (90 days, A19) — not a staff member's.
 *
 * This service has no create, update or delete path and must not gain one.
 */

const MAX_PAGE = 50;

// Same local helper as adminOrgs / adminProducts / userManagement — a user-typed
// route fragment goes into a RegExp, so every metacharacter is neutralised first.
function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFilter({ requestId, route, method, statusCode, userId, orgId, from, to }) {
  const filter = {};

  if (requestId) filter.requestId = requestId;
  // Anchored PREFIX match: `/admin/orgs` should find `/admin/orgs/<id>?x=1`, but
  // an unanchored match would let `orgs` also hit an unrelated route elsewhere.
  if (route) filter.route = new RegExp(`^${escapeRegex(route)}`);
  if (method) filter.method = method;
  if (statusCode) filter.statusCode = statusCode;
  if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
  if (orgId) filter.orgId = new mongoose.Types.ObjectId(orgId);

  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = from;
    if (to) filter.occurredAt.$lte = to;
  }

  return filter;
}

/** Resolve the acting user for a whole page in ONE query, never per row. */
async function loadUsers(rows) {
  const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean).map(String))];
  if (ids.length === 0) return new Map();
  const users = await User.find({ _id: { $in: ids } }).select('name role').lean();
  return new Map(
    users.map((u) => [String(u._id), { id: String(u._id), name: u.name, role: u.role }]),
  );
}

function userFor(row, userById) {
  // Most 5xx have no user at all — an unauthenticated request can fail too. That
  // is a real state, not a missing lookup, so it renders as null rather than as
  // an "unknown user" placeholder that would imply someone was signed in.
  if (!row.userId) return null;
  return (
    userById.get(String(row.userId)) ?? {
      // Dangling id (a seed or a migration could leave one). Show the entry
      // anyway — an error must never become invisible because its user row
      // cannot be resolved.
      id: String(row.userId),
      name: null,
      role: null,
    }
  );
}

export async function listErrorEntries(params) {
  const size = Math.min(params.pageSize ?? 20, MAX_PAGE);
  const page = params.page ?? 1;
  const filter = buildFilter(params);

  const [rows, total] = await Promise.all([
    ErrorLog.find(filter)
      // `_id` tiebreaker — errors arrive in bursts and routinely share a
      // millisecond, so without it rows repeat and skip across pages. Served by
      // the {occurredAt: -1, _id: -1} index on the model.
      .sort({ occurredAt: -1, _id: -1 })
      .skip((page - 1) * size)
      .limit(size)
      .lean(),
    ErrorLog.countDocuments(filter),
  ]);

  const userById = await loadUsers(rows);
  return { rows, userById, total, page, pageSize: size, userFor };
}

export async function getErrorEntry(id) {
  const entry = await ErrorLog.findOne({ _id: id }).lean();
  if (!entry) throw AppError.notFound('error log entry not found', 'Not found.');
  const userById = await loadUsers([entry]);
  return { entry, user: userFor(entry, userById) };
}
