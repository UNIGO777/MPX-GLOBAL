import * as svc from '../services/category.service.js';
import { PUBLIC_FIELDS, PUBLIC_DERIVED } from '../models/Category.js';
import { toPublic } from '../utils/toPublic.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

const pub = (cat) => toPublic(cat, { fields: PUBLIC_FIELDS, derived: PUBLIC_DERIVED });

// The dynamic-form/facet shape of an attribute. `order` drives the sort but is
// not returned (rows arrive pre-sorted).
function attributeView(attr) {
  return {
    key: attr.key,
    name: attr.name,
    inputType: attr.inputType,
    options: attr.options ?? [],
    unit: attr.unit ?? null,
    required: attr.required,
    filterable: attr.filterable,
  };
}

// The staff view of an attribute: the form/facet shape PLUS the two fields the
// manager screen cannot work without — `id` (the PATCH/DELETE :attrId target)
// and `order` (the sort the admin edits).
//
// 🔴 A separate function on purpose. `attributeView` above also serves the
// PUBLIC /categories/:idOrSlug/attributes, and m3-public-projection.md keeps
// internal ids off public routes — so these two fields must never be folded
// into it "to avoid duplication".
function adminAttributeView(attr) {
  return { ...attributeView(attr), id: String(attr._id), order: attr.order };
}

// Admin tree view — includes what the public projection deliberately hides
// (inactive rows, prevActive, synonyms, order). Staff-only route; still a
// curated shape, never raw documents.
function adminCategoryView(cat) {
  return {
    id: String(cat._id),
    name: cat.name,
    slug: cat.slug,
    parentId: cat.parentId ? String(cat.parentId) : null,
    type: cat.type ?? null,
    active: cat.active,
    prevActive: cat.prevActive ?? null,
    order: cat.order,
    image: cat.image ?? null,
    synonyms: cat.synonyms ?? [],
    ...(cat.attributeCount !== undefined ? { attributeCount: cat.attributeCount } : {}),
    createdAt: cat.createdAt,
  };
}

// --- public reads --------------------------------------------------------------

export async function getTree(_req, res) {
  const tree = await svc.getPublicTree();
  res.json({
    categories: tree.map(({ top, subs }) => ({ ...pub(top), subs: subs.map(pub) })),
  });
}

export async function getTops(_req, res) {
  const tops = await svc.getTopCategories();
  res.json({ categories: tops.map(pub) });
}

export async function getSubcategories(req, res) {
  const subs = await svc.getSubcategories(req.params.parentId);
  res.json({ categories: subs.map(pub) });
}

export async function getCategory(req, res) {
  const cat = await svc.getPublicCategory(req.params.idOrSlug);
  res.json({ category: pub(cat) });
}

export async function getAttributes(req, res) {
  const { category, attributes } = await svc.getPublicCategoryAttributes(req.params.idOrSlug);
  res.json({ category: pub(category), attributes: attributes.map(attributeView) });
}

// --- admin ---------------------------------------------------------------------

export async function getAdminTree(_req, res) {
  const tree = await svc.getAdminTree();
  res.json({
    categories: tree.map(({ top, subs }) => ({ ...adminCategoryView(top), subs: subs.map(adminCategoryView) })),
  });
}

export async function getAdminAttributes(req, res) {
  const { category, attributes } = await svc.getAdminCategoryAttributes(req.params.id);
  res.json({ category: adminCategoryView(category), attributes: attributes.map(adminAttributeView) });
}

export async function toggle(req, res) {
  const cat = await svc.toggleCategory({ id: req.params.id, actor: req.user, meta: meta(req) });
  res.json({ category: adminCategoryView(cat) });
}

export async function createSub(req, res) {
  const cat = await svc.createSubCategory({ ...req.body, actor: req.user, meta: meta(req) });
  res.status(201).json({ category: adminCategoryView(cat) });
}

export async function update(req, res) {
  const cat = await svc.updateCategory({ id: req.params.id, patch: req.body, actor: req.user, meta: meta(req) });
  res.json({ category: adminCategoryView(cat) });
}

export async function remove(req, res) {
  await svc.deleteCategory({ id: req.params.id, actor: req.user, meta: meta(req) });
  res.json({ ok: true });
}

export async function uploadImage(req, res) {
  if (!req.file) {
    res.status(400).json({ error: { message: 'No file was uploaded (field "image").', requestId: req.id } });
    return;
  }
  const cat = await svc.setCategoryImage({
    id: req.params.id,
    buffer: req.file.buffer,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ category: adminCategoryView(cat) });
}

export async function createAttribute(req, res) {
  const attr = await svc.createAttribute({
    categoryId: req.params.id,
    def: req.body,
    actor: req.user,
    meta: meta(req),
  });
  res.status(201).json({ attribute: { ...attributeView(attr), id: String(attr._id) } });
}

export async function updateAttribute(req, res) {
  const attr = await svc.updateAttribute({
    categoryId: req.params.id,
    attrId: req.params.attrId,
    patch: req.body,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ attribute: { ...attributeView(attr), id: String(attr._id) } });
}

export async function deleteAttribute(req, res) {
  await svc.deleteAttribute({
    categoryId: req.params.id,
    attrId: req.params.attrId,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ ok: true });
}
