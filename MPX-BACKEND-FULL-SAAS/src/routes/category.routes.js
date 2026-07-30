import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermissions } from '../middleware/authorize.js';
import { publicRoute } from '../config/routeGuard.js';
import { generalLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { uploadCategoryImage } from '../middleware/uploadImages.js';
import { PERMISSIONS } from '../config/permissions.js';
import * as ctrl from '../controllers/categories.controller.js';
import * as V from '../validators/category.validators.js';

export const categoryRouter = Router();

// --- Public reads (active-only; buyers, sellers and guests) --------------------
// Order matters: the literal paths register BEFORE the :idOrSlug catch-all.

categoryRouter.get('/categories', publicRoute, generalLimiter, ctrl.getTree);
categoryRouter.get('/categories/top', publicRoute, generalLimiter, ctrl.getTops);
categoryRouter.get(
  '/categories/:parentId/subcategories',
  publicRoute,
  generalLimiter,
  validate(V.parentIdParam),
  ctrl.getSubcategories,
);
categoryRouter.get(
  '/categories/:idOrSlug/attributes',
  publicRoute,
  generalLimiter,
  validate(V.idOrSlugParam),
  ctrl.getAttributes,
);
categoryRouter.get(
  '/categories/:idOrSlug',
  publicRoute,
  generalLimiter,
  validate(V.idOrSlugParam),
  ctrl.getCategory,
);

// --- Admin (§A25: reads = category:read, writes = category:manage) -------------

categoryRouter.get(
  '/admin/categories',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_READ),
  ctrl.getAdminTree,
);
categoryRouter.patch(
  '/admin/categories/:id/toggle',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_MANAGE),
  validate(V.categoryIdParam),
  ctrl.toggle,
);
categoryRouter.post(
  '/admin/categories',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_MANAGE),
  validate(V.createSub),
  ctrl.createSub,
);
categoryRouter.patch(
  '/admin/categories/:id',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_MANAGE),
  validate(V.updateCategory),
  ctrl.update,
);
categoryRouter.delete(
  '/admin/categories/:id',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_MANAGE),
  validate(V.categoryIdParam),
  ctrl.remove,
);
// A20: image upload is allowed on TOPS too (the deliberate exception).
categoryRouter.post(
  '/admin/categories/:id/image',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_MANAGE),
  uploadLimiter,
  uploadCategoryImage,
  validate(V.categoryIdParam),
  ctrl.uploadImage,
);
categoryRouter.post(
  '/admin/categories/:id/attributes',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_MANAGE),
  validate(V.createAttribute),
  ctrl.createAttribute,
);
categoryRouter.patch(
  '/admin/categories/:id/attributes/:attrId',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_MANAGE),
  validate(V.updateAttribute),
  ctrl.updateAttribute,
);
categoryRouter.delete(
  '/admin/categories/:id/attributes/:attrId',
  authenticate,
  requirePermissions(PERMISSIONS.CATEGORY_MANAGE),
  validate(V.attributeParams),
  ctrl.deleteAttribute,
);
