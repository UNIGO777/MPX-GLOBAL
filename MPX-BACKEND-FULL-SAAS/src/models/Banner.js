import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

// Global marketing content (platform document), admin-managed.
const bannerSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withPlatformScope(bannerSchema);

export const Banner = mongoose.model('Banner', bannerSchema);
