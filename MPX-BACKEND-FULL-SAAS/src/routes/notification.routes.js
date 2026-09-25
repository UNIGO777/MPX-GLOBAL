import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import * as ctrl from '../controllers/notification.controller.js';
import * as V from '../validators/notification.validators.js';

export const notificationRouter = Router();

// B8 · the in-app notification centre (web; owner override 2026-09-25). Every
// signed-in role has one; each person sees and marks ONLY their own — the
// service filters by the token's user id. `unread-count` and `read-all` are
// declared before `/:id` so neither is read as an id.
const anyone = [authenticate, requireRole('buyer', 'exporter', 'employee', 'superadmin'), generalLimiter];

notificationRouter.get('/notifications/unread-count', ...anyone, ctrl.unreadCount);
notificationRouter.post('/notifications/read-all', ...anyone, ctrl.markAllRead);
notificationRouter.get('/notifications', ...anyone, validate(V.listNotifications), ctrl.list);
notificationRouter.post('/notifications/:id/read', ...anyone, validate(V.notificationIdParam), ctrl.markRead);
