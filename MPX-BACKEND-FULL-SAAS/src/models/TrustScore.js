import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';

const { Schema } = mongoose;

// One TrustScore per org (1:1), so orgId is declared unique directly here rather
// than via the org-scope mixin (which would add a non-unique index).
const trustScoreSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

declareScope(trustScoreSchema, SCOPE.ORG);

export const TrustScore = mongoose.model('TrustScore', trustScoreSchema);
