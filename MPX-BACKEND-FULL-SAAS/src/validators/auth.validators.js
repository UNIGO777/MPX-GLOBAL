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
    country,
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

export const login = {
  body: z.object({
    identifier: zString({ min: 3, max: 200 }),
    password: zString({ min: 1, max: 200 }),
  }),
};

export const verifyOtp = {
  body: z.object({ loginToken: opaqueToken, code: otpCode }),
};

export const refresh = {
  body: z.object({ refreshToken: opaqueToken }),
};

export const logout = {
  body: z.object({ refreshToken: opaqueToken }),
};

export const forgotPassword = {
  body: z.object({ identifier: zString({ min: 3, max: 200 }) }),
};

export const resetPassword = {
  body: z.object({
    identifier: zString({ min: 3, max: 200 }),
    code: otpCode,
    newPassword: password,
  }),
};
