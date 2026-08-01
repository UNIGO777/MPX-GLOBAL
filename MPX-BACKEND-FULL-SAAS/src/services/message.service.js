import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { AppError } from '../utils/AppError.js';
import { loadPartyConversation, viewerSideFor } from './conversation.service.js';
import { notifyNewMessage } from './push.service.js';

/**
 * M4-D — writing a line into a thread.
 *
 * This is the ONE send path. The REST route calls it, and M4-G's socket handler
 * will call the same function rather than reimplementing the guards — three
 * copies of an access check is how one of them ends up missing a case.
 *
 * §7.3, checked server-side on every send:
 *   1. the sender's org is a party to the thread
 *   2. the thread is not frozen
 *   3. the body is within 200 characters — USER SENDS ONLY
 *
 * (3) lives at the route boundary, not on the model: the composed first enquiry
 * message and system messages are exempt (M4-12) and routinely exceed 200, so a
 * model-level cap would reject the thread's own opening line on every enquiry.
 */

const PREVIEW_LENGTH = 200;

/**
 * A party sends a message. `senderType` is derived from the caller's role and is
 * never read from the body — otherwise a buyer could post as `system` and
 * impersonate the platform.
 */
export async function sendMessage({ user, conversationId, body }) {
  const side = viewerSideFor(user);
  if (side === 'staff') {
    // §7.3 / screen 5: admin can read, admin cannot speak. A staff account is
    // not a party, so `loadPartyConversation` would 404 anyway — this is the
    // explicit statement of the rule rather than an accident of scoping.
    throw AppError.forbidden('staff cannot send', 'Not allowed.');
  }

  // Guard 1 — membership. 404 (not 403) so a non-party cannot even confirm the
  // thread exists.
  const conversation = await loadPartyConversation({ user, id: conversationId });

  // Guard 2 — frozen. Reading stays open (M4-22: full history readable); only
  // writing stops.
  if (conversation.frozen) {
    throw AppError.conflict('conversation frozen', 'This conversation is closed for new messages.');
  }

  const sentAt = new Date();
  const message = await Message.create({
    conversationId: conversation._id,
    senderType: side,
    senderOrgId: user.orgId,
    senderUserId: user.userId,
    body,
  });

  // The sender has obviously read what they just wrote — stamp their own
  // lastReadAt from the same instant, or they would see their own message come
  // back as unread (`isUnread` compares lastMessageAt > lastReadAt).
  const readField = side === 'buyer' ? 'buyerLastReadAt' : 'exporterLastReadAt';
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessageAt: sentAt, lastMessagePreview: body.slice(0, PREVIEW_LENGTH), [readField]: sentAt } },
  );

  // M4-H — fire-and-forget, deliberately NOT awaited. A message being saved and
  // delivered must never depend on Firebase being reachable.
  notifyNewMessage({ conversation, senderSide: side, senderUserId: user.userId });

  return { message, conversation };
}

/**
 * The platform's own voice — freeze and unfreeze notices (M4-21 / M4-23), and
 * the welcome at creation. Never reachable from a client: there is no route that
 * produces a `system` message, and `sendMessage` derives senderType from the
 * caller's role.
 *
 * Deliberately NOT subject to the frozen guard: the message explaining WHY a
 * thread just froze has to be written after it is frozen.
 */
export async function postSystemMessage({ conversationId, body }) {
  const sentAt = new Date();
  const message = await Message.create({
    conversationId,
    senderType: 'system',
    body,
  });

  // A system notice updates the list ordering and preview, but must not mark
  // anything read on either side — both parties should see that it arrived.
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { lastMessageAt: sentAt, lastMessagePreview: body.slice(0, PREVIEW_LENGTH) } },
  );

  return message;
}
