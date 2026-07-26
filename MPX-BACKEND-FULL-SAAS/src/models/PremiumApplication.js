import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

// Platform document (decision B4): reviewed via permission. Records which org
// applied and who reviewed it.
const premiumApplicationSchema = new Schema(
  {
    applicantOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withPlatformScope(premiumApplicationSchema);

export const PremiumApplication = mongoose.model('PremiumApplication', premiumApplicationSchema);
