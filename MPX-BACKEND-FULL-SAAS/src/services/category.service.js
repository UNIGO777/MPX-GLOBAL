import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { CategoryAttribute } from '../models/CategoryAttribute.js';
import { Product } from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { idOrSlugFilter } from '../utils/idOrSlug.js';
import { logger } from '../utils/logger.js';
import { recordAudit } from './audit.service.js';
import { uploadPublicImage, deletePublicImage } from './image.storage.service.js';
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

/**
 * The public tree. No args = everything (the web app's one-shot load).
 * `{ limit, offset }` = a slice of TOPS in the same admin-defined order, each
 * still carrying ALL of its subs — the app's browse list loads in chunks as
 * the user scrolls (2026-08-17). Chunking is by top category, never by sub:
 * half a section's chips would render as a lie ("this category has 3 subs")
 * rather than a smaller page.
 */
export async function getPublicTree({ limit, offset = 0 } = {}) {
  const filter = { parentId: null, active: true };
  let topsQuery = Category.find(filter).sort({ order: 1, _id: 1 });
  if (limit != null) topsQuery = topsQuery.skip(offset).limit(limit);
  const tops = await topsQuery.lean();
  const subs = await Category.find({ parentId: { $in: tops.map((t) => t._id) }, active: true })
    .sort({ order: 1, _id: 1 })
    .lean();
  const byParent = new Map();
  for (const sub of subs) {
    const key = String(sub.parentId);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(sub);
  }
  const tree = tops.map((top) => ({ top, subs: byParent.get(String(top._id)) ?? [] }));
  if (limit == null) return { tree, total: tree.length };
  const total = await Category.countDocuments(filter);
  return { tree, total };
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

/**
 * The attribute manager's data source (m2 web screen 9).
 *
 * 🔴 Deliberately NOT `getPublicCategoryAttributes`. That one resolves through
 * `getPublicCategory`, which requires the category AND its parent to be active —
 * so the fields of a deactivated sub, or of any sub under a cascade-off top,
 * would be unreachable by the exact screen that exists to manage them. An admin
 * read sees every row, active or not.
 *
 * Tops are refused outright: §A16 puts `type` and attributes on the LEAF only,
 * so a top has no fields to manage (same rule as `loadLeafCategory` in
 * product.service.js).
 */
export async function getAdminCategoryAttributes(id) {
  const cat = await Category.findOne({ _id: id }).lean();
  if (!cat) throw AppError.notFound('category not found', 'Not found.');
  if (cat.parentId == null) {
    throw AppError.badRequest('top category has no attributes', 'Top categories have no fields.');
  }
  const attributes = await CategoryAttribute.find({ categoryId: cat._id }).sort({ order: 1, _id: 1 }).lean();
  return { category: cat, attributes };
}

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
    // Save the PARENT first, then cascade (review finding): if a cascade write
    // failed after the parent flip, the half-applied state is the harmless one —
    // a sub is invisible anyway while its top is off, and the public reads check
    // the parent. The reverse order could leave every sub off under a live top.
    if (cat.active) {
      cat.active = false;
      await saveCategory(cat);
      // Snapshot each sub's state, then switch all off.
      await Category.updateMany({ parentId: cat._id, active: true }, { $set: { prevActive: true, active: false } });
      await Category.updateMany(
        { parentId: cat._id, active: false, prevActive: { $exists: false } },
        { $set: { prevActive: false } },
      );
    } else {
      cat.active = true;
      await saveCategory(cat);
      // Restore each sub from its snapshot, then clear the markers.
      await Category.updateMany({ parentId: cat._id, prevActive: true }, { $set: { active: true } });
      await Category.updateMany({ parentId: cat._id }, { $unset: { prevActive: '' } });
    }
    after = { active: cat.active, cascade: true };
  } else {
    const parent = await Category.findOne({ _id: cat.parentId }).select('active');
    const parentOff = parent && !parent.active;

    if (parentOff) {
      // While the top is off every sub is already inactive, so the toggle edits
      // the RESTORE INTENT instead — and it must work BOTH ways (review finding:
      // it used to be a one-way door, 409-ing the moment an admin tried to undo).
      if (cat.prevActive === false) {
        cat.prevActive = true;
        await saveCategory(cat);
        after = { active: false, prevActive: true, intentRecorded: true };
      } else {
        cat.prevActive = false;
        await saveCategory(cat);
        after = { active: false, prevActive: false, intentRecorded: true };
      }
    } else {
      cat.active = !cat.active;
      await saveCategory(cat);
      after = { active: cat.active };
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

export async function createSubCategory({ parentId, name, type, synonyms = [], order, actor, meta }) {
  const parent = await Category.findOne({ _id: parentId, parentId: null });
  if (!parent) {
    // Depth stays 2: the parent must itself be a top.
    throw AppError.badRequest('parent must be a top category', 'Sub-categories can only be created under a top category.');
  }

  // No explicit position → append to the end; an explicit one shifts siblings
  // (same positional semantics as updateCategory, 2026-08-14).
  const siblingCount = await Category.countDocuments({ parentId: parent._id });

  let sub;
  try {
    sub = await Category.create({ name, parentId: parent._id, type, synonyms, order: siblingCount + 1 });
    if (order !== undefined && Number(order) !== siblingCount + 1) {
      sub.order = await resequenceSiblings(sub, Number(order));
      await sub.save();
    }
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

/**
 * `order` is a POSITION, not a free number (2026-08-14 — owner: "when I change
 * the order in one it's not updating others"). Moving a category to position N
 * shifts its siblings and rewrites the whole scope to a clean 1..n sequence,
 * so every list that sorts on `order` (admin rail, phone sheet, public tree,
 * sub lists) reorders consistently. Returns the clamped final position.
 */
async function resequenceSiblings(cat, requestedPosition) {
  const siblings = await Category.find({ parentId: cat.parentId ?? null, _id: { $ne: cat._id } })
    .sort({ order: 1, _id: 1 })
    .select('_id order')
    .lean();

  const position = Math.min(Math.max(Math.trunc(requestedPosition) || 1, 1), siblings.length + 1);
  const sequence = [
    ...siblings.slice(0, position - 1),
    { _id: cat._id, order: cat.order },
    ...siblings.slice(position - 1),
  ];

  const ops = [];
  sequence.forEach((row, i) => {
    const target = i + 1;
    if (row.order !== target && !row._id.equals(cat._id)) {
      ops.push({ updateOne: { filter: { _id: row._id }, update: { $set: { order: target } } } });
    }
  });
  if (ops.length > 0) await Category.bulkWrite(ops);
  return position;
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

  for (const field of ['name', 'synonyms', 'type']) {
    if (patch[field] !== undefined) {
      before[field] = cat[field];
      cat[field] = patch[field];
      after[field] = patch[field];
    }
  }
  if (patch.order !== undefined) {
    // Positional move — siblings shift around it (see resequenceSiblings).
    before.order = cat.order;
    cat.order = await resequenceSiblings(cat, Number(patch.order));
    after.order = cat.order;
  }
  if (Object.keys(after).length === 0) {
    throw AppError.badRequest('empty patch', 'Nothing to update.');
  }

  await saveCategory(cat);
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
  // `+publicId` — it is select:false, and we need the OLD asset id to clean up.
  const cat = await Category.findOne({ _id: id }).select('+publicId');
  if (!cat) throw AppError.notFound('category not found', 'Not found.');
  const previous = cat.publicId;
  const { url, publicId } = await uploadPublicImage({ buffer, folder: 'mpx/categories' });
  cat.image = url;
  cat.publicId = publicId;
  await saveCategory(cat);

  // Drop the replaced asset (review finding: every re-upload used to orphan one
  // on Cloudinary forever). Best-effort — a storage hiccup must not fail the
  // request, the local write has already succeeded.
  if (previous && previous !== publicId) {
    try {
      await deletePublicImage(previous);
    } catch (err) {
      logger.warn(
        { err: { name: err?.name, message: err?.message }, publicId: previous },
        'category image replace: old asset not deleted',
      );
    }
  }
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

// Both models' pre-validate hooks throw PLAIN Errors, and the central handler
// only honours `err.status` — so an unmapped throw becomes a 500 with no useful
// message. Map them to a 400 carrying our own (already safe) text. This also
// covers legacy/drifted rows: a pre-A16 sub with no `type` would otherwise 500
// on ANY save, including an unrelated image upload (review finding).
function mapModelError(err) {
  if (err?.code === 11000) {
    return AppError.conflict('duplicate key', 'An entry with this key already exists on this category.');
  }
  if (err?.name === 'ValidationError' || /^(CategoryAttribute|Category):/.test(String(err?.message))) {
    const clientMessage = String(err.message).replace(/^(CategoryAttribute|Category):\s*/, '');
    return AppError.badRequest(err.message, clientMessage);
  }
  return err;
}
const mapAttributeError = mapModelError;

// Every Category save goes through this, so no model-level rule can surface as
// a 500.
async function saveCategory(cat) {
  try {
    return await cat.save();
  } catch (err) {
    throw mapModelError(err);
  }
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
