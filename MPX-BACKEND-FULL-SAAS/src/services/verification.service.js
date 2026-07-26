import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';

// Platform-staff operation: an employee/admin reviews organisations they do NOT
// own, so access is governed by PERMISSION (RBAC), not org-ownership. The org is
// fetched by id + expected type (findOne, never findById); a missing/mismatched
// record is 404, never 403.
async function reviewOrg({ orgId, expectType, toStatus, reason, actor, action, meta }) {
  const org = await Organisation.findOne({ _id: orgId, type: expectType });
  if (!org) throw AppError.notFound('organisation not found', 'Not found.');
  if (org.kycStatus !== 'pending') {
    throw AppError.conflict('not pending', 'This account is not awaiting review.');
  }

  const before = { kycStatus: org.kycStatus };
  org.kycStatus = toStatus;
  if (toStatus === 'verified') {
    org.verifiedBy = actor.userId;
    org.verifiedAt = new Date();
    org.kycRejectionReason = null;
  } else if (toStatus === 'rejected') {
    org.verifiedBy = actor.userId;
    org.verifiedAt = new Date();
    org.kycRejectionReason = reason;
  }
  await org.save();

  await recordAudit({
    actor,
    action,
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before,
    after: { kycStatus: toStatus, ...(reason ? { reason } : {}) },
    meta,
  });

  return org;
}

// Phase 1: approval ONLY flips kycStatus (status/tick). It does NOT gate buyer
// activity — the buyer is already fully active from signup (Option A). The
// "inactive until approved" gate is on-hold D3 (docs/Note.md); do not add it here
// without the reminder.
export function approveBuyer({ orgId, actor, meta }) {
  return reviewOrg({ orgId, expectType: 'buyer', toStatus: 'verified', actor, action: 'buyer.approve', meta });
}

// Exporter is already publicly visible; verifying only adds the verified state
// (frontend shows the tick).
export function verifyExporter({ orgId, actor, meta }) {
  return reviewOrg({ orgId, expectType: 'exporter', toStatus: 'verified', actor, action: 'exporter.verify', meta });
}

export function rejectBuyer({ orgId, reason, actor, meta }) {
  return reviewOrg({ orgId, expectType: 'buyer', toStatus: 'rejected', reason, actor, action: 'buyer.reject', meta });
}

export function rejectExporter({ orgId, reason, actor, meta }) {
  return reviewOrg({ orgId, expectType: 'exporter', toStatus: 'rejected', reason, actor, action: 'exporter.reject', meta });
}
