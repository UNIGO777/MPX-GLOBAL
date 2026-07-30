import mongoose from 'mongoose';

import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { getActiveLeafIds } from './category.service.js';

// M2 public browse + detail (the full search engine is M3). Availability is
// enforced IN THE QUERY (m3-public-projection rule): only `status: 'active'`,
// not taken down, and sitting in an active leaf under an active top. B7: no
// verification filter of any kind.
//
// Known, accepted gap (F1-B): a BLOCKED org's products stay visible here until
// the FINALIZE products-cascade lands — deliberately no org.isActive filter.

const isObjectId = (v) => mongoose.isValidObjectId(v) && /^[a-fA-F0-9]{24}$/.test(String(v));
const idOrSlugFilter = (v) => (isObjectId(v) ? { _id: v } : { slug: String(v).toLowerCase() });

async function availabilityFilter() {
  const leafIds = await getActiveLeafIds();
  return {
    status: 'active',
    'takedown.isDown': { $ne: true },
    categoryId: { $in: leafIds },
  };
}

// category param accepts a top or a leaf, by id or slug; resolves to leaf ids.
async function resolveCategoryLeafIds(idOrSlug) {
  const cat = await Category.findOne({ ...idOrSlugFilter(idOrSlug), active: true }).select('_id parentId').lean();
  if (!cat) return []; // unknown/inactive category → empty result, not an oracle
  if (cat.parentId) return [cat._id];
  const subs = await Category.find({ parentId: cat._id, active: true }).select('_id').lean();
  return subs.map((s) => s._id);
}

export async function listPublicProducts({ category, seller, page, pageSize }) {
  const filter = await availabilityFilter();

  if (category !== undefined) {
    const leafIds = await resolveCategoryLeafIds(category);
    const allowed = new Set(filter.categoryId.$in.map(String));
    filter.categoryId = { $in: leafIds.filter((id) => allowed.has(String(id))) };
  }

  if (seller !== undefined) {
    const org = await Organisation.findOne(idOrSlugFilter(seller)).select('_id').lean();
    if (!org) return { rows: [], total: 0, page, pageSize };
    filter.exporterOrgId = org._id;
  }

  const [rows, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return { rows, total, page, pageSize };
}

// Detail accepts id OR slug (SEO §1 serves /product/:slug). The same
// availability filter applies in the query — anything non-public is a plain 404.
export async function getPublicProduct(idOrSlug) {
  const filter = { ...(await availabilityFilter()), ...idOrSlugFilter(idOrSlug) };
  const product = await Product.findOne(filter).lean();
  if (!product) throw AppError.notFound('product not public', 'Not found.');
  return product;
}

// Batch context for composing the category + seller blocks onto product rows.
export async function loadProjectionContext(products) {
  const catIds = [...new Set(products.map((p) => String(p.categoryId)))];
  const orgIds = [...new Set(products.map((p) => String(p.exporterOrgId)))];
  const [cats, orgs] = await Promise.all([
    Category.find({ _id: { $in: catIds } }).lean(),
    Organisation.find({ _id: { $in: orgIds } }).lean(),
  ]);
  return {
    categories: new Map(cats.map((c) => [String(c._id), c])),
    organisations: new Map(orgs.map((o) => [String(o._id), o])),
  };
}

// §9b — the seller-profile product count: LIVE listings only (taken-down
// excluded, same shape as the D1 cap query).
export function countActiveProducts(exporterOrgId) {
  return Product.countDocuments({
    exporterOrgId,
    status: 'active',
    'takedown.isDown': { $ne: true },
  });
}
