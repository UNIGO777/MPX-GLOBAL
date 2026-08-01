import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';

/**
 * FINALIZE F5 — error log viewer filters.
 *
 * The filters mirror how the screen is actually used: someone reports a failure
 * and quotes the `requestId` from the error response, or an operator wants to see
 * what has been failing on one route since a deploy.
 */
const isoDate = z.coerce.date();

export const listErrors = {
  query: z
    .object({
      // The reason this screen exists: the client is handed `requestId` in every
      // error response, so it is the one identifier a user can actually report.
      requestId: zString({ min: 1, max: 100 }).optional(),
      // Prefix match against `req.originalUrl`. Exact match would be useless —
      // the stored route includes the query string.
      route: zString({ min: 1, max: 200 }).optional(),
      method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']).optional(),
      // 5xx ONLY. `errorHandler` persists nothing below 500, so accepting a 404
      // here would return an empty page that reads as "this route never failed"
      // when the truth is "that filter can never match" — the same reasoning as
      // the audit viewer's rejection of an inverted date range (W6).
      statusCode: z.coerce.number().int().min(500).max(599).optional(),
      userId: zObjectId().optional(),
      orgId: zObjectId().optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    })
    .refine((v) => !(v.from && v.to) || v.from <= v.to, {
      message: 'from must not be after to',
      path: ['from'],
    }),
};

export const errorIdParam = {
  params: z.object({ id: zObjectId() }),
};
