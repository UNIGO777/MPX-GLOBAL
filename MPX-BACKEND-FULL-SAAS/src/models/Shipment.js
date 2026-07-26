import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';

const { Schema } = mongoose;

const shipmentSchema = new Schema(
  {
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
  },
  baseSchemaOptions,
);

withPartiesScope(shipmentSchema);

export const Shipment = mongoose.model('Shipment', shipmentSchema);
