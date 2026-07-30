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
export const OTP_PURPOSE = ['login', 'forgot_password'];

// KYC entity type — drives the KYC document path (business docs vs personal ID).
export const ENTITY_TYPE = ['business', 'individual'];

// Accepted KYC document types. Business entities submit registration/GST/
// certificate proofs; individuals submit a personal govt ID (PAN/Aadhaar/
// passport). 'other' is a catch-all the reviewer can still inspect.
export const KYC_DOC_TYPE = ['registration', 'gst', 'certificate', 'pan', 'aadhaar', 'passport', 'other'];

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
