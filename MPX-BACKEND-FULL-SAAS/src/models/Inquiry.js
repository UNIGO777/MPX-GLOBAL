import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';

const { Schema } = mongoose;

// Skeleton: references + indexes only. Detailed fields land in M2.
const inquirySchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withPartiesScope(inquirySchema);

export const Inquiry = mongoose.model('Inquiry', inquirySchema);
