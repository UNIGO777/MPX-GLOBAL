import * as svc from '../services/search.service.js';
import * as svcAi from '../services/aiSearch.service.js';
import { consumeAiQuota } from '../services/aiQuota.service.js';
import { getFacets } from '../services/facets.service.js';
import { suggest } from '../services/didYouMean.service.js';
import { resolveCategoryLeafIds } from '../services/search.query.js';
import { loadProjectionContext } from '../services/publicProducts.service.js';
import { publicProductView } from '../views/publicProduct.view.js';
import { CategoryAttribute } from '../models/CategoryAttribute.js';
import { AppError } from '../utils/AppError.js';
import { toPublic } from '../utils/toPublic.js';
import { PUBLIC_FIELDS as ORG_FIELDS, PUBLIC_DERIVED as ORG_DERIVED } from '../models/Organisation.js';
import { resolveAttributeFilters } from '../validators/search.validators.js';

// Attribute filters can only be validated against the SELECTED category's
// definitions, so the resolution happens here (it needs a DB read) and turns a
// bad key into a clean 400.
async function attributeFilters(query) {
  if (!query.attr) return [];
  if (!query.category) {
    throw AppError.badRequest('attr without category', 'Pick a category before filtering by specification.');
  }
  const leafIds = await resolveCategoryLeafIds(query.category);
  const defs = await CategoryAttribute.find({ categoryId: { $in: leafIds } }).lean();
  try {
    return resolveAttributeFilters(query.attr, defs);
  } catch (err) {
    throw AppError.badRequest(err.message, err.clientMessage ?? 'Invalid filter.');
  }
}

export async function aiSearch(req, res) {
  // Per-organisation daily cap (guests: the per-IP limiter covers them).
  await consumeAiQuota(req.user?.orgId);

  const { answer, message, extracted, results, target, fallback } = await svcAi.aiSearch({ query: req.body.query });

  if (target === 'supplier') {
    res.json({
      answer,
      message,
      extracted,
      fallback,
      type: 'supplier',
      suppliers: results.rows.map((org) => ({
        ...toPublic(org, { fields: ORG_FIELDS, derived: ORG_DERIVED }),
        productCount: org.productCount ?? 0,
      })),
      total: results.total,
    });
    return;
  }

  const context = await loadProjectionContext(results.rows);
  res.json({
    answer,
    message,
    extracted,
    fallback,
    type: 'product',
    products: results.rows.map((p) => publicProductView(p, context)),
    total: results.total,
    // The same rescue applies after an AI fallback that found nothing — the
    // buyer gets identical help whichever entry point they used.
    didYouMean: results.total === 0 ? await suggest(req.body.query) : null,
  });
}

export async function facets(req, res) {
  const query = req.validated.query;
  const attributes = query.type === 'supplier' ? [] : await attributeFilters(query);
  res.json({ type: query.type, facets: await getFacets({ ...query, attributes }) });
}

export async function search(req, res) {
  const query = req.validated.query;

  if (query.type === 'supplier') {
    const { rows, total, page, pageSize } = await svc.searchSuppliers(query);
    res.json({
      type: 'supplier',
      suppliers: rows.map((org) => ({
        ...toPublic(org, { fields: ORG_FIELDS, derived: ORG_DERIVED }),
        productCount: org.productCount ?? 0,
      })),
      total,
      page,
      pageSize,
    });
    return;
  }

  const attributes = await attributeFilters(query);
  const { rows, total, page, pageSize } = await svc.searchProducts({ ...query, attributes });
  const context = await loadProjectionContext(rows);
  res.json({
    type: 'product',
    products: rows.map((p) => publicProductView(p, context)),
    total,
    page,
    pageSize,
    // M3-G: only on a ZERO-result keyword query — native $text has no typo
    // tolerance, so this is the (deliberately narrow) rescue.
    didYouMean: total === 0 && query.q ? await suggest(query.q) : null,
  });
}
