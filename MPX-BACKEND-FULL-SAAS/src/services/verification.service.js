import { Organisation } from '../models/Organisation.js';
import { Product } from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { KYC_DOCS_BY_ENTITY, KYC_DOC_TYPE } from '../models/enums.js';
import { recordAudit } from './audit.service.js';
import { notifyVerificationResult } from './emailNotifications.service.js';

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
    // A verify after a revocation closes it — the notice must stop showing.
    org.kycRevocation = undefined;
  } else if (toStatus === 'rejected') {
    // `verifiedBy`/`verifiedAt` mean "this org was VERIFIED, by whom and when".
    // They must stay empty on a reject — stamping them here (as this used to)
    // left a rejected org carrying a real `verifiedAt`, which is both wrong on
    // every staff/self response and one careless line away from a public tick:
    // anyone later deriving `verified` from `Boolean(org.verifiedAt)` instead of
    // from `kycStatus` would hand the tick to rejected companies. Clearing also
    // covers the A22 demotion path, where a previously-verified org is
    // re-reviewed and must not keep its old verification evidence.
    // WHO rejected and WHEN is preserved in the append-only AuditLog below.
    org.verifiedBy = undefined;
    org.verifiedAt = undefined;
    org.kycRejectionReason = reason;
  }
  await org.save();

  // §A23 (M2): sync the denormalised `sellerVerified` search field onto the
  // org's products. Search is native MongoDB `$text` (§A26 — self-hosted, not
  // Atlas) and cannot join across collections, so the verified boost reads this
  // copy. A reject was never verified, so `false` is a no-op there. (The A22
  // demotion + country-change syncs attach to the A22 edit endpoint when it is
  // built — §A22.2 step 5.)
  await Product.updateMany(
    { exporterOrgId: org._id },
    { $set: { sellerVerified: toStatus === 'verified' } },
  );

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

  // Tell the owner their status changed (D5 email carve-out, owner 2026-08-04).
  // NOT awaited and cannot throw: the decision and its audit record are already
  // committed, and a mail server outage must not fail an employee's review.
  // `sideFlag` picks who to write to — the buyer-side or exporter-side owner.
  notifyVerificationResult({
    org,
    role: sideFlag === 'exporterSide' ? 'exporter' : 'buyer',
    approved: toStatus === 'verified',
    reason,
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

/**
 * Verification-redesign (2026-08-19) — staff asks a company for documents.
 *
 * Any status, including verified: the tick is untouched while the request is
 * open (the request is a question, not a judgement). Side-shaped like every
 * review action: fetched by id + side flag, mismatch → 404 never 403. The note
 * is shown to the company; the request auto-fulfils inside the upload path.
 */
export async function requestDocuments({ orgId, sideFlag, docTypes, note, actor, meta }) {
  const org = await Organisation.findOne({ _id: orgId, [sideFlag]: true });
  if (!org) throw AppError.notFound('organisation not found', 'Not found.');

  // Valid for the entity type the documents would be reviewed against — the
  // pending one when a change is switching identity, else the live one. An org
  // with no entityType yet (buyer before first upload) may be asked anything.
  const target = org.pendingChanges?.values?.entityType ?? org.entityType;
  const allowed = target ? KYC_DOCS_BY_ENTITY[target] : KYC_DOC_TYPE;
  const invalid = docTypes.filter((t) => !allowed.includes(t));
  if (invalid.length > 0) {
    throw AppError.badRequest(
      'docTypes invalid for entity',
      `Not valid for this company's entity type: ${invalid.join(', ')}.`,
    );
  }

  const request = { docTypes, note, requestedBy: actor.userId, requestedAt: new Date() };
  await Organisation.updateOne({ _id: org._id }, { $push: { documentRequests: request } });

  await recordAudit({
    actor,
    action: 'kyc.request_documents',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before: null,
    after: { docTypes, note },
    meta,
  });

  return { docTypes, note };
}

// ═══ Verification-redesign (2026-08-19) — change re-verification + revoke ═══

const CHANGE_FIELDS = ['name', 'country', 'entityType', 'address'];

async function loadForChangeReview(orgId, sideFlag) {
  const org = await Organisation.findOne({ _id: orgId, [sideFlag]: true });
  if (!org) throw AppError.notFound('organisation not found', 'Not found.');
  if (org.kycStatus !== 'verified' || org.pendingChanges?.state !== 'awaiting_review') {
    // Not a judgement — there is simply nothing reviewable: no set, no docs
    // yet, or the org is not verified (its edits applied live).
    throw AppError.conflict('no change to review', 'This company has no profile change awaiting review.');
  }
  return org;
}

/**
 * Approve a pending profile change: the values become the live profile, the
 * change's document round becomes the current set, everything older is marked
 * superseded (kept forever), and the tick CONTINUES — kycStatus never leaves
 * `verified`, so the public surface never blinks.
 */
export async function approveChange({ orgId, sideFlag, actor, meta }) {
  const org = await loadForChangeReview(orgId, sideFlag);
  const pc = org.pendingChanges;
  const changed = pc.changedFields ?? [];

  for (const f of changed) {
    if (f === 'address') {
      org.address = pc.values.address ?? {};
      org.markModified('address');
    } else {
      org[f] = pc.values[f];
    }
  }
  // Slug is immutable by design — a rename never rewrites indexed public URLs.

  const roundId = pc.roundId;
  org.pendingChanges = undefined;
  org.markModified('pendingChanges');
  org.verifiedBy = actor.userId;
  org.verifiedAt = new Date();
  await org.save();

  // The approved round is now THE document set; everything current outside it
  // is superseded — kept, hidden, out of the cap. (No delete path, ever.)
  await Organisation.updateOne(
    { _id: org._id },
    { $set: { 'kycDocuments.$[d].supersededAt': new Date() } },
    { arrayFilters: [{ 'd.roundId': { $ne: roundId }, 'd.supersededAt': null }] },
  );

  // §A23 denorm syncs — the search copies must follow the new live values.
  if (org.exporterSide) {
    const sync = { sellerVerified: true };
    if (changed.includes('country')) sync.sellerCountry = org.country;
    await Product.updateMany({ exporterOrgId: org._id }, { $set: sync });
  }

  await recordAudit({
    actor,
    action: 'organisation.change_approve',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before: { kycStatus: 'verified' },
    after: { kycStatus: 'verified', changedFields: changed, roundId: String(roundId) },
    meta,
  });

  return org;
}

/**
 * Reject a pending change: the set HOLDS with the reason (owner-visible, never
 * public); the live profile, tick, documents and products are untouched. The
 * company amends (→ back to review) or cancels.
 */
export async function rejectChange({ orgId, sideFlag, reason, actor, meta }) {
  const org = await loadForChangeReview(orgId, sideFlag);
  org.pendingChanges.state = 'rejected';
  org.pendingChanges.rejectionReason = reason;
  org.pendingChanges.rejectedAt = new Date();
  org.pendingChanges.rejectedBy = actor.userId;
  org.markModified('pendingChanges');
  await org.save();

  await recordAudit({
    actor,
    action: 'organisation.change_reject',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before: { kycStatus: 'verified' },
    after: { changedFields: org.pendingChanges.changedFields, reason },
    meta,
  });

  return org;
}

/**
 * Revoke a granted verification (mandatory reason — shown to the company,
 * never public). Target state is `submitted`, which is literally true: the
 * documents are on file awaiting review, and the org re-enters the ordinary
 * queue with no special-casing. `kycSubmittedAt` is re-dated so it doesn't
 * jump the age-ordered queue.
 *
 * An open pending set APPLIES live and clears: the org is unverified now, and
 * unverified orgs' edits apply live — silently destroying the company's typed
 * input would be worse.
 */
export async function revokeVerification({ orgId, sideFlag, reason, actor, meta }) {
  const org = await Organisation.findOne({ _id: orgId, [sideFlag]: true });
  if (!org) throw AppError.notFound('organisation not found', 'Not found.');
  if (org.kycStatus !== 'verified') {
    throw AppError.conflict('not verified', 'This company is not verified.');
  }

  const pc = org.pendingChanges?.state ? org.pendingChanges : null;
  const appliedFields = [];
  if (pc) {
    for (const f of pc.changedFields ?? []) {
      if (!CHANGE_FIELDS.includes(f)) continue;
      if (f === 'address') {
        org.address = pc.values.address ?? {};
        org.markModified('address');
      } else {
        org[f] = pc.values[f];
      }
      appliedFields.push(f);
    }
    org.pendingChanges = undefined;
    org.markModified('pendingChanges');
  }

  org.kycStatus = 'submitted';
  org.kycSubmittedAt = new Date();
  org.verifiedAt = undefined;
  org.verifiedBy = undefined;
  org.kycRevocation = { reason, revokedAt: new Date(), revokedBy: actor.userId };
  await org.save();

  if (org.exporterSide) {
    const sync = { sellerVerified: false };
    if (appliedFields.includes('country')) sync.sellerCountry = org.country;
    await Product.updateMany({ exporterOrgId: org._id }, { $set: sync });
  }

  await recordAudit({
    actor,
    action: 'verification.revoke',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before: { kycStatus: 'verified' },
    after: {
      kycStatus: 'submitted',
      reason,
      ...(appliedFields.length ? { appliedPendingFields: appliedFields } : {}),
    },
    meta,
  });

  return org;
}
