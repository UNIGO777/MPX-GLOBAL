import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withOrgScope } from './scoping.js';
import { TICKET_AUTHOR } from './enums.js';

const { Schema } = mongoose;

/**
 * Step 1b · one message in a support ticket's thread.
 *
 * 🔴 APPEND-ONLY, like chat's Message (M4-13): no route edits or deletes one.
 * A support thread is a record of what the platform told a company.
 *
 * `authorId` is stored for the staff log and the audit trail; a company-facing
 * view shows `authorType` only ("MPX Global Support" for staff), never the
 * employee behind it.
 */
const attachmentSchema = new Schema(
  {
    kind: { type: String, enum: ['image', 'document'], required: true },
    storageKey: { type: String, required: true },
    format: { type: String, required: true },
    mime: String,
    bytes: Number,
    width: Number,
    height: Number,
    name: String,
  },
  { _id: false },
);

const ticketMessageSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    authorType: { type: String, enum: TICKET_AUTHOR, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Optional when a file is attached (the service enforces "one or the other").
    body: { type: String, trim: true, maxlength: 2000, default: '' },
    attachment: { type: attachmentSchema, default: null },
  },
  baseSchemaOptions,
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

withOrgScope(ticketMessageSchema);

export const TicketMessage = mongoose.model('TicketMessage', ticketMessageSchema);
