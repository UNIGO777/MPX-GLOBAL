import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { PRICE_MODE, CURRENCIES } from '../models/enums.js';
import { MAX_PRODUCT_IMAGES } from '../models/Product.js';
import { containsContactDetails } from '../utils/contactDetails.js';
import { normaliseHsCode } from '../utils/hsCodes.js';

// §A25.3 image refs come from POST /products/images — ownership of the publicId
// prefix is re-checked in the service.
const imageRef = z.object({
  url: zString({ min: 8, max: 500 }),
  publicId: zString({ min: 3, max: 300 }),
});

// attributes[].value is a PRIMITIVE union ONLY (string|number|boolean) — the
// Mixed path is indexed and becomes an M3 filter target, so an operator object
// must be impossible at the boundary (rejectMongoOperators is the backstop).
const attributeInput = z.object({
  key: zString({ min: 1, max: 60 }).regex(/^[a-z0-9_]+$/, 'invalid key'),
  value: z.union([z.string().trim().max(500), z.number(), z.boolean()]),
});

// Seller-written specs (2026-09-23). Plain text only, capped, unique labels,
// and no contact details — these render on the PUBLIC product page, where an
// email, link or phone number would route a buyer around the platform.
export const MAX_CUSTOM_SPECS = 10;
const customSpec = z.object({
  label: zString({ min: 1, max: 40 }),
  value: zString({ min: 1, max: 200 }),
});
const customSpecs = z
  .array(customSpec)
  .max(MAX_CUSTOM_SPECS)
  .superRefine((rows, ctx) => {
    const seen = new Set();
    rows.forEach((r, i) => {
      const key = r.label.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: [i, 'label'], message: `"${r.label}" is listed twice` });
      }
      seen.add(key);
      if (containsContactDetails(r.label) || containsContactDetails(r.value)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'value'],
          message: 'Contact details (email, phone or links) cannot go in specifications',
        });
      }
    });
  });

// Price mode rules (plan M2-E): fixed → single value in `min`, no `max`;
// range → min < max; on_request → no numbers; currency required unless
// on_request. Currency comes from the static ISO-4217 allowlist.
const price = z
  .object({
    mode: z.enum(PRICE_MODE),
    min: z.coerce.number().nonnegative().optional(),
    max: z.coerce.number().nonnegative().optional(),
    currency: z.enum(CURRENCIES).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.mode === 'fixed') {
      if (p.min === undefined) ctx.addIssue({ code: 'custom', message: 'fixed price needs a value (min)' });
      if (p.max !== undefined) ctx.addIssue({ code: 'custom', message: 'fixed price must not carry max' });
    }
    if (p.mode === 'range') {
      if (p.min === undefined || p.max === undefined) {
        ctx.addIssue({ code: 'custom', message: 'range needs min and max' });
      } else if (p.min >= p.max) {
        ctx.addIssue({ code: 'custom', message: 'range needs min < max' });
      }
    }
    if (p.mode === 'on_request') {
      if (p.min !== undefined || p.max !== undefined) {
        ctx.addIssue({ code: 'custom', message: 'on_request carries no price values' });
      }
    } else if (p.currency === undefined) {
      ctx.addIssue({ code: 'custom', message: 'currency is required unless price is on request' });
    }
  });

const countryCode = zString({ min: 2, max: 2 }).regex(/^[A-Za-z]{2}$/, 'ISO alpha-2 code');

