import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { CATEGORY_TYPE } from './enums.js';
import { slugify } from '../utils/slug.js';

const { Schema } = mongoose;

// Global taxonomy (platform document): self-referential 2-level tree. The ~40
// tops are seeded; sub-categories are admin-managed. A4: Category uses
// `active` + `prevActive` — deliberately NOT the base mixin's `isActive`, so the
// top-toggle cascade can restore each sub's prior state instead of
// blanket-enabling.
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

    // Public SEO handle (/category/:slug). Generated from `name` on first save
    // when absent (seed supplies explicit, de-duplicated slugs), then immutable —
    // a rename must never break an indexed public URL (A6 / SEO §1).
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // null = top category; set = sub-category (leaf). Depth is 2 — enforced at
    // the create endpoint (parent must itself be a top).
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', index: true, default: null },

    // A16: REQUIRED on sub-categories, ABSENT on tops (no default — a top's
    // goods/services grouping is derived from its children at read time, never
    // stored). Enforced by the pre-validate hook below.
    type: { type: String, enum: CATEGORY_TYPE },

    active: { type: Boolean, default: true },

    // A4: each sub's `active` as it was JUST BEFORE a top-toggle cascade switched
    // it off — reactivation restores from here. Also written (as false) when an
    // admin deactivates a sub DURING a cascade-off period, so their intent
    // survives the top's reactivation. Managed only by the toggle service;
    // undefined at all other times.
    prevActive: { type: Boolean },

    order: { type: Number, default: 0 },

    // A11: optional Cloudinary URL for category cards; A20: uploaded by admin
    // (tops included — the deliberate exception to top = toggle-only).
    image: { type: String, trim: true },

    // A12/M3: keyword→category search terms. Seeded empty (the top-40 list is
    // owner content); admin-editable. Search-only — never on a public response.
    synonyms: { type: [String], default: [] },
  },
  baseSchemaOptions,
);

categorySchema.index({ parentId: 1, active: 1, order: 1 });

// A16, both directions: a top must NOT carry a type; a sub MUST.
categorySchema.pre('validate', function enforceTypeOnLeaf() {
  if (this.parentId == null && this.type != null) {
    throw new Error('Category: a top category must not have a type (A16 — derived from children)');
  }
  if (this.parentId != null && this.type == null) {
    throw new Error('Category: a sub-category requires a type (A16)');
  }
});

// Generate the slug once from the name when absent; short id suffix on clash
// (SEO §1). Seed data supplies explicit slugs, so this mainly serves
// admin-created sub-categories.
categorySchema.pre('validate', async function generateSlug() {
  if (this.slug || !this.name) return;
  const base = slugify(this.name) || String(this._id).slice(-6);
  const clash = await this.constructor
    .findOne({ slug: base, _id: { $ne: this._id } })
    .select('_id')
    .lean();
  this.slug = clash ? `${base}-${String(this._id).slice(-4)}` : base;
});

declareScope(categorySchema, SCOPE.PLATFORM);

// A3: the category PUBLIC whitelist. Deliberately absent: `order` (server sorts
// by it, the projection rule lists it private), `synonyms` (search-only — A12),
// `active`/`prevActive` (public reads exclude inactive rows in the query), and
// admin/internal fields.
export const PUBLIC_FIELDS = ['name', 'slug', 'image', 'parentId', 'type'];
export const PUBLIC_DERIVED = {
  id: (cat) => String(cat._id),
};

export const Category = mongoose.model('Category', categorySchema);
