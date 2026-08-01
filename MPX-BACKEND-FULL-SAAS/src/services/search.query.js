import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { idOrSlugFilter } from '../utils/idOrSlug.js';
import { getActiveLeafIds } from './category.service.js';

/**
 * §A27.4 — the ONE query builder behind both public product surfaces:
 * M2's `/public/products` browse and M3's `/public/search`. Sharing it is the
 * point: the availability rules can never drift between the two.
 *
 * Availability is enforced IN THE QUERY (m3-public-projection rule), never by
 * filtering a response: only `status: 'active'`, not taken down, and sitting in
 * an active leaf under an active top.
 *
 * ✅ The old "blocked org's products stay visible" gap is CLOSED (F1-B, 2026-08-01)
 * — and still with no org filter here. The cascade puts every product of a
 * blocked company into `takedown`, so `takedown.isDown` already excludes them.
 * Do not add an org join to "fix" it: that would cost a lookup on the hottest
 * query on the platform to re-derive a fact the takedown flag already carries.
 */

export async function buildAvailabilityFilter() {
  return {
    status: 'active',
    'takedown.isDown': { $ne: true },
    categoryId: { $in: await getActiveLeafIds() },
  };
}

// A category param may name a TOP or a LEAF, by id or slug. Returns the leaf ids
// it covers — intersected with the active set by the caller.
export async function resolveCategoryLeafIds(idOrSlug) {
  const cat = await Category.findOne({ ...idOrSlugFilter(idOrSlug), active: true })
    .select('_id parentId')
    .lean();
  if (!cat) return []; // unknown/inactive → empty result, never an oracle
  if (cat.parentId) return [cat._id];
  const subs = await Category.find({ parentId: cat._id, active: true }).select('_id').lean();
  return subs.map((s) => s._id);
}

/**
 * Compile the public filter params into one Mongo filter.
 *
 * `params` (all optional): category · seller · country · currency · priceMin ·
 * priceMax · onRequest · moqMin · goodsOrService · verifiedOnly · attributes
 * (already validated: [{ key, values?, min?, max? }]).
 *
 * §A27.1 — the price range is CURRENCY-SCOPED: `priceMin/Max` only ever apply
 * together with a currency (the validator defaults it to INR), because Phase 1
 * has no FX conversion and comparing 100 USD to a 100–500 INR range is wrong.
 */
export async function buildPublicProductFilter(params = {}) {
  const filter = await buildAvailabilityFilter();
  const and = [];

  if (params.category !== undefined) {
    const requested = await resolveCategoryLeafIds(params.category);
    const active = new Set(filter.categoryId.$in.map(String));
    filter.categoryId = { $in: requested.filter((id) => active.has(String(id))) };
  }

  if (params.seller !== undefined) {
    const org = await Organisation.findOne(idOrSlugFilter(params.seller)).select('_id').lean();
    if (!org) return { filter: null }; // unknown seller → empty result set
    filter.exporterOrgId = org._id;
  }

  if (params.country) filter.sellerCountry = params.country.toUpperCase();
  if (params.goodsOrService) filter.categoryType = params.goodsOrService;
  if (params.verifiedOnly) filter.sellerVerified = true; // opt-in ONLY (B7 carve-out)

  // Price: on-request listings carry no number, so a range must not silently
  // drop them — `onRequest` is its own toggle (M2↔M3 fix).
  const hasRange = params.priceMin !== undefined || params.priceMax !== undefined;
  if (params.onRequest === true) {
    and.push({ 'price.mode': 'on_request' });
  } else if (hasRange) {
    const bounds = {};
    if (params.priceMin !== undefined) bounds.$gte = params.priceMin;
    if (params.priceMax !== undefined) bounds.$lte = params.priceMax;
    and.push({ 'price.currency': params.currency, 'price.min': bounds });
  }

  if (params.moqMin !== undefined) and.push({ moq: { $gte: params.moqMin } });

  // OR within one attribute group, AND across groups — one $elemMatch per key so
  // key and value must match on the SAME array element.
  for (const attr of params.attributes ?? []) {
    const match = { key: attr.key };
    if (attr.values) match.value = { $in: attr.values };
    else {
      const bounds = {};
      if (attr.min !== undefined) bounds.$gte = attr.min;
      if (attr.max !== undefined) bounds.$lte = attr.max;
      match.value = bounds;
    }
    and.push({ attributes: { $elemMatch: match } });
  }

  if (and.length > 0) filter.$and = and;
  return { filter };
}

/**
 * Sort stage. §A27.1's currency problem applies to SORTING too: `100 USD` and
 * `100 INR` cannot be ordered against each other, and on-request listings have
 * no price at all. So a price sort NEVER changes the result set — it orders in
 * three tiers: selected currency → other currencies → on-request.
 *
 * `hasText` adds the relevance leg; without a query there is no textScore.
 */
export function buildSortStages({ sort, currency, hasText }) {
  if (sort === 'newest') return [{ $sort: { createdAt: -1, _id: -1 } }];

  if (sort === 'priceAsc' || sort === 'priceDesc') {
    const direction = sort === 'priceAsc' ? 1 : -1;
    return [
      {
        $addFields: {
          _priceTier: {
            $cond: [
              { $eq: ['$price.mode', 'on_request'] },
              2,
              { $cond: [{ $eq: ['$price.currency', currency] }, 0, 1] },
            ],
          },
        },
      },
      { $sort: { _priceTier: 1, 'price.min': direction, createdAt: -1, _id: -1 } },
    ];
  }

  // relevance (default): textScore → verified boost → recency → completeness.
  // Without a text query there is no score, so it degrades to newest-first.
  if (!hasText) return [{ $sort: { sellerVerified: -1, createdAt: -1, _id: -1 } }];
  return [
    {
      $addFields: {
        _completeness: {
          $add: [
            { $cond: [{ $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] }, 1, 0] },
            { $cond: [{ $ifNull: ['$description', false] }, 1, 0] },
            { $cond: [{ $gt: [{ $size: { $ifNull: ['$attributes', []] } }, 0] }, 1, 0] },
          ],
        },
      },
    },
    {
      $sort: {
        _score: -1,
        sellerVerified: -1,
        createdAt: -1,
        _completeness: -1,
        _id: -1,
      },
    },
  ];
}
