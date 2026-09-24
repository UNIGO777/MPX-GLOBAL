import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermissions, requireRole } from '../middleware/authorize.js';
import { enquiryLimiter, generalLimiter } from '../middleware/rateLimit.js';
import { PERMISSIONS } from '../config/permissions.js';
import * as ctrl from '../controllers/leads.controller.js';
import * as V from '../validators/leads.validators.js';
import * as reportsCtrl from '../controllers/staffReports.controller.js';
import * as RV from '../validators/staffReports.validators.js';

export const leadsRouter = Router();

// ── Buyer side. Ownership is enforced in the service ({ buyerOrgId } from the
// token → 404). The superadmin passes requireRole and the service refuses it.
leadsRouter.post('/leads', authenticate, requireRole('buyer'), enquiryLimiter, validate(V.createLead), ctrl.create);
leadsRouter.get('/leads', authenticate, requireRole('buyer'), generalLimiter, ctrl.listMine);
leadsRouter.get('/leads/:id', authenticate, requireRole('buyer'), generalLimiter, validate(V.leadIdParam), ctrl.getMine);

// ── Staff side — `lead:manage` (grantable; superadmin passes). Fixed paths first.
const staff = [authenticate, requirePermissions(PERMISSIONS.LEAD_MANAGE)];
leadsRouter.get('/admin/leads/overview', ...staff, generalLimiter, ctrl.overview);
leadsRouter.get('/admin/leads/assignees', ...staff, generalLimiter, ctrl.assignees);
leadsRouter.get('/admin/leads', ...staff, generalLimiter, validate(V.listLeads), ctrl.list);
leadsRouter.get('/admin/leads/:id', ...staff, generalLimiter, validate(V.leadIdParam), ctrl.get);
leadsRouter.get('/admin/leads/:id/timeline', ...staff, generalLimiter, validate(V.leadIdParam), ctrl.timeline);
leadsRouter.patch('/admin/leads/:id/assign', ...staff, generalLimiter, validate(V.assignLead), ctrl.assign);
leadsRouter.patch('/admin/leads/:id/status', ...staff, generalLimiter, validate(V.setLeadStatus), ctrl.status);
leadsRouter.post('/admin/leads/:id/route', ...staff, generalLimiter, validate(V.routeLead), ctrl.route);

// ── Step 1e · "My work" + staff reports. Any staff role (superadmin passes);
// the service forces an employee's report to their OWN row.
leadsRouter.get('/admin/my-work', authenticate, requireRole('employee'), generalLimiter, reportsCtrl.myWork);
leadsRouter.get('/admin/reports/staff', authenticate, requireRole('employee'), generalLimiter, validate(RV.staffReport), reportsCtrl.report);
