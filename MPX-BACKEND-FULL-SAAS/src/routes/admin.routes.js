import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { requireRole, requirePermissions } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import * as ctrl from '../controllers/admin.controller.js';
import * as V from '../validators/admin.validators.js';
import * as AV from '../validators/audit.validators.js';
import * as auditCtrl from '../controllers/audit.controller.js';
import * as OV from '../validators/adminOrgs.validators.js';
import * as orgCtrl from '../controllers/adminOrgs.controller.js';
import * as dashboardCtrl from '../controllers/dashboard.controller.js';
import * as EV from '../validators/errorLog.validators.js';
import * as errorCtrl from '../controllers/errorLog.controller.js';
import * as FV from '../validators/featured.validators.js';
import * as featuredCtrl from '../controllers/featured.controller.js';
import { uploadBannerImage } from '../middleware/uploadImages.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

export const adminRouter = Router();

// User directory — READ is grantable (user:read); superadmin is all-access.
adminRouter.get(
  '/admin/users',
  authenticate,
  requirePermissions(PERMISSIONS.USER_READ),
  validate(V.listUsers),
  ctrl.listUsers,
);
adminRouter.get(
  '/admin/users/:id',
  authenticate,
  requirePermissions(PERMISSIONS.USER_READ),
  validate(V.userIdParam),
  ctrl.getUser,
);

// Activate / deactivate — HARD role gate, never a grantable permission (a granted
// employee must not be able to change any user's active state → privilege
// escalation). Superadmin-only: there is no 'admin' role (see models/enums.js).
adminRouter.post(
  '/admin/users/:id/activate',
  authenticate,
  requireRole('superadmin'),
  validate(V.userIdParam),
  ctrl.activateUser,
);
adminRouter.post(
  '/admin/users/:id/deactivate',
  authenticate,
  requireRole('superadmin'),
  validate(V.userIdParam),
  ctrl.deactivateUser,
);

// F1-A · Organisation block / unblock — HARD superadmin gate, never a grantable
// permission (same governance reasoning as activate/deactivate above: an employee
// able to take a whole company offline, or to bring a blocked one back, is a
// privilege-escalation path). Blocking cascades to every user of the org.
adminRouter.post(
  '/admin/orgs/:id/block',
  authenticate,
  requireRole('superadmin'),
  validate(V.blockOrg),
  ctrl.blockOrg,
);
adminRouter.post(
  '/admin/orgs/:id/unblock',
  authenticate,
  requireRole('superadmin'),
  validate(V.unblockOrg),
  ctrl.unblockOrg,
);

// Assign/replace an employee's permissions — HARD superadmin gate (governance).
// This must NEVER be a grantable permission: an over-permissioned employee could
// otherwise grant itself every permission (privilege escalation). m1.md §6.
adminRouter.patch(
  '/admin/employees/:id/permissions',
  authenticate,
  requireRole('superadmin'),
  validate(V.updateEmployeePermissions),
  ctrl.updateEmployeePermissions,
);

// --- M5-C · Audit log viewer -------------------------------------------------
// READ ONLY. `audit:read` is grantable and kept separate from `organisation:read`
// on purpose: the audit trail records every KYC view and every conversation
// read, so browsing a company is a much smaller thing than reading the record of
// everything staff have ever looked at.
//
// There is no write, update or delete route here and there never will be —
// rule 1, and the model refuses all three regardless (tracker C10).
adminRouter.get(
  '/admin/audit',
  authenticate,
  requirePermissions(PERMISSIONS.AUDIT_READ),
  validate(AV.listAudit),
  auditCtrl.list,
);
adminRouter.get(
  '/admin/audit/:id',
  authenticate,
  requirePermissions(PERMISSIONS.AUDIT_READ),
  validate(AV.auditIdParam),
  auditCtrl.get,
);

