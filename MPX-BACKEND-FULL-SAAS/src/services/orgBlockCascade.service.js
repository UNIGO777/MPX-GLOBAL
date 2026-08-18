import { Organisation } from '../models/Organisation.js';
import { Product } from '../models/Product.js';
import { Conversation } from '../models/Conversation.js';
import { logger } from '../utils/logger.js';
import { postSystemMessage } from './message.service.js';
import { recomputeFreeze, FREEZE_NOTICES } from './conversationFreeze.service.js';
import { emitFreeze, emitUnfreeze } from '../realtime/socket.js';

/**
 * F1-B — the half of the org block that reaches the CATALOGUE and the CHATS.
 *
 * F1-A already blocks the company and its users, which kills sessions and login.
 * But until this existed, a blocked seller's products stayed searchable and
 * buyers could still open enquiries that would never be answered — the block
 * "looked like it worked and didn't", which is exactly why FINALIZE lists F1 as
 * its top priority.
 *
 * 🔴 F1 open point 1 — UNBLOCK MUST NOT BLANKET-RESTORE. Some products may have
 * been taken down individually before the account block, and some chats blocked
 * individually. Turning everything back on would silently undo those separate
 * moderation decisions. So prior state is captured first — `Product.prevTakedown`
 * and `Conversation.prevFrozen`, the same pattern as `Category.prevActive` and
 * `User.prevActive` — and unblock restores only what THIS cascade switched off.
 *
 * F1 open point 4 — SCALE. Owner decision (2026-08-01): the cascade runs in the
 * BACKGROUND so the admin gets an immediate response. The account half stays
 * synchronous, because that is the part that must be instant: it is what ends
 * the blocked users' sessions.
 */

// The same reason everywhere, as F1 requires.
const CASCADE_REASON = 'Account blocked by MPX Global';

/**
 * Products: everything the org owns goes into takedown, EXCEPT drafts and
 * archived rows.
 *
 * - drafts were never public, so there is nothing to hide, and taking one down
 *   would strand it exactly as M2 refuses to for a manual takedown
 * - archived rows must never enter takedown (A7): a taken-down archived product
 *   would match the §A8 purge query and be hard-deleted, and archived rows are
 *   kept forever
 */
async function cascadeProducts(orgId) {
  const filter = { exporterOrgId: orgId, status: { $in: ['active', 'inactive'] } };

  // Capture prior state FIRST, in two passes, because the value differs per row.
  await Product.updateMany({ ...filter, 'takedown.isDown': true }, { $set: { prevTakedown: true } });
  await Product.updateMany({ ...filter, 'takedown.isDown': { $ne: true } }, { $set: { prevTakedown: false } });

  // Only the ones that were NOT already down need taking down. Rows already in
  // takedown keep their original reason and actor — an org block must not
  // rewrite why a product was individually removed.
  const res = await Product.updateMany(
    { ...filter, 'takedown.isDown': { $ne: true } },
    { $set: { takedown: { isDown: true, reason: CASCADE_REASON, at: new Date() } } },
  );

  // ⚠️ `Organisation.takedownCount` is deliberately NOT incremented. §A24 counts
  // OFFENCES — individual moderation decisions about individual listings. One
  // account block is a single decision; inflating the counter by the size of the
  // seller's catalogue would corrupt the very signal that drives F6.
  return res.modifiedCount ?? 0;
}

