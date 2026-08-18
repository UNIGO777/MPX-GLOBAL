import { Conversation } from '../models/Conversation.js';
import { Product } from '../models/Product.js';
import { Organisation } from '../models/Organisation.js';
import { emitFreeze, emitUnfreeze } from '../realtime/socket.js';
import { postSystemMessage } from './message.service.js';

/**
 * M4 — freeze state, and the reason that survives.
 *
 * Two decisions make this harder than a boolean, and both are deliberate:
 *
 * **M4-29 — first reason wins.** `frozenReason` is set once and is NOT
 * overwritten while it still applies. A chat blocked by an admin and then hit by
 * a product takedown keeps the *block* label, because that is what a moderator
 * needs to see.
 *
 * **M4-30 — unfreezing is therefore not a toggle.** Lifting one reason must ask
 * whether another still applies. So the state is RE-DERIVED from live data
 * rather than flipped: `frozen: false` is only ever the answer when nothing at
 * all is holding the thread shut.
 */

// The system's own words when a thread changes state. Both parties see these.
export const FREEZE_NOTICES = Object.freeze({
  // M4-21: explain there is an issue, and point the buyer elsewhere.
  takedown:
    'This product is under review by MPX Global, so messaging is paused here. ' +
    'You may want to explore other suppliers in the meantime.',
  restored: 'This product is available again. You can continue the conversation.',
  // M4-25: both parties see the reason the admin wrote — never who wrote it.
  blocked: (reason) => `This conversation has been restricted by MPX Global. Reason: ${reason}`,
  unblocked: 'This conversation has been reopened by MPX Global.',
  // F1-B — the COMPANY is blocked, not this chat and not this product. Worded so
  // neither party is told anything about the other's account status beyond the
  // fact that the conversation cannot continue.
  account:
    'This conversation is paused because the other party\u2019s account is currently unavailable on MPX Global.',
  accountRestored: 'This account is active again. You can continue the conversation.',
});

/**
 * Which freeze reasons apply to this thread RIGHT NOW, read from live state.
 *
 * A missing product counts: a purged row (A8) means the listing was taken down
 * and then hard-deleted, so there is nothing left to trade and the thread must
 * stay shut (M4-22). Without this branch, unblocking a thread whose product had
 * since been purged would cheerfully reopen it.
 *
 * A seller's own `inactive`/`archived` is NOT a reason — M4-20 is explicit that
 * the chat carries on untouched.
 */
async function activeFreezeReasons(conversation) {
  const reasons = [];
  if (conversation.blockedReason) reasons.push('blocked');

  const product = await Product.findOne({ _id: conversation.productId }).select('takedown').lean();
  if (!product || product.takedown?.isDown) reasons.push('takedown');

  // F1-B — a blocked COMPANY keeps its threads shut, whatever happens to the
  // product. Without this branch, restoring a taken-down product would reopen
  // the conversations of a company that is still blocked.
  const blockedParty = await Organisation.exists({ _id: { $in: conversation.parties }, isActive: false });
  if (blockedParty) reasons.push('account');

  return reasons;
}

/**
 * M4-30 — re-derive the freeze from what still applies. Returns the new state.
 * Never call this to freeze something; it is the unfreeze-safely path.
 */
export async function recomputeFreeze(conversation) {
  const reasons = await activeFreezeReasons(conversation);

  if (reasons.length === 0) {
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { frozen: false }, $unset: { frozenReason: '' } },
    );
    return { frozen: false, reason: null };
  }

  // M4-29: if the stored reason is still one of the live ones, it stays.
  const reason = reasons.includes(conversation.frozenReason) ? conversation.frozenReason : reasons[0];
  await Conversation.updateOne({ _id: conversation._id }, { $set: { frozen: true, frozenReason: reason } });
  return { frozen: true, reason };
}

/**
 * Freeze for a reason that is now true. Respects M4-29: if the thread is already
 * frozen, the ORIGINAL reason is kept and only the new fact is recorded.
 */
export async function applyFreeze({ conversation, reason }) {
  const update = { frozen: true };
  if (!conversation.frozen) update.frozenReason = reason;
  await Conversation.updateOne({ _id: conversation._id }, { $set: update });
  return { frozen: true, reason: conversation.frozen ? conversation.frozenReason : reason };
}

/**
 * M4-21 — an admin takedown freezes every thread on that product and explains
 * why in each. Used by M2's takedown path.
 *
 * The system message is posted AFTER the freeze on purpose: `sendMessage` refuses
 * to write into a frozen thread, and `postSystemMessage` deliberately does not,
 * because the notice explaining the freeze has to survive it.
 */
export async function freezeThreadsForProduct({ productId, reason }) {
  const conversations = await Conversation.find({ productId, frozen: { $ne: true } });
  for (const conversation of conversations) {
    await applyFreeze({ conversation, reason });
    await postSystemMessage({
      conversationId: conversation._id,
      body: FREEZE_NOTICES.takedown,
      systemKind: 'product_takedown',
    });
    // §7.4 — pushed, not polled: both composers disable without a refresh.
    emitFreeze(conversation._id, reason);
  }
  return { frozen: conversations.length };
}

/**
 * M4-21 — restoring the product lifts ITS freeze, but only where nothing else
 * still applies (M4-30): a thread an admin had separately blocked stays shut.
 */
export async function unfreezeThreadsForProduct({ productId }) {
  const conversations = await Conversation.find({ productId, frozen: true });
  let reopened = 0;
  for (const conversation of conversations) {
    const state = await recomputeFreeze(conversation);
    if (!state.frozen) {
      reopened += 1;
      await postSystemMessage({
        conversationId: conversation._id,
        body: FREEZE_NOTICES.restored,
        systemKind: 'product_restored',
      });
      emitUnfreeze(conversation._id);
    }
  }
  return { reopened, examined: conversations.length };
}
