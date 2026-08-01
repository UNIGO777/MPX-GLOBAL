import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermissions } from '../middleware/authorize.js';
import { generalLimiter, messageLimiter } from '../middleware/rateLimit.js';
import { PERMISSIONS } from '../config/permissions.js';
import * as ctrl from '../controllers/conversations.controller.js';
import * as adminCtrl from '../controllers/adminConversations.controller.js';
import * as V from '../validators/conversation.validators.js';

export const conversationRouter = Router();

// M4-C — the party's own thread reads. M4-35: ONE role-aware list serves buyer
// and seller alike; only the scope filter and the composed title differ.
// Membership is proved on every route by the service (404, never 403) — staff
// use the separate /admin/conversations surface, which is audited.

// ⚠️ Order matters: the fixed paths must be declared BEFORE `/conversations/:id`,
// or Express matches "unread-count" as an id and the validator 400s it.
conversationRouter.get(
  '/conversations/unread-count',
  authenticate,
  generalLimiter,
  ctrl.unreadCount,
);

conversationRouter.get(
  '/conversations/by-product/:productId',
  authenticate,
  generalLimiter,
  validate(V.byProductParam),
  ctrl.byProduct,
);

conversationRouter.get(
  '/conversations',
  authenticate,
  generalLimiter,
  validate(V.listConversations),
  ctrl.list,
);

conversationRouter.get(
  '/conversations/:id',
  authenticate,
  generalLimiter,
  validate(V.conversationIdParam),
  ctrl.get,
);

conversationRouter.get(
  '/conversations/:id/messages',
  authenticate,
  generalLimiter,
  validate(V.listMessages),
  ctrl.messages,
);

conversationRouter.post(
  '/conversations/:id/read',
  authenticate,
  generalLimiter,
  validate(V.conversationIdParam),
  ctrl.markRead,
);

// M4-D — the REST send. §7.1 keeps the socket for LIVE DELIVERY only, so this
// stays the path of record: if the socket is down the application still works.
// The three §7.3 guards live in the service, which the socket handler will reuse
// rather than re-implement.
conversationRouter.post(
  '/conversations/:id/messages',
  authenticate,
  messageLimiter,
  validate(V.sendMessage),
  ctrl.send,
);

// --- M4-E · staff moderation -------------------------------------------------
// Access by PERMISSION, never by membership (M4-2). Both strings are grantable
// to employees: `conversation:block` supersedes M4-38's "read only in month 1"
// on the owner's decision (2026-07-31). Superadmin passes as all-access.
// There is no composer here at any level — admin can read, admin cannot speak.

conversationRouter.get(
  '/admin/conversations',
  authenticate,
  requirePermissions(PERMISSIONS.CONVERSATION_READ),
  generalLimiter,
  validate(V.listAdminConversations),
  adminCtrl.list,
);

conversationRouter.get(
  '/admin/conversations/:id',
  authenticate,
  requirePermissions(PERMISSIONS.CONVERSATION_READ),
  generalLimiter,
  validate(V.conversationIdParam),
  adminCtrl.get,
);

conversationRouter.get(
  '/admin/conversations/:id/messages',
  authenticate,
  requirePermissions(PERMISSIONS.CONVERSATION_READ),
  generalLimiter,
  validate(V.adminMessages),
  adminCtrl.messages,
);

conversationRouter.post(
  '/admin/conversations/:id/block',
  authenticate,
  requirePermissions(PERMISSIONS.CONVERSATION_BLOCK),
  generalLimiter,
  validate(V.blockConversation),
  adminCtrl.block,
);

conversationRouter.post(
  '/admin/conversations/:id/unblock',
  authenticate,
  requirePermissions(PERMISSIONS.CONVERSATION_BLOCK),
  generalLimiter,
  validate(V.unblockConversation),
  adminCtrl.unblock,
);
