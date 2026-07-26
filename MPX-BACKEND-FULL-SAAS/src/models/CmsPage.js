import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

// Global CMS content (platform document), addressed by slug.
const cmsPageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withPlatformScope(cmsPageSchema);

export const CmsPage = mongoose.model('CmsPage', cmsPageSchema);
