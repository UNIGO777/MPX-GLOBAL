import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withOrgScope } from './scoping.js';

const { Schema } = mongoose;

// Tracker C1: bank details are never authoritative here. We store only the
// payment provider's beneficiary token (select:false) and the masked last four
// digits. There is deliberately NO account-number field — you can't send what
// there's no field to hold.
const payoutAccountSchema = new Schema(
  {
    provider: { type: String, trim: true },
    providerToken: { type: String, select: false },
    maskedLast4: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

withOrgScope(payoutAccountSchema); // orgId = the exporter being paid

export const PayoutAccount = mongoose.model('PayoutAccount', payoutAccountSchema);
