import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withOrgScope } from './scoping.js';

const { Schema } = mongoose;

// References Deal + milestone + escrow + payout account (decision B2). Tracker
// C3: idempotency is enforced at the DB level — a unique idempotencyKey and a
// unique (dealId, milestoneId, attempt) tuple — so a retry or double-click can
// never produce two payouts.
const payoutRequestSchema = new Schema(
  {
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone', required: true, index: true },
    escrowId: { type: Schema.Types.ObjectId, ref: 'Escrow', required: true, index: true },
    payoutAccountId: { type: Schema.Types.ObjectId, ref: 'PayoutAccount', required: true, index: true },
    attempt: { type: Number, required: true, default: 1 },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  baseSchemaOptions,
);

withOrgScope(payoutRequestSchema); // orgId = the exporter being paid

payoutRequestSchema.index({ dealId: 1, milestoneId: 1 });
payoutRequestSchema.index({ dealId: 1, milestoneId: 1, attempt: 1 }, { unique: true });

export const PayoutRequest = mongoose.model('PayoutRequest', payoutRequestSchema);
