import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { PRICE_MODE, CURRENCIES } from '../models/enums.js';
import { MAX_PRODUCT_IMAGES } from '../models/Product.js';

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

  // goods-only:
  moq: z.coerce.number().nonnegative().optional(),
  unit: zString({ min: 1, max: 40 }).optional(),
  hsCode: zString({ min: 1, max: 20 }).optional(),
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

export const productIdParam = {
  params: z.object({ id: zObjectId() }),
};

export const listMine = {
  query: z.object({
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
    status: z.enum(['active', 'inactive', 'blocked']).optional(),
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
