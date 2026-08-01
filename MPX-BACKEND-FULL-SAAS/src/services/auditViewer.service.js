import mongoose from 'mongoose';

import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

/**
 * M5-C — the audit log viewer.
 *
 * Read-only and append-only, with no exceptions (rule 1). There is no update
 * path, no delete path and no bulk clear anywhere in this file, and the model
 * refuses all three even if one were added — this is the record that protects
 * the operator in a dispute, and a mutable audit log is worth nothing.
 */

const MAX_PAGE = 50;

// A system job has no acting user — `purgeBlockedProducts` writes actorId: null
// deliberately. That row is precisely the one a dispute is most likely to need
// (it is the only hard delete in the system), so it must render as an actor, not
// as a blank.
const SYSTEM_ACTOR = { id: null, name: 'System', role: 'system' };

function buildFilter({ actorId, action, entityType, entityId, orgId, from, to }) {
  const filter = {};

  if (actorId) filter.actorId = new mongoose.Types.ObjectId(actorId);
  // §7's "this Organisation's full record". NOT expressible as entityType +
  // entityId: a product takedown carries entityType 'Product' but the seller's
  // orgId, so filtering by target alone would miss most of a company's history.
  if (orgId) filter.orgId = new mongoose.Types.ObjectId(orgId);
  // `action` is matched EXACTLY and is deliberately not an enum: the action list
  // grows with every module, and a stale allowlist would hide new entries from
  // the viewer rather than show them.
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = new mongoose.Types.ObjectId(entityId);

  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = from;
    if (to) filter.occurredAt.$lte = to;
  }

  return filter;
}

/** Resolve actor names for a page in ONE query, never per row. */
async function loadActors(rows) {
  const ids = [...new Set(rows.map((r) => r.actorId).filter(Boolean).map(String))];
  if (ids.length === 0) return new Map();
  const users = await User.find({ _id: { $in: ids } }).select('name role').lean();
  return new Map(users.map((u) => [String(u._id), { id: String(u._id), name: u.name, role: u.role }]));
}

function actorFor(row, actorById) {
  if (!row.actorId) return SYSTEM_ACTOR;
  return (
    actorById.get(String(row.actorId)) ?? {
      // The user row is gone (they are only ever deactivated, never deleted —
      // but a seed or a migration could still leave a dangling id). Render the
      // entry rather than dropping it: an audit row must never disappear because
      // its actor cannot be resolved.
      id: String(row.actorId),
      name: null,
      role: row.actorRole ?? null,
    }
  );
}

export async function listAuditEntries(params) {
  const size = Math.min(params.pageSize ?? 20, MAX_PAGE);
  const page = params.page ?? 1;
  const filter = buildFilter(params);

  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      // `occurredAt` + `_id` — a tiebreaker, or rows repeat and skip across
      // pages when several entries share a timestamp (rule 9). Served by the
      // {action, occurredAt} / {actorId, occurredAt} indexes added in M5-A.
      .sort({ occurredAt: -1, _id: -1 })
      .skip((page - 1) * size)
      .limit(size)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  const actorById = await loadActors(rows);
  return { rows, actorById, total, page, pageSize: size, actorFor };
}

export async function getAuditEntry(id) {
  const entry = await AuditLog.findOne({ _id: id }).lean();
  if (!entry) throw AppError.notFound('audit entry not found', 'Not found.');
  const actorById = await loadActors([entry]);
  return { entry, actor: actorFor(entry, actorById) };
}
