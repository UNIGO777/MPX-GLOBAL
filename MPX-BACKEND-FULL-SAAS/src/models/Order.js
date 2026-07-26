import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';

const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, unique: true },
  },
  baseSchemaOptions,
);

withPartiesScope(orderSchema);

export const Order = mongoose.model('Order', orderSchema);
