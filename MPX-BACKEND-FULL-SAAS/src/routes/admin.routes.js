import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { requireRole, requirePermissions } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import * as ctrl from '../controllers/admin.controller.js';
import * as V from '../validators/admin.validators.js';

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