// --- FINALIZE F5 · Error log viewer ------------------------------------------
// READ ONLY, gated by its own `errorlog:read` (owner-decided 2026-08-01) rather
// than by `audit:read`: this shows 5xx stack traces, while `audit:read` shows the
// record of every KYC document and private conversation staff have ever opened.
// Someone chasing a bug should not have to be handed the second to get the first.
//
// There is no write, update, delete or "clear" route here and there never will
// be — retention is the TTL's job (A19), never a staff action.
adminRouter.get(
  '/admin/errors',
  authenticate,
  requirePermissions(PERMISSIONS.ERRORLOG_READ),
  validate(EV.listErrors),
  errorCtrl.list,
);
adminRouter.get(
  '/admin/errors/:id',
  authenticate,
  requirePermissions(PERMISSIONS.ERRORLOG_READ),
  validate(EV.errorIdParam),
  errorCtrl.get,
);

// --- FINALIZE F5b · Featured landing content ---------------------------------
// `featured:manage` is GRANTABLE, following `category:manage` rather than the
// governance pattern: this is content curation, not platform governance — it can
// put a product on the front page but cannot change anyone's access, and every
// action writes an AuditLog row. The matching READ is PUBLIC (`/public/featured`).
adminRouter.get(
  '/admin/featured',
  authenticate,
  requirePermissions(PERMISSIONS.FEATURED_MANAGE),
  featuredCtrl.list,
);
// Feature an existing product / category / supplier (JSON).
adminRouter.post(
  '/admin/featured',
  authenticate,
  requirePermissions(PERMISSIONS.FEATURED_MANAGE),
  validate(FV.createFeatured),
  featuredCtrl.create,
);
// Banners have their own multipart route: a banner with no image is not a valid
// row, so the file arrives with the create rather than in a second call.
adminRouter.post(
  '/admin/featured/banner',
  authenticate,
  requirePermissions(PERMISSIONS.FEATURED_MANAGE),
  uploadLimiter,
  uploadBannerImage, // must precede validate — multer is what populates req.body
  validate(FV.createBanner),
  featuredCtrl.createBanner,
);
adminRouter.patch(
  '/admin/featured/:id',
  authenticate,
  requirePermissions(PERMISSIONS.FEATURED_MANAGE),
  validate(FV.updateFeatured),
  featuredCtrl.update,
);
adminRouter.post(
  '/admin/featured/:id/image',
  authenticate,
  requirePermissions(PERMISSIONS.FEATURED_MANAGE),
  uploadLimiter,
  uploadBannerImage,
  validate(FV.featuredIdParam),
  featuredCtrl.uploadImage,
);
// A hard delete, deliberately: un-featuring is removing a curation slot, not
// retiring a business record. The AuditLog keeps the history.
adminRouter.delete(
  '/admin/featured/:id',
  authenticate,
  requirePermissions(PERMISSIONS.FEATURED_MANAGE),
  validate(FV.featuredIdParam),
  featuredCtrl.remove,
);

// --- M5-D · Organisation list + detail ---------------------------------------
// `organisation:read` is grantable and is a READ: it never returns kycDocuments
// (those need kyc:view and write their own audit row) and never returns another
// user's permissions. Block/unblock above stays hard superadmin-gated.
adminRouter.get(
  '/admin/orgs',
  authenticate,
  requirePermissions(PERMISSIONS.ORGANISATION_READ),
  validate(OV.listOrganisations),
  orgCtrl.list,
);
adminRouter.get(
  '/admin/orgs/:id',
  authenticate,
  requirePermissions(PERMISSIONS.ORGANISATION_READ),
  validate(OV.orgIdParam),
  orgCtrl.get,
);

// --- M5-E · Dashboard --------------------------------------------------------
// D1: no permission of its OWN — each tile is filtered by what the caller
// already holds, so a tile can never link an employee to a list they cannot
// open. But "no permission" is not "no gate" (V1): a buyer or exporter must not
// reach an /admin/* route at all, hence the role gate.
adminRouter.get(
  '/admin/dashboard',
  authenticate,
  requireRole('employee', 'superadmin'),
  dashboardCtrl.get,
);
