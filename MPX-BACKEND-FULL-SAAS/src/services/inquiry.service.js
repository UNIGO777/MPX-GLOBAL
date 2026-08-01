import { Inquiry } from '../models/Inquiry.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Organisation } from '../models/Organisation.js';
import { Category } from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { getPublicProduct } from './publicProducts.service.js';
import { resolveInquiryFields } from '../validators/inquiry.validators.js';
import { notifyNewEnquiry } from './push.service.js';

/**
 * M4-B — enquiry creation. The only way a buyer and a seller ever start talking.
 *
 * One call creates four rows in a fixed order (M4-10):
 *   Inquiry → Conversation → message #1 (the buyer's composed enquiry)
 *                          → message #2 (the platform's welcome)
 *
 * There are no transactions: production MongoDB is a standalone VPS instance,
 * not a replica set. So the sequence compensates by hand if a later step fails,
 * exactly as M1's `createUserWithOrg` does — otherwise a half-created enquiry
 * leaves an orphan row, or a thread that renders permanently blank.
 */

// M4-11 — the automated welcome. Locked wording (2026-07-31, owner).
// Deliberately does NOT say "complete your deal": encouraging completion inside
// the chat pushes deals off-platform, against the Phase-2 escrow model.
export const WELCOME_MESSAGE =
  'MPX Global is part of this conversation. Please keep all discussion and documents here — ' +
  'it is how we can support you if anything goes wrong.';

const FIELD_LABELS = {
  quantity: 'Quantity',
  unit: 'Unit',
  targetPrice: 'Target price',
  budget: 'Budget',
  currency: 'Currency',
  deliveryCountry: 'Delivery to',
  deliveryTimeline: 'Delivery timeline',
  engagementType: 'Engagement type',
  timeline: 'Timeline',
  deliveryModel: 'Delivery model',
};

/**
 * M4-8 — the thread's first message is COMPOSED from the structured fields plus
 * the note, and stored once as a Message. The structured copy stays on Inquiry
 * so it remains queryable; this is the human-readable rendering, not a duplicate
 * source of truth.
 *
 * This routinely exceeds 200 characters, which is exactly why the 200-char cap
 * is a boundary rule for normal user sends and NOT a model constraint (M4-12).
 */
