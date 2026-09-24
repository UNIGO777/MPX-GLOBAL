import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';

import { baseSchemaOptions } from './baseSchema.js';
import { withPartiesScope } from './scoping.js';
import { CURRENCIES, QUOTATION_STATUS } from './enums.js';

const { Schema } = mongoose;

/**
 * Module 4 — the quotation an exporter sends a buyer inside a chat thread.
 * Month 2 (Bucket A1); the owner gave the explicit override on 2026-09-24.
 *
 * ── The shape of the decisions baked in here ──────────────────────────────
 *
 * 🔴 **Everything a sent quotation shows is SNAPSHOT, never referenced.** Bank
 * details, both companies' details, the totals and the terms text are copied in
 * at send and frozen. Render any of it live and editing the source silently
 * rewrites every quotation already issued — a buyer opens last month's document
 * and sees a different bank account. That is the attack this design exists to
 * survive, and it is the single thing most likely to be "simplified" away later.
 *
 * 🔴 **Money is integer MINOR UNITS throughout** (paise, cents). `computeTotals`
 * in `quotationTotals.js` is authoritative; a total arriving in a request body
 * is never trusted or stored. No currency conversion anywhere (§A27.1).
 *
 * 🔴 **`termsVersion`, not free text.** The legal clauses — governing law, force
 * majeure, tolerances, claims window — come from a fixed versioned set the
 * exporter picks. GPT never writes them. An LLM inventing "±5% on GSM" or a
 * jurisdiction is a liability on a document two companies transact against.
 *
 * 🔴 **`accessToken`, not a public slug.** The buyer's link is unguessable and
 * tied to this row; there is no public quotation page and therefore no new
 * public projection to police. Prices, parties and terms stay between the two.
 *
 * 🔴 **Acceptance is an ACCEPTANCE RECORD, not a signature** (owner, 2026-09-25).
 * `accepted` records that BOTH parties confirmed, each with a code sent to their
 * own registered email. That is a second factor, not a digital signature: under
 * the IT Act §3/3A a digital/electronic signature means a licensed CA's
 * certificate or a notified technique such as Aadhaar eSign, and an email code is
 * neither. Never label it a signature in UI copy, the PDF, an email or an audit
 * entry. Real eSign and AI contract generation are Bucket B and stay there.
 */

// A line of the quotation. `rateMinor` is per unit; `amountMinor` is never
// stored — it is derived, so it can never disagree with qty × rate.
const itemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    spec: { type: String, trim: true, maxlength: 400 },
    hsCode: { type: String, trim: true, maxlength: 20 },
    qty: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true, maxlength: 20 },
    rateMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// `amountMinor: null` means "Included" — deliberately different from 0, which
// would read as free rather than as part of the price.
const chargeSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    amountMinor: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

const taxSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    ratePct: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const milestoneSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 160 },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

/**
 * The bank details AS PRINTED. Copied from `ExporterBankAccount` at send and
 * never read back from it.
 *
 * 🔴 `accountNumber` is `select: false` here too — a quotation list must never
 * carry it, and only the document render selects it explicitly.
 */
const bankSnapshotSchema = new Schema(
  {
    beneficiary: { type: String, trim: true },
    bankName: { type: String, trim: true },
    branch: { type: String, trim: true },
    accountNumber: { type: String, trim: true, select: false },
    last4: { type: String, maxlength: 4 },
    swift: { type: String, trim: true },
    ifsc: { type: String, trim: true },
  },
  { _id: false },
);

/**
 * A company as printed on the document.
 *
 * These fields have no home on `Organisation` today (GSTIN, IEC, a contact
 * person, a full address on the public side), so they are collected PER
 * QUOTATION. That is also the honest default: incoterm, ports and the signing
 * contact genuinely differ deal to deal. If they later become org-profile
 * fields, this snapshot still stands on its own.
 */
