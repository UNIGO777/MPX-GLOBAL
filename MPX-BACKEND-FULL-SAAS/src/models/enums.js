// Shared enumerations. Kept in one place so a role or status string can't drift
// between models (User.role, AuditLog.actorRole, Organisation.type, …).

// Four roles. There is deliberately NO 'admin' role: platform governance is
// superadmin-only, and everyone else is an employee holding individually granted
// permissions. (The quote names only "Super admin dashboard" + "Employee panel";
// nothing ever created an 'admin' user, so the role was removed rather than left
// as an unreachable branch.)
export const ROLES = ['buyer', 'exporter', 'employee', 'superadmin'];

// 'platform' backs the single Organisation that employees and the superadmin
// belong to, so every User has an orgId and ownership scoping never special-cases
// null (decision A3).
// A21: `type` no longer discriminates buyer vs exporter — that is `buyerSide` /
// `exporterSide` on Organisation. `type` now only separates a company org
// (`business`) from the single platform/system org (`platform`).
export const ORG_TYPE = ['business', 'platform'];

export const KYC_STATUS = ['pending', 'submitted', 'verified', 'rejected'];

// Purposes a transactional OTP can be issued for.
//
// ⚠️ `signup_email` and `signup_mobile` are deliberately SEPARATE purposes rather
// than one `signup` purpose distinguished by channel. `requestOtp()` keeps only
// one live challenge per (subject, purpose) — so a shared purpose would make each
// new code silently destroy the other one and the flow could never complete.
// Separate purposes also give each channel its own A3 lock (5 attempts → 15 min),
// which is the behaviour we want: failing the email code must not lock the phone.
//
// ⚠️ `claim_org_email` (D7 rule 6, 2026-09-23) is separate for the SAME reason,
// and the reason bites harder here: a mobile-matched claim holds a live
// `signup_email` challenge already, so reusing that purpose would have each new
// code delete the other and the claim could never complete. It is also a
// different thing being proved — not "this is my address" but "I can read the
// address of the member already in this company" — and it therefore deserves its
// own A3 lock, so probing a stranger's inbox cannot lock the claimant out of
// their own signup.
export const OTP_PURPOSE = [
  'login',
  'forgot_password',
  'signup_email',
  'signup_mobile',
  'claim_org_email',
];

// KYC entity type — drives the KYC document path (business docs vs personal ID).
export const ENTITY_TYPE = ['business', 'individual'];

// Accepted KYC document types. Business entities submit registration/GST/
// certificate proofs; individuals submit a personal govt ID (PAN/Aadhaar/
// passport). 'other' is a catch-all the reviewer can still inspect.
/**
 * Every docType a STORED document may carry.
 *
 * The three lists here do different jobs and must not be collapsed into one:
 * STORABLE (this), REQUESTABLE (below) and OFFERED (`KYC_DOCS_BY_ENTITY`).
 * Retiring a type changes the last two and never this one, so documents already
 * stored under it keep passing mongoose validation and keep their label.
 */
export const KYC_DOC_TYPE = [
  // Cross-border generics — one name each for instruments every country has
  // under a different title (see KYC_DOCS_DEFAULT below).
  'registration', 'tax', 'licence',
  'passport', 'national_id', 'driving_licence',
  // India-specific
  'gst', 'iec', 'certificate', 'pan', 'aadhaar',
  // Catch-all
  'other',
];

// Verification-redesign (owner, 2026-08-19): a VERIFIED org's locked-field edit
// becomes a pending change that must earn its way in through review.
//   awaiting_documents — set created, no supporting doc in its round yet (not queue-visible)
//   awaiting_review    — round has documents; visible in the verification queue
//   rejected           — HOLDS with the reviewer's reason; amend (→ awaiting_review) or cancel
// Approve and cancel clear the subdocument entirely — history lives in the AuditLog.
export const PENDING_CHANGE_STATE = ['awaiting_documents', 'awaiting_review', 'rejected'];

