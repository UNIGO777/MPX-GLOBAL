import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { requirePermissions } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import * as ctrl from '../controllers/verification.controller.js';
import * as kycCtrl from '../controllers/kyc.controller.js';
import * as V from '../validators/verification.validators.js';

export const employeeRouter = Router();

// Buyer approval (kycStatus pending → verified). Requires the buyer-approve
// permission; superadmin is all-access.
employeeRouter.post(
  '/employee/buyers/:id/approve',
  authenticate,
  requirePermissions(PERMISSIONS.BUYER_APPROVE),
  validate(V.reviewParams),
  ctrl.approveBuyer,
);
employeeRouter.post(
  '/employee/buyers/:id/reject',
  authenticate,
  requirePermissions(PERMISSIONS.BUYER_APPROVE),
  validate(V.rejectSchema),
  ctrl.rejectBuyer,
);

// Exporter verification (kycStatus pending → verified). Requires the
// exporter-verify permission.
employeeRouter.post(
  '/employee/exporters/:id/verify',
  authenticate,
  requirePermissions(PERMISSIONS.EXPORTER_VERIFY),
  validate(V.reviewParams),
  ctrl.verifyExporter,
);
employeeRouter.post(
  '/employee/exporters/:id/reject',
  authenticate,
  requirePermissions(PERMISSIONS.EXPORTER_VERIFY),
  validate(V.rejectSchema),
  ctrl.rejectExporter,
);

// Verification-redesign (2026-08-19): change re-verification — approve applies
// the pending values (tick continuous), reject holds them with a reason. Revoke
// removes a granted tick (mandatory reason; org returns to the review queue).
// Same side permissions as first-time review: one review authority.
employeeRouter.post(
  '/employee/buyers/:id/changes/approve',
  authenticate,
  requirePermissions(PERMISSIONS.BUYER_APPROVE),
  validate(V.reviewParams),
  ctrl.approveBuyerChange,
);
employeeRouter.post(
  '/employee/buyers/:id/changes/reject',
  authenticate,
  requirePermissions(PERMISSIONS.BUYER_APPROVE),
  validate(V.rejectSchema),
  ctrl.rejectBuyerChange,
);
employeeRouter.post(
  '/employee/buyers/:id/revoke',
  authenticate,
  requirePermissions(PERMISSIONS.BUYER_APPROVE),
  validate(V.rejectSchema),
  ctrl.revokeBuyer,
);
employeeRouter.post(
  '/employee/exporters/:id/changes/approve',
  authenticate,
  requirePermissions(PERMISSIONS.EXPORTER_VERIFY),
  validate(V.reviewParams),
  ctrl.approveExporterChange,
);
employeeRouter.post(
  '/employee/exporters/:id/changes/reject',
  authenticate,
  requirePermissions(PERMISSIONS.EXPORTER_VERIFY),
  validate(V.rejectSchema),
  ctrl.rejectExporterChange,
);
employeeRouter.post(
  '/employee/exporters/:id/revoke',
  authenticate,
  requirePermissions(PERMISSIONS.EXPORTER_VERIFY),
  validate(V.rejectSchema),
  ctrl.revokeExporter,
);

// Verification-redesign (2026-08-19): staff asks a company for documents. Same
// side permissions as the review actions; the tick is untouched by a request.
employeeRouter.post(
  '/employee/buyers/:id/kyc/request-documents',
  authenticate,
  requirePermissions(PERMISSIONS.BUYER_APPROVE),
  validate(V.requestDocumentsSchema),
  ctrl.requestBuyerDocuments,
);
employeeRouter.post(
  '/employee/exporters/:id/kyc/request-documents',
  authenticate,
  requirePermissions(PERMISSIONS.EXPORTER_VERIFY),
  validate(V.requestDocumentsSchema),
  ctrl.requestExporterDocuments,
);

// KYC document viewer (M1-D): mints short-lived signed URLs for a reviewer. Needs
// the kyc:view permission; records a kyc.view access audit.
employeeRouter.get(
  '/employee/orgs/:id/kyc/documents',
  authenticate,
  requirePermissions(PERMISSIONS.KYC_VIEW),
  validate(V.reviewParams),
  kycCtrl.getOrgKyc,
);
