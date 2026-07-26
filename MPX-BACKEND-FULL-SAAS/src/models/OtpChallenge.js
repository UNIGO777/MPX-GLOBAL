import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { OTP_PURPOSE } from './enums.js';

const { Schema } = mongoose;

// Short-lived OTP challenge. The code is stored hashed (auth-sessions A3), never
// in plaintext. Ephemeral — hard-removed by the TTL index (the documented
// exception to soft-delete).
const otpChallengeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The account's own address the code was sent to (never a request-supplied one).
    identifier: { type: String, required: true },
    channel: { type: String, enum: ['mobile', 'email'], required: true },
    purpose: { type: String, enum: OTP_PURPOSE, required: true },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, required: true },
    lockedUntil: { type: Date },
    consumedAt: { type: Date },
  },
  baseSchemaOptions,
);

otpChallengeSchema.index({ userId: 1, purpose: 1 });
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

declareScope(otpChallengeSchema, SCOPE.USER);

export const OtpChallenge = mongoose.model('OtpChallenge', otpChallengeSchema);
