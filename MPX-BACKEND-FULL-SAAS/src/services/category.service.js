import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { CategoryAttribute } from '../models/CategoryAttribute.js';
import { Product } from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { idOrSlugFilter } from '../utils/idOrSlug.js';
import { recordAudit } from './audit.service.js';
import { uploadPublicImage } from './image.storage.service.js';
import { rebuildForCategory } from './searchSync.service.js';

// ---------------------------------------------------------------------------
// Lookups. Public reads hide inactive rows IN THE QUERY; admin reads see all.
// Ids and slugs are both accepted on single reads (SEO §1 serves /category/:slug).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// activeLeafIds — the availability helper the public product reads filter on.
// Leaf counts as active only when BOTH it and its parent top are active
// (defensive: the toggle guard should make the parent check redundant, but the
// filter must not depend on that). Per-process cache with a short TTL backstop;
// admin writes invalidate immediately.
// ---------------------------------------------------------------------------

const LEAF_CACHE_TTL_MS = 30_000;
let leafCache = { ids: null, at: 0 };

export function invalidateLeafCache() {
  leafCache = { ids: null, at: 0 };
}

export async function getActiveLeafIds() {
  const now = Date.now();
  // Never cache in tests: a stale entry surviving between cases makes results
  // depend on test ORDER, which is exactly the kind of flake that wastes a day
  // to diagnose. Production keeps the cache (the collection is ~300 rows and the
  // admin writes invalidate it explicitly).
  const cacheable = env.NODE_ENV !== 'test';
  if (cacheable && leafCache.ids && now - leafCache.at < LEAF_CACHE_TTL_MS) return leafCache.ids;

  const activeTops = await Category.find({ parentId: null, active: true }).select('_id').lean();
  const topIds = activeTops.map((t) => t._id);
  const leaves = await Category.find({ parentId: { $in: topIds }, active: true }).select('_id').lean();
  const ids = leaves.map((l) => l._id);

  if (cacheable) leafCache = { ids, at: now };
  return ids;
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export async function getPublicTree() {
  const tops = await Category.find({ parentId: null, active: true }).sort({ order: 1, _id: 1 }).lean();
  const subs = await Category.find({ parentId: { $in: tops.map((t) => t._id) }, active: true })
    .sort({ order: 1, _id: 1 })
    .lean();
  const byParent = new Map();
  for (const sub of subs) {
    const key = String(sub.parentId);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(sub);
  }
  return tops.map((top) => ({ top, subs: byParent.get(String(top._id)) ?? [] }));
}

export async function getTopCategories() {
  return Category.find({ parentId: null, active: true }).sort({ order: 1, _id: 1 }).lean();
}

// Children of an ACTIVE top; an inactive/unknown parent yields an empty list
// (the plan's "inactive parent returns empty" rule — no oracle about hidden rows).
export async function getSubcategories(parentId) {
  const parent = await Category.findOne({ _id: parentId, parentId: null, active: true }).select('_id').lean();
  if (!parent) return [];
  return Category.find({ parentId: parent._id, active: true }).sort({ order: 1, _id: 1 }).lean();
}

export async function getPublicCategory(idOrSlug) {
  const cat = await Category.findOne({ ...idOrSlugFilter(idOrSlug), active: true }).lean();
  if (!cat) throw AppError.notFound('category not found', 'Not found.');
  // A sub under a cascade-hidden top is not publicly reachable either.
  if (cat.parentId) {
    const parentActive = await Category.findOne({ _id: cat.parentId, active: true }).select('_id').lean();
    if (!parentActive) throw AppError.notFound('category parent inactive', 'Not found.');
  }
  return cat;
}

// The dynamic-form field list for a (public) category, sorted for rendering.
export async function getPublicCategoryAttributes(idOrSlug) {
  const cat = await getPublicCategory(idOrSlug);
  const attrs = await CategoryAttribute.find({ categoryId: cat._id }).sort({ order: 1, _id: 1 }).lean();
  return { category: cat, attributes: attrs };
}

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

// Full tree INCLUDING inactive rows + prevActive + synonyms + attribute counts —
// the m5 category-tree screen's data source (public reads hide all of that).
export async function getAdminTree() {
  const all = await Category.find({}).sort({ order: 1, _id: 1 }).lean();
  const counts = await CategoryAttribute.aggregate([
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]);
  const attrCount = new Map(counts.map((c) => [String(c._id), c.count]));

  const tops = all.filter((c) => c.parentId == null);
  const byParent = new Map();
  for (const sub of all.filter((c) => c.parentId != null)) {
    const key = String(sub.parentId);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push({ ...sub, attributeCount: attrCount.get(String(sub._id)) ?? 0 });
  }
  return tops.map((top) => ({ top, subs: byParent.get(String(top._id)) ?? [] }));
}

// ---------------------------------------------------------------------------
// Admin writes (all audited — A19; leaf cache invalidated on every one)
// ---------------------------------------------------------------------------

async function loadCategory(id) {
  const cat = await Category.findOne({ _id: id });
  if (!cat) throw AppError.notFound('category not found', 'Not found.');
  return cat;
}

// A4 cascade toggle for tops; guarded flip for subs (incl. the cascade-intent
// rule: deactivating a sub during a top-off period records prevActive=false so
// the top's reactivation keeps it off).
export async function toggleCategory({ id, actor, meta }) {
  const cat = await loadCategory(id);

  let after;
  if (cat.parentId == null) {
    if (cat.active) {
      // Deactivate top: snapshot each sub's state, then switch all off.
      await Category.updateMany({ parentId: cat._id, active: true }, { $set: { prevActive: true, active: false } });
      await Category.updateMany(
        { parentId: cat._id, active: false, prevActive: { $exists: false } },
        { $set: { prevActive: false } },
      );
      cat.active = false;
    } else {
      // Reactivate top: restore each sub from its snapshot, clear the markers.
      cat.active = true;
      await Category.updateMany({ parentId: cat._id, prevActive: true }, { $set: { active: true } });
      await Category.updateMany({ parentId: cat._id }, { $unset: { prevActive: '' } });
    }
    after = { active: cat.active, cascade: true };
    await cat.save();
  } else {
    const parent = await Category.findOne({ _id: cat.parentId }).select('active');
    if (!cat.active) {
      if (parent && !parent.active) {
        if (cat.prevActive === true) {
          // Cascade-off period: record the admin's intent — stay off on restore.
          cat.prevActive = false;
          await cat.save();
          after = { active: false, prevActive: false, intentRecorded: true };
        } else {
          throw AppError.conflict('parent top inactive', 'The parent category is deactivated.');
        }
      } else {
        cat.active = true;
        await cat.save();
        after = { active: true };
      }
    } else {
      cat.active = false;
      await cat.save();
      after = { active: false };
    }
  }

  invalidateLeafCache();
  await recordAudit({
    actor,
    action: 'category.toggle',
    entityType: 'Category',
    entityId: cat._id,
    before: null,
    after,
    meta,
  });
  return cat;
}

export async function createSubCategory({ parentId, name, type, synonyms = [], order = 0, actor, meta }) {
  const parent = await Category.findOne({ _id: parentId, parentId: null });
  if (!parent) {
    // Depth stays 2: the parent must itself be a top.
    throw AppError.badRequest('parent must be a top category', 'Sub-categories can only be created under a top category.');
  }

  let sub;
  try {
    sub = await Category.create({ name, parentId: parent._id, type, synonyms, order });
  } catch (err) {
    if (err?.code === 11000) {
      // Slug insert-race (the pre-validate clash check passed on both sides) —
      // surface a clean conflict instead of a raw 500; a retry resolves it.
      throw AppError.conflict('category slug race', 'A category with this name was just created. Please retry.');
    }
    throw err;
  }
  invalidateLeafCache();
  await recordAudit({
    actor,
    action: 'category.create',
    entityType: 'Category',
    entityId: sub._id,
    after: { name, slug: sub.slug, parentId: String(parent._id), type },
    meta,
  });
  return sub;
}

// Slug is immutable everywhere; parentId is immutable (no re-parenting); a
// sub's type change is blocked once products exist (a flip would orphan the
// goods/service field groups on live rows). Tops accept name/order/synonyms
// only (A12-spirit: the top-40 synonym list lands after seeding).
export async function updateCategory({ id, patch, actor, meta }) {
  const cat = await loadCategory(id);
  const before = {};
  const after = {};

  if (cat.parentId == null && patch.type !== undefined) {
    throw AppError.badRequest('top has no type', 'A top category does not carry a type (A16).');
  }
  if (patch.type !== undefined && patch.type !== cat.type) {
    const products = await Product.countDocuments({ categoryId: cat._id });
    if (products > 0) {
      throw AppError.conflict('type locked', 'This category has products; its type can no longer change.');
    }
  }

  for (const field of ['name', 'order', 'synonyms', 'type']) {
    if (patch[field] !== undefined) {
      before[field] = cat[field];
      cat[field] = patch[field];
      after[field] = patch[field];
    }
  }
  if (Object.keys(after).length === 0) {
    throw AppError.badRequest('empty patch', 'Nothing to update.');
  }

  await cat.save();
  invalidateLeafCache();

  // §A26: a rename or a synonyms edit changes the search corpus of every product
  // in this category — rebuild them now, or the category silently stops matching
  // under its new name. Rare admin action, bounded batch (searchSync.service).
  if (after.name !== undefined || after.synonyms !== undefined) {
    await rebuildForCategory(cat._id);
  }

  await recordAudit({
    actor,
    action: 'category.update',
    entityType: 'Category',
    entityId: cat._id,
    before,
    after,
    meta,
  });
  return cat;
}

export async function deleteCategory({ id, actor, meta }) {
  const cat = await loadCategory(id);
  if (cat.parentId == null) {
    throw AppError.forbidden('top delete blocked', 'Top categories cannot be deleted.');
  }
  const [products, children] = await Promise.all([
    Product.countDocuments({ categoryId: cat._id }),
    Category.countDocuments({ parentId: cat._id }),
  ]);
  if (products > 0 || children > 0) {
    throw AppError.conflict('category in use', 'This category has products or children and cannot be deleted.');
  }

  await CategoryAttribute.deleteMany({ categoryId: cat._id });
  await Category.deleteOne({ _id: cat._id });
  invalidateLeafCache();
  await recordAudit({
    actor,
    action: 'category.delete',
    entityType: 'Category',
    entityId: cat._id,
    before: { name: cat.name, slug: cat.slug },
    after: null,
    meta,
  });
}

// A11/A20 — admin uploads the card image; ALLOWED on tops too (the deliberate
// exception to top = toggle-only; do not "fix" it away).
export async function setCategoryImage({ id, buffer, actor, meta }) {
  const cat = await loadCategory(id);
  const { url } = await uploadPublicImage({ buffer, folder: 'mpx/categories' });
  cat.image = url;
  await cat.save();
  await recordAudit({
    actor,
    action: 'category.image.upload',
    entityType: 'Category',
    entityId: cat._id,
    after: { image: url },
    meta,
  });
  return cat;
}

// ---------------------------------------------------------------------------
// Attribute CRUD (sub-categories only — a top has no product form)
// ---------------------------------------------------------------------------

async function loadSubCategory(id) {
  const cat = await loadCategory(id);
  if (cat.parentId == null) {
    throw AppError.badRequest('attributes live on subs', 'Attributes belong to sub-categories.');
  }
  return cat;
}

// The model's options-vs-inputType hook throws a plain Error — surface it as a
// 400 (its message is our own safe text), never a 500.
function mapAttributeError(err) {
  if (err?.code === 11000) {
    return AppError.conflict('duplicate key', 'An attribute with this key already exists on this category.');
  }
  if (err?.name === 'ValidationError' || String(err?.message).startsWith('CategoryAttribute:')) {
    const clientMessage = String(err.message).replace(/^CategoryAttribute:\s*/, '');
    return AppError.badRequest(err.message, clientMessage);
  }
  return err;
}

export async function createAttribute({ categoryId, def, actor, meta }) {
  const cat = await loadSubCategory(categoryId);
  let attr;
  try {
    attr = await CategoryAttribute.create({ ...def, categoryId: cat._id });
  } catch (err) {
    throw mapAttributeError(err);
  }
  await recordAudit({
    actor,
    action: 'category.attribute.create',
    entityType: 'CategoryAttribute',
    entityId: attr._id,
    after: { categoryId: String(cat._id), key: attr.key, inputType: attr.inputType },
    meta,
  });
  return attr;
}

// `key` and `inputType` are IMMUTABLE (products store {key, value} snapshots; a
// number→select flip would corrupt stored typed values). The validator strips
// them, so a patch can only carry the editable set.
export async function updateAttribute({ categoryId, attrId, patch, actor, meta }) {
  await loadSubCategory(categoryId);
  const attr = await CategoryAttribute.findOne({ _id: attrId, categoryId });
  if (!attr) throw AppError.notFound('attribute not found', 'Not found.');

  const before = {};
  const after = {};
  for (const field of ['name', 'options', 'unit', 'required', 'filterable', 'order']) {
    if (patch[field] !== undefined) {
      before[field] = attr[field];
      attr[field] = patch[field];
      after[field] = patch[field];
    }
  }
  if (Object.keys(after).length === 0) {
    throw AppError.badRequest('empty patch', 'Nothing to update.');
  }

  try {
    await attr.save(); // model validator re-checks options-vs-inputType
  } catch (err) {
    throw mapAttributeError(err);
  }
  await recordAudit({
    actor,
    action: 'category.attribute.update',
    entityType: 'CategoryAttribute',
    entityId: attr._id,
    before,
    after,
    meta,
  });
  return attr;
}

// Existing products keep their {key, value} snapshots — nothing breaks.
export async function deleteAttribute({ categoryId, attrId, actor, meta }) {
  await loadSubCategory(categoryId);
  const attr = await CategoryAttribute.findOne({ _id: attrId, categoryId });
  if (!attr) throw AppError.notFound('attribute not found', 'Not found.');

  await CategoryAttribute.deleteOne({ _id: attr._id });
  await recordAudit({
    actor,
    action: 'category.attribute.delete',
    entityType: 'CategoryAttribute',
    entityId: attr._id,
    before: { categoryId: String(categoryId), key: attr.key },
    after: null,
    meta,
  });
}
