import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';

const { Schema } = mongoose;

// Separate collection, not a Deal subdocument (decision B3): milestones have
// their own state machine, the PayoutRequest idempotency index depends on a real
// milestoneId, and the approval queue queries across milestones. Detailed state
// fields come in M2.
const milestoneSchema = new Schema(
  {
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
  },
  baseSchemaOptions,
);

withPartiesScope(milestoneSchema);

export const Milestone = mongoose.model('Milestone', milestoneSchema);
