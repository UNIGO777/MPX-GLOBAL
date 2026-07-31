import * as svc from '../services/saved.service.js';
import { publicProductView } from '../views/publicProduct.view.js';
import { toPublic } from '../utils/toPublic.js';
import { PUBLIC_FIELDS as ORG_FIELDS, PUBLIC_DERIVED as ORG_DERIVED } from '../models/Organisation.js';

// Saved rows carry the SAME public projections as every other surface — an
// unavailable item is flagged, never enriched.
function savedView(item, context) {
  const base = {
    id: item.id,
    targetType: item.targetType,
    savedAt: item.savedAt,
    available: item.available,
    unavailableReason: item.unavailableReason,
  };
  if (item.targetType === 'product') {
    return { ...base, product: publicProductView(item.product, context) };
  }
  return { ...base, supplier: toPublic(item.supplier, { fields: ORG_FIELDS, derived: ORG_DERIVED }) };
}

export async function save(req, res) {
  const row = await svc.saveItem({ user: req.user, ...req.body });
  res.status(201).json({ saved: { id: String(row._id), targetType: row.targetType, savedAt: row.savedAt } });
}

export async function unsave(req, res) {
  await svc.unsaveItem({ user: req.user, id: req.params.id });
  res.json({ ok: true });
}

export async function list(req, res) {
  const { items, context, total, page, pageSize } = await svc.listSaved({
    user: req.user,
    ...req.validated.query,
  });
  res.json({ items: items.map((item) => savedView(item, context)), total, page, pageSize });
}
