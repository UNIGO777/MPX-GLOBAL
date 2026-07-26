import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

// Government Incentives Directory (decision B5): a display + inquiry listing,
// admin/employee posted. No financial transaction.
const incentiveSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withPlatformScope(incentiveSchema);

export const Incentive = mongoose.model('Incentive', incentiveSchema);
