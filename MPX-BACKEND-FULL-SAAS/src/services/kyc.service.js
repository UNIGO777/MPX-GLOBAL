import { Organisation } from '../models/Organisation.js';
import { KYC_DOCS_BY_ENTITY } from '../models/enums.js';
import { AppError } from '../utils/AppError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';
import { recordAudit } from './audit.service.js';
import { uploadKycDocument, signedKycUrl } from './kyc.storage.service.js';

// Hard cap on stored KYC documents per organisation (owner decision 2026-07-30):
// without it a hostile account can push unlimited 10-MB files to Cloudinary
// (storage-cost abuse + unbounded array growth). 20 leaves room for both entity
// types' document sets plus several resubmit rounds.
const KYC_MAX_DOCS_PER_ORG = 20;

// Self-service KYC submission (M1-B). The caller writes only their OWN org
// (req.user.orgId) — this is a self write, not a staff action. Status moves
// pending|rejected|submitted → submitted (resubmit after rejection is the same
// path). Once verified there is nothing to resubmit.
/**
 * §A22 gate (owner, 2026-08-05): documents are reviewed AGAINST the profile —
 * name, country and address are what verification locks — so they must be
 * complete BEFORE anything is uploaded. Without this, an org gets verified with
 * an empty address and filling it in later demotes them: the flow would punish
 * completing the profile. entityType is resolved separately below (the wizard
 * may still supply it on first upload).
 */
export function isKycProfileComplete(org) {
  return Boolean(
    org.name?.trim() &&
      org.country &&
      org.address?.line1?.trim() &&
      org.address?.city?.trim() &&
      org.address?.postalCode?.trim(),
  );
}

export async function submitKycDocument({ user, entityType, docType, buffer, meta }) {
  // Only the two self-registering roles have a KYC profile to submit.
  if (user.role !== 'buyer' && user.role !== 'exporter') {
    throw AppError.forbidden('role has no kyc', 'Not allowed.');
  }

  // +kycDocuments (select:false) loaded ONLY to count — never returned.
  const org = await Organisation.findOne({ _id: user.orgId }).select('+kycDocuments');
  if (!org) throw AppError.notFound('org not found', 'Not found.');

  // The A22 gate — server-side, because the app's redirect is UX, not access
  // control. Stable code so the client can route to the profile screen.
  if (!isKycProfileComplete(org)) {
    throw AppError.badRequest(
      'kyc profile incomplete',
      'Complete your company profile before uploading documents.',
      ERROR_CODES.PROFILE_INCOMPLETE,
    );
  }

  // Checked BEFORE the Cloudinary upload so a capped org costs no storage call.
  // SUPERSEDED docs (kept forever, hidden) do not count — a profile change must
  // never lock a company out of uploading its new set (2026-08-19).
  const currentDocs = (org.kycDocuments ?? []).filter((d) => !d.supersededAt);
  if (currentDocs.length >= KYC_MAX_DOCS_PER_ORG) {
    throw AppError.conflict(
      'kyc document limit reached',
      'Document limit reached for this account. Please contact support.',
    );
  }

  // Resolve the entity type. Set at signup for exporters, on the first upload
  // for buyers; changeable later via the company profile (2026-08-19).
  let resolved = org.entityType;
  if (!resolved) {
    if (!entityType) {
      throw AppError.badRequest('entityType required', 'Please provide your entity type (business or individual).');
    }
    resolved = entityType;
  } else if (entityType && entityType !== resolved) {
    throw AppError.badRequest('entityType mismatch', 'Entity type does not match your account.');
  }

  /**
   * Verified orgs (2026-08-19): an upload is allowed ONLY as part of
   *  (a) a pending profile change — the doc joins that change's round, or
   *  (b) an open staff document request naming this docType.
   * Neither ⇒ the historic refusal stands. Either way the org's kycStatus is
   * NEVER touched — the tick stays while the change/request is processed.
   */
  const pending = org.kycStatus === 'verified' ? org.pendingChanges : null;
  const requestMatch =
    org.kycStatus === 'verified'
      ? (org.documentRequests ?? []).find((r) => !r.fulfilledAt && r.docTypes.includes(docType))
      : null;
  if (org.kycStatus === 'verified' && !pending && !requestMatch) {
    throw AppError.conflict(
      'already verified',
      'Your account is already verified. Uploads are only needed for a profile change or a document we asked for.',
    );
  }

  // The document type must be valid for the entity type it will be reviewed
  // against — the PENDING one when a change is switching entity type (the new
  // documents support the NEW identity), the live one otherwise.
  const targetEntity = pending?.values?.entityType ?? resolved;
  if (!KYC_DOCS_BY_ENTITY[targetEntity]?.includes(docType)) {
    throw AppError.badRequest('invalid docType for entity', 'This document type is not valid for your entity type.');
  }

  // Verify (magic bytes) + upload as a private asset. Returns only the private
  // storageKey — never a public URL.
  const { storageKey, format } = await uploadKycDocument({ buffer, orgId: String(org._id), docType });

  const before = { kycStatus: org.kycStatus };
  const docRow = { docType, storageKey, format, uploadedAt: new Date() };
  if (pending) docRow.roundId = pending.roundId;
  if (requestMatch) docRow.requestId = requestMatch._id;

  const set = {};
  if (org.kycStatus !== 'verified') {
    // The unverified flow is unchanged: an upload (re)submits for review.
    Object.assign(set, {
      kycStatus: 'submitted',
      kycSubmittedAt: new Date(),
      entityType: resolved,
      kycRejectionReason: null,
    });
  } else if (pending && pending.state === 'awaiting_documents') {
    // First supporting document → the change becomes reviewable.
    set['pendingChanges.state'] = 'awaiting_review';
    set['pendingChanges.submittedAt'] = new Date();
  }
  // A request auto-fulfils when every docType it names has a non-superseded
  // upload dated after the request — including this one.
  if (requestMatch) {
    const covered = requestMatch.docTypes.every(
      (t) =>
        t === docType ||
        currentDocs.some((d) => d.docType === t && d.uploadedAt > requestMatch.requestedAt),
    );
    if (covered) set[`documentRequests.$[req].fulfilledAt`] = new Date();
  }

  await Organisation.updateOne(
    { _id: org._id },
    { $push: { kycDocuments: docRow }, ...(Object.keys(set).length ? { $set: set } : {}) },
    requestMatch && set['documentRequests.$[req].fulfilledAt']
      ? { arrayFilters: [{ 'req._id': requestMatch._id }] }
      : undefined,
  );

  // Audit snapshot carries only the docType + the status transition — NEVER the
  // storageKey or file contents (security-baseline rule 4 / fix #10).
  const after = { kycStatus: org.kycStatus === 'verified' ? 'verified' : 'submitted', docType };
  if (pending) after.roundId = String(pending.roundId);
  if (requestMatch) after.requestId = String(requestMatch._id);
  await recordAudit({
    actor: user,
    action: 'kyc.submit',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before,
    after,
    meta,
  });

  return { kycStatus: after.kycStatus, entityType: resolved, docType };
}

