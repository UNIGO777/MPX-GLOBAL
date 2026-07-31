import { SavedItem } from '../models/SavedItem.js';
import { Product } from '../models/Product.js';
import { Organisation } from '../models/Organisation.js';
import { Category } from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { getActiveLeafIds } from './category.service.js';

/**
 * M3-D — saved products and suppliers (§A13: buyer accounts only).
 *
 * 🔴 The read path deliberately does NOT reuse `getPublicProduct()` /
 * `getPublicExporter()`. Those apply the availability filter IN THE QUERY and
 * would 404 exactly the rows this list is required to KEEP and flag
 * "currently unavailable". We load targets unfiltered and evaluate availability
 * here; only the PROJECTION is shared.
 *
 * Temporary vs permanent (Saved-item.md §3.2):
 *   inactive / taken down / category deactivated / org blocked → STAYS, flagged
 *   archived or purged                                          → REMOVED by the
 *                                                                 cleanup hooks
 */

async function loadBuyerOrg(orgId) {
  // Defensive, mirroring the exporter guard: `requireRole('buyer')` lets a
  // superadmin through, and the platform org must never own saved items.
  const org = await Organisation.findOne({ _id: orgId }).select('buyerSide');
  if (!org || !org.buyerSide) throw AppError.forbidden('not a buyer org', 'Not allowed.');
  return org;
}

// Is the target publicly visible RIGHT NOW? (Used both to validate a save and
// to flag a row on read.)
async function productAvailability(product, activeLeafIds) {
  if (!product) return { available: false, reason: 'removed' };
  if (product.status === 'archived') return { available: false, reason: 'removed' };
  if (product.takedown?.isDown) return { available: false, reason: 'unavailable' };
  if (product.status !== 'active') return { available: false, reason: 'unavailable' };
  if (!activeLeafIds.some((id) => String(id) === String(product.categoryId))) {
    return { available: false, reason: 'unavailable' };
  }
  return { available: true, reason: null };
}

function supplierAvailability(org) {
  if (!org || !org.exporterSide) return { available: false, reason: 'removed' };
  if (org.isActive === false) return { available: false, reason: 'unavailable' };
  return { available: true, reason: null };
}

export async function saveItem({ user, targetType, targetId }) {
  await loadBuyerOrg(user.orgId);

  // A buyer may only save something that is publicly visible at save time.
  if (targetType === 'product') {
    const product = await Product.findOne({ _id: targetId });
    const { available } = await productAvailability(product, await getActiveLeafIds());
    if (!available) throw AppError.notFound('product not saveable', 'Not found.');
  } else {
    const org = await Organisation.findOne({ _id: targetId }).select('exporterSide isActive');
    if (!supplierAvailability(org).available) throw AppError.notFound('supplier not saveable', 'Not found.');
  }

  try {
    return await SavedItem.create({ buyerOrgId: user.orgId, targetType, targetId, savedAt: new Date() });
  } catch (err) {
    if (err?.code === 11000) {
      throw AppError.conflict('already saved', 'This item is already in your saved list.');
    }
    throw err;
  }
}

export async function unsaveItem({ user, id }) {
  // Ownership-scoped: another buyer's row is a 404, never a 403.
  const row = await SavedItem.findOne({ _id: id, buyerOrgId: user.orgId });
  if (!row) throw AppError.notFound('saved item not found', 'Not found.');
  await SavedItem.deleteOne({ _id: row._id });
}

export async function listSaved({ user, targetType, page, pageSize }) {
  await loadBuyerOrg(user.orgId);

  const filter = { buyerOrgId: user.orgId, ...(targetType ? { targetType } : {}) };
  const [rows, total] = await Promise.all([
    SavedItem.find(filter)
      .sort({ savedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    SavedItem.countDocuments(filter),
  ]);

  // Batched per page — one products query and one orgs query, never per row.
  const productIds = rows.filter((r) => r.targetType === 'product').map((r) => r.targetId);
  const orgIds = rows.filter((r) => r.targetType === 'supplier').map((r) => r.targetId);
  const [products, orgs, activeLeafIds] = await Promise.all([
    productIds.length ? Product.find({ _id: { $in: productIds } }).lean() : [],
    orgIds.length ? Organisation.find({ _id: { $in: orgIds } }).lean() : [],
    getActiveLeafIds(),
  ]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const orgById = new Map(orgs.map((o) => [String(o._id), o]));

  // Category + seller blocks for the product rows' projection.
  const catIds = [...new Set(products.map((p) => String(p.categoryId)))];
  const sellerIds = [...new Set(products.map((p) => String(p.exporterOrgId)))];
  const [categories, sellers] = await Promise.all([
    catIds.length ? Category.find({ _id: { $in: catIds } }).lean() : [],
    sellerIds.length ? Organisation.find({ _id: { $in: sellerIds } }).lean() : [],
  ]);

  const items = [];
  for (const row of rows) {
    if (row.targetType === 'product') {
      const product = productById.get(String(row.targetId));
      // Tolerate a dangling target (a row saved before the cleanup hooks
      // existed): skip it rather than render a broken entry.
      if (!product) continue;
      const { available, reason } = await productAvailability(product, activeLeafIds);
      items.push({ id: String(row._id), targetType: 'product', savedAt: row.savedAt, available, unavailableReason: reason, product });
    } else {
      const org = orgById.get(String(row.targetId));
      if (!org) continue;
      const { available, reason } = supplierAvailability(org);
      items.push({ id: String(row._id), targetType: 'supplier', savedAt: row.savedAt, available, unavailableReason: reason, supplier: org });
    }
  }

  // Note: `total` counts saved ROWS, so a skipped dangling target makes it read
  // one higher than `items.length` on that page. That state is transient by
  // design — the archive/purge hooks prevent it, and `sweepOrphanedSavedItems()`
  // clears any legacy rows — so it is not worth a second query per request.
  return {
    items,
    context: {
      categories: new Map(categories.map((c) => [String(c._id), c])),
      organisations: new Map(sellers.map((o) => [String(o._id), o])),
    },
    total,
    page,
    pageSize,
  };
}

/**
 * Cleanup — a PERMANENTLY gone product leaves no dead saved rows.
 * Called from the M2 archive path and from the A8 purge job.
 */
export function removeSavedForProduct(productId) {
  return SavedItem.deleteMany({ targetType: 'product', targetId: productId });
}

/** One-off sweep for rows whose target no longer exists (pre-hook data). */
export async function sweepOrphanedSavedItems() {
  const rows = await SavedItem.find({ targetType: 'product' }).select('targetId').lean();
  if (rows.length === 0) return { removed: 0 };
  const ids = [...new Set(rows.map((r) => String(r.targetId)))];
  const alive = await Product.find({ _id: { $in: ids } }).select('_id').lean();
  const aliveSet = new Set(alive.map((p) => String(p._id)));
  const dead = ids.filter((id) => !aliveSet.has(id));
  if (dead.length === 0) return { removed: 0 };
  const res = await SavedItem.deleteMany({ targetType: 'product', targetId: { $in: dead } });
  return { removed: res.deletedCount ?? 0 };
}
