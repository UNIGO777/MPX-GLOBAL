import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';

const { Schema } = mongoose;

// One Escrow per Deal (decision B2): it holds the whole deal amount; milestones
// draw from it via PayoutRequest.
const escrowSchema = new Schema(
  {
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, unique: true },
  },
  baseSchemaOptions,
);

withPartiesScope(escrowSchema);

export const Escrow = mongoose.model('Escrow', escrowSchema);
