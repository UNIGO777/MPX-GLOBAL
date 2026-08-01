import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { enquiryLimiter } from '../middleware/rateLimit.js';
import * as ctrl from '../controllers/inquiries.controller.js';
import * as V from '../validators/inquiry.validators.js';

export const inquiryRouter = Router();

// M4-B — the single entry point into the whole chat module. Buyer accounts only:
// `requireRole('buyer')` gates the role and the service additionally requires the
// caller's org to be buyer-side (a superadmin passes requireRole, and the
// platform org must never open a thread). The service also carries the F4
// self-enquiry guard (M4-39) and the public-visibility check on the product.
inquiryRouter.post(
  '/inquiries',
  authenticate,
  requireRole('buyer'),
  enquiryLimiter,
  validate(V.createInquiry),
  ctrl.create,
);
