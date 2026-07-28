import { Organisation } from '../models/Organisation.js';
import { KYC_DOCS_BY_ENTITY } from '../models/enums.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';
import { uploadKycDocument } from './kyc.storage.service.js';

// Self-service KYC submission (M1-B). The caller writes only their OWN org
// (req.user.orgId) — this is a self write, not a staff action. Status moves
// pending|rejected|submitted → submitted (resubmit after rejection is the same
// path). Once verified there is nothing to resubmit.
export async function submitKycDocument({ user, entityType, docType, buffer, meta }) {
  // Only the two self-registering roles have a KYC profile to submit.
  if (user.role !== 'buyer' && user.role !== 'exporter') {
    throw AppError.forbidden('role has no kyc', 'Not allowed.');
  }

  const org = await Organisation.findOne({ _id: user.orgId });
  if (!org) throw AppError.notFound('org not found', 'Not found.');

  // Resolve the entity type. Exporters set it at signup (immutable here); a buyer
  // has none until the first upload, so it must be supplied then.
  let resolved = org.entityType;
  if (!resolved) {
    if (!entityType) {
      throw AppError.badRequest('entityType required', 'Please provide your entity type (business or individual).');
    }
    resolved = entityType;
  } else if (entityType && entityType !== resolved) {
    throw AppError.badRequest('entityType mismatch', 'Entity type does not match your account.');
  }

  // The document type must be valid for the (resolved) entity type.
  if (!KYC_DOCS_BY_ENTITY[resolved]?.includes(docType)) {
    throw AppError.badRequest('invalid docType for entity', 'This document type is not valid for your entity type.');
  }

  if (org.kycStatus === 'verified') {
    throw AppError.conflict('already verified', 'Your account is already verified.');
  }

  // Verify (magic bytes) + upload as a private asset. Returns only the private
  // storageKey — never a public URL.
  const { storageKey, format } = await uploadKycDocument({ buffer, orgId: String(org._id), docType });

  const before = { kycStatus: org.kycStatus };
  await Organisation.updateOne(
    { _id: org._id },
    {
      $push: { kycDocuments: { docType, storageKey, format, uploadedAt: new Date() } },
      $set: {
        kycStatus: 'submitted',
        kycSubmittedAt: new Date(),
        entityType: resolved,
        kycRejectionReason: null,
      },
    },
  );

  // Audit snapshot carries only the docType + the status transition — NEVER the
  // storageKey or file contents (security-baseline rule 4 / fix #10).
  await recordAudit({
    actor: user,
    action: 'kyc.submit',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before,
    after: { kycStatus: 'submitted', docType },
    meta,
  });

  return { kycStatus: 'submitted', entityType: resolved, docType };
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
