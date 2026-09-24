import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generalLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { uploadCover, uploadKycDocument, uploadLogo } from '../middleware/upload.js';
import * as orgCtrl from '../controllers/organisation.controller.js';
import * as OV from '../validators/organisation.validators.js';
import * as ctrl from '../controllers/kyc.controller.js';
import * as V from '../validators/kyc.validators.js';
import * as DV from '../validators/device.validators.js';
import * as deviceCtrl from '../controllers/devices.controller.js';
import * as bankCtrl from '../controllers/bankAccount.controller.js';
import * as BV from '../validators/bankAccount.validators.js';

export const meRouter = Router();

// Self-service KYC document upload (M1-B). Authenticated self-write: the caller
// submits their OWN org's document. multipart: file field `document` + text
// fields `docType`, `entityType`. Rate-limited (upload is expensive), but with the
// general limit — this is not a credential endpoint. Order:
// auth → limit → multer(parse) → zod(text fields) → controller.
meRouter.post(
  '/me/kyc/documents',
  authenticate,
  generalLimiter,
  uploadKycDocument,
  validate(V.kycUpload),
  ctrl.uploadKyc,
);

// The caller's own verification status (buyer/exporter dashboards). Self-scoped.
meRouter.get('/me/verification', authenticate, ctrl.getMyVerification);

// M4-H · FCM device registration. Any authenticated role may register a device —
// buyers and sellers both need push, and staff carry the same app. Registration
// is an UPSERT because a device changes hands and FCM reuses the token.
meRouter.post('/me/devices', authenticate, generalLimiter, validate(DV.registerDevice), deviceCtrl.register);
meRouter.delete('/me/devices/:token', authenticate, generalLimiter, validate(DV.deviceTokenParam), deviceCtrl.unregister);

// §A22 · self-service company profile. Owner-scoped by construction: the org id
// comes from the token, never from a param. GET is the profile screen's load;
// PATCH applies the lock/demotion rule (verified + locked-field change →
// kycStatus back to `submitted`, audited) inside the service.
meRouter.get('/me/organisation', authenticate, generalLimiter, orgCtrl.getMine);
meRouter.patch('/me/organisation', authenticate, generalLimiter, validate(OV.updateMine), orgCtrl.updateMine);
// Cancel a pending profile change (2026-08-19) — 409 when none exists.
meRouter.delete('/me/organisation/pending-changes', authenticate, generalLimiter, orgCtrl.cancelPending);

// Exporter logo — storefront content, never touches kycStatus. Dedicated tight
// upload limiter (storage-abuse surface), multipart field `logo`, images only.
meRouter.post('/me/organisation/logo', authenticate, uploadLimiter, uploadLogo, orgCtrl.setLogo);
meRouter.delete('/me/organisation/logo', authenticate, generalLimiter, orgCtrl.removeLogo);

// Exporter cover banner — same shape and same guards as the logo above.
meRouter.post('/me/organisation/cover', authenticate, uploadLimiter, uploadCover, orgCtrl.setCover);
meRouter.delete('/me/organisation/cover', authenticate, generalLimiter, orgCtrl.removeCover);

/**
 * Exporter bank details (owner, 2026-09-24 — quotation builder, Bucket A1).
 *
 * 🔴 Self-scoped: every handler reads `exporterOrgId` from the TOKEN. There is
 * no path or body parameter naming an organisation, so one exporter can never
 * address another's row — a foreign id is a 404.
 *
 * The role check lives in the SERVICE (`assertExporter`), not only here, so the
 * rule holds however the endpoint is reached (web-frontend.md trust boundary:
 * the client renders, the server decides).
 *
 * ⚠️ No REVEAL route is exposed yet. `revealForQuotation()` exists in the
 * service and is audited, but nothing should load a full account number until
 * the quotation endpoints that need it are built in month 2 — an endpoint that
 * hands out bank numbers with no consumer is a surface with no purpose.
 */
meRouter.get('/me/bank-accounts', authenticate, generalLimiter, bankCtrl.list);

meRouter.post(
  '/me/bank-accounts',
  authenticate,
  generalLimiter,
  validate(BV.createBankAccountSchema),
  bankCtrl.create,
);

meRouter.patch(
  '/me/bank-accounts/:id',
  authenticate,
  generalLimiter,
  validate(BV.updateBankAccountSchema),
  bankCtrl.update,
);

meRouter.delete(
  '/me/bank-accounts/:id',
  authenticate,
  generalLimiter,
  validate(BV.bankAccountParams),
  bankCtrl.remove,
);

// The exporter answering "yes, use these" on a quotation form — the control
// that stops tampered details riding along unnoticed.
meRouter.post(
  '/me/bank-accounts/:id/confirm',
  authenticate,
  generalLimiter,
  validate(BV.bankAccountParams),
  bankCtrl.confirm,
);
