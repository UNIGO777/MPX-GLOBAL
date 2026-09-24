import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { TICKET_CATEGORIES, TICKET_SIDES, TICKET_STATUS } from '../models/enums.js';

// Step 1b · support tickets. Bodies may arrive as multipart (with a file) or
// JSON; multer runs first on the file routes and fills `req.body` with strings,
// so every field here is a string schema.

const page = z.coerce.number().int().min(1).max(10000).default(1);
const pageSize = z.coerce.number().int().min(1).max(50).default(20);

export const createTicket = {
  body: z.object({
    subject: zString({ min: 3, max: 120 }),
    category: z.enum(TICKET_CATEGORIES),
    body: zString({ max: 2000 }).optional().default(''),
    // Raised from a closed ticket's "Raise a new ticket" — must be the caller's own (service checks).
    followUpOf: zObjectId().optional(),
  }),
};

export const listMyTickets = {
  query: z.object({
    status: z.enum(TICKET_STATUS).optional(),
    page,
    pageSize,
  }),
};

export const ticketIdParam = {
  params: z.object({ id: zObjectId() }),
};

export const replyTicket = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ body: zString({ max: 2000 }).optional().default('') }),
};

export const listTickets = {
  query: z.object({
    // 'active' = anything not resolved (the queue's default view).
    status: z.enum([...TICKET_STATUS, 'active', 'needs_reply', 'waiting']).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    side: z.enum(TICKET_SIDES).optional(),
    assignee: z.union([z.enum(['me', 'unassigned']), zObjectId()]).optional(),
    q: zString({ min: 1, max: 120 }).optional(),
    page,
    pageSize,
  }),
};

export const setStatus = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ status: z.enum(TICKET_STATUS) }),
};

export const assignTicket = {
  params: z.object({ id: zObjectId() }),
  // Always a person (owner, 2026-09-24): a ticket starts unassigned, and once
  // someone holds it it can move to someone else — never back to nobody.
  body: z.object({ assigneeId: zObjectId() }),
};

export const ticketLog = {
  query: z.object({
    actorId: zObjectId().optional(),
    action: z.enum(['ticket.create', 'ticket.reply', 'ticket.assign', 'ticket.status', 'ticket.reopen']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  }),
};
