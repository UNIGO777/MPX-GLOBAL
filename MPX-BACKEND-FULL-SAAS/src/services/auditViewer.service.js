import mongoose from 'mongoose';

import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Organisation } from '../models/Organisation.js';
import { Category } from '../models/Category.js';
import { CategoryAttribute } from '../models/CategoryAttribute.js';
import { FeaturedItem } from '../models/FeaturedItem.js';
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

/**
 * Which audited entity types may have their name resolved for display, and from
 * which field. An ALLOWLIST on purpose — a type absent here simply renders
 * without a name rather than having one guessed, so adding a model to the audit
 * trail can never quietly widen what this screen shows.
 *
 * Deliberately absent:
 *  - `Conversation` — thread titles are composed at read time from the parties'
 *    company names (A22.3), never stored; there is nothing here to read.
 *  - `PendingSignup` — a person who never completed signup. Their name is not
 *    something the audit viewer needs in order to describe the action.
 */
const NAMEABLE = {
  Product: [Product, 'name'],
  Organisation: [Organisation, 'name'],
  Category: [Category, 'name'],
  CategoryAttribute: [CategoryAttribute, 'name'],
  User: [User, 'name'],
  FeaturedItem: [FeaturedItem, 'title'],
};

/**
 * The name a row's snapshot preserved, for targets that no longer exist.
 *
 * This is what makes a purge row self-contained (§A8): the product row and its
 * images are gone, so the AuditLog entry is the only remaining record, and it
 * snapshots `productName` + `sellerCompanyName` precisely for this moment.
 */
function snapshotName(row) {
  const snap = { ...(row.before ?? {}), ...(row.after ?? {}) };
  return snap.productName ?? snap.name ?? snap.title ?? null;
}

/**
 * Resolve target names for a page in ONE query PER TYPE — never per row.
 *
 * A page carries at most a handful of distinct entity types (usually two or
 * three), so this is 2–3 small indexed `$in` lookups, the same shape as the
 * actor resolution above.
 */
async function loadTargetNames(rows) {
  const byType = new Map();
  for (const row of rows) {
    if (!row.entityId || !NAMEABLE[row.entityType]) continue;
    if (!byType.has(row.entityType)) byType.set(row.entityType, new Set());
    byType.get(row.entityType).add(String(row.entityId));
  }

  const names = new Map(); // `${type}:${id}` -> name
  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      const [Model, field] = NAMEABLE[type];
      const docs = await Model.find({ _id: { $in: [...ids] } })
        .select(field)
        .lean();
      for (const doc of docs) names.set(`${type}:${String(doc._id)}`, doc[field] ?? null);
    }),
  );
  return names;
}

/**
 * Live name first, snapshot second, null last.
 *
 * The order matters: a renamed entity should read under its CURRENT name so the
 * row still points at something findable, while a DELETED one falls back to what
 * the entry preserved. `null` is an honest answer — most actions never recorded a
 * name (a takedown stores its reason, a publish stores its status), so a row
 * whose target has since been removed genuinely has no name to show, and
 * inventing one would be worse than the gap.
 */
function targetNameFor(row, nameById) {
  if (row.entityId && row.entityType) {
    const live = nameById.get(`${row.entityType}:${String(row.entityId)}`);
    if (live) return live;
  }
  return snapshotName(row);
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

  const [actorById, nameById] = await Promise.all([loadActors(rows), loadTargetNames(rows)]);
  return {
    rows,
    actorById,
    total,
    page,
    pageSize: size,
    actorFor,
    targetNameFor: (row) => targetNameFor(row, nameById),
  };
}

export async function getAuditEntry(id) {
  const entry = await AuditLog.findOne({ _id: id }).lean();
  if (!entry) throw AppError.notFound('audit entry not found', 'Not found.');
  const [actorById, nameById] = await Promise.all([loadActors([entry]), loadTargetNames([entry])]);
  return { entry, actor: actorFor(entry, actorById), targetName: targetNameFor(entry, nameById) };
}
