import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { FEATURED_KIND } from './enums.js';

const { Schema } = mongoose;

/**
 * FINALIZE F5b — curated landing-page content.
 *
 * Quote scope: Module 5 "Content — banners, featured listings" and Module 1
 * "Featured categories and highlighted suppliers". One model rather than four
 * because every kind shares the same operational fields — curation order, an
 * active window, who placed it — and the landing page fetches them together.
 *
 * ⚠️ This row is a POINTER, never a copy. It stores `targetId` and nothing about
 * the target itself: no product name, no price, no seller name. That is what
 * makes the public read self-healing — a featured product that gets taken down,
 * or whose company gets blocked, simply stops resolving and disappears from the
 * landing page. Denormalising a snapshot here would keep a blocked company on
 * the front page, which is precisely the failure F1 existed to close.
 *
 * (The empty `Banner` skeleton predates this and is unused. It was left in place
 * rather than deleted — removing it is the owner's call.)
 */
const featuredItemSchema = new Schema(
  {
    kind: { type: String, enum: FEATURED_KIND, required: true },

    // Product / Category / Organisation id. Absent for `banner`, required for
    // every other kind — enforced in the pre-validate hook below, because the
    // requirement is conditional and `required` cannot express it.
    targetId: { type: Schema.Types.ObjectId },

    // --- banner-only presentation -------------------------------------------
    image: { type: String },
    // Cloudinary asset id, kept so a replaced or deleted banner can drop its old
    // asset instead of orphaning it (the lesson from category image replace).
    // Internal — select:false keeps it out of every serialised response.
    publicId: { type: String, select: false },
    title: { type: String, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    // Where the banner sends the visitor. Validated to a relative path or an
    // http(s) URL at the route boundary — never rendered as raw HTML.
    linkUrl: { type: String, trim: true, maxlength: 500 },

    // --- curation -----------------------------------------------------------
    // Ascending: 0 shows first. Ties break by newest, so an admin who never sets
    // an order still gets a stable, sensible sequence.
    order: { type: Number, default: 0 },

    // The admin's on/off switch, independent of the date window below.
    active: { type: Boolean, default: true },

    // Optional schedule. Absent means "no bound on that side" — a slot with
    // neither is simply live while `active`.
    startsAt: { type: Date },
    endsAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

// A banner carries no target; everything else is meaningless without one.
// ⚠️ Mongoose 9 pre-hooks are THROW/async style — a `next(err)` callback hook
// fails with "next is not a function" (History.md §7).
featuredItemSchema.pre('validate', async function requireTargetForNonBanners() {
  if (this.kind === 'banner') {
    if (this.targetId) throw new Error('a banner has no targetId');
    if (!this.image) throw new Error('a banner requires an image');
  } else if (!this.targetId) {
    throw new Error(`kind "${this.kind}" requires a targetId`);
  }
  if (this.startsAt && this.endsAt && this.startsAt > this.endsAt) {
    throw new Error('startsAt must not be after endsAt');
  }
});

// The public read: pick the live rows of each kind in curated order.
featuredItemSchema.index({ kind: 1, active: 1, order: 1 });

// The same product must not occupy two slots — a duplicate on the landing page
// is a curation mistake, not a feature. Partial so the banner rows (which have
// no targetId) are exempt rather than colliding with each other on null.
featuredItemSchema.index(
  { kind: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { targetId: { $exists: true } } },
);

// Platform content — not org-scoped. Gated by permission only (`featured:manage`).
declareScope(featuredItemSchema, SCOPE.PLATFORM);

export const FeaturedItem = mongoose.model('FeaturedItem', featuredItemSchema, 'featuredItems');
