import { z } from 'zod';

import { zString } from './helpers.js';
import { PERMISSIONS } from '../config/permissions.js';

// zString rejects non-strings (so a Mongo operator object can never reach these
// fields); each object schema strips unknown keys by default.

const email = zString({ min: 3, max: 200 }).email();
const password = zString({ min: 8, max: 200 });
const mobile = z.object({
  countryCode: zString({ min: 1, max: 5 }),
  number: zString({ min: 4, max: 15 }),
});
const otpCode = zString({ min: 4, max: 12 });
const opaqueToken = zString({ min: 10, max: 4096 });

// `country`, `entityType` and `address` moved to validators/signup.validators.js
// with the signup endpoints — they are company fields, and A21 puts those in
// step 2. Nothing left in this file captures them.

// `buyerSignup` / `exporterSignup` were removed with their endpoints (A21,
// 2026-08-03) — see validators/signup.validators.js. The field RULES are
// unchanged there; only the flow moved, so nothing about what a name, password
// or address may contain was relaxed.
//
// `businessProfile` (registrationNumber / taxId / establishedYear) is still
// deliberately NOT accepted anywhere in signup (A5: the registration number is
// checked at verification time and its unique index must not fire on a public
// signup — owner decision 2026-07-30).

export const createEmployee = {
  body: z.object({
    name: zString({ min: 1, max: 120 }),
    email,
    mobile,
    password,
    // Same rule as PATCH /admin/employees/:id/permissions: only catalogue values.
    // A free-text string here would store a permission the assignment screen can
    // never show, and a typo would silently grant nothing.
    permissions: z.array(z.enum(Object.values(PERMISSIONS))).max(50).optional(),
  }),
};

// A21: buyer/exporter portals share /auth/login, so the login must say which
// portal — the same email may hold both.
const portal = z.enum(['buyer', 'exporter']);

export const login = {
  body: z.object({
    identifier: zString({ min: 3, max: 200 }),
    password: zString({ min: 1, max: 200 }),
    portal,
  }),
};

// Staff (employee/superadmin) — a staff email is exclusive, so no portal.
export const staffLogin = {
  body: z.object({
    identifier: zString({ min: 3, max: 200 }),
    password: zString({ min: 1, max: 200 }),
  }),
};

export const verifyOtp = {
  body: z.object({ loginToken: opaqueToken, code: otpCode }),
};

export const resendOtp = {
  body: z.object({ loginToken: opaqueToken }),
};

// A21/A2: the token may arrive in the httpOnly cookie (browser) OR the body
// (native). It is therefore OPTIONAL at the schema level and the controller
// rejects "neither" with REFRESH_TOKEN_MISSING — the shape check still applies
// to whatever the body does carry.
export const refresh = {
  body: z.object({ refreshToken: opaqueToken.optional() }),
};

export const logout = {
  body: z.object({ refreshToken: opaqueToken.optional() }),
};

export const forgotPassword = {
  body: z.object({ identifier: zString({ min: 3, max: 200 }), portal }),
};

export const staffForgotPassword = {
  body: z.object({ identifier: zString({ min: 3, max: 200 }) }),
};

export const resetPassword = {
  body: z.object({
    identifier: zString({ min: 3, max: 200 }),
    code: otpCode,
    newPassword: password,
    portal,
  }),
};

export const staffResetPassword = {
  body: z.object({
    identifier: zString({ min: 3, max: 200 }),
    code: otpCode,
    newPassword: password,
  }),
};

export const changePassword = {
  body: z.object({
    currentPassword: zString({ min: 1, max: 200 }),
    newPassword: password,
  }),
};
