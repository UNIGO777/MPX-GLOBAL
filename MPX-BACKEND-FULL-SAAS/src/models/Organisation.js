import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { ORG_TYPE, KYC_STATUS, ENTITY_TYPE, KYC_DOC_TYPE, PENDING_CHANGE_STATE } from './enums.js';
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

    // A21: `type` only separates a company org (`business`) from the single
    // platform/system org (`platform`). It is NO LONGER the buyer/exporter
    // discriminator — that is buyerSide/exporterSide below.
    type: { type: String, enum: ORG_TYPE, required: true, index: true },

    // A21: which sides this ONE company operates. Both false = the platform org.
    // A buyer-approved company that later claims an exporter side shares the same
    // kycStatus (one company, one tick — see verification.service.js). Boolean +
    // default:false so a missing flag can never read as truthy.
    buyerSide: { type: Boolean, default: false, index: true },
    exporterSide: { type: Boolean, default: false, index: true },

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
    // Public supplier-profile cover banner (2026-08-13, owner-directed
    // redesign — SupplierProfile.jsx). Same shape as `logo`: a Cloudinary
    // URL, public asset by design, no upload endpoint wired yet — see that
    // file's own header comment for what's built vs still missing.
    coverImage: { type: String, trim: true },

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
          // Verification-redesign (2026-08-19). All three absent on legacy rows,
          // which therefore read as "current, initial round" — no migration.
          roundId: { type: Schema.Types.ObjectId },   // pending-change round this doc supports
          requestId: { type: Schema.Types.ObjectId }, // documentRequest this doc fulfils
          // Set when a later round is approved (or this doc's round cancelled).
          // Superseded docs are KEPT forever — hidden by default, excluded from
          // the 20-doc cap. There is deliberately still no delete path.
          supersededAt: { type: Date },
        },
      ],
      select: false,
      default: [],
    },

    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },

    /**
     * Verification-redesign (owner, 2026-08-19) — the PENDING CHANGE SET.
     *
     * A VERIFIED org's locked-field edits (name/country/entityType/address) land
     * here instead of on the live fields: the live profile and the tick stay
     * untouched and public while the change earns re-approval with fresh
     * documents. One set at a time — further edits amend it. Absent (undefined)
     * = no pending change; approve/cancel $unset the whole subdocument (the
     * history is the AuditLog's job). NEVER in PUBLIC_FIELDS.
     */
    pendingChanges: {
      type: {
        values: {
          name: { type: String, trim: true },
          country: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
          entityType: { type: String, enum: ENTITY_TYPE },
          address: {
            line1: { type: String, trim: true },
            line2: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            postalCode: { type: String, trim: true },
            country: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
          },
        },
        changedFields: { type: [String], default: undefined },
        state: { type: String, enum: PENDING_CHANGE_STATE },
        // Joins kycDocuments rows to this change (doc.roundId === roundId).
        roundId: { type: Schema.Types.ObjectId },
        submittedAt: { type: Date }, // re-dated on every amend
        rejectionReason: { type: String, trim: true }, // owner-visible, never public
        rejectedAt: { type: Date },
        rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
      default: undefined,
    },

    /**
     * Staff-initiated document requests (2026-08-19): "upload X and Y, because…".
     * The note is SHOWN TO THE COMPANY. `fulfilledAt` is set automatically when
     * every requested docType has a non-superseded upload dated after the
     * request. The tick is untouched while a request is open. Never public.
     */
    documentRequests: {
      type: [
        {
          docTypes: { type: [{ type: String, enum: KYC_DOC_TYPE }], required: true },
          note: { type: String, trim: true, required: true },
          requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          requestedAt: { type: Date, default: Date.now },
          fulfilledAt: { type: Date },
        },
      ],
      default: [],
    },

    /**
     * Set when staff revoke a granted verification (mandatory reason, shown to
     * the company — never public). Cleared on the next successful verify.
     */
    kycRevocation: {
      reason: { type: String, trim: true },
      revokedAt: { type: Date },
      revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    // Set when an employee rejects verification (kycStatus 'rejected'). Internal —
    // not exposed on public listings.
    kycRejectionReason: { type: String, trim: true },

    // F1-A: an admin block flips this to false. The public seller read already
    // filters { isActive: true }, so the profile 404s the moment it does. NOTE this
    // flag alone does NOT end sessions — `authenticate` never reads the org (that
    // lookup is deliberately kept off every request), so the block MUST also cascade
    // onto the org's user rows. See services/orgBlock.service.js.
    isActive: { type: Boolean, default: true },

    // F1-A: why the org was blocked, and by whom. INTERNAL — never public (it is
    // absent from PUBLIC_FIELDS below, which is what keeps it private).
    blockReason: { type: String, trim: true },
    blockedAt: { type: Date },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // §A24 (M2): per-seller takedown counter — INCREMENT-ONLY (a restore never
    // decrements; it counts offences, not current state). Purge-proof by design:
    // blocked products hard-delete at 180 days (A8), so counting Product rows
    // would undercount repeat offenders exactly when it matters. This is the
    // trigger data for the F6 suspension threshold. INTERNAL — not public.
    takedownCount: { type: Number, default: 0 },

    // F1-B: what the org-block cascade did, and whether it finished. This exists
    // BECAUSE the cascade is asynchronous (owner decision 2026-08-01) — a
    // background job that failed silently would leave a blocked company's
    // catalogue live with nobody aware, which is worse than the gap it replaced.
    // Surfaced on the admin Organisation detail screen. INTERNAL — never public.
    blockCascade: {
      status: { type: String, enum: ['running', 'done', 'failed'] },
      direction: { type: String, enum: ['block', 'unblock'] },
      startedAt: { type: Date },
      completedAt: { type: Date },
      products: { type: Number },
      conversations: { type: Number },
      error: { type: String },
    },
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

// §A26 — the Suppliers side of the M3 search toggle matches on company name and
// description (§A27.3: NOT on their products). ⚠️ Like Product, this collection
// may hold exactly ONE text index — extend this definition, never add another.
organisationSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 1 }, name: 'organisation_text' },
);

