import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withOrgScope } from './scoping.js';

const { Schema } = mongoose;

const ticketSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  baseSchemaOptions,
);

withOrgScope(ticketSchema);

export const Ticket = mongoose.model('Ticket', ticketSchema);
