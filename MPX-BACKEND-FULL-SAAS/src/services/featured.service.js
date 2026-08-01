import { FeaturedItem } from '../models/FeaturedItem.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { recordAudit } from './audit.service.js';
import { buildAvailabilityFilter } from './search.query.js';
import { loadProjectionContext } from './publicProducts.service.js';
import { uploadPublicImage, deletePublicImage } from './image.storage.service.js';

/**
 * FINALIZE F5b — curated landing content.
 *
 * The public half is the part that matters. A featured row is only a POINTER, so
 * every target is re-resolved through the SAME availability rules the rest of the
 * public surface uses — `buildAvailabilityFilter()` for products (§A27.4), the
 * `exporterSide + isActive` pair for suppliers, `active` for categories. A target
 * that no longer qualifies is simply absent from the response: no error, no
 * broken card, no stale snapshot.
 *
 * That is what makes a block reach the front page. When F1-B takes a blocked
 * company's products down, those products stop matching the availability filter,
 * so they leave the landing page without anyone remembering to un-feature them.
 */

// Hard ceiling per kind. The landing page is the most-requested route on the
// platform and its payload must not be open-ended (api-endpoints: never
// pagination without a maximum).
const MAX_PER_KIND = 24;

/** `active`, and inside its date window if it declared one. */
function liveFilter(now) {
  return {
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  };
}

// Curated order, then newest. `_id` breaks the remaining tie so the sequence is
// stable across requests when an admin leaves several rows at the default 0.
const CURATED_SORT = { order: 1, createdAt: -1, _id: -1 };

