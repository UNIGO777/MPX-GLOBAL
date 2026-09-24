import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { LEAD_STATUS } from '../models/enums.js';

// Step 1d · enquiry routing ("help me find a supplier").
const page = z.coerce.number().int().min(1).max(10000).default(1);

export const createLead = {
  body: z.object({
    what: zString({ min: 3, max: 200 }),
    quantity: z.coerce.number().positive().max(1e12).optional(),
    unit: zString({ min: 1, max: 40 }).optional(),
    destinationCountry: zString({ min: 2, max: 2 }).regex(/^[A-Za-z]{2}$/, 'expected an ISO alpha-2 country code').optional(),
    note: zString({ max: 500 }).optional(),
  }),
};

export const leadIdParam = { params: z.object({ id: zObjectId() }) };

export const listLeads = {
  query: z.object({
    status: z.enum([...LEAD_STATUS, 'active']).optional(),
    assignee: z.union([z.enum(['me', 'unassigned']), zObjectId()]).optional(),
    q: zString({ min: 1, max: 120 }).optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
};

export const assignLead = {
  params: z.object({ id: zObjectId() }),
  // Always a person — same rule as tickets (owner, 2026-09-24): a request can
  // move to someone else, never back to nobody.
  body: z.object({ assigneeId: zObjectId() }),
};

export const setLeadStatus = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ status: z.enum(LEAD_STATUS) }),
};

export const routeLead = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ productId: zObjectId() }),
};
