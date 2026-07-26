import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';

const { Schema } = mongoose;

const contractSchema = new Schema(
  {
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, unique: true },
  },
  baseSchemaOptions,
);

withPartiesScope(contractSchema);

export const Contract = mongoose.model('Contract', contractSchema);
