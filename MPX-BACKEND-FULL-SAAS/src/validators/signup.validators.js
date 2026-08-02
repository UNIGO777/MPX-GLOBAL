import { z } from 'zod';

import { zString } from './helpers.js';

/**
 * A21 · two-step signup with both channels verified.
 *
 * Field rules are kept identical to the auth validators they replace — same
 * lengths, same shapes — so the change is the FLOW, not the contract of what a
 * name or a password may be.
 */

const email = zString({ min: 3, max: 200 }).email();
const password = zString({ min: 8, max: 200 });
const country = zString({ min: 2, max: 2 });
const mobile = z.object({
  countryCode: zString({ min: 1, max: 5 }),
  number: zString({ min: 4, max: 15 }),
});
const otpCode = zString({ min: 4, max: 12 });
const signupToken = zString({ min: 10, max: 4096 });
const channel = z.enum(['email', 'mobile']);

/** Step 1 — identity only. Nothing about the company (A21). */
export const startSignup = {
  body: z.object({
    name: zString({ min: 1, max: 120 }),
    email,
    mobile,
    password,
    // Which portal this signup is for. Required because uniqueness is per-role:
    // the same email may hold one buyer AND one exporter account (A21).
    role: z.enum(['buyer', 'exporter']),
  }),
};

export const verifySignup = {
  body: z.object({ signupToken, channel, code: otpCode }),
};

export const resendSignup = {
  body: z.object({ signupToken, channel }),
};

/**
 * Step 2 — the company. Exporter-only extras stay optional at the schema level
 * and are enforced by role in the service, because the role lives on the pending
 * record (server-side) rather than in this body — a client must not be able to
 * pick which role it is completing.
 */
export const completeSignup = {
  body: z.object({
    signupToken,
    company: zString({ min: 1, max: 200 }),
    country,
    // Exporter only — drives the KYC path. Ignored for a buyer.
    entityType: z.enum(['business', 'individual']).optional(),
    address: z
      .object({
        line1: zString({ max: 200 }).optional(),
        line2: zString({ max: 200 }).optional(),
        city: zString({ max: 100 }).optional(),
        state: zString({ max: 100 }).optional(),
        postalCode: zString({ max: 20 }).optional(),
      })
      .optional(),
  }),
};
