import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';
import { LEAD_STATUS } from './enums.js';

const { Schema } = mongoose;

/**
 * Step 1d · a buyer's "help me find a supplier" request (quote Module 6
 * "enquiry routing"). Platform-owned (decision B4) and worked by staff via
 * `assignedTo`; the BUYER reads their own through an explicit
 * `{ buyerOrgId }` filter in the service (never by id alone).
 *
 * Routing a request opens a NORMAL enquiry + chat in the buyer's name through
 * the existing `createInquiry` path — `routedTo` records each one. Staff never
 * appear in the chat as a person.
 */
const routedSchema = new Schema(
  {
    exporterOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    // false = the buyer already had a thread on this product; it was linked, not duplicated.
    created: { type: Boolean, default: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const leadSchema = new Schema(
  {
    buyerOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ref: { type: String, required: true, unique: true },
    what: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, min: 0 },
    unit: { type: String, trim: true, maxlength: 40 },
    destinationCountry: { type: String, uppercase: true, minlength: 2, maxlength: 2 },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: LEAD_STATUS, default: 'new' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    routedTo: { type: [routedSchema], default: [] },
    closedAt: { type: Date, default: null },
    // Unused legacy field from the skeleton — kept so no old document breaks.
    convertedOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation' },
  },
  baseSchemaOptions,
);

leadSchema.index({ status: 1, createdAt: -1 });

withPlatformScope(leadSchema);

export const Lead = mongoose.model('Lead', leadSchema);
