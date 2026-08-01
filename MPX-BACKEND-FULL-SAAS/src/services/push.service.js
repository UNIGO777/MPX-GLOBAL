import { DeviceToken } from '../models/DeviceToken.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { isPushConfigured, sendToTokens } from './push.client.js';
import { usersInConversationRoom } from '../realtime/socket.js';

/**
 * M4-H — push notifications, narrow slice.
 *
 * 🔴 Scope: approved into month 1 by the owner (2026-07-31) as a SCHEDULE change,
 * not a scope change — notifications are quote Module 8, already inside Phase 1.
 * Only two events send: a new enquiry, and a new message. Email, WhatsApp, the
 * in-app centre, admin per-type controls and every non-M4 event remain deferred
 * (`month1-not-doing.md` A3 / `Note.md` D5) and still need a red alert.
 *
 * 🔴 D-N1 — the payload NEVER carries the message body. This whole module exists
 * to keep commercial detail off other channels, and a push lands on a lock
 * screen where anyone holding the phone can read it. Company + product only.
 */

/** Registration is an UPSERT: a device changes hands and FCM reuses the token. */
export async function registerDevice({ user, token, platform }) {
  await DeviceToken.updateOne(
    { token },
    { $set: { userId: user.userId, orgId: user.orgId, platform, lastSeenAt: new Date() } },
    { upsert: true },
  );
  return { registered: true };
}

export async function unregisterDevice({ user, token }) {
  // Ownership-scoped: a caller may only drop their OWN device.
  await DeviceToken.deleteOne({ token, userId: user.userId });
  return { unregistered: true };
}

/**
 * D-N2 — every ACTIVE user of the recipient org. An Organisation may hold several
 * people and any of them could be the one watching.
 * D-N3 — minus anyone currently sitting in the thread, and always minus the sender.
 */
async function targetTokens({ orgId, conversationId, excludeUserId }) {
  const users = await User.find({ orgId, isActive: true }).select('_id').lean();
  const watching = conversationId ? await usersInConversationRoom(conversationId) : new Set();

  const userIds = users
    .map((u) => String(u._id))
    .filter((id) => id !== String(excludeUserId) && !watching.has(id));

  if (userIds.length === 0) return [];
  const rows = await DeviceToken.find({ userId: { $in: userIds } }).select('token').lean();
  return rows.map((r) => r.token);
}

async function dispatch({ tokens, title, body, data }) {
  const { deadTokens } = await sendToTokens({ tokens, title, body, data });
  // Dead tokens are deleted, or the rows accumulate forever and every future
  // send wastes a call on a device that no longer exists.
  if (deadTokens.length > 0) {
    await DeviceToken.deleteMany({ token: { $in: deadTokens } });
  }
}

/**
 * Fire-and-forget by construction.
 *
 * 🔴 A notification failure must NEVER fail the thing that triggered it. A buyer's
 * message being saved and delivered cannot depend on Firebase being reachable —
 * so every caller invokes these without awaiting, and nothing here throws.
 */
function safely(promise) {
  return promise.catch((err) =>
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'push notification skipped'),
  );
}

/** A new enquiry — the seller learns someone is interested. */
export function notifyNewEnquiry({ conversation, buyerOrgName }) {
  if (!isPushConfigured()) return Promise.resolve();
  return safely(
    (async () => {
      const tokens = await targetTokens({
        orgId: conversation.exporterOrgId,
        conversationId: conversation._id,
      });
      await dispatch({
        tokens,
        title: 'New enquiry',
        // No commercial detail, no note — just who and about what (D-N1).
        body: `${buyerOrgName} enquired about ${conversation.productNameSnapshot}`,
        data: { type: 'enquiry', conversationId: String(conversation._id) },
      });
    })(),
  );
}

/** A new message — the counterparty learns there is a reply waiting. */
export function notifyNewMessage({ conversation, senderSide, senderUserId }) {
  if (!isPushConfigured()) return Promise.resolve();
  return safely(
    (async () => {
      const toBuyer = senderSide === 'exporter';
      const tokens = await targetTokens({
        orgId: toBuyer ? conversation.buyerOrgId : conversation.exporterOrgId,
        conversationId: conversation._id,
        excludeUserId: senderUserId,
      });
      const from = toBuyer ? conversation.exporterOrgName : conversation.buyerOrgName;
      await dispatch({
        tokens,
        title: 'New message',
        // 🔴 The message text is deliberately absent (D-N1).
        body: `${from} — ${conversation.productNameSnapshot}`,
        data: { type: 'message', conversationId: String(conversation._id) },
      });
    })(),
  );
}
