import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { publicRoute } from '../config/routeGuard.js';
import {
  authLimiter,
  otpLimiter,
  refreshLimiter,
  staffOtpLimiter,
  generalLimiter,
} from '../middleware/rateLimit.js';
import * as ctrl from '../controllers/auth.controller.js';
import * as V from '../validators/auth.validators.js';
import * as signupCtrl from '../controllers/signup.controller.js';
import * as SV from '../validators/signup.validators.js';

export const authRouter = Router();

// --- A21 · self-registration, both channels verified before an account exists --
//
// 🔴 The old `/auth/buyer/signup` and `/auth/exporter/signup` are GONE, not
// deprecated. They wrote the User and the Organisation before any verification,
// which let anyone permanently burn a stranger's email or mobile (both are
// uniquely indexed per role) with no proof of ownership. Leaving them mounted
// "for compatibility" would have left that hole fully open, so they were removed
// in the same change that replaced them.
//
// Step 1 holds the details in a short-lived PendingSignup and sends TWO codes;
// nothing reaches `users` / `organisations` until /complete, and /complete
// refuses unless BOTH channels are verified.
authRouter.post('/auth/signup/start', publicRoute, otpLimiter, validate(SV.startSignup), signupCtrl.start);
// Verify is token-identified and order-agnostic — the screens run email then
// mobile, but the API deliberately does not encode that order.
authRouter.post('/auth/signup/verify', publicRoute, authLimiter, validate(SV.verifySignup), signupCtrl.verify);
authRouter.post('/auth/signup/resend', publicRoute, otpLimiter, validate(SV.resendSignup), signupCtrl.resend);
authRouter.post('/auth/signup/complete', publicRoute, authLimiter, validate(SV.completeSignup), signupCtrl.complete);

// Login → second factor → tokens. Public (identity is being established here).
// A21: buyer/exporter use /auth/login with a `portal`; staff use /auth/staff/login
// (no portal, its own rate limiter). verify-otp/resend-otp are token-identified, so
// they serve both and are unchanged.
authRouter.post('/auth/login', publicRoute, otpLimiter, validate(V.login), ctrl.login);
authRouter.post('/auth/staff/login', publicRoute, staffOtpLimiter, validate(V.staffLogin), ctrl.staffLogin);
authRouter.post('/auth/verify-otp', publicRoute, authLimiter, validate(V.verifyOtp), ctrl.verifyOtp);
authRouter.post('/auth/resend-otp', publicRoute, otpLimiter, validate(V.resendOtp), ctrl.resendOtp);

// Current user (any authenticated role).
authRouter.get('/auth/me', authenticate, ctrl.me);

// Change password (authenticate only, so a must-change-password user can reach
// it; clears the flag, rotates the session).
authRouter.post('/auth/change-password', authenticate, validate(V.changePassword), ctrl.changePassword);

// Session lifecycle. Refresh/logout present an opaque token, not an access token.
authRouter.post('/auth/refresh', publicRoute, refreshLimiter, validate(V.refresh), ctrl.refresh);
authRouter.post('/auth/logout', publicRoute, generalLimiter, validate(V.logout), ctrl.logout);

// Password reset via OTP. Public. A21: same portal split as login — party takes a
// `portal`; staff use the /auth/staff/* variants (no portal).
authRouter.post('/auth/forgot-password', publicRoute, otpLimiter, validate(V.forgotPassword), ctrl.forgotPassword);
authRouter.post('/auth/reset-password', publicRoute, authLimiter, validate(V.resetPassword), ctrl.resetPassword);
authRouter.post(
  '/auth/staff/forgot-password',
  publicRoute,
  staffOtpLimiter,
  validate(V.staffForgotPassword),
  ctrl.staffForgotPassword,
);
authRouter.post(
  '/auth/staff/reset-password',
  publicRoute,
  authLimiter,
  validate(V.staffResetPassword),
  ctrl.staffResetPassword,
);

// Superadmin creates an employee (default-deny). Governance is a HARD role gate,
// never a grantable permission — see admin.routes.js.
authRouter.post(
  '/admin/employees',
  authenticate,
  requireRole('superadmin'),
  validate(V.createEmployee),
  ctrl.createEmployee,
);