/**
 * Which KYC documents we ask for, BY COUNTRY then entity type (owner,
 * 2026-09-23). Enforced at upload — this is not a UI hint.
 *
 * 🔴 The shape is DEFAULT + OVERRIDES, deliberately not a 193-row matrix. The
 * country picker offers the full ISO list and the server accepts any two-letter
 * code, so a per-country table would be both unmaintainable and permanently
 * incomplete — and a wrong document NAME on a KYC form reads worse than a
 * generic one. An override earns its place only when a country's instruments
 * have no honest generic name.
 *
 * Today India is the only override, because that is where our exporters are
 * (CLAUDE.md: "Indian exporters, international buyers"). GST, IEC, PAN and
 * Aadhaar have no cross-border equivalent worth pretending about.
 *
 * ⚠️ The list keys off COUNTRY, never off buyerSide/exporterSide. An
 * Organisation may be BOTH (CLAUDE.md), so a side-based rule would put the
 * Indian set in front of a German company that also sells. Exporters get the
 * Indian set because they are Indian, not because they are exporters.
 */
export const KYC_DOCS_DEFAULT = Object.freeze({
  /**
   * Generic names chosen to cover the real instruments without naming any
   * country's: `tax` is the UK/EU VAT certificate, the US EIN letter, a TIN
   * registration; `licence` is the UAE trade licence, a municipal business
   * licence, China's business licence; `registration` is a certificate of
   * incorporation, Singapore's ACRA profile, a commercial-register extract.
   */
  business: ['registration', 'tax', 'licence', 'other'],
  /** `other` stays out for individuals everywhere — see the India note below. */
  individual: ['passport', 'national_id', 'driving_licence'],
});

export const KYC_DOCS_BY_COUNTRY = Object.freeze({
  IN: Object.freeze({
    /**
     * `iec` — the DGFT Import Export Code. Added 2026-09-23: it is mandatory to
     * export from India and it is the single most relevant document on an export
     * marketplace, yet we were not asking for it at all. Offered like every other
     * document (optional slot, reviewer decides) — making it a hard requirement
     * would be a new GATE, and gates are guarded here (D1/D2/D3).
     */
    business: ['registration', 'gst', 'certificate', 'iec', 'other'],
    /**
     * 🔴 Aadhaar: removed, then RESTORED **masked-only**, both on 2026-09-23.
     * Masked Aadhaar is a genuinely different document — UIDAI replaces the
     * first eight digits with X, so the Aadhaar NUMBER, which is what the
     * restriction is about, is not in the file.
     *
     * 🔴 The "(masked only)" in the label is a DETERRENT, NOT A CONTROL. Nothing
     * here can tell a masked upload from an unmasked one. Two things carry it,
     * both outside this file: the KYC viewer WARNS the reviewer whenever the
     * docType is `aadhaar`, and `removeDocument` DESTROYS the file so an
     * unmasked one can be got rid of rather than merely marked. Remove either
     * and this list becomes a promise nobody keeps.
     *
     * 🚫 `other` is deliberately absent for individuals. Labelled "Other
     * identity document" it was the back door — an Aadhaar landed there anyway
     * and was then UNFINDABLE by query. A named docType keeps an unmasked copy
     * recoverable. `other` stays for business, where it has no such failure mode.
     */
    individual: ['pan', 'aadhaar', 'passport'],
  }),
});

/**
 * The documents offered to one company. `country` is the ISO alpha-2 on the
 * Organisation; anything without an override falls through to the default set,
 * which is why an unknown or missing country is safe rather than empty.
 */
export function kycDocsFor({ country, entityType }) {
  const set = KYC_DOCS_BY_COUNTRY[String(country ?? '').toUpperCase()] ?? KYC_DOCS_DEFAULT;
  return set[entityType] ?? [];
}

/**
 * What STAFF may ask any company to send — the union of every set above, so it
 * tracks them automatically and can never drift above what upload accepts.
 *
 * Deliberately NOT `KYC_DOC_TYPE`: that enum also keeps values no country
 * offers any more, so documents already stored under them stay valid and
 * labelled. Validating a request against it let a reviewer ask for a document
 * the upload endpoint then refuses (kyc.service.js) — an unsatisfiable request
 * the company could only answer with a 400.
 *
 * ⚠️ It is country-BLIND on purpose: it is the outer schema guard. The
 * per-company narrowing happens in `requestDocuments`, which knows the org.
 */
