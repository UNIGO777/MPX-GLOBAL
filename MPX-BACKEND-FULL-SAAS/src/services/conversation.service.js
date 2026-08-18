import mongoose from 'mongoose';

import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Product } from '../models/Product.js';
import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { isObjectIdLike } from '../utils/idOrSlug.js';
import {
  searchClause,
  isNameSearch,
  loadOrgLogos,
  encodeCursor,
  decodeCursor,
  cursorClause,
  combineFilter,
} from './conversationSearch.js';

/**
 * M4-C — reading threads.
 *
 * Two rules shape everything here:
 *
 * 1. A Message has NO owner field, so it can never be fetched by id alone. Every
 *    path loads the Conversation first, proves the caller is a party, and only
 *    then touches messages by `conversationId`.
 * 2. Scoping is by ROLE + org, not by `parties` alone. Under A21 one Organisation
 *    may hold BOTH a buyer and an exporter side; `{ parties: orgId }` would then
 *    show that company's selling conversations inside its buyer portal. §8.4 is
 *    right to split it — the buyer account sees threads where it is the buyer.
 */

const MAX_PAGE = 50;

export function viewerSideFor(user) {
  if (user.role === 'buyer') return 'buyer';
  if (user.role === 'exporter') return 'exporter';
  return 'staff';
}

// §8.4 — role changes ONLY the scope filter, never the fields that are searched.
function scopeFilter(user) {
  const side = viewerSideFor(user);
  if (side === 'buyer') return { buyerOrgId: new mongoose.Types.ObjectId(user.orgId) };
  if (side === 'exporter') return { exporterOrgId: new mongoose.Types.ObjectId(user.orgId) };
  // Staff have no party list of their own — the platform is never a member
  // (M4-2), so this deliberately matches nothing. Staff use /admin/conversations.
  //
  // ⚠️ Filters on `parties`, NOT on `_id`. The obvious `{ _id: null }` produced
  // the right answer only by accident: spread into `{ _id: id, ...scope }` the
  // duplicate key silently OVERWROTE the id being looked up. It happened to
  // yield "match nothing", but a filter that works because of key collision is
  // one refactor away from working the other way.
  return { parties: null };
}

// Batch-load the page's products in ONE query — the title and the purged label
// both need to know whether the row still exists (M4-18 / C5).
async function loadProducts(conversations) {
  const ids = [...new Set(conversations.map((c) => String(c.productId)))];
  if (ids.length === 0) return new Map();
  const rows = await Product.find({ _id: { $in: ids } }).select('name slug').lean();
  return new Map(rows.map((p) => [String(p._id), p]));
}

export async function listConversations({ user, q, cursor, limit }) {
  const pageSize = Math.min(limit ?? 20, MAX_PAGE);

  let decoded = null;
  if (cursor) {
    decoded = decodeCursor(cursor);
    if (!decoded) throw AppError.badRequest('bad cursor', 'Invalid page cursor.');
  }

  // Page 1 always tries the indexed `$text` path. Later pages stay in whichever
  // mode page 1 settled on — the cursor carries it.
  let mode = decoded?.mode ?? 'text';

  const runQuery = (searchMode) =>
    Conversation.find(
      combineFilter(
        scopeFilter(user),
        searchClause(q, searchMode),
        decoded ? cursorClause(decoded) : null,
      ),
    )
      .sort({ lastMessageAt: -1, _id: -1 })
      // One extra row tells us whether another page exists, without a count.
      .limit(pageSize + 1)
      .lean();

  let rows = await runQuery(mode);

  // The partial-match fallback (§8.3). Only on a FIRST page — mid-pagination the
  // mode is already fixed — and only when the indexed search found nothing, so
  // the scan is paid for exclusively by searches that were about to fail.
  if (rows.length === 0 && !cursor && mode === 'text' && isNameSearch(q)) {
    mode = 'regex';
    rows = await runQuery(mode);
  }

  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;

  return {
    rows: page,
    products: await loadProducts(page),
    logos: await loadOrgLogos(Organisation, page),
    nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1], mode) : null,
  };
}

/**
 * §7.5 / G7 — the nav badge. ONE query comparing the two stored timestamps; no
 * counter is stored anywhere and no per-row count is issued.
 */
export function unreadCount(user) {
  const side = viewerSideFor(user);
  if (side === 'staff') return Promise.resolve(0);
  const readField = side === 'buyer' ? '$buyerLastReadAt' : '$exporterLastReadAt';
  return Conversation.countDocuments({
    ...scopeFilter(user),
    $expr: { $gt: ['$lastMessageAt', { $ifNull: [readField, new Date(0)] }] },
  });
}

/**
 * Load a thread the caller is a party to. Anything else is 404 — never 403,
 * which would confirm the thread exists.
 */
export async function loadPartyConversation({ user, id }) {
  const conversation = await Conversation.findOne({ _id: id, ...scopeFilter(user) });
  if (!conversation) throw AppError.notFound('conversation not found', 'Not found.');
  return conversation;
}

export async function getConversation({ user, id }) {
  const conversation = await loadPartyConversation({ user, id });
  const products = await loadProducts([conversation]);
  return {
    conversation,
    product: products.get(String(conversation.productId)) ?? null,
    logos: await loadOrgLogos(Organisation, [conversation]),
  };
}

/**
 * G8 — the product page's button state ("Create enquiry" vs "Open chat").
 * A separate authenticated lookup on purpose: `GET /public/products/:id` is a
 * public, guest-cacheable response and must not grow a per-caller field.
 */
export async function findByProduct({ user, productId }) {
  const conversation = await Conversation.findOne({ productId, ...scopeFilter(user) }).select('_id').lean();
  if (!conversation) throw AppError.notFound('no thread for product', 'Not found.');
  return { conversationId: String(conversation._id) };
}

/**
 * §7.6 — cursor pagination, never page numbers: a new message arriving mid-scroll
 * shifts every offset, and the reader sees a duplicate or a gap.
 * `before` is a message id; the reply is oldest-first for rendering.
 */
export async function listMessages({ user, id, before, limit }) {
  // Rule 1: prove membership through the CONVERSATION before touching messages.
  await loadPartyConversation({ user, id });

  const pageSize = Math.min(limit ?? 30, MAX_PAGE);
  const filter = { conversationId: id };
  if (before) {
    if (!isObjectIdLike(before)) throw AppError.badRequest('bad cursor', 'Invalid page cursor.');
    const anchor = await Message.findOne({ _id: before, conversationId: id }).select('createdAt').lean();
    if (!anchor) throw AppError.badRequest('unknown cursor', 'Invalid page cursor.');
    filter.$or = [
      { createdAt: { $lt: anchor.createdAt } },
      { createdAt: anchor.createdAt, _id: { $lt: new mongoose.Types.ObjectId(before) } },
    ];
  }

  const rows = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(pageSize + 1).lean();
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;

  return {
    // Oldest-first: the client appends upward when scrolling back.
    rows: page.slice().reverse(),
    nextBefore: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null,
  };
}

/** §7.5 — opening a thread stamps the reader's own timestamp. */
export async function markRead({ user, id }) {
  const conversation = await loadPartyConversation({ user, id });
  const side = viewerSideFor(user);
  const field = side === 'buyer' ? 'buyerLastReadAt' : 'exporterLastReadAt';
  const readAt = new Date();
  await Conversation.updateOne({ _id: conversation._id }, { $set: { [field]: readAt } });
  return { readAt };
}
