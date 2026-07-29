import * as svc from '../services/kyc.service.js';
import { AppError } from '../utils/AppError.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function uploadKyc(req, res) {
  if (!req.file) {
    throw AppError.badRequest('no file', 'No file was uploaded (field "document").');
  }
  const result = await svc.submitKycDocument({
    user: req.user,
    entityType: req.body.entityType,
    docType: req.body.docType,
    buffer: req.file.buffer,
    meta: meta(req),
  });
  res.status(201).json({ kyc: result });
}

export async function getOrgKyc(req, res) {
  const result = await svc.getOrgKycDocuments({ orgId: req.params.id, actor: req.user, meta: meta(req) });
  res.json(result);
}

export async function getMyVerification(req, res) {
  const org = await svc.getMyVerification({ user: req.user });
  // Curate: per-document metadata only (no storageKey). Rejection reason is shown
  // to the owner so they know why and can resubmit.
  const documents = (org.kycDocuments ?? []).map((d) => ({
    docType: d.docType,
    uploadedAt: d.uploadedAt,
    verifiedAt: d.verifiedAt ?? null,
  }));
  res.json({
    verification: {
      kycStatus: org.kycStatus,
      entityType: org.entityType ?? null,
      verifiedAt: org.verifiedAt ?? null,
      kycRejectionReason: org.kycStatus === 'rejected' ? (org.kycRejectionReason ?? null) : null,
      kycSubmittedAt: org.kycSubmittedAt ?? null,
      documents,
    },
  });
}
