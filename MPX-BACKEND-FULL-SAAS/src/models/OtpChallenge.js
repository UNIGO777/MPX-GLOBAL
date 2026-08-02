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
    // EXACTLY ONE of these identifies the subject (enforced in pre-validate).
    // A signup challenge has no account yet — that is the point of A21's pending
    // step — so it points at the PendingSignup instead.
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    pendingSignupId: { type: Schema.Types.ObjectId, ref: 'PendingSignup', index: true },
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

// Exactly one subject — never both, never neither. A challenge with no subject
// would be matched by a query whose subject filter went missing, which is how a
// code issued for one person ends up verifying another.
// ⚠️ Mongoose 9 pre-hooks are THROW/async style, not `next(err)` (History.md §7).
otpChallengeSchema.pre('validate', async function requireExactlyOneSubject() {
  const subjects = [this.userId, this.pendingSignupId].filter(Boolean).length;
  if (subjects !== 1) {
    throw new Error('OtpChallenge needs exactly one of userId / pendingSignupId');
  }
});

otpChallengeSchema.index({ userId: 1, purpose: 1 });
otpChallengeSchema.index({ pendingSignupId: 1, purpose: 1 });
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

declareScope(otpChallengeSchema, SCOPE.USER);

export const OtpChallenge = mongoose.model('OtpChallenge', otpChallengeSchema);
