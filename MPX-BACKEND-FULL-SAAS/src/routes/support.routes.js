import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermissions, requireRole } from '../middleware/authorize.js';
import { generalLimiter, ticketLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { uploadSupportFile } from '../middleware/upload.js';
import { PERMISSIONS } from '../config/permissions.js';
import * as ctrl from '../controllers/support.controller.js';
import * as notesCtrl from '../controllers/internalNotes.controller.js';
import * as NV from '../validators/internalNotes.validators.js';
import * as V from '../validators/support.validators.js';

export const supportRouter = Router();

// ── Company side (buyer / exporter accounts). Ownership is enforced in the
// service on EVERY call ({ _id, orgId, side } from the token → 404). The
// superadmin passes requireRole, and the service refuses it there.
// Order matters: fixed paths before `/:id`.

supportRouter.get('/support/tickets/unread-count', authenticate, requireRole('buyer', 'exporter'), generalLimiter, ctrl.myUnread);

supportRouter.post(
  '/support/tickets',
  authenticate,
  requireRole('buyer', 'exporter'),
  ticketLimiter,
  uploadSupportFile,
  validate(V.createTicket),
  ctrl.create,
);

supportRouter.get('/support/tickets', authenticate, requireRole('buyer', 'exporter'), generalLimiter, validate(V.listMyTickets), ctrl.listMine);

supportRouter.get('/support/tickets/:id', authenticate, requireRole('buyer', 'exporter'), generalLimiter, validate(V.ticketIdParam), ctrl.getMine);

// "Mark as solved" — the company closes its own ticket.
supportRouter.post('/support/tickets/:id/close', authenticate, requireRole('buyer', 'exporter'), ticketLimiter, validate(V.ticketIdParam), ctrl.closeMine);

supportRouter.post(
  '/support/tickets/:id/messages',
  authenticate,
  requireRole('buyer', 'exporter'),
  uploadLimiter,
  uploadSupportFile,
  validate(V.replyTicket),
  ctrl.replyMine,
);

// ── Staff side (grantable; superadmin passes). Reads need `support:read`; each
// action needs `support:read` AND its own grant (all-of). Assigning someone
// ELSE is checked in the service (`support:assign`), because taking an
// unassigned ticket for yourself needs only `support:reply`.
const staff = [authenticate, requirePermissions(PERMISSIONS.SUPPORT_READ)];
const canReply = [authenticate, requirePermissions(PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_REPLY)];
const canStatus = [authenticate, requirePermissions(PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_STATUS)];

supportRouter.get('/admin/support/overview', ...staff, generalLimiter, ctrl.overview);
// The list of staff names — only for someone who sees the whole queue (owner, 2026-09-25).
supportRouter.get('/admin/support/assignees', authenticate, requirePermissions(PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_VIEW_ALL), generalLimiter, ctrl.assignees);
supportRouter.get('/admin/support/log', ...staff, generalLimiter, validate(V.ticketLog), ctrl.log);
supportRouter.get('/admin/support/tickets', ...staff, generalLimiter, validate(V.listTickets), ctrl.list);
supportRouter.get('/admin/support/tickets/:id', ...staff, generalLimiter, validate(V.ticketIdParam), ctrl.get);
supportRouter.get('/admin/support/tickets/:id/timeline', ...staff, generalLimiter, validate(V.ticketIdParam), ctrl.timeline);
supportRouter.post(
  '/admin/support/tickets/:id/messages',
  ...canReply,
  uploadLimiter,
  uploadSupportFile,
  validate(V.replyTicket),
  ctrl.reply,
);
supportRouter.patch('/admin/support/tickets/:id/status', ...canStatus, generalLimiter, validate(V.setStatus), ctrl.status);
supportRouter.patch('/admin/support/tickets/:id/assign', ...staff, generalLimiter, validate(V.assignTicket), ctrl.assign);

// ── Step 1c · internal notes (staff-only). The route admits staff roles only;
// the service then requires the SUBJECT's own permission (organisation:read /
// conversation:read / support:read). There is no edit or delete route — notes
// are append-only.
supportRouter.get('/admin/notes', authenticate, requireRole('employee'), generalLimiter, validate(NV.listNotes), notesCtrl.list);
supportRouter.post('/admin/notes', authenticate, requireRole('employee'), generalLimiter, validate(NV.addNote), notesCtrl.add);
