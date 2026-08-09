import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole, requirePermissions } from '../middleware/authorize.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadProductImages } from '../middleware/uploadImages.js';
import { PERMISSIONS } from '../config/permissions.js';
import * as ctrl from '../controllers/products.controller.js';
import * as adminCtrl from '../controllers/adminProducts.controller.js';
import * as V from '../validators/product.validators.js';

export const productRouter = Router();

// All seller product routes: authenticate + requireRole('exporter'); the
// exporterOrgId ownership filter in each query does the per-document isolation
// (plan M2-E route-guards note). The service additionally requires the org to
// be exporter-side (superadmin-bypass defence).

// Two-step image upload: files first (dedicated tight limiter — storage-abuse
// surface), refs then travel in the JSON create/edit.
productRouter.post(
  '/products/images',
  authenticate,
  requireRole('exporter'),
  uploadLimiter,
  uploadProductImages,
  ctrl.uploadImages,
);

productRouter.post('/products', authenticate, requireRole('exporter'), validate(V.createProduct), ctrl.create);

productRouter.get('/products/mine', authenticate, requireRole('exporter'), validate(V.listMine), ctrl.mine);

// 🔴 MUST stay below '/products/mine' — Express matches in registration order,
// and a ':id' registered first would swallow the literal "mine".
productRouter.get(
  '/products/:id',
  authenticate,
  requireRole('exporter'),
  validate(V.productIdParam),
  ctrl.one,
);

productRouter.patch(
  '/products/:id',
  authenticate,
  requireRole('exporter'),
  validate(V.updateProduct),
  ctrl.update,
);

productRouter.patch(
  '/products/:id/status',
  authenticate,
  requireRole('exporter'),
  validate(V.setStatus),
  ctrl.setStatus,
);

productRouter.delete(
  '/products/:id',
  authenticate,
  requireRole('exporter'),
  validate(V.productIdParam),
  ctrl.archive,
);

// --- Admin moderation (§A25: read = product:read, takedown/restore =
// product:takedown — both grantable; governance stays elsewhere) ---------------

productRouter.get(
  '/admin/products',
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_READ),
  validate(V.listAdminProducts),
  adminCtrl.list,
);
productRouter.post(
  '/admin/products/:id/takedown',
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_TAKEDOWN),
  validate(V.takedownBody),
  adminCtrl.takedown,
);
productRouter.post(
  '/admin/products/:id/restore',
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_TAKEDOWN),
  validate(V.productIdParam),
  adminCtrl.restore,
);
