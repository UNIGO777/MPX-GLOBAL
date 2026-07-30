import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { ROLES, KYC_STATUS } from '../models/enums.js';
import { PERMISSIONS } from '../config/permissions.js';

// Only values that exist in the server catalogue may be assigned. Anything else
// (a typo, a made-up string, or a non-grantable action like activate/deactivate
// which is NOT in the catalogue) is rejected at the boundary.
const GRANTABLE_PERMISSIONS = Object.values(PERMISSIONS);

// User-directory listing. All filters optional; pageSize is HARD-capped (max 100)
// so a caller can never request an unbounded page (api-endpoints rule). `q` is a
// plain string — the service regex-escapes it before querying (no ReDoS / no
// operator injection; zString already rejects non-string operator payloads).
export const listUsers = {
  query: z.object({
    role: z.enum(ROLES).optional(),
    kycStatus: z.enum(KYC_STATUS).optional(),
    q: zString({ min: 1, max: 100 }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

// Just the target user id in the path.
export const userIdParam = {
  params: z.object({ id: zObjectId() }),
};

// F1-A org block. The reason is REQUIRED — an org block takes a whole company
// offline and kills every one of its sessions, so the audit trail must say why
// (a per-user deactivate has no reason field; this deliberately does).
export const blockOrg = {
  params: z.object({ id: zObjectId() }),
  body: z.object({
    reason: zString({ min: 3, max: 500 }),
  }),
};

// Unblock: reason optional — it explains the reversal, it is not the record of
// the moderation decision itself.
export const unblockOrg = {
  params: z.object({ id: zObjectId() }),
  body: z.object({
    reason: zString({ min: 3, max: 500 }).optional(),
  }),
};

// Replace an employee's permission set. Empty array = revoke all. Each entry must
// be a known grantable permission; unknown values fail validation (no free-text).
export const updateEmployeePermissions = {
  params: z.object({ id: zObjectId() }),
  body: z.object({
    permissions: z.array(z.enum(GRANTABLE_PERMISSIONS)).max(50),
  }),
};
