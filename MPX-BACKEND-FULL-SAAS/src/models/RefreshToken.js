import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';

const { Schema } = mongoose;

// One row per issued refresh token. Only the HMAC hash of the raw token is
// stored (auth-sessions A2) — the raw value is returned to the client once and
// never persisted. Rotated/revoked rows are kept until they TTL-expire so a
// replay of an old token can still be detected as theft.
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Groups every token descended from one login, so the whole family can be
    // revoked on reuse.
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    status: { type: String, enum: ['active', 'rotated', 'revoked'], default: 'active', index: true },
    expiresAt: { type: Date, required: true },
    replacedByTokenId: { type: Schema.Types.ObjectId, ref: 'RefreshToken' },
    rotatedAt: { type: Date },
    revokedAt: { type: Date },
    ip: { type: String },
    userAgent: { type: String },
  },
  baseSchemaOptions,
);

// TTL cleanup once a token is past its absolute expiry.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

declareScope(refreshTokenSchema, SCOPE.USER);

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
