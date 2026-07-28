import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { publicRoute } from '../config/routeGuard.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import * as ctrl from '../controllers/exporters.controller.js';
import * as V from '../validators/exporters.validators.js';

export const publicRouter = Router();

// Public exporter profile (B7): visible from signup, never gated on verification.
// A full public directory/search is Module 3 — this is the single-profile read M1
// needs so the frontend can render the verified tick.
publicRouter.get(
  '/exporters/:id',
  publicRoute,
  generalLimiter,
  validate(V.exporterIdParam),
  ctrl.getExporter,
);
