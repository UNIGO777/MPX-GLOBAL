import { z } from 'zod';

import { zString } from './helpers.js';

// zString rejects non-strings (so a Mongo operator object can never reach these
// fields); each object schema strips unknown keys by default.

const email = zString({ min: 3, max: 200 }).email();
const password = zString({ min: 8, max: 200 });
const country = zString({ min: 2, max: 2 });
const mobile = z.object({
  countryCode: zString({ min: 1, max: 5 }),
  number: zString({ min: 4, max: 15 }),
});
const otpCode = zString({ min: 4, max: 12 });
const opaqueToken = zString({ min: 10, max: 4096 });
const entityType = z.enum(['business', 'individual']);
const address = z.object({
  line1: zString({ max: 200 }).optional(),
  line2: zString({ max: 200 }).optional(),
  city: zString({ max: 100 }).optional(),
  state: zString({ max: 100 }).optional(),
  postalCode: zString({ max: 20 }).optional(),
});

export const buyerSignup = {
  body: z.object({
    name: zString({ min: 1, max: 120 }),
    email,
    mobile,
    password,
    company: zString({ min: 1, max: 200 }),
    country,
  }),
};

export const exporterSignup = {
  body: z.object({
    name: zString({ min: 1, max: 120 }),
    email,
    mobile,
    password,
    company: zString({ min: 1, max: 200 }),
    // Exporter-only extra fields (fields image): entity type (required — drives
    // the KYC path) and a structured address.
    entityType,
    country,
    address: address.optional(),
    businessProfile: z
      .object({
        registrationNumber: zString({ max: 100 }).optional(),
        taxId: zString({ max: 100 }).optional(),
        establishedYear: z.coerce.number().int().gte(1800).lte(2100).optional(),
      })
      .optional(),
  }),
};

export const createEmployee = {
  body: z.object({
    name: zString({ min: 1, max: 120 }),
    email,
    mobile,
    password,
    permissions: z.array(zString({ min: 1, max: 100 })).max(100).optional(),
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

export const refresh = {
  body: z.object({ refreshToken: opaqueToken }),
};

export const logout = {
  body: z.object({ refreshToken: opaqueToken }),
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