// Common + goods-only + service-only fields. Cross-type presence (a goods leaf
// with service fields, etc.) is enforced in the service against the LEAF type.
const productFields = {
  name: zString({ min: 1, max: 200 }),
  description: zString({ max: 5000 }).optional(),
  categoryId: zObjectId(),
  price,
  images: z.array(imageRef).max(MAX_PRODUCT_IMAGES).optional(),
  attributes: z.array(attributeInput).max(50).optional(),
  customSpecs: customSpecs.optional(),

  // goods-only:
  // 🔴 min 1, integer (owner, 2026-08-17): "cannot be 0". A zero minimum-order
  // is meaningless to a buyer and made the MOQ filter nonsense. Still
  // `.optional()` here because a DRAFT may be saved incomplete — publishing a
  // goods listing without one is refused in `product.service.js`.
  moq: z.coerce.number().int().min(1).optional(),
  unit: zString({ min: 1, max: 40 }).optional(),
  // HS code (2026-09-24): picked from the HS 2022 list, or typed by the seller
  // when theirs isn't listed. Separators are stripped ("5208.11" → "520811")
  // and it must then be 6–8 digits — the 6-digit international code, or a
  // national 8-digit extension such as India's ITC-HS.
  hsCode: z
    .preprocess((v) => (typeof v === 'string' ? normaliseHsCode(v.trim()) : v), z.string())
    .refine((v) => /^\d{6,8}$/.test(v), { message: 'HS code must be 6–8 digits.' })
    .optional(),
  countryOfOrigin: countryCode.optional(),
  supplyAbility: zString({ min: 1, max: 200 }).optional(),
  leadTime: zString({ min: 1, max: 200 }).optional(),
  packaging: zString({ min: 1, max: 500 }).optional(),
  terms: zString({ min: 1, max: 500 }).optional(),

  // service-only:
  engagementType: zString({ min: 1, max: 120 }).optional(),
  deliveryModel: zString({ min: 1, max: 120 }).optional(),
  teamSize: zString({ min: 1, max: 60 }).optional(),
  pricingModel: zString({ min: 1, max: 120 }).optional(),
  timeline: zString({ min: 1, max: 200 }).optional(),
};

export const createProduct = {
  body: z.object(productFields),
};

export const updateProduct = {
  params: z.object({ id: zObjectId() }),
  body: z
    .object(
      Object.fromEntries(Object.entries(productFields).map(([k, schema]) => [k, schema.optional()])),
    )
    .refine((b) => Object.keys(b).length > 0, { message: 'empty patch' }),
};

// §A1: only active|inactive are reachable here — draft is one-way (never a
// target) and archived only via DELETE (A5).
export const setStatus = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ status: z.enum(['active', 'inactive']) }),
};

// The HS code picker's search (2026-09-24).
export const hsCodeSearch = {
  query: z.object({
    q: zString({ min: 1, max: 60 }),
    limit: z.coerce.number().int().min(1).max(25).default(20),
  }),
};

export const productIdParam = {
  params: z.object({ id: zObjectId() }),
};

// The seller's own list. Unlike the admin monitoring list this DOES expose
// drafts and archived rows — they are the seller's own, and the list screen's
// status tabs are exactly these four plus "All" (omit `status` for All).
export const listMine = {
  query: z.object({
    status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
    // Name search over the seller's OWN products (2026-09-24).
    q: zString({ min: 1, max: 80 }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

// --- public browse/detail (M2-F) -----------------------------------------------

// category/seller accept an id OR slug; the detail param too (SEO §1).
const idOrSlug = zString({ min: 1, max: 200 });

export const listPublic = {
  query: z.object({
    category: idOrSlug.optional(),
    seller: idOrSlug.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

export const publicIdOrSlugParam = {
  params: z.object({ idOrSlug }),
};

// --- admin moderation (M2-G) ---------------------------------------------------

// m5 §4: EXACTLY three status options — Active/Inactive read `status`, Blocked
// reads `takedown.isDown`. Drafts and archived rows are never listed at all.
export const listAdminProducts = {
  query: z.object({
    category: idOrSlug.optional(),
    // 'requests' = taken down with an unblock request waiting (D6).
    status: z.enum(['active', 'inactive', 'blocked', 'requests']).optional(),
    // §5 — lets the dashboard's "nearing purge" tile link to a list that
    // reproduces its own count, instead of to every blocked product.
    nearingPurge: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    seller: zObjectId().optional(),
    q: zString({ min: 1, max: 100 }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

// Reason is REQUIRED on takedown (m5-rules §2 — no default, no empty string).
export const takedownBody = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }) }),
};

// D6 · the seller explains what they fixed; staff give a reason when declining.
export const unblockRequestBody = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ message: zString({ min: 10, max: 1000 }) }).strict(),
};

export const unblockRejectBody = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }) }).strict(),
};
