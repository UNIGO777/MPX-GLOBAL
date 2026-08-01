import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import { uploadKycDocument } from '../middleware/upload.js';
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
