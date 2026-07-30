import * as svc from '../services/adminProducts.service.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

// Moderation response — staff view (curated; A9 hides byUserId from the SELLER
// only, so it is present here).
function moderationView(p) {
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    status: p.status,
    takedown: p.takedown?.isDown
      ? {
          isDown: true,
          reason: p.takedown.reason ?? null,
          byUserId: p.takedown.byUserId ? String(p.takedown.byUserId) : null,
          at: p.takedown.at ?? null,
        }
      : null,
  };
}

export async function list(req, res) {
  const result = await svc.listAdminProducts(req.validated.query);
  res.json(result);
}

export async function takedown(req, res) {
  const product = await svc.takedownProduct({
    id: req.params.id,
    reason: req.body.reason,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ product: moderationView(product) });
}

export async function restore(req, res) {
  const product = await svc.restoreProduct({ id: req.params.id, actor: req.user, meta: meta(req) });
  res.json({ product: moderationView(product) });
}
