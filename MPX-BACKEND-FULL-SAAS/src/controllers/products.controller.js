import * as svc from '../services/product.service.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

// The seller's own view of their product. Full own data — but A9: the takedown
// block shows reason + date and NEVER byUserId (which admin acted stays
// internal). Curated by construction, not by toJSON.
function ownView(p) {
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
    categoryId: String(p.categoryId),
    status: p.status,
    price: {
      mode: p.price?.mode ?? 'on_request',
      min: p.price?.min ?? null,
      max: p.price?.max ?? null,
      currency: p.price?.currency ?? null,
    },
    images: (p.images ?? []).map((i) => i.url),
    moq: p.moq ?? null,
    unit: p.unit ?? null,
    hsCode: p.hsCode ?? null,
    countryOfOrigin: p.countryOfOrigin ?? null,
    supplyAbility: p.supplyAbility ?? null,
    leadTime: p.leadTime ?? null,
    packaging: p.packaging ?? null,
    terms: p.terms ?? null,
    engagementType: p.engagementType ?? null,
    deliveryModel: p.deliveryModel ?? null,
    teamSize: p.teamSize ?? null,
    pricingModel: p.pricingModel ?? null,
    timeline: p.timeline ?? null,
    attributes: (p.attributes ?? []).map((a) => ({ key: a.key, value: a.value })),
    takedown: p.takedown?.isDown ? { reason: p.takedown.reason ?? null, at: p.takedown.at ?? null } : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function uploadImages(req, res) {
  const refs = await svc.uploadImages({ user: req.user, files: req.files });
  res.status(201).json({ images: refs });
}

export async function create(req, res) {
  const product = await svc.createProduct({ user: req.user, body: req.body, meta: meta(req) });
  res.status(201).json({ product: ownView(product) });
}

export async function update(req, res) {
  const product = await svc.updateProduct({ user: req.user, id: req.params.id, patch: req.body, meta: meta(req) });
  res.json({ product: ownView(product) });
}

export async function setStatus(req, res) {
  const product = await svc.setProductStatus({
    user: req.user,
    id: req.params.id,
    status: req.body.status,
    meta: meta(req),
  });
  res.json({ product: ownView(product) });
}

export async function archive(req, res) {
  const product = await svc.archiveProduct({ user: req.user, id: req.params.id, meta: meta(req) });
  res.json({ product: ownView(product) });
}

// `counts` drives the status tabs, `caps` the cap meter — both ride on every
// page so a publish refreshes rows, tabs and meter in one call.
export async function mine(req, res) {
  const { rows, total, page, pageSize, counts, caps } = await svc.listMine({
    user: req.user,
    ...req.validated.query,
  });
  res.json({ products: rows.map(ownView), total, page, pageSize, counts, caps });
}
