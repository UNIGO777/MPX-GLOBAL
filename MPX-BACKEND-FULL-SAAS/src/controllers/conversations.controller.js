import * as svc from '../services/conversation.service.js';
import { sendMessage } from '../services/message.service.js';
import { conversationPartyView, messageView } from '../views/conversation.view.js';

// Every response here goes through the shared views — a controller that
// hand-rolls an object literal is how `blockedBy` and `senderUserId` would leak
// (the same mistake that once put `website` on a public seller page).

export async function list(req, res) {
  const { user } = req;
  const { rows, products, nextCursor } = await svc.listConversations({ user, ...req.validated.query });
  const viewerSide = svc.viewerSideFor(user);

  res.json({
    conversations: rows.map((c) =>
      conversationPartyView(c, { viewerSide, product: products.get(String(c.productId)) ?? null }),
    ),
    nextCursor,
  });
}

export async function unreadCount(req, res) {
  res.json({ unread: await svc.unreadCount(req.user) });
}

export async function byProduct(req, res) {
  res.json(await svc.findByProduct({ user: req.user, productId: req.params.productId }));
}

export async function get(req, res) {
  const { conversation, product } = await svc.getConversation({ user: req.user, id: req.params.id });
  res.json({
    conversation: conversationPartyView(conversation, {
      viewerSide: svc.viewerSideFor(req.user),
      product,
    }),
  });
}

export async function messages(req, res) {
  const { rows, nextBefore } = await svc.listMessages({
    user: req.user,
    id: req.params.id,
    ...req.validated.query,
  });
  res.json({ messages: rows.map(messageView), nextBefore });
}

export async function markRead(req, res) {
  res.json(await svc.markRead({ user: req.user, id: req.params.id }));
}

export async function send(req, res) {
  const { message } = await sendMessage({
    user: req.user,
    conversationId: req.params.id,
    body: req.validated.body.body,
  });
  res.status(201).json({ message: messageView(message) });
}
