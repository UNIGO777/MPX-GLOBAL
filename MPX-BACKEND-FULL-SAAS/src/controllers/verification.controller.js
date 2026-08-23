import * as svc from '../services/verification.service.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

// Curated view — never return the full organisation document (api-endpoints rule).
function view(org) {
  return {
    id: String(org._id),
    name: org.name,
    // A21: `type` (buyer/exporter) removed from the response — the sides are the
    // discriminator now. API contract change (logged in docs/UiWebNotes.md).
    buyerSide: Boolean(org.buyerSide),
    exporterSide: Boolean(org.exporterSide),
    kycStatus: org.kycStatus,
    verifiedAt: org.verifiedAt ?? null,
    kycRejectionReason: org.kycRejectionReason ?? null,
  };
}

export async function approveBuyer(req, res) {
  const org = await svc.approveBuyer({ orgId: req.params.id, actor: req.user, meta: meta(req) });
  res.json({ organisation: view(org) });
}

export async function verifyExporter(req, res) {
  const org = await svc.verifyExporter({ orgId: req.params.id, actor: req.user, meta: meta(req) });
  res.json({ organisation: view(org) });
}

export async function rejectBuyer(req, res) {
  const org = await svc.rejectBuyer({ orgId: req.params.id, reason: req.body.reason, actor: req.user, meta: meta(req) });
  res.json({ organisation: view(org) });
}

export async function rejectExporter(req, res) {
  const org = await svc.rejectExporter({ orgId: req.params.id, reason: req.body.reason, actor: req.user, meta: meta(req) });
  res.json({ organisation: view(org) });
}

// Verification-redesign (2026-08-19) — request documents, side-shaped.
export async function requestBuyerDocuments(req, res) {
  const result = await svc.requestDocuments({
    orgId: req.params.id,
    sideFlag: 'buyerSide',
    ...req.validated.body,
    actor: req.user,
    meta: meta(req),
  });
  res.status(201).json({ request: result });
}

export async function requestExporterDocuments(req, res) {
  const result = await svc.requestDocuments({
    orgId: req.params.id,
    sideFlag: 'exporterSide',
    ...req.validated.body,
    actor: req.user,
    meta: meta(req),
  });
  res.status(201).json({ request: result });
}

// Change re-verification + revoke (2026-08-19) — side-shaped like the four above.
const changeHandler = (fn, sideFlag) => async (req, res) => {
  const org = await fn({
    orgId: req.params.id,
    sideFlag,
    ...(req.validated?.body?.reason ? { reason: req.validated.body.reason } : {}),
    actor: req.user,
    meta: meta(req),
  });
  res.json({ organisation: view(org) });
};

export const approveBuyerChange = changeHandler(svc.approveChange, 'buyerSide');
export const approveExporterChange = changeHandler(svc.approveChange, 'exporterSide');
export const rejectBuyerChange = changeHandler(svc.rejectChange, 'buyerSide');
export const rejectExporterChange = changeHandler(svc.rejectChange, 'exporterSide');
export const revokeBuyer = changeHandler(svc.revokeVerification, 'buyerSide');
export const revokeExporter = changeHandler(svc.revokeVerification, 'exporterSide');
