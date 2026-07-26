import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';

const { Schema } = mongoose;

// Owned by a single user (USER scope): scoped by userId, so one user can never
// read another's notifications even within the same org.
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', index: true },
    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

notificationSchema.index({ userId: 1, createdAt: -1 });

declareScope(notificationSchema, SCOPE.USER);

export const Notification = mongoose.model('Notification', notificationSchema);