/** Conversations: every thread the org is a party to, on either side. */
async function cascadeConversations(orgId) {
  const filter = { parties: orgId };

  await Conversation.updateMany({ ...filter, frozen: true }, { $set: { prevFrozen: true } });
  await Conversation.updateMany({ ...filter, frozen: { $ne: true } }, { $set: { prevFrozen: false } });

  // Freeze only what is currently open. M4-29 (first reason wins) is honoured by
  // construction: an already-frozen thread keeps its own reason and is skipped.
  const toFreeze = await Conversation.find({ ...filter, frozen: { $ne: true } }).select('_id').lean();

  for (const row of toFreeze) {
    await Conversation.updateOne({ _id: row._id }, { $set: { frozen: true, frozenReason: 'account' } });
    // Posted AFTER the freeze on purpose — `postSystemMessage` bypasses the
    // frozen guard so the notice explaining the freeze can survive it.
    await postSystemMessage({
      conversationId: row._id,
      body: FREEZE_NOTICES.account,
      systemKind: 'account_paused',
    });
    emitFreeze(row._id, 'account');
  }
  return toFreeze.length;
}

/** Undo — restoring ONLY what this cascade switched off. */
async function restoreProducts(orgId) {
  const res = await Product.updateMany(
    { exporterOrgId: orgId, prevTakedown: false },
    { $set: { takedown: { isDown: false } } },
  );
  // Clear the marker on every row, so a later block captures fresh state rather
  // than restoring a stale snapshot.
  await Product.updateMany({ exporterOrgId: orgId }, { $unset: { prevTakedown: '' } });
  return res.modifiedCount ?? 0;
}

async function restoreConversations(orgId) {
  const candidates = await Conversation.find({ parties: orgId, prevFrozen: false });
  let reopened = 0;

  for (const conversation of candidates) {
    // M4-30 — never a blind unfreeze. A thread whose product is still taken
    // down, or which an admin blocked separately, stays shut.
    const state = await recomputeFreeze(conversation);
    if (!state.frozen) {
      reopened += 1;
      await postSystemMessage({
        conversationId: conversation._id,
        body: FREEZE_NOTICES.accountRestored,
        systemKind: 'account_restored',
      });
      emitUnfreeze(conversation._id);
    }
  }

  await Conversation.updateMany({ parties: orgId }, { $unset: { prevFrozen: '' } });
  return reopened;
}

/**
 * Record what the cascade did, so the console can tell the truth about it.
 *
 * This exists BECAUSE the cascade is asynchronous (owner's choice). A background
 * job that fails silently would leave a blocked company's catalogue live with
 * nobody aware — strictly worse than the documented gap it replaced. The status
 * is written on the Organisation and surfaced on the detail screen.
 */
async function setCascadeState(orgId, state) {
  await Organisation.updateOne({ _id: orgId }, { $set: { blockCascade: state } });
}

async function runCascade({ orgId, direction }) {
  const startedAt = new Date();
  await setCascadeState(orgId, { status: 'running', direction, startedAt });

  try {
    const products = direction === 'block' ? await cascadeProducts(orgId) : await restoreProducts(orgId);
    const conversations =
      direction === 'block' ? await cascadeConversations(orgId) : await restoreConversations(orgId);

    await setCascadeState(orgId, {
      status: 'done', direction, startedAt, completedAt: new Date(), products, conversations,
    });
    logger.info({ orgId: String(orgId), direction, products, conversations }, 'org block cascade complete');
  } catch (err) {
    // Loud, and recorded on the row: an admin looking at this company must be
    // able to see that the catalogue was NOT hidden.
    await setCascadeState(orgId, {
      status: 'failed', direction, startedAt, completedAt: new Date(),
      error: err?.message ?? 'unknown',
    }).catch(() => {});
    logger.error(
      { err: { name: err?.name, message: err?.message }, orgId: String(orgId), direction },
      'org block cascade FAILED — the catalogue may still be live',
    );
  }
}

/**
 * Kick the cascade off without blocking the caller (owner decision: option B).
 * Deliberately not awaited — the account half has already taken effect by the
 * time this is called, so the admin's response is honest about what is done.
 */
export function startBlockCascade(orgId) {
  runCascade({ orgId, direction: 'block' });
}

export function startUnblockCascade(orgId) {
  runCascade({ orgId, direction: 'unblock' });
}

/** Exported for tests and for a future retry path — runs to completion. */
export const runCascadeNow = runCascade;
