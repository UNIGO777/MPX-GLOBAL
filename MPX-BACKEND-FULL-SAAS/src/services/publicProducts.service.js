import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { idOrSlugFilter } from '../utils/idOrSlug.js';
import { buildAvailabilityFilter, buildPublicProductFilter } from './search.query.js';

// M2 public browse + detail (the full search engine is M3). Availability is
// enforced IN THE QUERY (m3-public-projection rule): only `status: 'active'`,
// not taken down, and sitting in an active leaf under an active top. B7: no
// verification filter of any kind.
//
// Known, accepted gap (F1-B): a BLOCKED org's products stay visible here until
// the FINALIZE products-cascade lands — deliberately no org.isActive filter.

// §A27.4: browse compiles its filter through the SHARED builder, so the
// availability rules can never drift from search. Its param set stays exactly
// what M2 shipped — category, seller, page, pageSize — nothing more.
export async function listPublicProducts({ category, seller, page, pageSize }) {
  const { filter } = await buildPublicProductFilter({ category, seller });
  if (filter === null) return { rows: [], total: 0, page, pageSize };

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
  const filter = { ...(await buildAvailabilityFilter()), ...idOrSlugFilter(idOrSlug) };
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
