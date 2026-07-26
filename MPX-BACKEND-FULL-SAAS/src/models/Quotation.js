import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';

const { Schema } = mongoose;

const quotationSchema = new Schema(
  {
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withPartiesScope(quotationSchema);

export const Quotation = mongoose.model('Quotation', quotationSchema);
