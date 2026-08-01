import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { PRODUCT_STATUS, PRICE_MODE, CURRENCIES, CATEGORY_TYPE } from './enums.js';
import { slugify } from '../utils/slug.js';

const { Schema } = mongoose;

const MAX_IMAGES = 5; // §A25.3 — max 5 images per product

// A seller's listing (goods OR service — one model, the leaf category's `type`
// decides which field group applies; §A14: the seller never picks it manually).
//
// Deliberate schema decisions (Part A):
//  - §A1  — lifecycle lives ENTIRELY in `status` (draft one-way, archived
//           terminal via delete). NO `isActive` and no scope mixin (the mixin
//           would add one).
//  - §A2  — owned via `exporterOrgId` (SCOPE.EXPORTER_ORG), not generic orgId.
//  - §A19 — no `createdBy`: product create/edit write AuditLog entries instead.
//  - §A23 — `sellerCountry`/`sellerVerified` are DENORMALISED, INTERNAL-ONLY
//           copies for the search index (Atlas $search cannot join). Set on
//           create; synced on org verify/demote/country-edit. NEVER public.
const productSchema = new Schema(
  {
    exporterOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },

    // Always a LEAF (sub-category) — tops are rejected at the service layer (the
    // model cannot see the parent without a lookup).
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // Public Cloudinary assets. `publicId` is INTERNAL (the A8 purge deletes
    // assets by it); the public projection maps this array to plain URLs.
    images: {
      type: [
        {
          url: { type: String, required: true, trim: true },
          publicId: { type: String, required: true, trim: true },
        },
      ],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_IMAGES,
        message: `a product may hold at most ${MAX_IMAGES} images`,
      },
    },

    // Flexible pricing: fixed (single value in `min`) / range (min–max) /
    // on_request (no numbers). Mode rules are enforced at the route boundary;
    // the model keeps the enum + currency allowlist as the backstop.
    price: {
      mode: { type: String, enum: PRICE_MODE, default: 'on_request' },
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, enum: CURRENCIES },
    },

    // goods-only (leaf type === 'goods'):
    moq: { type: Number, min: 0 },
    unit: { type: String, trim: true },
    hsCode: { type: String, trim: true },
    countryOfOrigin: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    supplyAbility: { type: String, trim: true },
    leadTime: { type: String, trim: true },
    packaging: { type: String, trim: true },
    terms: { type: String, trim: true },

    // service-only (leaf type === 'service'):
    engagementType: { type: String, trim: true },
    deliveryModel: { type: String, trim: true },
    teamSize: { type: String, trim: true },
    pricingModel: { type: String, trim: true },
    timeline: { type: String, trim: true },

    // Category-specific specs. `value` is Mixed so numeric range filters work —
    // the route boundary restricts it to a PRIMITIVE (string|number|boolean);
    // an object must never reach this indexed, M3-queried path.
    attributes: {
      type: [
        {
          attributeId: { type: Schema.Types.ObjectId, ref: 'CategoryAttribute' },
          key: { type: String, required: true, trim: true, lowercase: true },
          value: { type: Schema.Types.Mixed },
        },
      ],
      default: [],
    },

    // §A1: draft (default, one-way) → active ↔ inactive; archived = terminal
    // (delete path only). Transition rules live in the service.
    status: { type: String, enum: PRODUCT_STATUS, default: 'draft', index: true },

    // F1-B: whether this product was ALREADY taken down when an org block
    // cascaded over it. Unblock restores only the rows the cascade itself downed
    // — a product an admin had taken down individually beforehand stays down, or
    // the unblock would silently undo a separate moderation decision.
    // Same pattern as Category.prevActive and User.prevActive. Undefined at all
    // other times; a value here means an org block is currently overriding it.
    prevTakedown: { type: Boolean },

    // Public SEO handle (/product/:slug). Generated once from `name` (short id
    // suffix on clash); immutable on rename; the ARCHIVE path appends a marker
    // to free the clean slug (A6).
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // Admin moderation (m5-rules §2: NEVER conflated with `status`). The owning
    // seller sees reason + at, never byUserId (A9).
    takedown: {
      isDown: { type: Boolean, default: false },
      reason: { type: String, trim: true },
      byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },

    // §A23 denorm — INTERNAL-ONLY (never in PUBLIC_FIELDS).
    sellerCountry: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    sellerVerified: { type: Boolean, default: false, index: true },

    // §A26 denorms — also INTERNAL-ONLY. Native $text cannot join and cannot sit
    // inside $or, so the searchable corpus and the facet keys have to live on
    // the product row. Kept in sync by services/searchSync.service.js.
    //
    // searchKeywords: leaf category name + synonyms + attribute values + seller
    // company name (see utils/searchKeywords.js). select:false — it is index
    // fodder, not payload, and must never be serialised anywhere.
    searchKeywords: { type: String, select: false },
    // The leaf's `type` — powers the goods/service facet without a lookup.
    categoryType: { type: String, enum: CATEGORY_TYPE, index: true },
    // The leaf's parent — powers the category facet counts without a lookup.
    topCategoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
  },
  baseSchemaOptions,
);

