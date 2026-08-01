import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { DEVICE_PLATFORM } from './enums.js';

const { Schema } = mongoose;

/**
 * M4 — a device registered for FCM push.
 *
 * Scope note: this is USER-scoped, not org-scoped — a token belongs to one
 * person's device, and fan-out resolves org → users → tokens at send time.
 *
 * ⚠️ The token is unique GLOBALLY, not per user, and registration must be an
 * UPSERT that reassigns `userId`: a device changes hands (one user logs out,
 * another logs in on the same phone) and FCM hands back the same token. A plain
 * insert would collide forever and silently stop that device receiving anything.
 */
const deviceTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Denormalised so the send path can fan out by org without a join back to User.
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },

    // The FCM registration token. Not a secret of ours, but it is a device
    // identifier — never logged and never returned in a response.
    token: { type: String, required: true, trim: true },

    platform: { type: String, enum: DEVICE_PLATFORM, required: true },

    // Bumped on every re-registration; a stale token is also removed the moment
    // FCM reports it unregistered.
    lastSeenAt: { type: Date, default: Date.now },
  },
  baseSchemaOptions,
);

deviceTokenSchema.index({ token: 1 }, { unique: true });

declareScope(deviceTokenSchema, SCOPE.USER);

export const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);
