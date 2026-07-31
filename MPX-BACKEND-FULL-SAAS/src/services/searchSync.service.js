import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { buildSearchKeywords } from '../utils/searchKeywords.js';

/**
 * §A26 — keeps the denormalised search fields on Product truthful.
 *
 * The whole correctness story of M3's search lives here: a stale
 * `searchKeywords` means a renamed category (or a renamed company) silently
 * stops matching, with no error anywhere. Every write path that can invalidate
 * these values calls into this module, and each one has a test.
 *
 * Sync points:
 *   product create / edit  → searchFieldsFor()      (inline, single doc)
 *   category rename / synonyms edit → rebuildForCategory()
 *   organisation rename (A22, when built)           → rebuildForOrganisation()
 *   org verify / demote / country change            → §A23, verification.service
 */

// The values a single product should carry, given its leaf and owning org.
export function searchFieldsFor({ leaf, org, attributes = [] }) {
  return {
    searchKeywords: buildSearchKeywords({
      categoryName: leaf?.name,
      synonyms: leaf?.synonyms ?? [],
      attributes,
      sellerName: org?.name,
    }),
    categoryType: leaf?.type,
    topCategoryId: leaf?.parentId ?? null,
  };
}

// A product's keywords depend on its OWN attribute values, so a bulk rebuild
// cannot be a single updateMany — it batches through the affected rows and
// writes them in one bulkWrite per chunk. Both triggers are rare admin actions
// (a category rename, a company rename), so a bounded loop is the right cost.
const CHUNK = 500;

async function rebuild(filter) {
  const products = await Product.find(filter)
    .select('_id exporterOrgId categoryId attributes')
    .lean();
  if (products.length === 0) return { updated: 0 };

  // Load each distinct leaf and org once, not per product.
  const leafIds = [...new Set(products.map((p) => String(p.categoryId)))];
  const orgIds = [...new Set(products.map((p) => String(p.exporterOrgId)))];
  const [leaves, orgs] = await Promise.all([
    Category.find({ _id: { $in: leafIds } }).select('name synonyms type parentId').lean(),
    Organisation.find({ _id: { $in: orgIds } }).select('name').lean(),
  ]);
  const leafById = new Map(leaves.map((c) => [String(c._id), c]));
  const orgById = new Map(orgs.map((o) => [String(o._id), o]));

  let updated = 0;
  for (let i = 0; i < products.length; i += CHUNK) {
    const ops = products.slice(i, i + CHUNK).map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: {
          $set: searchFieldsFor({
            leaf: leafById.get(String(p.categoryId)),
            org: orgById.get(String(p.exporterOrgId)),
            attributes: p.attributes ?? [],
          }),
        },
      },
    }));
    // `timestamps: false` matters (caught by the idempotency test): Mongoose
    // otherwise stamps `updatedAt` on every bulkWrite row, so a single category
    // rename would mark thousands of untouched products as just-modified —
    // polluting the RECENCY leg of search ranking and every sitemap `lastmod`.
    // Rebuilding a derived index field is not a business modification.
    const res = await Product.bulkWrite(ops, { timestamps: false });
    updated += res.modifiedCount ?? 0;
  }
  return { updated };
}

/** Category renamed, or its `synonyms` edited (A12) — its products' corpus changed. */
export function rebuildForCategory(categoryId) {
  return rebuild({ categoryId });
}

/** Organisation renamed (A22 edit path) — the company name is in the corpus. */
export function rebuildForOrganisation(exporterOrgId) {
  return rebuild({ exporterOrgId });
}

/** Every product — used by the one-off backfill script. */
export function rebuildAll() {
  return rebuild({});
}
