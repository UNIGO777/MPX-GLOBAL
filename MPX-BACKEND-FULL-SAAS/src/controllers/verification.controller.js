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
