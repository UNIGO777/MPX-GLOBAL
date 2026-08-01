import mongoose from 'mongoose';

import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Product } from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { isObjectIdLike } from '../utils/idOrSlug.js';
import { recordAudit } from './audit.service.js';
import { postSystemMessage } from './message.service.js';
import { recomputeFreeze, FREEZE_NOTICES } from './conversationFreeze.service.js';
import { emitFreeze, emitUnfreeze } from '../realtime/socket.js';

/**
 * M4-E — staff moderation of conversations.
 *
 * Access is by ROLE/PERMISSION, never by membership (M4-2) — the platform is
 * never in `parties`, so none of these reads are ownership-scoped. That is
 * exactly why every one of them that touches CONTENT is audited (M4-34): an
 * employee reading two companies' private commercial conversation leaves a
 * record identical to a superadmin's.
 */

const MAX_PAGE = 50;

// Same branch as the party list: native `$text` must be the first `$match` and
// cannot sit inside an `$or`, so "three names OR two ids" is two queries, chosen
// by the shape of the input.
function searchClause(q) {
  if (!q) return {};
  if (isObjectIdLike(q)) {
    const id = new mongoose.Types.ObjectId(q);
    return { $or: [{ buyerOrgId: id }, { exporterOrgId: id }] };
  }
  return { $text: { $search: q } };
}

/**
 * G3/G4 — the two targeted filters M5's screens navigate by. `q` alone cannot
 * express either:
 *
 *   productId  §4's "view that product's chats". `q` only ever branches on an
 *              ORG id, so a product id matched nothing at all.
 *   side+orgId §7 needs the buyer-account chats and the exporter-account chats
 *              as TWO lists, and explains why that works — each filters on its
 *              own field. `q` always `$or`s both, so a company holding both
 *              sides could never be split.
 */
function targetClause({ productId, side, orgId }) {
  const clause = {};
  if (productId) clause.productId = new mongoose.Types.ObjectId(productId);
  if (orgId) {
    const id = new mongoose.Types.ObjectId(orgId);
    if (side === 'buyer') clause.buyerOrgId = id;
    else if (side === 'exporter') clause.exporterOrgId = id;
    // No side given: both, which is the same reach as pasting the id into `q`.
    else clause.$or = [{ buyerOrgId: id }, { exporterOrgId: id }];
  }
  return clause;
}

// Cursor is (lastMessageAt, _id) — see listAdminConversations for why this list
// cannot use page numbers.
function encodeCursor(row) {
  return Buffer.from(`${row.lastMessageAt.getTime()}:${row._id}`).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split(':');
    const millis = Number(at);
    if (!Number.isFinite(millis) || !isObjectIdLike(id)) return null;
    return { at: new Date(millis), id: new mongoose.Types.ObjectId(id) };
  } catch {
    return null;
  }
}

async function loadProducts(conversations) {
  const ids = [...new Set(conversations.map((c) => String(c.productId)))];
  if (ids.length === 0) return new Map();
  const rows = await Product.find({ _id: { $in: ids } }).select('name slug').lean();
  return new Map(rows.map((p) => [String(p._id), p]));
}

/**
 * Every thread on the platform. Deliberately NOT audited (G11): the list is
 * metadata, and writing a record for every keystroke of a moderator's search
 * would bury the reads that actually matter.
 *
 * 🔴 CURSOR pagination, never page numbers (m5-rules §9). This list sorts by
 * `lastMessageAt`, so every message sent anywhere on the platform reorders it
 * under a moderator who is paging — with `skip` they would see the same thread
 * twice and miss another entirely. The party-facing list already did this
 * correctly; only the admin one used `skip`, and it is the one where rows churn
 * fastest.
 */
export async function listAdminConversations({ q, productId, side, orgId, cursor, limit }) {
  const size = Math.min(limit ?? 20, MAX_PAGE);
  const filter = { ...searchClause(q), ...targetClause({ productId, side, orgId }) };

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) throw AppError.badRequest('bad cursor', 'Invalid page cursor.');
    // Held in `$and` so it can never collide with an `$or` from either clause
    // above — both the id search and the side-less org filter use one.
    filter.$and = [
      {
        $or: [
          { lastMessageAt: { $lt: decoded.at } },
          { lastMessageAt: decoded.at, _id: { $lt: decoded.id } },
        ],
      },
    ];
  }

  // One extra row answers "is there another page?" without a count.
  const rows = await Conversation.find(filter)
    .sort({ lastMessageAt: -1, _id: -1 })
    .limit(size + 1)
    .lean();

  const hasMore = rows.length > size;
  const page = hasMore ? rows.slice(0, size) : rows;

  return {
    rows: page,
    products: await loadProducts(page),
    nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]) : null,
  };
}

/**
 * §7 — the two chat counts on Organisation detail. Kept here so the org screen
 * never reimplements the side split.
 */
export async function countConversationsForOrg(orgId) {
  const id = new mongoose.Types.ObjectId(orgId);
  const [asBuyer, asExporter] = await Promise.all([
    Conversation.countDocuments({ buyerOrgId: id }),
    Conversation.countDocuments({ exporterOrgId: id }),
  ]);
  return { asBuyer, asExporter };
}