export function composeEnquiryMessage({ fields, note }) {
  const lines = Object.entries(fields ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${FIELD_LABELS[key] ?? key}: ${value}`);
  return [...lines, note].filter(Boolean).join('\n');
}

// The caller must be a buyer ACCOUNT (§A13's posture): `requireRole('buyer')`
// gates the role, but a superadmin passes that gate and the platform org must
// never open a thread, so the org's buyerSide flag is checked here too.
async function loadBuyerOrg(orgId) {
  const org = await Organisation.findOne({ _id: orgId }).select('name buyerSide');
  if (!org || !org.buyerSide) throw AppError.forbidden('not a buyer org', 'Not allowed.');
  return org;
}

// The Inquiry attached to a conversation the caller already owns. Still scoped
// by owner rather than fetched by _id alone (A6) — the conversation lookup and
// this one are independent queries, and "the caller owns the parent" is an
// assumption, not a guarantee, once a second query is involved.
function loadOwnInquiry(conversation, buyerOrgId) {
  return Inquiry.findOne({ _id: conversation.inquiryId, buyerOrgId });
}

/**
 * Wait briefly for the winner of a unique-index race to finish writing.
 *
 * 🔴 The window this closes: `Inquiry` ALSO carries a unique
 * `(buyerOrgId, productId)` index, so under concurrency a loser can fail on the
 * INQUIRY insert while the winner has created its Inquiry but not yet its
 * Conversation. Looking for the Conversation once would find nothing and the raw
 * E11000 escaped as a 500 — the exact outcome V7 exists to prevent, and it only
 * surfaced under real parallel load.
 *
 * The winner is mid-flight and milliseconds away, so a few short retries resolve
 * it. Bounded: a caller must never be held while something is genuinely broken.
 */
async function awaitWinningConversation(buyerOrgId, productId, attempts = 5) {
  for (let i = 0; i < attempts; i += 1) {
    const winner = await Conversation.findOne({ buyerOrgId, productId });
    if (winner) return winner;
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  }
  return null;
}

function mapFieldError(err) {
  if (err?.clientMessage) return AppError.badRequest(err.message, err.clientMessage);
  return err;
}

/**
 * Create the enquiry, or hand back the thread that already exists.
 * Returns { inquiry, conversation, created }.
 */
export async function createInquiry({ user, productId, note, fields, meta }) {
  const buyerOrg = await loadBuyerOrg(user.orgId);

  // A buyer may only enquire on a PUBLICLY VISIBLE product. Reuses the shared
  // availability check so draft / inactive / archived / taken-down / dead-category
  // all 404 here exactly as they do in search — this can never drift from it.
  const product = await getPublicProduct(String(productId));

  // 🔴 F4 self-enquiry guard (M4-39). A21 lets one Organisation hold both a buyer
  // and an exporter side, so this is reachable: without the check the same thread
  // appears in both portals, the company notifies itself, and enquiry counts skew.
  // The model cannot express this — it is only ever caught here.
  if (String(product.exporterOrgId) === String(buyerOrg._id)) {
    throw AppError.badRequest(
      'self enquiry',
      'This product belongs to your own company, so you cannot enquire on it.',
    );
  }

  // M4-5: one enquiry per (buyer, product). Check first for the common case; the
  // unique index below is what actually guarantees it under concurrency.
  const existing = await Conversation.findOne({ buyerOrgId: buyerOrg._id, productId: product._id });
  if (existing) {
    return { conversation: existing, inquiry: await loadOwnInquiry(existing, buyerOrg._id), created: false };
  }

  const leaf = await Category.findOne({ _id: product.categoryId }).select('type').lean();
  let safeFields;
  try {
    safeFields = resolveInquiryFields(fields, leaf?.type);
  } catch (err) {
    throw mapFieldError(err);
  }

  const sellerOrg = await Organisation.findOne({ _id: product.exporterOrgId }).select('name');
  if (!sellerOrg) throw AppError.notFound('seller org missing', 'Not found.');

  let inquiry;
  let conversation;
  try {
    inquiry = await Inquiry.create({
      buyerOrgId: buyerOrg._id,
      exporterOrgId: sellerOrg._id,
      productId: product._id,
      categoryId: product.categoryId,
      fields: safeFields,
      note,
      createdBy: user.userId,
    });

    const body = composeEnquiryMessage({ fields: safeFields, note });
    const openedAt = new Date();

    conversation = await Conversation.create({
      inquiryId: inquiry._id,
      buyerOrgId: buyerOrg._id,
      exporterOrgId: sellerOrg._id,
      productId: product._id,
      // The only product identity that survives the A8 purge (M4-18/M4-22).
      productNameSnapshot: product.name,
      // §8.2 — denormalised so list search is one query with no join.
      buyerOrgName: buyerOrg.name,
      exporterOrgName: sellerOrg.name,
      lastMessageAt: openedAt,
      lastMessagePreview: body.slice(0, 200),
      // The buyer has obviously read the enquiry they just wrote. Stamped from
      // the SAME instant as lastMessageAt so the strict `>` comparison in
      // `isUnread` reads false — otherwise a buyer lands in a thread that is
      // already shouting "unread" at them. The seller's stays unset, which is
      // exactly the "exporter sees it unread, highlighted" step in the flow.
      buyerLastReadAt: openedAt,
    });

    // M4-10: the order is fixed — the buyer's enquiry is #1, the welcome is #2.
    await Message.create({
      conversationId: conversation._id,
      senderType: 'buyer',
      senderOrgId: buyerOrg._id,
      senderUserId: user.userId,
      body,
    });
    await Message.create({
      conversationId: conversation._id,
      senderType: 'system',
      body: WELCOME_MESSAGE,
    });
  } catch (err) {
    // No transactions on standalone Mongo — undo by hand so a failure never
    // leaves an orphan Inquiry or a thread that renders blank forever.
    await compensate({ inquiry, conversation, err });

    // M4-5 under concurrency: two simultaneous enquiries both passed the check
    // above; one won the unique index. The loser must get the WINNER'S thread,
    // never a 500 and never a second thread.
    if (err?.code === 11000) {
      const winner = await awaitWinningConversation(buyerOrg._id, product._id);
      if (winner) {
        return { conversation: winner, inquiry: await loadOwnInquiry(winner, buyerOrg._id), created: false };
      }
      // The winner exists (something owns the unique index) but never finished
      // writing its Conversation — it failed and rolled back between our two
      // lookups. A clean conflict, never a raw driver error.
      throw AppError.conflict(
        'enquiry creation raced',
        'Another request is already creating this enquiry. Please try again.',
      );
    }
    throw err;
  }

  // M4-H — the seller learns someone is interested. Fire-and-forget (never
  // awaited): an enquiry must be created even if push is down or unconfigured.
  notifyNewEnquiry({ conversation, buyerOrgName: buyerOrg.name });

  return { inquiry, conversation, created: true, meta };
}

// Best-effort rollback. Messages are append-only (M4-13) so they cannot be
// deleted — which is why the Conversation is created BEFORE any message and
// removed here: without its conversation a stray message is unreachable, and the
// next attempt starts clean.
async function compensate({ inquiry, conversation, err }) {
  try {
    if (conversation) await Conversation.deleteOne({ _id: conversation._id });
    if (inquiry) await Inquiry.deleteOne({ _id: inquiry._id });
  } catch (cleanupErr) {
    logger.error(
      {
        err: { name: cleanupErr?.name, message: cleanupErr?.message },
        cause: { name: err?.name, message: err?.message },
        inquiryId: inquiry?._id,
        conversationId: conversation?._id,
      },
      'enquiry creation rollback failed — manual cleanup may be needed',
    );
  }
}
