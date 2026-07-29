// Server-side permission catalogue. Employees are granted a subset of these
// (individually assignable); routes declare exactly one (default-deny).
export const PERMISSIONS = Object.freeze({
  BUYER_APPROVE: 'buyer:approve',
  EXPORTER_VERIFY: 'exporter:verify',
  // Grantable READ of the user directory (M1-E). Mutating a user's active state is
  // deliberately NOT a grantable permission — it is hard role-gated
  // (requireRole('superadmin')) so a granted employee can never escalate.
  USER_READ: 'user:read',
  // Grantable VIEW of an org's KYC documents (M1-D) via short-lived signed URLs — a
  // reviewer who can verify needs to see the docs. superadmin is all-access.
  KYC_VIEW: 'kyc:view',
});
