import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { CategoryAttribute } from '../models/CategoryAttribute.js';
import { buildPublicProductFilter, resolveCategoryLeafIds } from './search.query.js';
import { idOrSlugFilter } from '../utils/idOrSlug.js';

/**
 * M3-C — available filters + counts for the CURRENT query.
 *
 * §A27.2: every facet group's counts are computed with all filters applied
 * **except that group's own**, so a buyer can see what choosing a different
 * option would yield (choosing "Cotton" must not make "Silk" read 0). That is
 * one small aggregation per group; the result LIST itself has all filters.
 */

// Build the filter for one group by dropping that group's own params.
function without(params, keys) {
  const copy = { ...params };
  for (const key of keys) delete copy[key];
  return copy;
}

async function countBy(params, drop, field) {
  const { filter } = await buildPublicProductFilter(without(params, drop));
  if (filter === null) return [];
  const rows = await Product.aggregate([
    { $match: withText(filter, params.q) },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.filter((r) => r._id !== null && r._id !== undefined);
}

// `$text` must live in the first $match — never inside $or, never later.
function withText(filter, q) {
  return q ? { ...filter, $text: { $search: q } } : filter;
}

async function boundsOf(params, drop, field, extra = {}) {
  const { filter } = await buildPublicProductFilter(without(params, drop));
  if (filter === null) return null;
  const [row] = await Product.aggregate([
    { $match: { ...withText(filter, params.q), ...extra } },
    { $group: { _id: null, min: { $min: `$${field}` }, max: { $max: `$${field}` } } },
  ]);
  return row && row.min !== null ? { min: row.min, max: row.max } : null;
}

// Which attributes to offer, and their shape.
async function attributeFacets(params) {
  if (!params.category) return []; // no category → no dynamic facets (memo H2)

  const leafIds = await resolveCategoryLeafIds(params.category);
  if (leafIds.length === 0) return [];

  const defs = await CategoryAttribute.find({ categoryId: { $in: leafIds }, filterable: true })
    .sort({ order: 1 })
    .lean();

  // A TOP covers several leaves: show the INTERSECTION of their filterable keys.
  // A union would list attributes most visible products cannot have, so nearly
  // every option would read 0 and the panel would look broken.
  let keys = [...new Set(defs.map((d) => d.key))];
  if (leafIds.length > 1) {
    // Seed the map with EVERY leaf, not just the ones that happen to define an
    // attribute (review fix): a leaf with no filterable attributes must still
    // veto a key, otherwise a top would offer a filter that half of its visible
    // products can never satisfy.
    const byLeaf = new Map(leafIds.map((id) => [String(id), new Set()]));
    for (const def of defs) {
      byLeaf.get(String(def.categoryId))?.add(def.key);
    }
    keys = keys.filter((key) => [...byLeaf.values()].every((set) => set.has(key)));
  }

  const out = [];
  for (const key of keys) {
    const def = defs.find((d) => d.key === key);
    // Exclude ONLY this attribute's own selection (§A27.2), keeping the others.
    const scoped = {
      ...params,
      attributes: (params.attributes ?? []).filter((a) => a.key !== key),
    };
    const { filter } = await buildPublicProductFilter(scoped);
    if (filter === null) continue;

    if (def.inputType === 'number') {
      const [row] = await Product.aggregate([
        { $match: withText(filter, params.q) },
        { $unwind: '$attributes' },
        { $match: { 'attributes.key': key } },
        { $group: { _id: null, min: { $min: '$attributes.value' }, max: { $max: '$attributes.value' } } },
      ]);
      if (row) out.push({ key, name: def.name, inputType: 'number', unit: def.unit ?? null, bounds: { min: row.min, max: row.max } });
      continue;
    }

    const rows = await Product.aggregate([
      { $match: withText(filter, params.q) },
      { $unwind: '$attributes' },
      { $match: { 'attributes.key': key } },
      { $group: { _id: '$attributes.value', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);
    out.push({
      key,
      name: def.name,
      inputType: def.inputType,
      unit: def.unit ?? null,
      options: rows.map((r) => ({ value: r._id, count: r.count })),
    });
  }
  return out;
}

async function productFacets(params) {
  // The category facet always answers "where can I go next".
  //  - nothing selected → the TOP categories, counted across the whole catalogue
  //  - a top OR a leaf selected → that branch's LEAVES, scoped to the branch
  //
  // Review fix: this used to switch on `leafIds.length > 1`, so a top holding
  // exactly one sub-category behaved as if a leaf had been selected. Decide from
  // what the category actually IS, never from how many children it has.
  const selected = params.category
    ? await Category.findOne({ ...idOrSlugFilter(params.category), active: true })
        .select('_id parentId')
        .lean()
    : null;

  let categoryField = 'topCategoryId';
  let categoryParams = without(params, ['category']);
  if (selected) {
    categoryField = 'categoryId';
    // Keep the branch, drop only the leaf-level choice — otherwise the drill-down
    // would list leaves belonging to entirely unrelated top categories.
    categoryParams = { ...params, category: String(selected.parentId ?? selected._id) };
  }

  const [categoryRows, subCategoryRows, countryRows, typeRows, verifiedRows, price, moq, attributes] = await Promise.all([
    countBy(categoryParams, [], categoryField),
    // 2026-08-16 (owner): the search rail shows related SUB-categories
    // directly, so leaf-level counts are exposed alongside the drill-down
    // facet above. Category dropped from the scope (like the top-level case)
    // so a selected branch still shows its related siblings.
    countBy(without(params, ['category']), [], 'categoryId'),
    countBy(params, ['country'], 'sellerCountry'),
    countBy(params, ['goodsOrService'], 'categoryType'),
    countBy(params, ['verifiedOnly'], 'sellerVerified'),
    // §A27.1 — price bounds are ALWAYS scoped to one currency; never bucket across.
    boundsOf(params, ['priceMin', 'priceMax', 'onRequest'], 'price.min', {
      'price.currency': params.currency,
    }),
    boundsOf(params, ['moqMin'], 'moq'),
    attributeFacets(params),
  ]);

  const categoryIds = [...categoryRows.map((r) => r._id), ...subCategoryRows.map((r) => r._id)];
  const categories = await Category.find({ _id: { $in: categoryIds } }).select('name slug').lean();
  const byId = new Map(categories.map((c) => [String(c._id), c]));

  // Goods-only facets do not render for a service category (memo H/plan M3-C).
  const isServiceOnly = params.goodsOrService === 'service';

  return {
    category: categoryRows
      .filter((r) => byId.has(String(r._id)))
      .map((r) => ({
        id: String(r._id),
        name: byId.get(String(r._id)).name,
        slug: byId.get(String(r._id)).slug,
        count: r.count,
      })),
    // Leaf-level counts for the "related subcategories" rails (search +
    // AI-search). Same public fields as `category` — name/slug/count only.
    subCategory: subCategoryRows
      .filter((r) => byId.has(String(r._id)))
      .map((r) => ({
        id: String(r._id),
        name: byId.get(String(r._id)).name,
        slug: byId.get(String(r._id)).slug,
        count: r.count,
      })),
    country: countryRows.map((r) => ({ value: r._id, count: r.count })),
    goodsOrService: typeRows.map((r) => ({ value: r._id, count: r.count })),
    verified: verifiedRows.map((r) => ({ value: Boolean(r._id), count: r.count })),
    // The currency is echoed so the UI can label the slider honestly.
    price: price ? { ...price, currency: params.currency } : null,
    moq: isServiceOnly ? null : moq,
    attributes,
  };
}

async function supplierFacets(params) {
  // §A27.3: an Organisation has no category, price or MOQ of its own, so the
  // supplier panel is deliberately just these two.
  const base = { exporterSide: true, isActive: true };
  const withQ = (extra = {}) => ({
    ...base,
    ...extra,
    ...(params.q ? { $text: { $search: params.q } } : {}),
  });

  const [countryRows, verifiedRows] = await Promise.all([
    Organisation.aggregate([
      { $match: withQ(params.verifiedOnly ? { kycStatus: 'verified' } : {}) },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    Organisation.aggregate([
      { $match: withQ(params.country ? { country: params.country.toUpperCase() } : {}) },
      { $group: { _id: { $eq: ['$kycStatus', 'verified'] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    country: countryRows.filter((r) => r._id).map((r) => ({ value: r._id, count: r.count })),
    verified: verifiedRows.map((r) => ({ value: Boolean(r._id), count: r.count })),
  };
}

export function getFacets(params) {
  return params.type === 'supplier' ? supplierFacets(params) : productFacets(params);
}
