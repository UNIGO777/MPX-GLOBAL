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

// KYC document viewer (M1-D): mints short-lived signed URLs for a reviewer. Needs
// the kyc:view permission; records a kyc.view access audit.
employeeRouter.get(
  '/employee/orgs/:id/kyc/documents',
  authenticate,
  requirePermissions(PERMISSIONS.KYC_VIEW),
  validate(V.reviewParams),
  kycCtrl.getOrgKyc,
);
