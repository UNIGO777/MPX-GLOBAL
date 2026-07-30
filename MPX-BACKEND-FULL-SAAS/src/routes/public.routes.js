import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { publicRoute } from '../config/routeGuard.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import * as ctrl from '../controllers/exporters.controller.js';
import * as V from '../validators/exporters.validators.js';
import * as productsCtrl from '../controllers/publicProducts.controller.js';
import * as PV from '../validators/product.validators.js';

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

// M2-F: public catalogue browse + detail (full search/facets = M3). Query-level
// availability; whitelist projections only. The `seller` filter renders the
// public seller page's catalogue.
publicRouter.get(
  '/public/products',
  publicRoute,
  generalLimiter,
  validate(PV.listPublic),
  productsCtrl.listPublic,
);
publicRouter.get(
  '/public/products/:idOrSlug',
  publicRoute,
  generalLimiter,
  validate(PV.publicIdOrSlugParam),
  productsCtrl.getPublic,
);
