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

    /**
     * 🔴 The server-derived set of organisations this signup may claim (rule 3,
     * 2026-09-23). A verified identity can reach TWO companies — the email one
     * firm's buyer, the mobile another's — so the screen has to offer a choice,
     * and a choice means the client sends something back.
     *
     * This list is what makes that safe. It is written when the offer is served,
     * from identity both OTPs proved, and `complete` accepts a choice ONLY if it
     * appears here. The client still cannot NAME an organisation: it echoes an
     * opaque `choice` token, and the orgId never leaves the server.
     *
     * 🔴 The list RESTRICTS, it never GRANTS. Rule 6 adds an OTP round trip, so
     * minutes pass — the seat can be filled, the company blocked or renamed
     * meanwhile. `complete` therefore re-runs the FULL eligibility check rather
     * than trusting membership of this list. Treating it as a grant would turn a
     * stale offer into a way into an organisation that no longer qualifies.
     */
    claimCandidates: [
      {
        _id: false,
        orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        // Which identifier reached this company — 'email' | 'mobile' | 'both'.
        // Shown to the user (rule 3 wants the rows labelled) and recorded in the
        // claim audit: "how did this stranger get into Acme?" is answered by it.
        matchedOn: { type: String, enum: ['email', 'mobile', 'both'], required: true },
        // Opaque handle the client echoes back — a hash of `claimSalt` + orgId,
        // so nothing about the org is inferable and repeated reads agree.
        choice: { type: String, required: true },
      },
    ],

    /**
     * Secret per-signup salt the `choice` tokens are derived from. Fixed when the
     * signup starts, so two concurrent offer reads compute the SAME choices
     * instead of racing to write different random ones (found in a browser
     * walkthrough 2026-09-23: React's double effect fired two reads, one save hit
     * a VersionError and the screen fell back to "nothing to claim").
     */
    claimSalt: { type: String },

    /**
     * Rule 6 proofs: a claim always proves the EXISTING member's email. One row
     * per company whose member-inbox code was passed, recording WHICH member's
     * inbox it was — `complete` accepts the proof only while that same user is
     * still the company's verifier. Kept apart from `claimCandidates` and only
     * ever `$push`ed, so re-reading the offer can never erase a proof.
     */
    claimProofs: [
      {
        _id: false,
        orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, required: true },
      },
    ],

    /**
     * The `choice` the live `claim_org_email` code was issued for. There is one
     * live challenge per (signup, purpose), so without this a code sent for
     * company A could be redeemed against company B.
     */
    claimCodeFor: { type: String },
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
