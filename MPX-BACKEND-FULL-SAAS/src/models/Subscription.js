import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

// Platform document (decision B4): plan/billing managed under permission. Carries
// a reference to the subscribing org.
const subscriptionSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', index: true },
  },
  baseSchemaOptions,
);

withPlatformScope(subscriptionSchema);

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