const partySnapshotSchema = new Schema(
  {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postcode: { type: String, trim: true },
    country: { type: String, trim: true },
    gstin: { type: String, trim: true },
    iec: { type: String, trim: true },
    taxId: { type: String, trim: true },
    contactName: { type: String, trim: true },
    contactTitle: { type: String, trim: true },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * A counter-offer. Append-only — the whole back-and-forth is the record of what
 * was asked and answered, so nothing here is ever edited or removed.
 *
 * 🔴 `totalMinor` is the WHOLE deal's figure, not a per-line change. Line-level
 * renegotiation would mean re-pricing the document, which is a new revision, not
 * an offer. Keeping offers to one number is what lets "what was agreed" be
 * answered without ambiguity.
 */
const offerSchema = new Schema(
  {
    by: { type: String, enum: ['buyer', 'exporter'], required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    totalMinor: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 300 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * Who confirmed, and when.
 *
 * 🔴 NOT a signature — an ACCEPTANCE RECORD (owner, 2026-09-25). See the
 * `quotation_accept` note in enums.js. Both sides confirm: one initiates, the
 * other has to confirm before the quotation is `accepted`, so neither party can
 * later say the deal was closed without them.
 *
 * 🔴 `agreedTotalMinor` is stored EXPLICITLY. After a negotiation the accepted
 * figure is the last counter-offer, not the document's printed total — leaving
 * it implied is how two companies end up each believing a different number was
 * agreed.
 */
const partyConfirmSchema = new Schema(
  {
    side: { type: String, enum: ['buyer', 'exporter'] },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date },
    ip: { type: String, trim: true },
    // The email the code went to, kept so the record can say WHICH inbox proved
    // it. Stored, never returned on a list.
    email: { type: String, trim: true, select: false },
  },
  { _id: false },
);

/**
 * The whole two-sided acceptance, as ONE subdocument on purpose.
 *
 * A plain nested object would MERGE on assignment in Mongoose, so clearing a
 * half-finished acceptance (`quotation.acceptance = undefined`) would silently do
 * nothing and a stale confirmation would survive a counter-offer. A single
 * subdocument replaces and clears wholesale, which is the behaviour the
 * negotiation logic depends on.
 */
const acceptanceSchema = new Schema(
  {
    initiated: { type: partyConfirmSchema, default: undefined },
    confirmed: { type: partyConfirmSchema, default: undefined },
    agreedTotalMinor: { type: Number, min: 0 },
  },
  { _id: false },
);

const quotationSchema = new Schema(
  {
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

    number: { type: String, required: true, unique: true, trim: true },
    revision: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: QUOTATION_STATUS, default: 'draft', index: true },

    issueDate: { type: Date },
    validUntil: { type: Date },

    currency: { type: String, enum: CURRENCIES, required: true },
    incoterm: { type: String, trim: true, maxlength: 40 },
    portOfLoading: { type: String, trim: true, maxlength: 120 },
    portOfDischarge: { type: String, trim: true, maxlength: 120 },
    leadTime: { type: String, trim: true, maxlength: 120 },

    items: { type: [itemSchema], default: [] },
    charges: { type: [chargeSchema], default: [] },
    taxes: { type: [taxSchema], default: [] },
    taxNote: { type: String, trim: true, maxlength: 400 },

    payment: {
      milestones: { type: [milestoneSchema], default: [] },
      note: { type: String, trim: true, maxlength: 300 },
    },
    delivery: {
      rows: {
        type: [new Schema({ label: String, value: String }, { _id: false })],
        default: [],
      },
      note: { type: String, trim: true, maxlength: 300 },
    },

    /** Which fixed clause set this document carries. Never free text. */
    termsVersion: { type: String, trim: true, default: 'v1' },

    /**
     * The exporter's own extra notes — the "custom field" the owner asked for.
     * Free text, and deliberately NOT legal clauses: it prints as a note, under
     * its own heading, so nothing here can read as a contractual term.
     */
    additionalDetails: { type: String, trim: true, maxlength: 2000 },

    // ── frozen at send ──────────────────────────────────────────────────────
    totals: { type: Schema.Types.Mixed },
    bankSnapshot: { type: bankSnapshotSchema },
    supplier: { type: partySnapshotSchema },
    buyer: { type: partySnapshotSchema },

    /**
     * The buyer's link. Unguessable, per-quotation, and the reason no public
     * quotation page exists. Never logged, never listed.
     */
    accessToken: { type: String, select: false, index: true },

    /** The negotiation, oldest first. Append-only. */
    offers: { type: [offerSchema], default: [] },

    /**
     * The two-sided acceptance. `initiated` is the party who said yes first;
     * `confirmed` is the other answering. Only when BOTH are set does `status`
     * become `accepted`.
     */
    acceptance: { type: acceptanceSchema, default: undefined },

    sentAt: { type: Date },
    acceptedAt: { type: Date },
    declinedAt: { type: Date },
    declineReason: { type: String, trim: true, maxlength: 500 },
  },
  baseSchemaOptions,
);

// buyerOrgId + exporterOrgId + parties, and SCOPE.PARTIES — the same two-party
// pattern Inquiry and Conversation use (`model-decisions.md` B1).
withPartiesScope(quotationSchema);

quotationSchema.index({ inquiryId: 1, revision: -1 });
quotationSchema.index({ exporterOrgId: 1, status: 1, createdAt: -1 });

/** 32 hex chars — the buyer's link, not a guessable id. */
export function newAccessToken() {
  return randomBytes(16).toString('hex');
}

/** `MPX-Q-2026-000123`. Sequence is per year, assigned at creation. */
export function formatQuotationNumber(year, seq) {
  return `MPX-Q-${year}-${String(seq).padStart(6, '0')}`;
}

export const Quotation = mongoose.model('Quotation', quotationSchema);
