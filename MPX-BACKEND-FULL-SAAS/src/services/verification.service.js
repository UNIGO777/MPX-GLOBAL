import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';

// Platform-staff operation: an employee (or the superadmin) reviews organisations
// they do NOT own, so access is governed by PERMISSION (RBAC), not org-ownership. The org is
// fetched by id + the required SIDE flag (findOne, never findById); a missing/mismatched
// record is 404, never 403.
//
// A21 — ONE SHARED kycStatus, BY DESIGN (accepted, not a bug — do NOT "fix" it):
// buyer:approve and exporter:verify both act on the SAME Organisation and write the
// SAME `kycStatus`. So whichever review runs first verifies the WHOLE company, and
// the other side inherits the tick with no separate review — including a
// buyer-approved company that later claims an exporter side and gets the public
// verified tick without an exporter-side review. This follows the locked rule
// "one company = one Organisation, no second KYC, one tick". Do NOT add per-side
// verification, a second kycStatus, or a per-side verified flag — that is a KYC-flow
// change and is out of scope.
async function reviewOrg({ orgId, sideFlag, toStatus, reason, actor, action, meta }) {
  const org = await Organisation.findOne({ _id: orgId, [sideFlag]: true });
  if (!org) throw AppError.notFound('organisation not found', 'Not found.');
  // Reviewable ONLY after documents are submitted (owner decision, fix #3): a
  // reviewer verifies/rejects actual evidence, so a 'pending' (no-docs) org cannot
  // be verified or rejected — applies to buyer approve AND exporter verify. A
  // rejected org resubmits via the KYC-upload path (→ 'submitted') to re-enter here.
  if (org.kycStatus !== 'submitted') {
    throw AppError.conflict('not reviewable', 'This account has not submitted documents for review.');
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
  return reviewOrg({ orgId, sideFlag: 'buyerSide', toStatus: 'verified', actor, action: 'buyer.approve', meta });
}

// Exporter is already publicly visible; verifying only adds the verified state
// (frontend shows the tick).
export function verifyExporter({ orgId, actor, meta }) {
  return reviewOrg({ orgId, sideFlag: 'exporterSide', toStatus: 'verified', actor, action: 'exporter.verify', meta });
}

export function rejectBuyer({ orgId, reason, actor, meta }) {
  return reviewOrg({ orgId, sideFlag: 'buyerSide', toStatus: 'rejected', reason, actor, action: 'buyer.reject', meta });
}

export function rejectExporter({ orgId, reason, actor, meta }) {
  return reviewOrg({ orgId, sideFlag: 'exporterSide', toStatus: 'rejected', reason, actor, action: 'exporter.reject', meta });
}
