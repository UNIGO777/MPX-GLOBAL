import * as svc from '../services/organisation.service.js';
import { AppError } from '../utils/AppError.js';

// §A22 · self-service company profile. Thin: validation is the route's zod
// schema, rules live in organisation.service.js.

function clientMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function getMine(req, res) {
  res.json({ organisation: await svc.getMyOrganisation({ user: req.user }) });
}

export async function updateMine(req, res) {
  const { organisation, demoted } = await svc.updateMyOrganisation({
    user: req.user,
    patch: req.body,
    meta: clientMeta(req),
  });
  res.json({ organisation, demoted });
}

export async function setLogo(req, res) {
  if (!req.file?.buffer) {
    throw AppError.badRequest('no file', 'Upload one image in the "logo" field.');
  }
  const { organisation } = await svc.setMyLogo({ user: req.user, buffer: req.file.buffer });
  res.json({ organisation });
}

export async function setCover(req, res) {
  if (!req.file?.buffer) {
    throw AppError.badRequest('no file', 'Upload one image in the "cover" field.');
  }
  const { organisation } = await svc.setMyCover({ user: req.user, buffer: req.file.buffer });
  res.json({ organisation });
}

export async function removeCover(req, res) {
  const { organisation } = await svc.removeMyCover({ user: req.user });
  res.json({ organisation });
}

export async function removeLogo(req, res) {
  const { organisation } = await svc.removeMyLogo({ user: req.user });
  res.json({ organisation });
}

// Verification-redesign (2026-08-19): back out of a pending profile change.
export async function cancelPending(req, res) {
  const { organisation } = await svc.cancelMyPendingChanges({
    user: req.user,
    meta: { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id },
  });
  res.json({ organisation });
}