export const KYC_DOC_TYPE_REQUESTABLE = Object.freeze([
  ...new Set([
    ...Object.values(KYC_DOCS_DEFAULT).flat(),
    ...Object.values(KYC_DOCS_BY_COUNTRY).flatMap((c) => Object.values(c).flat()),
  ]),
]);

// --- M2 · Catalogue -----------------------------------------------------------

// A14/A16: category type lives on the LEAF (sub-category). 'either' was removed;
// top categories carry NO type at all (derived from children at read time).
export const CATEGORY_TYPE = ['goods', 'service'];

// CategoryAttribute.inputType — decides the product form control AND the value
// type stored on Product.attributes[].value.
export const ATTR_INPUT_TYPE = ['text', 'number', 'select', 'boolean'];

// A1: draft is the create default and is ONE-WAY (published never returns to
// draft); archived is terminal (A5 delete path only). No isActive on Product.
export const PRODUCT_STATUS = ['draft', 'active', 'inactive', 'archived'];

export const PRICE_MODE = ['fixed', 'range', 'on_request'];

// ISO-4217 active currency codes (allowlist — a price currency must be one of
// these; display names live in the frontend). Kept as a static const so no
// dependency is needed.
export const CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD',
  'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR',
  'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
  'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON',
  'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP',
  'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
  'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWL',
];

// --- FINALIZE F5b · Featured landing content ---------------------------------

// What a curated landing-page slot points at. One model covers all four because
// they share every operational field (order, active window, curation audit) and
// the landing page reads them in a single call.
//   banner   — a standalone image + link. The only kind with no targetId.
//   product  — quote Module 5 "featured listings"
//   category — quote Module 1 "featured categories"
//   supplier — quote Module 1 "highlighted suppliers"
export const FEATURED_KIND = ['banner', 'product', 'category', 'supplier'];

// --- M4 · Enquiry & Chat -----------------------------------------------------

// Who wrote a message. `system` is the platform's own automated voice (the
// welcome template, freeze notices) — it has no org and no user (M4-11).
export const MESSAGE_SENDER_TYPE = ['buyer', 'exporter', 'system'];

/**
 * What a `system` message is ABOUT.
 *
 * The body already says it in words, but only to a human — a client cannot tell
 * a block from a reopen without this, because the blocked notice has the
 * moderator's free-text reason appended and so has no fixed string to match.
 * Rendering keyed on copy would also fail silently the day the copy is reworded.
 *
 * ⚠️ Set at creation and never after. Messages are append-only (M4-13), so the
 * notices already sent carry no kind and never will — a reader must treat the
 * field as optional, not assume every system message has one.
 */
export const MESSAGE_SYSTEM_KIND = [
  'welcome',
  'blocked',
  'unblocked',
  'product_takedown',
  'product_restored',
  'account_paused',
  'account_restored',
  // A staff-chosen platform warning (2026-09-24) — text from utils/chatWarnings.js.
  // `warning` alone was the first day's kind (all amber); since the same day each
  // warning carries its TONE. The bare value stays so those notices still validate.
  'warning',
  'warning_reminder',
  'warning_caution',
  'warning_serious',
  'warning_final',
];

// Why messaging is frozen. FIRST REASON WINS and is never overwritten (M4-29).
// `account` is F1-B's org-block cascade: the COMPANY is blocked, which is a
// different fact from this chat being blocked or this product being taken down —
// and it has to be distinguishable, because lifting a product takedown must not
// reopen a thread whose company is still blocked.
//
// ⚠️ `purged` is deliberately NOT a value: m4.md §4 listed it, but M4-22 (label
// turns red at purge) and M4-29 (never overwritten) cannot both hold if the
// purge rewrites this field. The red "product no longer available" label is
// DERIVED at read time from the product row being gone — see the M4 build plan
// C5. A purge therefore writes nothing to any conversation.
export const CONVERSATION_FROZEN_REASON = ['takedown', 'blocked', 'account'];

// Enquiry lifecycle. Written once at creation and left alone — the flow that
// drives it is month 2 (m4.md §13). Do not add transitions here.
export const INQUIRY_STATUS = ['open', 'responded', 'closed'];

// Device platforms for FCM push registration.
export const DEVICE_PLATFORM = ['android', 'ios', 'web'];
