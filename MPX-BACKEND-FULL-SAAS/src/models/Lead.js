import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

// Platform-owned (decision B4), but routed to an employee via assignedTo.
const leadSchema = new Schema(
  {
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    convertedOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation' },
  },
  baseSchemaOptions,
);

withPlatformScope(leadSchema);

export const Lead = mongoose.model('Lead', leadSchema);
