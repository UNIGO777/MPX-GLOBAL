import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter, generalLimiter, quotationAcceptLimiter } from '../middleware/rateLimit.js';
import * as ctrl from '../controllers/quotation.controller.js';
import * as V from '../validators/quotation.validators.js';

export const quotationRouter = Router();

/**
 * Module 4 — quotations (month 2, Bucket A1; owner override 2026-09-24).
 *
 * 🔴 Two-party scoped, like `Inquiry` and `Conversation`: every handler queries
 * `{ _id, parties: req.user.orgId }`, so a quotation between two other companies
 * is a **404, never a 403**. There is no organisation id in any path or body.
 *
 * 🔴 Which SIDE may do what is enforced in the service, not only here:
 *   create / update / send   → exporter side
 *   counter-offer            → either side (never twice in a row)
 *   confirm acceptance       → either side, BOTH must confirm with an emailed code
 *   decline                  → buyer side
 * A route-level role check alone would be one `requireRole` away from letting a
 * buyer edit a supplier's prices.
 *
 * ⚠️ There is no public route and no `/q/:token` page yet. The access token is
 * generated at send and stored, but nothing serves it until the buyer-facing
 * document page is built — an unguessable URL with no consumer is still a
 * surface, and this one would carry prices and bank details.
 */
quotationRouter.post(
  '/quotations',
  authenticate,
  generalLimiter,
  validate(V.createDraftSchema),
  ctrl.createDraft,
);

quotationRouter.get(
  '/conversations/:conversationId/quotations',
  authenticate,
  generalLimiter,
  validate(V.listForConversationSchema),
  ctrl.listForConversation,
);

quotationRouter.get(
  '/quotations/:id',
  authenticate,
  generalLimiter,
  validate(V.quotationParams),
  ctrl.getOne,
);

quotationRouter.patch(
  '/quotations/:id',
  authenticate,
  generalLimiter,
  validate(V.updateDraftSchema),
  ctrl.update,
);

quotationRouter.post(
  '/quotations/:id/send',
  authenticate,
  generalLimiter,
  validate(V.sendSchema),
  ctrl.send,
);

/**
 * AI drafting — `:target` is `milestones`, `charges` or `details`, validated as
 * an enum. `aiLimiter` smooths bursts; the per-org DAILY quota inside the
 * service caps the spend (api-endpoints B7 — an unbounded GPT endpoint is a
 * billing incident waiting to happen).
 *
 * It returns a suggestion and writes nothing: the exporter saves it through the
 * ordinary PATCH after reading it.
 */
quotationRouter.post(
  '/quotations/:id/ai/:target',
  authenticate,
  aiLimiter,
  validate(V.draftWithAiSchema),
  ctrl.draftWithAi,
);

quotationRouter.post(
  '/quotations/:id/negotiate',
  authenticate,
  generalLimiter,
  validate(V.negotiateSchema),
  ctrl.negotiate,
);

/**
 * Accepting is TWO calls, and there is deliberately no single-shot `/accept`.
 * One endpoint that flipped the status without a code would be the bypass —
 * every OTP the UI shows is worth nothing while the plain route still exists.
 *
 * A tighter limiter than `generalLimiter`: the request-code route sends real
 * email and the confirm route checks a 6-digit secret (`auth-sessions` A3). It
 * is keyed on the USER rather than the ip — see its note in rateLimit.js.
 */
quotationRouter.post(
  '/quotations/:id/accept/request-code',
  authenticate,
  quotationAcceptLimiter,
  validate(V.quotationParams),
  ctrl.requestAcceptCode,
);

quotationRouter.post(
  '/quotations/:id/accept/confirm',
  authenticate,
  quotationAcceptLimiter,
  validate(V.acceptCodeSchema),
  ctrl.confirmAccept,
);

quotationRouter.post(
  '/quotations/:id/decline',
  authenticate,
  generalLimiter,
  validate(V.declineSchema),
  ctrl.decline,
);
