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
