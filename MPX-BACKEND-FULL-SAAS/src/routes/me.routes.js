import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import { uploadKycDocument } from '../middleware/upload.js';
import * as ctrl from '../controllers/kyc.controller.js';
import * as V from '../validators/kyc.validators.js';

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
