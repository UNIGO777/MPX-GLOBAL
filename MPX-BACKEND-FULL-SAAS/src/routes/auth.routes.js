import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { publicRoute } from '../config/routeGuard.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';
import * as ctrl from '../controllers/auth.controller.js';
import * as V from '../validators/auth.validators.js';

export const authRouter = Router();

// Self-registration (Phase 1: both roles self-register; no gate). Public.
authRouter.post('/auth/buyer/signup', publicRoute, authLimiter, validate(V.buyerSignup), ctrl.buyerSignup);
authRouter.post('/auth/exporter/signup', publicRoute, authLimiter, validate(V.exporterSignup), ctrl.exporterSignup);

// Login → second factor → tokens. Public (identity is being established here).
authRouter.post('/auth/login', publicRoute, otpLimiter, validate(V.login), ctrl.login);
authRouter.post('/auth/verify-otp', publicRoute, authLimiter, validate(V.verifyOtp), ctrl.verifyOtp);

// Current user (any authenticated role).
authRouter.get('/auth/me', authenticate, ctrl.me);

// Change password (authenticate only, so a must-change-password user can reach
// it; clears the flag, rotates the session).
authRouter.post('/auth/change-password', authenticate, validate(V.changePassword), ctrl.changePassword);

// Session lifecycle. Refresh/logout present an opaque token, not an access token.
authRouter.post('/auth/refresh', publicRoute, authLimiter, validate(V.refresh), ctrl.refresh);
authRouter.post('/auth/logout', publicRoute, validate(V.logout), ctrl.logout);

// Password reset via OTP. Public.
authRouter.post('/auth/forgot-password', publicRoute, otpLimiter, validate(V.forgotPassword), ctrl.forgotPassword);
authRouter.post('/auth/reset-password', publicRoute, authLimiter, validate(V.resetPassword), ctrl.resetPassword);

// Admin creates an employee (default-deny: admin/superadmin only).
authRouter.post(
  '/admin/employees',
  authenticate,
  requireRole('admin', 'superadmin'),
  validate(V.createEmployee),
  ctrl.createEmployee,
);
