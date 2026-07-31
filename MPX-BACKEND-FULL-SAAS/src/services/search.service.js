import { Product } from '../models/Product.js';
import { Organisation } from '../models/Organisation.js';
import { buildPublicProductFilter, buildSortStages } from './search.query.js';

/**
 * M3-B — the one engine (§A26: native MongoDB `$text`, never Atlas `$search`).
 *
 * Pipeline order is load-bearing and must not be reordered:
 *   $match (with $text FIRST — Mongo requires it in the first stage)
 *     → $addFields _score ({ $meta: 'textScore' } cannot be read after $facet)
 *       → sort stages → $facet rows+total
 */

// Products path -----------------------------------------------------------

export async function searchProducts({ q, page, pageSize, sort, ...params }) {
  const { filter } = await buildPublicProductFilter(params);
  if (filter === null) return { rows: [], total: 0, page, pageSize };

  const hasText = Boolean(q);
  const match = hasText ? { ...filter, $text: { $search: q } } : filter;

  const pipeline = [{ $match: match }];
  if (hasText) pipeline.push({ $addFields: { _score: { $meta: 'textScore' } } });
  pipeline.push(...buildSortStages({ sort, currency: params.currency, hasText }));
  pipeline.push({
    $facet: {
      rows: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
      total: [{ $count: 'count' }],
    },
  });

  const [result] = await Product.aggregate(pipeline);
  return {
    rows: result.rows,
    total: result.total[0]?.count ?? 0,
    page,
    pageSize,
  };
}

// Suppliers path (§A27.3) -------------------------------------------------
// Matches company name + description ONLY — never the seller's products (that
// was considered and rejected). Filters are narrow by design: country and
// verified-only, because a cancelled "working categories" (§A22.5) means an
// Organisation has no category, price or MOQ of its own.

export async function searchSuppliers({ q, page, pageSize, sort, country, verifiedOnly }) {
  const filter = { exporterSide: true, isActive: true };
  if (country) filter.country = country.toUpperCase();
  // B7: verification is a query condition ONLY on the buyer's explicit opt-in.
  if (verifiedOnly) filter.kycStatus = 'verified';

  const hasText = Boolean(q);
  const match = hasText ? { ...filter, $text: { $search: q } } : filter;

  const pipeline = [{ $match: match }];
  if (hasText) pipeline.push({ $addFields: { _score: { $meta: 'textScore' } } });
  pipeline.push(
    sort === 'newest' || !hasText
      ? { $sort: { createdAt: -1, _id: -1 } }
      : { $sort: { _score: -1, createdAt: -1, _id: -1 } },
  );
  pipeline.push({
    $facet: {
      rows: [
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
        // productCount batched for the whole page — never one countDocuments per
        // seller. "Live listings only", same shape as the D1 cap query.
        {
          $lookup: {
            from: 'products',
            let: { orgId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$exporterOrgId', '$$orgId'] },
                  status: 'active',
                  'takedown.isDown': { $ne: true },
                },
              },
              { $count: 'count' },
            ],
            as: '_products',
          },
        },
        { $addFields: { productCount: { $ifNull: [{ $first: '$_products.count' }, 0] } } },
      ],
      total: [{ $count: 'count' }],
    },
  });

  const [result] = await Organisation.aggregate(pipeline);
  return {
    rows: result.rows,
    total: result.total[0]?.count ?? 0,
    page,
    pageSize,
  };
}
