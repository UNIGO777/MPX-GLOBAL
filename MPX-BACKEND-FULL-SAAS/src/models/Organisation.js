import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { ORG_TYPE, KYC_STATUS, ENTITY_TYPE, KYC_DOC_TYPE } from './enums.js';
import { slugify } from '../utils/slug.js';

const { Schema } = mongoose;

// The tenant root — its _id IS the orgId every other business document
// references, so it carries no orgId of its own (documented exception to the
// orgId convention).
const organisationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // A5: intentionally NOT unique

    // Public, readable slug for SEO URLs (/supplier/:slug). Generated from `name`
    // on first save, then IMMUTABLE — a rename must never change it and break an
    // indexed public URL (A6 / SEO §1). See the pre-validate hook below.
    slug: { type: String, lowercase: true, trim: true },

    type: { type: String, enum: ORG_TYPE, required: true, index: true },

    // Captured at exporter signup (owner decision — the fields image). Drives the
    // KYC document path (business ⇒ registration/GST; individual ⇒ govt ID).
    entityType: { type: String, enum: ENTITY_TYPE },

    // A6: ISO 3166-1 alpha-2 code (IN, AE, AU) — never a display name.
    country: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    },

    website: { type: String, trim: true },
    description: { type: String, trim: true },
    logo: { type: String, trim: true },

    businessProfile: {
      registrationNumber: { type: String, trim: true },
      taxId: { type: String, trim: true },
      establishedYear: { type: Number },
    },

    // Used later for contract signing — captured now so relations don't change.
    authorisedSignatory: {
      name: { type: String, trim: true },
      designation: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      mobile: {
        countryCode: { type: String, trim: true },
        number: { type: String, trim: true },
        e164: { type: String, trim: true },
      },
    },

    kycStatus: { type: String, enum: KYC_STATUS, default: 'pending', index: true },
    // Set when documents are first submitted (kycStatus → 'submitted'); lets the
    // review queue order by submission time.
    kycSubmittedAt: { type: Date },
    // A7 (tracker E3): select:false so no list endpoint accidentally returns KYC
    // documents. We store only the Cloudinary `storageKey` (public_id) — a PRIVATE
    // reference, never a public URL. Documents are served via a permissioned
    // endpoint that mints signed, expiring URLs from the storageKey on read.
    kycDocuments: {
      type: [
        {
          docType: { type: String, enum: KYC_DOC_TYPE, required: true },
          storageKey: { type: String, required: true, trim: true },
          format: { type: String, trim: true },
          uploadedAt: { type: Date, default: Date.now },
          verifiedAt: { type: Date },
          verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        },
      ],
      select: false,
      default: [],
    },

    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    // Set when an employee rejects verification (kycStatus 'rejected'). Internal —
    // not exposed on public listings.
    kycRejectionReason: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

// A5: uniqueness only when a registration number exists, and it's (number,
// country) — enforced at verification time, not signup. Partial index so orgs
// without a registration number are unconstrained.
organisationSchema.index(
  { 'businessProfile.registrationNumber': 1, country: 1 },
  {
    unique: true,
    partialFilterExpression: { 'businessProfile.registrationNumber': { $type: 'string' } },
  },
);

// Public slug is unique, but only where present — pre-existing orgs created before
// this field (null slug) don't collide on the index (partial filter).
organisationSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);

// Generate the slug once, from the company name, then leave it alone (immutable:
// a rename must not rewrite an indexed public URL — A6). On a base-slug clash,
// append a short suffix from the id (SEO §1). Async throw-style hook (Mongoose 9);
// runs before validation so the unique index sees the final value.
organisationSchema.pre('validate', async function generateSlug() {
  if (this.slug || !this.name) return;
  const base = slugify(this.name) || String(this._id).slice(-6);
  const clash = await this.constructor
    .findOne({ slug: base, _id: { $ne: this._id } })
    .select('_id')
    .lean();
  this.slug = clash ? `${base}-${String(this._id).slice(-4)}` : base;
});

declareScope(organisationSchema, SCOPE.SELF);

export const Organisation = mongoose.model('Organisation', organisationSchema);
