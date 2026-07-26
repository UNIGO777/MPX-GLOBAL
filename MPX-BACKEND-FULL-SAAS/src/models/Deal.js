import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';

const { Schema } = mongoose;

// The spine: it ties the transaction together. Milestones are a separate
// collection (decision B3), not subdocuments — they reference dealId. One
// Escrow per Deal (decision B2).
const dealSchema = new Schema(
  {
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', index: true },
    quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    shipmentId: { type: Schema.Types.ObjectId, ref: 'Shipment' },
    escrowId: { type: Schema.Types.ObjectId, ref: 'Escrow' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withPartiesScope(dealSchema);

export const Deal = mongoose.model('Deal', dealSchema);
