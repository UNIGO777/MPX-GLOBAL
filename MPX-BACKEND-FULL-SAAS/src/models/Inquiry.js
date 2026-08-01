import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';
import { INQUIRY_STATUS } from './enums.js';

const { Schema } = mongoose;

/**
 * M4 — the structured commercial ask. One per (buyer org, product).
 *
 * Deliberately NOT merged into `Conversation` (M4-6): this carries real
 * commercial data, stays queryable, and is what Phase 2's quotation module
 * attaches to. `Conversation` holds the messaging; the two are one-to-one but
 * stay separate models.
 *
 * The thread's first message is COMPOSED from `fields` + `note` and stored once
 * as a Message (M4-8) — this document is the queryable copy, not a duplicate of
 * the chat.
 */
const inquirySchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // Kept from the original skeleton: month-2 routing and reports will want to
    // group enquiries by category without joining through Product.
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },

    // The structured ask. Shape follows the sub-category's `type` (M4-9) and is
    // validated at the route boundary against the locked goods/services field
    // sets — unknown keys are REJECTED there, never silently stripped, so this
    // Mixed field can only ever hold values the validator allowed.
    fields: { type: Schema.Types.Mixed, default: {} },

    // The only free text in the enquiry (M4-7). 200 chars — this cap is real and
    // belongs on the model, unlike Message.body's (see Message.js for why).
    note: { type: String, trim: true, maxlength: 200 },

    // m4.md §13: the lifecycle that drives this is month 2. Written at creation
    // and left alone — do not add transitions without that module.
    status: { type: String, enum: INQUIRY_STATUS, default: 'open', index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

// Adds buyerOrgId + exporterOrgId + parties (B1 two-party scoping) + isActive.
withPartiesScope(inquirySchema);

// One enquiry per buyer per product (M4-5) — the database is the enforcement,
// not a read-then-write check. Mirrors the same rule on Conversation.
inquirySchema.index({ buyerOrgId: 1, productId: 1 }, { unique: true });

export const Inquiry = mongoose.model('Inquiry', inquirySchema);
