import { z } from 'zod';

import { zString } from './helpers.js';
import { CURRENCIES, CATEGORY_TYPE } from '../models/enums.js';

const idOrSlug = zString({ min: 1, max: 200 });
const flag = z.enum(['true', 'false']).transform((v) => v === 'true');

// Attribute filters arrive in BRACKET notation — `attr[gsm]=140` or
// `attr[gsm][min]=100`. NEVER dotted: `rejectMongoOperators` 400s any request key
// containing a dot, and `qs` does not expand dots into objects, so `attr.gsm`
// could never reach a controller (§ plan M3-B).
const attrValue = z.union([
  zString({ min: 1, max: 200 }), // "Cotton" or "Cotton,Silk"
  z.object({
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
  }),
]);

const baseQuery = {
  q: zString({ min: 1, max: 200 }).optional(),
  type: z.enum(['product', 'supplier']).default('product'),
  category: idOrSlug.optional(),
  seller: idOrSlug.optional(),
  country: zString({ min: 2, max: 2 }).optional(),
  currency: z.enum(CURRENCIES).default('INR'),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  onRequest: flag.optional(),
  moqMin: z.coerce.number().nonnegative().optional(),
  goodsOrService: z.enum(CATEGORY_TYPE).optional(),
  verifiedOnly: flag.optional(),
  sort: z.enum(['relevance', 'newest', 'priceAsc', 'priceDesc']).default('relevance'),
  attr: z.record(zString({ min: 1, max: 60 }), attrValue).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

// §A27.3 — supplier mode only supports company-level filters. A product-only
// param there is a 400 naming the parameter, never a silent ignore (a silent
// ignore hides a frontend bug; the error surfaces it in development).
const PRODUCT_ONLY = ['category', 'seller', 'priceMin', 'priceMax', 'onRequest', 'moqMin', 'goodsOrService', 'attr'];

function refineSupplierMode(query, ctx) {
  if (query.type !== 'supplier') return;
  for (const key of PRODUCT_ONLY) {
    if (query[key] !== undefined) {
      ctx.addIssue({ code: 'custom', path: [key], message: `${key} does not apply to supplier search` });
    }
  }
  if (query.sort === 'priceAsc' || query.sort === 'priceDesc') {
    ctx.addIssue({ code: 'custom', path: ['sort'], message: 'suppliers cannot be sorted by price' });
  }
}

function refinePriceRange(query, ctx) {
  if (query.priceMin !== undefined && query.priceMax !== undefined && query.priceMin > query.priceMax) {
    ctx.addIssue({ code: 'custom', path: ['priceMin'], message: 'priceMin must not exceed priceMax' });
  }
}

export const search = {
  query: z.object(baseQuery).superRefine((query, ctx) => {
    refineSupplierMode(query, ctx);
    refinePriceRange(query, ctx);
  }),
};

// Facets take the SAME params as search — counts are always "for the current
// query", so every active filter has to be passed in.
export const facets = search;

// AI search: one free-text sentence. Bounded so a huge body can never reach the
// model (cost) — zString also rejects any non-string operator payload.
export const aiSearch = {
  body: z.object({ query: zString({ min: 2, max: 500 }) }),
};

/**
 * Resolve the raw `attr` bag against the leaf's real CategoryAttribute rows:
 * unknown keys are rejected, and a range is only valid on a `number` attribute.
 * Runs in the service (it needs the DB), not in the zod schema.
 */
export function resolveAttributeFilters(rawAttr, defs) {
  if (!rawAttr) return [];
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const out = [];

  for (const [key, raw] of Object.entries(rawAttr)) {
    const def = byKey.get(key);
    if (!def) {
      const err = new Error(`unknown attribute key: ${key}`);
      err.clientMessage = `Unknown filter "${key}" for this category.`;
      throw err;
    }

    if (typeof raw === 'string') {
      const values = raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => {
          if (def.inputType === 'number') return Number(v);
          if (def.inputType === 'boolean') return v === 'true';
          return v;
        });
      if (values.length > 0) out.push({ key, values });
      continue;
    }

    if (def.inputType !== 'number') {
      const err = new Error(`range filter on non-number attribute: ${key}`);
      err.clientMessage = `"${def.name}" cannot be filtered by range.`;
      throw err;
    }
    out.push({ key, min: raw.min, max: raw.max });
  }
  return out;
}