productSchema.index({ exporterOrgId: 1, status: 1 }); // cap query · /mine · §9b count
productSchema.index({ categoryId: 1, status: 1 }); // browse by category
productSchema.index({ 'attributes.key': 1, 'attributes.value': 1 }); // M3 facet filters
productSchema.index({ 'takedown.isDown': 1, 'takedown.at': 1 }); // purge scan + Blocked filter
productSchema.index({ sellerCountry: 1 });

// §A26 — THE text index. ⚠️ MongoDB allows exactly ONE text index per
// collection: extend this compound definition, never add a second one.
// Weights put a product's own name first, the denormalised corpus (category /
// synonyms / attribute values / seller name) second, the free-text description
// last. Left on the DEFAULT english analyser on purpose — its stemming already
// matches "medicines" to "medicine" without any fuzzy engine (do not set
// default_language: 'none').
productSchema.index(
  { name: 'text', searchKeywords: 'text', description: 'text' },
  { weights: { name: 10, searchKeywords: 5, description: 1 }, name: 'product_text' },
);

// Slug once, from the name; short id suffix on a visible clash (an insert-race
// E11000 is retried by the service with a random suffix).
productSchema.pre('validate', async function generateSlug() {
  if (this.slug || !this.name) return;
  const base = slugify(this.name) || String(this._id).slice(-6);
  const clash = await this.constructor
    .findOne({ slug: base, _id: { $ne: this._id } })
    .select('_id')
    .lean();
  this.slug = clash ? `${base}-${String(this._id).slice(-4)}` : base;
});

declareScope(productSchema, SCOPE.EXPORTER_ORG);

// A3: the product PUBLIC whitelist (m3.md §5c.1). Deliberately absent: `status`
// (only active rows are queryable at all), the entire `takedown` object, raw
// `exporterOrgId` (the seller block is the org's public projection, composed in
// the controller), `sellerCountry`/`sellerVerified` (§A23 internal denorms),
// image `publicId`s, and attribute `attributeId`s.
export const PUBLIC_FIELDS = [
  'name',
  'slug',
  'description',
  'moq',
  'unit',
  'hsCode',
  'countryOfOrigin',
  'supplyAbility',
  'leadTime',
  'packaging',
  'terms',
  'engagementType',
  'deliveryModel',
  'teamSize',
  'pricingModel',
  'timeline',
];

export const PUBLIC_DERIVED = {
  id: (p) => String(p._id),
  // Stable price shape (never the raw subdocument).
  price: (p) => ({
    mode: p.price?.mode ?? 'on_request',
    min: p.price?.min ?? null,
    max: p.price?.max ?? null,
    currency: p.price?.currency ?? null,
  }),
  // Plain URL list — `publicId` stays internal (purge bookkeeping).
  images: (p) => (p.images ?? []).map((i) => i.url),
  // Specs as {key, value} only — `attributeId` is internal.
  attributes: (p) => (p.attributes ?? []).map((a) => ({ key: a.key, value: a.value })),
  // Trust signal (5c.1 "listed-since").
  listedSince: (p) => p.createdAt ?? null,
};

export const MAX_PRODUCT_IMAGES = MAX_IMAGES;
export const Product = mongoose.model('Product', productSchema);
