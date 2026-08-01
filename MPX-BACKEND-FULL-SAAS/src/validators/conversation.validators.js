import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';

// M4-C — thread reads. `q` is a plain string; the service decides whether it is
// an id or a text search (native `$text` cannot sit inside an `$or`, so the two
// cannot be one query). Cursors are opaque strings, validated on decode.

export const listConversations = {
  query: z.object({
    q: zString({ min: 1, max: 200 }).optional(),
    cursor: zString({ min: 1, max: 200 }).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
};

export const conversationIdParam = {
  params: z.object({ id: zObjectId() }),
};

export const listMessages = {
  params: z.object({ id: zObjectId() }),
  query: z.object({
    before: zObjectId().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  }),
};

export const byProductParam = {
  params: z.object({ productId: zObjectId() }),
};

/**
 * M4-12 — the 200-character limit lives HERE, at the route boundary, and applies
 * to normal user sends only.
 *
 * It is deliberately not a model constraint: the composed first enquiry message
 * (structured fields + note) and system messages are exempt and routinely run
 * past 200, so `maxlength: 200` on `Message.body` would reject the thread's own
 * opening line on every single enquiry. Neither of those paths comes through
 * this route, so the cap can be strict here without touching them.
 *
 * `senderType` is NOT accepted from the client — it is derived from the caller's
 * role, so nobody can post as `system` and impersonate the platform.
 */
export const sendMessage = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ body: zString({ min: 1, max: 200 }) }),
};

// --- staff moderation (M4-E) -------------------------------------------------

// m5-rules §9 — conversation lists are CURSOR paginated, never page numbers.
// `productId` and `side`+`orgId` are the two navigation targets M5's screens
// use (G3/G4); `q` cannot express either, because it only ever branches on an
// org id and always matches both sides at once.
export const listAdminConversations = {
  query: z
    .object({
      q: zString({ min: 1, max: 200 }).optional(),
      productId: zObjectId().optional(),
      orgId: zObjectId().optional(),
      side: z.enum(['buyer', 'exporter']).optional(),
      cursor: zString({ min: 1, max: 200 }).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    // `side` narrows an org filter; on its own it would silently do nothing,
    // which reads as "this filter is broken" rather than "you forgot a field".
    .refine((v) => !v.side || v.orgId, { message: 'side requires orgId' }),
};

export const adminMessages = {
  params: z.object({ id: zObjectId() }),
  query: z.object({
    before: zObjectId().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  }),
};

// M4-25: BOTH parties are shown this text, so it is required and it is written
// for them, not for an internal note.
export const blockConversation = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }) }),
};

// The reason here explains the reversal for the audit trail; it is not the
// record of the moderation decision itself, so it stays optional.
export const unblockConversation = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }).optional() }),
};
