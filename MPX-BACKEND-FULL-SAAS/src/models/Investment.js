import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

// Listing directory (decision B5): JV opportunities, businesses for sale,
// franchises, projects — display + inquiry only. No money, settlement or equity
// tracking. Admin/authorised-employee posted.
const investmentSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withPlatformScope(investmentSchema);

export const Investment = mongoose.model('Investment', investmentSchema);
