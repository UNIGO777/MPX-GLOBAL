import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

// Global taxonomy (platform document): self-referential tree, admin-managed.
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
  },
  baseSchemaOptions,
);

withPlatformScope(categorySchema);

export const Category = mongoose.model('Category', categorySchema);