async function resolveProducts(rows) {
  const ids = rows.map((r) => r.targetId);
  const products = await Product.find({
    _id: { $in: ids },
    // Availability enforced IN THE QUERY, never by filtering the response
    // (m3-public-projection rule).
    ...(await buildAvailabilityFilter()),
  }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const context = await loadProjectionContext(products);
  return { byId, context };
}

async function resolveCategories(rows) {
  const categories = await Category.find({
    _id: { $in: rows.map((r) => r.targetId) },
    active: true,
  }).lean();
  return new Map(categories.map((c) => [String(c._id), c]));
}

async function resolveSuppliers(rows) {
  const ids = rows.map((r) => r.targetId);
  const orgs = await Organisation.find({
    _id: { $in: ids },
    // Same pair the public exporter profile uses: an org with no exporter side
    // is not a supplier, and a blocked one (isActive: false) is invisible.
    exporterSide: true,
    isActive: true,
  }).lean();

  // Live listing counts for the whole card set in ONE aggregation rather than a
  // count per supplier — same shape as the D1 cap query.
  const counts = await Product.aggregate([
    {
      $match: {
        exporterOrgId: { $in: orgs.map((o) => o._id) },
        status: 'active',
        'takedown.isDown': { $ne: true },
      },
    },
    { $group: { _id: '$exporterOrgId', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));

  return { byId: new Map(orgs.map((o) => [String(o._id), o])), countById };
}

/**
 * The landing page's single call. Returns the four groups, each already
 * resolved, availability-filtered and in curated order.
 */
export async function getLandingFeatured({ now = new Date() } = {}) {
  const rows = await FeaturedItem.find(liveFilter(now)).sort(CURATED_SORT).lean();

  const byKind = { banner: [], product: [], category: [], supplier: [] };
  for (const row of rows) {
    // Cap per kind AFTER sorting, so the cap keeps the highest-priority rows.
    if (byKind[row.kind] && byKind[row.kind].length < MAX_PER_KIND) byKind[row.kind].push(row);
  }

  const [products, categories, suppliers] = await Promise.all([
    byKind.product.length ? resolveProducts(byKind.product) : null,
    byKind.category.length ? resolveCategories(byKind.category) : null,
    byKind.supplier.length ? resolveSuppliers(byKind.supplier) : null,
  ]);

  return { byKind, products, categories, suppliers };
}

// --- admin ------------------------------------------------------------------

/**
 * Confirm the target exists before it can be featured.
 *
 * Deliberately a WEAKER check than the public read: an exporter still pending
 * verification, or a product whose category is momentarily inactive, may be
 * curated — B7 forbids verification acting as a gate. The public read applies
 * the strict rules at render time, so an unavailable target is stored but never
 * shown. What this refuses is only a target that does not exist at all, because
 * that is always a mistake rather than a choice.
 */
async function assertTargetExists({ kind, targetId }) {
  const models = { product: Product, category: Category, supplier: Organisation };
  const exists = await models[kind].exists({ _id: targetId });
  if (!exists) throw AppError.badRequest(`${kind} not found`, 'That item no longer exists.');
}

export async function listFeatured() {
  // The admin screen shows EVERYTHING — inactive and expired rows included.
  // Hiding them would leave an admin unable to find the row they need to fix.
  return FeaturedItem.find({}).sort(CURATED_SORT).lean();
}

export async function createFeatured({ data, actor, meta }) {
  if (data.kind !== 'banner') await assertTargetExists(data);

  let uploaded = null;
  if (data.kind === 'banner') {
    uploaded = await uploadPublicImage({ buffer: data.buffer, folder: 'mpx/banners' });
  }

  let item;
  try {
    item = await FeaturedItem.create({
      kind: data.kind,
      targetId: data.targetId,
      image: uploaded?.url,
      publicId: uploaded?.publicId,
      title: data.title,
      subtitle: data.subtitle,
      linkUrl: data.linkUrl,
      order: data.order,
      active: data.active,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      createdBy: actor.userId,
    });
  } catch (err) {
    // The row was never written, so the freshly-uploaded asset would be orphaned
    // on Cloudinary forever. Best-effort cleanup, then report the real failure.
    if (uploaded) await deletePublicImage(uploaded.publicId).catch(() => {});
    // A duplicate is a curation mistake with an obvious message, not a 500.
    if (err?.code === 11000) {
      throw AppError.badRequest('already featured', 'That item is already featured.');
    }
    throw err;
  }

  await recordAudit({
    actor,
    action: 'featured.create',
    entityType: 'FeaturedItem',
    entityId: item._id,
    after: { kind: item.kind, targetId: item.targetId, order: item.order, active: item.active },
    meta,
  });
  return item;
}

export async function updateFeatured({ id, patch, actor, meta }) {
  const item = await FeaturedItem.findOne({ _id: id });
  if (!item) throw AppError.notFound('featured item not found', 'Not found.');

  const before = {
    order: item.order,
    active: item.active,
    title: item.title,
    subtitle: item.subtitle,
    linkUrl: item.linkUrl,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
  };

  // `kind` and `targetId` are deliberately not patchable: repointing a slot at a
  // different product would silently rewrite what was audited at creation.
  for (const key of ['order', 'active', 'title', 'subtitle', 'linkUrl', 'startsAt', 'endsAt']) {
    if (patch[key] !== undefined) item[key] = patch[key];
  }
  await item.save();

  await recordAudit({
    actor,
    action: 'featured.update',
    entityType: 'FeaturedItem',
    entityId: item._id,
    before,
    after: { order: item.order, active: item.active },
    meta,
  });
  return item;
}

export async function removeFeatured({ id, actor, meta }) {
  // `+publicId` — select:false, and the old asset id is needed to clean up.
  const item = await FeaturedItem.findOne({ _id: id }).select('+publicId');
  if (!item) throw AppError.notFound('featured item not found', 'Not found.');

  await FeaturedItem.deleteOne({ _id: item._id });

  // Best-effort: the local delete has already succeeded and must not be undone
  // by a storage hiccup.
  if (item.publicId) {
    try {
      await deletePublicImage(item.publicId);
    } catch (err) {
      logger.warn(
        { err: { name: err?.name, message: err?.message }, publicId: item.publicId },
        'featured banner delete: old asset not removed',
      );
    }
  }

  await recordAudit({
    actor,
    action: 'featured.delete',
    entityType: 'FeaturedItem',
    entityId: item._id,
    before: { kind: item.kind, targetId: item.targetId },
    meta,
  });
  return item;
}

export async function replaceBannerImage({ id, buffer, actor, meta }) {
  const item = await FeaturedItem.findOne({ _id: id }).select('+publicId');
  if (!item) throw AppError.notFound('featured item not found', 'Not found.');
  if (item.kind !== 'banner') {
    throw AppError.badRequest('not a banner', 'Only a banner carries an image.');
  }

  const previous = item.publicId;
  const { url, publicId } = await uploadPublicImage({ buffer, folder: 'mpx/banners' });
  item.image = url;
  item.publicId = publicId;
  await item.save();

  if (previous && previous !== publicId) {
    try {
      await deletePublicImage(previous);
    } catch (err) {
      logger.warn(
        { err: { name: err?.name, message: err?.message }, publicId: previous },
        'featured banner replace: old asset not deleted',
      );
    }
  }

  await recordAudit({
    actor,
    action: 'featured.image.upload',
    entityType: 'FeaturedItem',
    entityId: item._id,
    after: { image: url },
    meta,
  });
  return item;
}
