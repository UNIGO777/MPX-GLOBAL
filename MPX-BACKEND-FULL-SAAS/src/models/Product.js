import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withOrgScope } from './scoping.js';

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withOrgScope(productSchema); // orgId = the exporter that owns the listing

export const Product = mongoose.model('Product', productSchema);
