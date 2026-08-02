import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';

const { Schema } = mongoose;

/**
 * A21 · step 1 of signup, held OFF the real collections until both the email and
 * the mobile have been proved.
 *
 * ⚠️ THE WHOLE POINT: no `User` and no `Organisation` exists while a signup is
 * pending. `User` carries unique indexes on `(email, role)` and `(mobile.e164,
 * role)`, so writing the account up front let anyone permanently burn a stranger's
 * email or phone with no proof of control — the real owner could then never
 * register for that role. Creating the account only at `complete`, after both
 * codes pass, is what closes that.
 *
 * Consequences to preserve:
 * - This collection is NOT the account. It grants nothing and is never logged in
 *   to. It holds a password hash only so `complete` need not ask again.
 * - It is deliberately NOT unique on email/mobile. Two people may hold pending
 *   signups for the same address at once and neither is harmed, because neither
 *   gets anything without controlling BOTH channels. Making it unique would
 *   re-open a milder version of the squat: start a signup, block the victim.
 * - Ephemeral: the TTL hard-removes it (the documented exception to soft delete),
 *   so abandoned signups clean themselves up instead of accumulating as junk orgs.
 */
const pendingSignupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    mobile: {
      countryCode: { type: String, required: true, trim: true },
      number: { type: String, required: true, trim: true },
      e164: { type: String, required: true, trim: true },
    },
    // Hashed at step 1 so the plaintext never has to survive the OTP round trip.
    // select:false — it must not come back on any read of this record.
    passwordHash: { type: String, required: true, select: false },

    // Which portal the signup was started from. Needed here because uniqueness,
    // and therefore what `complete` is allowed to create, is per-role (A21).
    role: { type: String, enum: ['buyer', 'exporter'], required: true },

    // Timestamps rather than booleans: "when was this proved" is the useful fact
    // for support and for any later dispute, and it cannot be un-set by accident.
    emailVerifiedAt: { type: Date },
    mobileVerifiedAt: { type: Date },

    expiresAt: { type: Date, required: true },
  },
  baseSchemaOptions,
);

/** Both channels proved — the only state from which an account may be created. */
pendingSignupSchema.methods.isFullyVerified = function isFullyVerified() {
  return Boolean(this.emailVerifiedAt && this.mobileVerifiedAt);
};

// Ephemeral by construction.
pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Lets `start` clear a caller's own earlier attempts for the same identity.
pendingSignupSchema.index({ email: 1, role: 1 });

// Not org-scoped: it exists precisely because there is no account or org yet.
// Reached only by holding the opaque signup token, never by permission.
declareScope(pendingSignupSchema, SCOPE.PLATFORM);

export const PendingSignup = mongoose.model('PendingSignup', pendingSignupSchema, 'pendingSignups');
