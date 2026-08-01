import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';
import { CONVERSATION_FROZEN_REASON } from './enums.js';

const { Schema } = mongoose;

/**
 * M4 — the thread. One-to-one with Inquiry, anchored to exactly one product.
 *
 * A conversation is a GROUP ROOM of three (M4-1): buyer, seller, and the
 * platform. Buyer and seller talk; the platform is present but silent after its
 * opening message. That presence is disclosure, not surveillance — both sides
 * can see it.
 *
 * ⚠️ The platform is NEVER written into `parties` (M4-2). Admin access comes
 * from role/permission, never from membership. `parties` holds exactly the two
 * company orgs, which is what B1 ownership scoping reads.
 */
const conversationSchema = new Schema(
  {
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', required: true, index: true },

    // May DANGLE after the A8 purge — expected and handled (M4-22). Never
    // populate blindly; fall back to productNameSnapshot.
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },

    // The only surviving product identity once the row is hard-deleted at 180
    // days. Without it a purged thread loses its title entirely (M4-18/M4-22).
    productNameSnapshot: { type: String, required: true, trim: true },

    // §8.2 — denormalised so list search is ONE query with no join. Every role's
    // list title shows the counterparty's company name, so that is exactly what
    // people type into the search box. Kept in sync on org rename (§8.5).
    buyerOrgName: { type: String, required: true, trim: true },
    exporterOrgName: { type: String, required: true, trim: true },

    // --- freeze state ------------------------------------------------------
    // The ONLY notion of "switched off" on this model. Note `withPartiesScope`
    // also injects an `isActive` flag: it is UNUSED here and must never be read
    // or written — two competing flags is how a thread ends up half-open.
    frozen: { type: Boolean, default: false, index: true },
    // FIRST REASON WINS — set once, never overwritten (M4-29). So if a chat is
    // blocked and the product is taken down afterwards, this stays 'blocked'.
    // Unfreezing therefore cannot be a toggle: it must re-check whether any
    // other reason still applies (M4-30) — see conversationFreeze.service.
    frozenReason: { type: String, enum: CONVERSATION_FROZEN_REASON },

    // F1-B: the same prevActive idea for threads. Captured before an org-block
    // cascade freezes them, so unblock reopens only what the cascade shut — a
    // thread an admin had blocked individually stays shut.
    prevFrozen: { type: Boolean },

    // Admin chat block (M4-23). BOTH parties see `blockedReason` (M4-25) — but
    // never `blockedBy`/`blockedAt`, which are staff-only, exactly as the seller
    // never sees `takedown.byUserId` (§A9).
    blockedReason: { type: String, trim: true },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    blockedAt: { type: Date },

    // --- list rendering ----------------------------------------------------
    lastMessageAt: { type: Date, default: Date.now },
    // Lets the list render without fetching messages.
    lastMessagePreview: { type: String, trim: true },

    // §7.5 — unread is DERIVED by comparing these against lastMessageAt. No
    // counter is stored anywhere; do not add one.
    buyerLastReadAt: { type: Date },
    exporterLastReadAt: { type: Date },
  },
  baseSchemaOptions,
);

// Adds buyerOrgId + exporterOrgId + parties (B1) + isActive (unused — see above).
withPartiesScope(conversationSchema);

// M4-3: one thread per (buyer org, product), enforced by the DATABASE, not by
// the UI and not by a read-then-write check. The creation path catches E11000
// and returns the existing thread (M4-5: a second enquiry never opens a second).
conversationSchema.index({ buyerOrgId: 1, productId: 1 }, { unique: true });

// List ordering, with an _id tiebreaker so cursor pagination is stable when two
// threads share a lastMessageAt.
conversationSchema.index({ lastMessageAt: -1, _id: -1 });

// §8.3 — list search. NATIVE MongoDB $text (§A26: production is a self-hosted
// VPS Mongo; Atlas $search does not exist here). MongoDB allows exactly ONE text
// index per collection — extend this definition, never add a second.
// Consequence: whole-word matching only, no typo tolerance and no partials.
// Pasting an org id is handled by a separate exact-match branch, because $text
// cannot sit inside an $or.
conversationSchema.index(
  { productNameSnapshot: 'text', buyerOrgName: 'text', exporterOrgName: 'text' },
  {
    weights: { productNameSnapshot: 10, exporterOrgName: 5, buyerOrgName: 5 },
    name: 'conversation_text',
  },
);

export const Conversation = mongoose.model('Conversation', conversationSchema);
