import { usersInConversationRoom } from '../realtime/socket.js';
import { companyUserIds, markReadByRef, notify } from './notification.service.js';

/**
 * B8 in-app notices for enquiries and chat (owner override 2026-09-25).
 *
 * 🔴 D-N1, same as push and email: a notice NEVER carries message text — only
 * who it is from and which product. The thread itself is behind auth.
 *
 * One UNREAD row per person per thread (`refKey: conv:<id>`), so a busy chat
 * updates one line instead of stacking one per message; reading the thread
 * clears it (`clearChatNotice`). All fire-and-forget: a message is saved and
 * delivered whether or not its notice is.
 */
const refKey = (conversation) => `conv:${conversation._id}`;
const chatLink = (role, conversation) => `/${role}/chat/${conversation._id}`;

async function receivers(conversation, role) {
  const orgId = role === 'buyer' ? conversation.buyerOrgId : conversation.exporterOrgId;
  return { orgId, ids: await companyUserIds(orgId, role) };
}

/** New enquiry → the seller. */
export function notifyEnquiryInApp({ conversation, buyerOrgName }) {
  (async () => {
    const { orgId, ids } = await receivers(conversation, 'exporter');
    await notify(ids, {
      type: 'enquiry.new',
      title: `New enquiry from ${buyerOrgName}`,
      body: conversation.productNameSnapshot,
      link: chatLink('exporter', conversation),
      orgId,
      refKey: refKey(conversation),
    });
  })().catch(() => {});
}

/**
 * New message → the other side, except anyone looking at this thread right now
 * (they are reading it; a notice would only need dismissing).
 */
export function notifyMessageInApp({ conversation, senderSide, senderUserId }) {
  (async () => {
    const role = senderSide === 'exporter' ? 'buyer' : 'exporter';
    const { orgId, ids } = await receivers(conversation, role);
    const viewing = await usersInConversationRoom(conversation._id);
    const to = ids.filter((id) => id !== String(senderUserId) && !viewing.has(id));
    const from = role === 'buyer' ? conversation.exporterOrgName : conversation.buyerOrgName;
    await notify(to, {
      type: 'chat.message',
      title: `New message from ${from}`,
      body: conversation.productNameSnapshot,
      link: chatLink(role, conversation),
      orgId,
      refKey: refKey(conversation),
    });
  })().catch(() => {});
}

/** A platform warning posted into the thread → both sides. */
export function notifyWarningInApp({ conversation }) {
  (async () => {
    for (const role of ['buyer', 'exporter']) {
      const { orgId, ids } = await receivers(conversation, role);
      await notify(ids, {
        type: 'chat.warning',
        title: 'MPX Global posted a notice in one of your chats',
        body: conversation.productNameSnapshot,
        link: chatLink(role, conversation),
        orgId,
        refKey: refKey(conversation),
      });
    }
  })().catch(() => {});
}

/** Opening a thread clears its notice for the reader. */
export function clearChatNotice({ userId, conversationId }) {
  return markReadByRef({ userId, refKey: `conv:${conversationId}` });
}
