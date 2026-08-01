import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';

/**
 * FINALIZE F5b — featured landing content.
 *
 * Note the multipart cases: multer populates `req.body` with STRINGS, so the
 * banner schemas coerce. The JSON create path does not, because a real client
 * sends real types there and silent coercion hides bugs.
 */

/**
 * A banner's destination. Either a site-relative path or an absolute http(s)
 * URL — nothing else.
 *
 * This is a security check, not tidiness: the frontend renders this straight
 * into an `href`, so `javascript:…` here would be stored XSS placed by an
 * employee with `featured:manage` and served to every visitor on the landing
 * page. An allowlist of two shapes is the only safe way to accept it.
 */
const linkUrl = zString({ max: 500 }).refine(
  (v) => /^\/(?!\/)[\w\-./?=&%#]*$/.test(v) || /^https?:\/\/[^\s]+$/i.test(v),
  { message: 'must be a relative path (/…) or an absolute http(s) URL' },
);

const isoDate = z.coerce.date();

// Shared curation fields. Present on every kind.
const curation = {
  order: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.coerce.boolean().optional(),
  startsAt: isoDate.optional(),
  endsAt: isoDate.optional(),
};

const windowIsOrdered = (v) => !(v.startsAt && v.endsAt) || v.startsAt <= v.endsAt;
const windowMessage = { message: 'startsAt must not be after endsAt', path: ['startsAt'] };

/** Feature an existing product / category / supplier (JSON). */
export const createFeatured = {
  body: z
    .object({
      // `banner` is excluded on purpose — it has its own multipart route,
      // because a banner without an image file is not a valid row.
      kind: z.enum(['product', 'category', 'supplier']),
      targetId: zObjectId(),
      ...curation,
    })
    .refine(windowIsOrdered, windowMessage),
};

/** Create a banner (multipart: an image file plus these text fields). */
export const createBanner = {
  body: z
    .object({
      title: zString({ max: 120 }).optional(),
      subtitle: zString({ max: 240 }).optional(),
      linkUrl: linkUrl.optional(),
      ...curation,
    })
    .refine(windowIsOrdered, windowMessage),
};

/**
 * Patch curation and banner text. `kind` and `targetId` are deliberately absent:
 * repointing a slot at a different product would silently rewrite what was
 * audited when it was created — delete the row and add the new one instead.
 */
export const updateFeatured = {
  params: z.object({ id: zObjectId() }),
  body: z
    .object({
      title: zString({ max: 120 }).nullish(),
      subtitle: zString({ max: 240 }).nullish(),
      linkUrl: linkUrl.nullish(),
      ...curation,
    })
    .refine(windowIsOrdered, windowMessage),
};

export const featuredIdParam = {
  params: z.object({ id: zObjectId() }),
};