async function loadConversation(id) {
  // Staff read: by id, no ownership filter (RBAC is the gate). Missing → 404.
  const conversation = await Conversation.findOne({ _id: id });
  if (!conversation) throw AppError.notFound('conversation not found', 'Not found.');
  return conversation;
}

/** M4-34 — reading a thread is an audited act, for employees and superadmins alike. */
export async function getAdminConversation({ id, actor, meta }) {
  const conversation = await loadConversation(id);
  const products = await loadProducts([conversation]);

  await recordAudit({
    actor,
    action: 'conversation.read',
    entityType: 'Conversation',
    entityId: conversation._id,
    orgId: conversation.exporterOrgId,
    after: { scope: 'thread' },
    meta,
  });

  return { conversation, product: products.get(String(conversation.productId)) ?? null };
}

/** The content itself — audited for the same reason. */
export async function getAdminMessages({ id, before, limit, actor, meta }) {
  const conversation = await loadConversation(id);
  const size = Math.min(limit ?? 30, MAX_PAGE);

  const filter = { conversationId: conversation._id };
  if (before) {
    if (!isObjectIdLike(before)) throw AppError.badRequest('bad cursor', 'Invalid page cursor.');
    const anchor = await Message.findOne({ _id: before, conversationId: conversation._id })
      .select('createdAt').lean();
    if (!anchor) throw AppError.badRequest('unknown cursor', 'Invalid page cursor.');
    filter.$or = [
      { createdAt: { $lt: anchor.createdAt } },
      { createdAt: anchor.createdAt, _id: { $lt: new mongoose.Types.ObjectId(before) } },
    ];
  }

  const rows = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(size + 1).lean();
  const hasMore = rows.length > size;
  const page = hasMore ? rows.slice(0, size) : rows;

  await recordAudit({
    actor,
    action: 'conversation.read',
    entityType: 'Conversation',
    entityId: conversation._id,
    orgId: conversation.exporterOrgId,
    after: { scope: 'messages', count: page.length },
    meta,
  });

  return { rows: page.slice().reverse(), nextBefore: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null };
}

/**
 * M4-23 — block ONE chat, independently of the product. The product stays live
 * and its other threads are untouched (M4-26: exactly two enforcement levels
 * exist — this, or suspending the whole account).
 */
export async function blockConversation({ id, reason, actor, meta }) {
  const conversation = await loadConversation(id);
  if (conversation.blockedReason) {
    throw AppError.conflict('already blocked', 'This conversation is already blocked.');
  }

  const update = { blockedReason: reason, blockedBy: actor.userId, blockedAt: new Date(), frozen: true };
  // M4-29: if a takedown already froze this thread, THAT reason stays — the
  // block is still recorded, it just does not take over the label.
  if (!conversation.frozen) update.frozenReason = 'blocked';
  await Conversation.updateOne({ _id: conversation._id }, { $set: update });

  await postSystemMessage({ conversationId: conversation._id, body: FREEZE_NOTICES.blocked(reason) });
  emitFreeze(conversation._id, 'blocked');

  await recordAudit({
    actor,
    action: 'conversation.block',
    entityType: 'Conversation',
    entityId: conversation._id,
    orgId: conversation.exporterOrgId,
    before: { frozen: conversation.frozen, frozenReason: conversation.frozenReason ?? null },
    after: { reason },
    meta,
  });

  return Conversation.findOne({ _id: conversation._id });
}

/**
 * M4-24 — reversible. But NOT a toggle (M4-30): lifting the block re-derives the
 * freeze, so a thread whose product is still taken down (or already purged)
 * stays shut.
 */
export async function unblockConversation({ id, reason, actor, meta }) {
  const conversation = await loadConversation(id);
  if (!conversation.blockedReason) {
    throw AppError.conflict('not blocked', 'This conversation is not blocked.');
  }

  const before = { reason: conversation.blockedReason };
  await Conversation.updateOne(
    { _id: conversation._id },
    { $unset: { blockedReason: '', blockedBy: '', blockedAt: '' } },
  );

  const fresh = await Conversation.findOne({ _id: conversation._id });
  const state = await recomputeFreeze(fresh);

  await postSystemMessage({
    conversationId: conversation._id,
    // Only claim it is reopened if it actually is.
    body: state.frozen ? FREEZE_NOTICES.takedown : FREEZE_NOTICES.unblocked,
  });
  // §7.4 — and only announce a reopening that actually happened (M4-30).
  if (!state.frozen) emitUnfreeze(conversation._id);

  await recordAudit({
    actor,
    action: 'conversation.unblock',
    entityType: 'Conversation',
    entityId: conversation._id,
    orgId: conversation.exporterOrgId,
    before,
    after: { ...(reason ? { reason } : {}), stillFrozen: state.frozen, remainingReason: state.reason },
    meta,
  });

  return Conversation.findOne({ _id: conversation._id });
}
