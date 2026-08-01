import * as svc from '../services/featured.service.js';
import { landingFeaturedView, adminFeaturedView } from '../views/featured.view.js';
import { AppError } from '../utils/AppError.js';

// FINALIZE F5b. The public read is one call so the landing page renders in a
// single round trip; the admin surface is ordinary curation CRUD.

function auditMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

/** PUBLIC — the landing page's four groups, already availability-filtered. */
export async function landing(req, res) {
  const resolved = await svc.getLandingFeatured();
  res.json(landingFeaturedView(resolved));
}

export async function list(req, res) {
  const rows = await svc.listFeatured();
  res.json({ items: rows.map(adminFeaturedView) });
}

export async function create(req, res) {
  const item = await svc.createFeatured({
    data: req.validated.body,
    actor: req.user,
    meta: auditMeta(req),
  });
  res.status(201).json({ item: adminFeaturedView(item) });
}

export async function createBanner(req, res) {
  if (!req.file?.buffer) {
    throw AppError.badRequest('no image', 'Upload the banner image in the "image" field.');
  }
  const item = await svc.createFeatured({
    data: { kind: 'banner', ...req.validated.body, buffer: req.file.buffer },
    actor: req.user,
    meta: auditMeta(req),
  });
  res.status(201).json({ item: adminFeaturedView(item) });
}

export async function update(req, res) {
  const item = await svc.updateFeatured({
    id: req.params.id,
    patch: req.validated.body,
    actor: req.user,
    meta: auditMeta(req),
  });
  res.json({ item: adminFeaturedView(item) });
}

export async function remove(req, res) {
  await svc.removeFeatured({ id: req.params.id, actor: req.user, meta: auditMeta(req) });
  res.status(204).end();
}

export async function uploadImage(req, res) {
  if (!req.file?.buffer) {
    throw AppError.badRequest('no image', 'Upload the banner image in the "image" field.');
  }
  const item = await svc.replaceBannerImage({
    id: req.params.id,
    buffer: req.file.buffer,
    actor: req.user,
    meta: auditMeta(req),
  });
  res.json({ item: adminFeaturedView(item) });
}
