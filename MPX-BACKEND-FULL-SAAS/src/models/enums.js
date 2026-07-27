// Shared enumerations. Kept in one place so a role or status string can't drift
// between models (User.role, AuditLog.actorRole, Organisation.type, …).

export const ROLES = ['buyer', 'exporter', 'employee', 'admin', 'superadmin'];

// 'platform' backs the single Organisation that employees/admins/superadmins
// belong to, so every User has an orgId and ownership scoping never special-cases
// null (decision A3).
export const ORG_TYPE = ['buyer', 'exporter', 'platform'];

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
