import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';

const { Schema } = mongoose;

// M3's only new model. Polymorphic: one collection holds both product and
// supplier saves (a future 'category' target needs no new model).
//
// §A13 (reversed): saving is BUYER-ONLY and scoped by `buyerOrgId` — under §A21
// an exporter who wants to buy uses a separate buyer account, so "buyer-only"
// means the buyer ACCOUNT, not the buyer company.
const savedItemSchema = new Schema(
  {
    buyerOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },

    targetType: { type: String, enum: ['product', 'supplier'], required: true },

    // ⚠️ Deliberately NO `ref`: this points at a Product OR an Organisation
    // depending on `targetType`, so a static ref would resolve against the wrong
    // collection half the time. Resolved manually by targetType.
    targetId: { type: Schema.Types.ObjectId, required: true },

    savedAt: { type: Date, default: Date.now },
  },
  baseSchemaOptions,
);

// One buyer cannot save the same thing twice — enforced by the database, not by
// a read-then-write check.
savedItemSchema.index({ buyerOrgId: 1, targetType: 1, targetId: 1 }, { unique: true });
// Saved list ordering.
savedItemSchema.index({ buyerOrgId: 1, savedAt: -1 });

declareScope(savedItemSchema, SCOPE.BUYER_ORG);

export const SavedItem = mongoose.model('SavedItem', savedItemSchema);
