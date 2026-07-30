import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { CATEGORY_TYPE, ATTR_INPUT_TYPE } from '../models/enums.js';

// Public single reads accept an ObjectId OR a slug (SEO §1 serves /category/:slug).
const idOrSlug = zString({ min: 1, max: 200 });

export const idOrSlugParam = {
  params: z.object({ idOrSlug }),
};

export const parentIdParam = {
  params: z.object({ parentId: zObjectId() }),
};

export const categoryIdParam = {
  params: z.object({ id: zObjectId() }),
};

const synonyms = z.array(zString({ min: 1, max: 60 })).max(100);

// Admin: sub-category create (top create is deliberately impossible — seeded).
export const createSub = {
  body: z.object({
    parentId: zObjectId(),
    name: zString({ min: 1, max: 120 }),
    type: z.enum(CATEGORY_TYPE),
    synonyms: synonyms.optional(),
    order: z.coerce.number().int().min(0).max(10000).optional(),
  }),
};

// Admin: category patch. Slug and parentId are IMMUTABLE — deliberately not
// accepted here. `type` is accepted for subs only and the service blocks the
// change once products exist.
export const updateCategory = {
  params: z.object({ id: zObjectId() }),
  body: z
    .object({
      name: zString({ min: 1, max: 120 }).optional(),
      order: z.coerce.number().int().min(0).max(10000).optional(),
      synonyms: synonyms.optional(),
      type: z.enum(CATEGORY_TYPE).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'empty patch' }),
};

// Attribute create: key + inputType are set once, immutable afterwards.
export const createAttribute = {
  params: z.object({ id: zObjectId() }),
  body: z.object({
    name: zString({ min: 1, max: 120 }),
    key: zString({ min: 1, max: 60 }).regex(/^[a-z0-9_]+$/, 'key must be lowercase snake_case'),
    inputType: z.enum(ATTR_INPUT_TYPE),
    options: z.array(zString({ min: 1, max: 120 })).max(100).optional(),
    unit: zString({ min: 1, max: 20 }).optional(),
    required: z.coerce.boolean().optional(),
    filterable: z.coerce.boolean().optional(),
    order: z.coerce.number().int().min(0).max(10000).optional(),
  }),
};

// Attribute patch: editable set only — `key`/`inputType` are IMMUTABLE and not
// accepted (a number→select flip would corrupt stored product values).
export const updateAttribute = {
  params: z.object({ id: zObjectId(), attrId: zObjectId() }),
  body: z
    .object({
      name: zString({ min: 1, max: 120 }).optional(),
      options: z.array(zString({ min: 1, max: 120 })).max(100).optional(),
      unit: zString({ min: 1, max: 20 }).optional(),
      required: z.coerce.boolean().optional(),
      filterable: z.coerce.boolean().optional(),
      order: z.coerce.number().int().min(0).max(10000).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'empty patch' }),
};

export const attributeParams = {
  params: z.object({ id: zObjectId(), attrId: zObjectId() }),
};
