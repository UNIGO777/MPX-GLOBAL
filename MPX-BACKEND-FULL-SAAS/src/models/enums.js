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
export const OTP_PURPOSE = ['login', 'forgot_password', 'signup_email', 'signup_mobile'];

// KYC entity type — drives the KYC document path (business docs vs personal ID).
export const ENTITY_TYPE = ['business', 'individual'];

// Accepted KYC document types. Business entities submit registration/GST/
// certificate proofs; individuals submit a personal govt ID (PAN/Aadhaar/
// passport). 'other' is a catch-all the reviewer can still inspect.
export const KYC_DOC_TYPE = ['registration', 'gst', 'certificate', 'pan', 'aadhaar', 'passport', 'other'];

// Verification-redesign (owner, 2026-08-19): a VERIFIED org's locked-field edit
// becomes a pending change that must earn its way in through review.
//   awaiting_documents — set created, no supporting doc in its round yet (not queue-visible)
//   awaiting_review    — round has documents; visible in the verification queue
//   rejected           — HOLDS with the reviewer's reason; amend (→ awaiting_review) or cancel
// Approve and cancel clear the subdocument entirely — history lives in the AuditLog.
export const PENDING_CHANGE_STATE = ['awaiting_documents', 'awaiting_review', 'rejected'];

// Which document types are valid for each entity type (enforced at upload).
export const KYC_DOCS_BY_ENTITY = Object.freeze({
  business: ['registration', 'gst', 'certificate', 'other'],
  individual: ['pan', 'aadhaar', 'passport', 'other'],
});

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
