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
userSchema.index({ orgId: 1, role: 1 });

declareScope(userSchema, SCOPE.ORG);

export const User = mongoose.model('User', userSchema);
