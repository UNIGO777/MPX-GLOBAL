import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withOrgScope } from './scoping.js';
import { TICKET_CATEGORIES, TICKET_CLOSED_BY, TICKET_SIDES, TICKET_STATUS } from './enums.js';

const { Schema } = mongoose;

/**
 * Step 1b · a support ticket (quote Module 6 "ticket/query queue").
 *
 * Tenant document: scoped by `orgId` AND `side`. One company can hold a buyer
 * and an exporter account (A21) — those are separate people, so each account
 * sees only the tickets raised from ITS side; the service filters on both.
 *
 * The thread lives in `TicketMessage` (append-only), like chat's Message.
 * `assignedTo` is staff-only: it never appears in a company-facing view (the
 * company talks to "MPX Global Support", never a named employee).
 */
const ticketSchema = new Schema(
  {
    side: { type: String, enum: TICKET_SIDES, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Short human reference ("T-4F9K2Q") — what a company quotes on the phone.
    ref: { type: String, required: true, unique: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    status: { type: String, enum: TICKET_STATUS, default: 'open' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessageAt: { type: Date, default: Date.now },
    // Who has something unread: the company (a staff reply) / staff (a company message).
    unread: {
      company: { type: Boolean, default: false },
      staff: { type: Boolean, default: true },
    },
    resolvedAt: { type: Date, default: null },
    // Who closed it: staff, the company itself ("Mark as solved"), or the
    // auto-close job. Null while the ticket is open.
    closedBy: { type: String, enum: [...TICKET_CLOSED_BY, null], default: null },
    // Set only by the auto-close job: the day count IN FORCE when it closed, so
    // "no reply for N days" stays true after the setting changes (2026-09-25).
    autoClosedAfterDays: { type: Number, default: null },
    // Set when staff reply or re-open (the ball is in the company's court),
    // cleared when the company writes or the ticket closes. The auto-close job
    // reads ONLY this — never lastMessageAt, which a staff re-open does not move.
    awaitingCompanySince: { type: Date, default: null },
    // A new ticket raised from a closed one points back at it (same company +
    // side, checked by the service). The ref is copied so no lookup is needed.
    followUpOf: { type: Schema.Types.ObjectId, ref: 'Ticket', default: null },
    followUpRef: { type: String, default: null },
  },
  baseSchemaOptions,
);

// The company's own list, newest activity first.
ticketSchema.index({ orgId: 1, side: 1, lastMessageAt: -1 });
// The staff queue and the dashboard counts.
ticketSchema.index({ status: 1, lastMessageAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
// The nightly auto-close sweep.
ticketSchema.index({ status: 1, awaitingCompanySince: 1 });

withOrgScope(ticketSchema);

export const Ticket = mongoose.model('Ticket', ticketSchema);
