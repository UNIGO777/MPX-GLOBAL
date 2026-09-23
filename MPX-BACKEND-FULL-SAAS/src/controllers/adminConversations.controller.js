import * as svc from '../services/adminConversations.service.js';
import { conversationStaffView, messageView } from '../views/conversation.view.js';
import { chatWarningList } from '../utils/chatWarnings.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function list(req, res) {
  const { rows, products, logos, nextCursor } = await svc.listAdminConversations(req.validated.query);
  res.json({
    conversations: rows.map((c) =>
      conversationStaffView(c, { product: products.get(String(c.productId)) ?? null, logos }),
    ),
    nextCursor,
  });
}

export async function get(req, res) {
  const { conversation, product, logos } = await svc.getAdminConversation({
    id: req.params.id, actor: req.user, meta: meta(req),
  });
  res.json({ conversation: conversationStaffView(conversation, { product, logos }) });
}

export async function messages(req, res) {
  const { rows, nextBefore } = await svc.getAdminMessages({
    id: req.params.id, ...req.validated.query, actor: req.user, meta: meta(req),
  });
  res.json({ messages: rows.map(messageView), nextBefore });
}

// Both actions return the thread WITH its product loaded: `freezeLabel()` reads
// a missing product as purged, so `product: null` here used to announce
// "Product no longer available" about a listing that still exists.
export async function block(req, res) {
  const { conversation, product, logos } = await svc.blockConversation({
    id: req.params.id, reason: req.validated.body.reason, actor: req.user, meta: meta(req),
  });
  res.json({ conversation: conversationStaffView(conversation, { product, logos }) });
}

/** The fixed warning list — the admin UI never holds its own copy of the text. */
export function warnings(_req, res) {
  res.json({ warnings: chatWarningList() });
}

export async function warn(req, res) {
  const { conversation, product, logos } = await svc.warnConversation({
    id: req.params.id, warning: req.validated.body.warning, actor: req.user, meta: meta(req),
  });
  res.json({ conversation: conversationStaffView(conversation, { product, logos }) });
}

export async function unblock(req, res) {
  const { conversation, product, logos } = await svc.unblockConversation({
    id: req.params.id, reason: req.validated.body?.reason, actor: req.user, meta: meta(req),
  });
  res.json({ conversation: conversationStaffView(conversation, { product, logos }) });
}
