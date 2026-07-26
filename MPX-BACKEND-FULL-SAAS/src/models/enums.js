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
