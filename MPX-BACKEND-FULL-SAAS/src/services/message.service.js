import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { uploadChatDocument, uploadChatImage } from './chatAttachment.storage.service.js';
import { AppError } from '../utils/AppError.js';
import { loadPartyConversation, viewerSideFor } from './conversation.service.js';
import { notifyNewMessage } from './push.service.js';
import { notifyMessageInApp } from './chatNotifications.service.js';
import { emitNewMessage } from '../realtime/socket.js';

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
 * The thread list's one-line preview. A file sent with no text would otherwise
 * preview as a blank row, so it names the file instead — never the storage key
 * or a URL, only the cleaned display name the other party already sees.
 */
function previewFor(body, attachment) {
  if (body) return body.slice(0, PREVIEW_LENGTH);
  if (attachment?.kind === 'document') return `📄 ${attachment.name}`.slice(0, PREVIEW_LENGTH);
  if (attachment) return '📷 Photo';
  return '';
}

/**
 * A party sends a message. `senderType` is derived from the caller's role and is
 * never read from the body — otherwise a buyer could post as `system` and
 * impersonate the platform.
 */
export async function sendMessage({ user, conversationId, body, imageBuffer = null, document = null }) {
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

  /**
   * D9 · the image, uploaded only AFTER both guards have passed.
   *
   * 🔴 Order matters. Uploading first and then checking membership would let a
   * non-party push files into our storage by firing at conversation ids — the
   * request would 404, but the bytes would already be paid for and stored. So
   * this sits below `loadPartyConversation` (membership) and below the frozen
   * check: a closed thread accepts no new content of any kind.
   */
  // Nothing to send: a multipart call with neither text nor a file. The JSON
  // route can't get here empty (its validator requires text).
  if (!body && !imageBuffer && !document) {
    throw AppError.badRequest('empty message', 'Write a message or attach a file.');
  }

  // D10 · documents follow the same order: guards first, bytes second.
  let attachment;
  if (imageBuffer) {
    attachment = { kind: 'image', ...(await uploadChatImage({ buffer: imageBuffer, conversationId: conversation._id })) };
  } else if (document) {
    attachment = await uploadChatDocument({
      buffer: document.buffer,
      originalName: document.originalName,
      conversationId: conversation._id,
    });
  }

  const sentAt = new Date();
  const message = await Message.create({
    conversationId: conversation._id,
    senderType: side,
    senderOrgId: user.orgId,
    senderUserId: user.userId,
    body,
    attachment,
  });

  // The sender has obviously read what they just wrote — stamp their own
  // lastReadAt from the same instant, or they would see their own message come
  // back as unread (`isUnread` compares lastMessageAt > lastReadAt).
  const readField = side === 'buyer' ? 'buyerLastReadAt' : 'exporterLastReadAt';
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessageAt: sentAt, lastMessagePreview: previewFor(body, attachment), [readField]: sentAt } },
  );

  // §7.1 — LIVE delivery, from the one place every send path passes through.
  // The socket handler used to do this itself, which meant a REST send (the
  // path of record, and what both clients actually use) reached nobody live.
  emitNewMessage(conversation._id, message);

  // M4-H — fire-and-forget, deliberately NOT awaited. A message being saved and
  // delivered must never depend on Firebase being reachable.
  notifyNewMessage({ conversation, senderSide: side, senderUserId: user.userId });
  notifyMessageInApp({ conversation, senderSide: side, senderUserId: user.userId });

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
export async function postSystemMessage({ conversationId, body, systemKind, quotationId }) {
  const sentAt = new Date();
  const message = await Message.create({
    conversationId,
    senderType: 'system',
    body,
    systemKind,
    quotationId,
  });

  // A system notice updates the list ordering and preview, but must not mark
  // anything read on either side — both parties should see that it arrived.
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { lastMessageAt: sentAt, lastMessagePreview: body.slice(0, PREVIEW_LENGTH) } },
  );

  // Freeze and unfreeze notices are the platform EXPLAINING what just happened;
  // they have to land in an open thread at the same moment the composer swaps
  // for the banner, not on the next reload.
  emitNewMessage(conversationId, message);

  return message;
}
