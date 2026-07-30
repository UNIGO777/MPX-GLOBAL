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

  // --- M2 · Catalogue (§A25, owner-decided 2026-07-31). Catalogue WRITES are
  // deliberately grantable (supersedes the 07-30 "takedown = superadmin-only"
  // default); governance (user activate, employee create/permissions, org block)
  // stays hard role-gated and is NOT in this catalogue.
  // Admin category tree / attribute read.
  CATEGORY_READ: 'category:read',
  // Sub-category CRUD, attribute CRUD, top toggle, image upload (A20), synonyms (A12).
  CATEGORY_MANAGE: 'category:manage',
  // Product monitoring list + detail.
  PRODUCT_READ: 'product:read',
  // Product takedown AND restore.
  PRODUCT_TAKEDOWN: 'product:takedown',
});