// A21 (C2): the public exporter read/listing filters { exporterSide, isActive }.
// The single-profile read is _id-anchored (backed by _id_), but the M3 public
// seller list — the hottest M3 query — filters on these two, so back it explicitly
// so it never degrades to a collection scan.
organisationSchema.index({ exporterSide: 1, isActive: 1 });

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

// A3: the seller's PUBLIC whitelist — the ONLY Organisation fields a buyer or
// guest may receive. Serialise with `toPublic()` (src/utils/toPublic.js); never
// return the document or its `toJSON`, which is a blacklist.
//
// Adding a field here PUBLISHES it. Before doing so, check
// `.claude/rules/m3-public-projection.md` — deliberately NOT public: `website`
// (our verification use only), `buyerSide`/`exporterSide`, the street address,
// `businessProfile.registrationNumber` / `taxId`, `authorisedSignatory`,
// `kycDocuments`, `kycStatus` itself (see PUBLIC_DERIVED below), and the F1-A
// block fields (`blockReason` / `blockedAt` / `blockedBy`) — a blocked org is
// invisible to the public read anyway, and the moderation reason is internal.
export const PUBLIC_FIELDS = [
  'name',
  'slug',
  'country', // ISO alpha-2 only — the street address stays private
  'description',
  'logo',
  'coverImage', // 2026-08-13 — same public-asset reasoning as `logo` above.
  // 'business' | 'individual'. A trust signal that sits next to the verified tick,
  // and the field that closes the cancelled "business type" (A22.5): without it the
  // public page said nothing about whether a seller is a registered business.
  // Not sensitive — it says nothing about WHICH documents were filed.
  'entityType',
  ['businessProfile.establishedYear', 'establishedYear'],
];

// A3 + B7: values computed at read time, never stored and never copied straight
// from the document.
export const PUBLIC_DERIVED = {
  id: (org) => String(org._id),

  // B7: the tick is a BOOLEAN derived here. Raw `kycStatus` must never reach a
  // public response — publishing it would leak the `rejected` state, and the
  // product rule is "verified tick or nothing" (there is no not-verified badge).
  verified: (org) => org.kycStatus === 'verified',

  // Nulled unless verified, so an unverified org cannot expose a stale
  // review timestamp.
  verifiedAt: (org) => (org.kycStatus === 'verified' ? (org.verifiedAt ?? null) : null),

  // Trust signal: "member since 2024" reads very differently from a brand-new
  // account. YEAR ONLY — a public field should carry the minimum the interface
  // needs, and the exact signup second serves nobody. `createdAt` comes free from
  // baseSchemaOptions, so this is derived, not stored.
  memberSince: (org) => org.createdAt?.getFullYear() ?? null,
};

export const Organisation = mongoose.model('Organisation', organisationSchema);
