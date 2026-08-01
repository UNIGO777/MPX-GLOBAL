import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';

/**
 * M5-C — audit viewer filters (m5 §6: actor · action type · date range · target).
 *
 * W6 — an inverted `from`/`to` range is REJECTED, not silently applied. An empty
 * page reads as "no activity in this window", which is the opposite of the truth
 * and exactly the wrong answer to give someone investigating an incident.
 */
const isoDate = z.coerce.date();

export const listAudit = {
  query: z
    .object({
      actorId: zObjectId().optional(),
      // §7 — Organisation detail shows "this Organisation's full record". That is
      // NOT expressible as entityType+entityId: a product takedown carries
      // entityType 'Product' but the seller's orgId, so filtering by target would
      // miss most of a company's own history. AuditLog already indexes orgId.
      orgId: zObjectId().optional(),
      // Matched exactly. Not an enum on purpose — the action list grows with
      // every module, and a stale allowlist would hide new entries.
      action: zString({ min: 1, max: 80 }).optional(),
      entityType: zString({ min: 1, max: 40 }).optional(),
      entityId: zObjectId().optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    })
    .refine((v) => !(v.from && v.to) || v.from <= v.to, {
      message: 'from must not be after to',
      path: ['from'],
    })
    // `entityId` without `entityType` would scan every collection's ids; the
    // index is {entityType, entityId}, so the pair is what makes it a lookup.
    .refine((v) => !v.entityId || v.entityType, {
      message: 'entityId requires entityType',
      path: ['entityId'],
    }),
};

export const auditIdParam = {
  params: z.object({ id: zObjectId() }),
};