/** Owner/staff-safe projections of the redesign's state (2026-08-19). */
export function pendingChangesView(org) {
  const pc = org.pendingChanges;
  if (!pc?.state) return null;
  return {
    changedFields: pc.changedFields ?? [],
    values: pc.values ?? {},
    state: pc.state,
    submittedAt: pc.submittedAt ?? null,
    rejectionReason: pc.state === 'rejected' ? (pc.rejectionReason ?? null) : null,
  };
}

export function documentRequestsView(org) {
  return (org.documentRequests ?? [])
    .map((r) => ({
      id: String(r._id),
      docTypes: r.docTypes,
      note: r.note,
      requestedAt: r.requestedAt ?? null,
      fulfilledAt: r.fulfilledAt ?? null,
    }))
    .sort((a, b) => Number(Boolean(a.fulfilledAt)) - Number(Boolean(b.fulfilledAt)));
}

// The caller's OWN verification status (self). Loads kycDocuments (select:false)
// so the controller can return per-doc METADATA only (docType/uploadedAt) — never
// the storageKey. Full status incl. the rejection reason is fine here: it is the
// owner's own account.
export async function getMyVerification({ user }) {
  const org = await Organisation.findOne({ _id: user.orgId }).select('+kycDocuments');
  if (!org) throw AppError.notFound('org not found', 'Not found.');
  return org;
}

// Reviewer view of an org's KYC documents (M1-D). Platform-staff op: fetched by id
// (RBAC-gated by the route's kyc:view permission), missing → 404 never 403. Mints a
// SHORT-LIVED signed URL per document from the private storageKey — the raw
// storageKey/public URL is never returned. Records a kyc.view access audit (who
// viewed whose docs) with NO document content.
export async function getOrgKycDocuments({ orgId, actor, meta }) {
  const org = await Organisation.findOne({ _id: orgId }).select('+kycDocuments');
  if (!org) throw AppError.notFound('org not found', 'Not found.');

  const documents = (org.kycDocuments ?? []).map((d) => {
    const { url, expiresAt } = signedKycUrl({ storageKey: d.storageKey, format: d.format });
    return {
      docType: d.docType,
      uploadedAt: d.uploadedAt,
      verifiedAt: d.verifiedAt ?? null,
      superseded: Boolean(d.supersededAt),
      roundId: d.roundId ? String(d.roundId) : null,
      requestId: d.requestId ? String(d.requestId) : null,
      signedUrl: url,
      expiresAt,
    };
  });

  // The reviewer judges documents against the CLAIMED new values, so the diff
  // (current live vs requested) rides with the documents (2026-08-19).
  const pc = pendingChangesView(org);
  const pendingDiff = pc
    ? {
        ...pc,
        current: Object.fromEntries(
          pc.changedFields.map((f) => [f, f === 'address' ? (org.address ?? null) : (org[f] ?? null)]),
        ),
        requested: pc.values,
      }
    : null;

  await recordAudit({
    actor,
    action: 'kyc.view',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before: null,
    after: { docCount: documents.length }, // access record only — no storageKey/content
    meta,
  });

  // A21: `type` (buyer/exporter) replaced by the side flags (UiWebNotes logged).
  return {
    orgId: String(org._id),
    buyerSide: Boolean(org.buyerSide),
    exporterSide: Boolean(org.exporterSide),
    kycStatus: org.kycStatus,
    entityType: org.entityType ?? null,
    documents,
    pendingChanges: pendingDiff,
    documentRequests: documentRequestsView(org),
    kycRevocation: org.kycRevocation?.revokedAt
      ? {
          reason: org.kycRevocation.reason,
          revokedAt: org.kycRevocation.revokedAt,
          revokedBy: org.kycRevocation.revokedBy ? String(org.kycRevocation.revokedBy) : null,
        }
      : null,
  };
}
