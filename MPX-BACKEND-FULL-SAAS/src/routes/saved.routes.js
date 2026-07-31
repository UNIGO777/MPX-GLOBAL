import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import * as ctrl from '../controllers/saved.controller.js';
import * as V from '../validators/saved.validators.js';

export const savedRouter = Router();

// §A13 — saving is BUYER-ONLY. `requireRole('buyer')` gates the role; the
// service additionally requires the caller's org to be buyer-side (a superadmin
// passes requireRole, and the platform org must never own saved items).
// Guests can search and browse; login is needed only to save.

savedRouter.post('/saved', authenticate, requireRole('buyer'), generalLimiter, validate(V.saveItem), ctrl.save);

savedRouter.get('/saved', authenticate, requireRole('buyer'), validate(V.listSaved), ctrl.list);

savedRouter.delete(
  '/saved/:id',
  authenticate,
  requireRole('buyer'),
  validate(V.savedIdParam),
  ctrl.unsave,
);
