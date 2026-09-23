import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { ROLES } from './enums.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

    // A21: uniqueness is COMPOUND (email + role), NOT global — the same email may
    // hold one buyer AND one exporter account (never two of the same role). Staff
    // (employee/superadmin) exclusivity is enforced in the service layer. See the
    // compound indexes below.
    email: { type: String, required: true, lowercase: true, trim: true },

    // A1: keep countryCode + number for display, and a normalized e164 that all
    // lookups and the unique index use. International buyers mean a single plain
    // string would make duplicate detection and OTP lookup ambiguous.
    mobile: {
      countryCode: { type: String, required: true, trim: true },
      number: { type: String, required: true, trim: true },
      e164: { type: String, required: true, trim: true },
    },

    // A2: always present (generated for exporter/employee accounts), never
    // returned. mustChangePassword forces a reset on first login for those.
    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: false },

    role: { type: String, enum: ROLES, required: true, index: true },

    // A3: required for every role. Platform staff belong to the 'platform'
    // Organisation, so ownership scoping never special-cases a null orgId.
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },

    // Individually assignable to employees; server-authoritative (never trusted
    // from the client).
    permissions: { type: [String], default: [] },

    // Bumping this invalidates every previously issued token for the user.
    tokenVersion: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },

    // F1-A: the user's own isActive as it was JUST BEFORE an org-level block
    // cascaded over it. Unblock restores from here instead of blanket-reactivating,
    // so a user a superadmin had deactivated individually *before* the block stays
    // deactivated. Same pattern as Category.prevActive (§A4).
    // Set only by the org block cascade; cleared on unblock. Undefined at all other
    // times — a value here means "an org block is currently overriding this row".
    prevActive: { type: Boolean },
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },

    isTwoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    // A4: hashed like passwords. Mark usedAt on redemption — never delete, so the
    // usage is auditable. Whole field is select:false.
    twoFactorBackupCodes: {
      type: [{ codeHash: { type: String, required: true }, usedAt: { type: Date, default: null } }],
      select: false,
      default: [],
    },

    lastLoginAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

// A21: (email, role) and (mobile.e164, role) are each unique — permits a shared
// buyer+exporter identity while blocking two accounts of the same role. Staff
// exclusivity (a staff identity may not coexist with any other account, and a
// party identity may not be given to staff) is an additional service-layer check.
userSchema.index({ email: 1, role: 1 }, { unique: true });
userSchema.index({ 'mobile.e164': 1, role: 1 }, { unique: true });
// 🔴 RULE 1 AT THE DATABASE (D7 claim, 2026-09-23): one organisation holds at
// most ONE buyer and ONE exporter account. The service layer checks this before
// a claim, but an application check cannot win a race — two simultaneous claims
// both read "no exporter yet" and both insert. Only a unique index refuses the
// second.
//
// 🔴 SCOPED TO ACTIVE USERS, deliberately. This is what lets support move a seat
// when a company's seller leaves: superadmin deactivates the holder
// (`userManagement.service.js` — sets `isActive: false`, bumps `tokenVersion`,
// audits), which frees the seat so the replacement can claim normally. A
// non-partial unique index would make that impossible and leave the only remedy
// a manual database edit. The support runbook depends on this line.
//
// Restricted to the two party roles: staff sit on the platform org, where several
// employees legitimately share `(orgId, 'employee')`.
userSchema.index(
  { orgId: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { role: { $in: ['buyer', 'exporter'] }, isActive: true },
  },
);

declareScope(userSchema, SCOPE.ORG);

export const User = mongoose.model('User', userSchema);
