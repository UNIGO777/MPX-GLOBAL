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
/**
 * A21 step 2 · the claim offer for a verified signup token.
 *
 * 🔴 The token is the ONLY input, deliberately. There is no company-name or id
 * parameter to add here: the org is derived from the identity both OTPs proved,
 * which is what keeps the endpoint from becoming a company-membership oracle.
 */
export const claimOffer = {
  body: z.object({ signupToken }),
};

// The opaque handle the offer issued for one company — 16 random bytes, hex.
// Never an org id: see `claimCandidates` on the PendingSignup model.
const claimChoice = z.string().regex(/^[a-f0-9]{32}$/);

/** Rule 6 · send the join code to the member already in the chosen company. */
export const claimCodeSend = {
  body: z.object({ signupToken, choice: claimChoice }),
};

export const claimCodeVerify = {
  body: z.object({ signupToken, choice: claimChoice, code: otpCode }),
};

export const completeSignup = {
  body: z.object({
    signupToken,
    // A21 step 2 / D7 — join the company the offer issued this choice for,
    // instead of creating one. An opaque token, never an org id: the server
    // resolves it against the stored offer AND re-checks eligibility.
    claimChoice: claimChoice.optional(),
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
