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
