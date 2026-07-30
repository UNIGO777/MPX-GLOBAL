import * as svc from '../services/publicProducts.service.js';
import { toPublic } from '../utils/toPublic.js';
import {
  PUBLIC_FIELDS as PRODUCT_PUBLIC_FIELDS,
  PUBLIC_DERIVED as PRODUCT_PUBLIC_DERIVED,
} from '../models/Product.js';
import {
  PUBLIC_FIELDS as CATEGORY_PUBLIC_FIELDS,
  PUBLIC_DERIVED as CATEGORY_PUBLIC_DERIVED,
} from '../models/Category.js';
import {
  PUBLIC_FIELDS as ORG_PUBLIC_FIELDS,
  PUBLIC_DERIVED as ORG_PUBLIC_DERIVED,
} from '../models/Organisation.js';

// One composed public product view: the product's own whitelist + a category
// block + the seller's public projection (never the raw Organisation — 5c.3).
// Every block goes through the ONE shared toPublic() (A3).
function publicProductView(product, { categories, organisations }) {
  const category = categories.get(String(product.categoryId));
  const org = organisations.get(String(product.exporterOrgId));
  return {
    ...toPublic(product, { fields: PRODUCT_PUBLIC_FIELDS, derived: PRODUCT_PUBLIC_DERIVED }),
    category: category
      ? toPublic(category, { fields: CATEGORY_PUBLIC_FIELDS, derived: CATEGORY_PUBLIC_DERIVED })
      : null,
    seller: org ? toPublic(org, { fields: ORG_PUBLIC_FIELDS, derived: ORG_PUBLIC_DERIVED }) : null,
  };
}

export async function listPublic(req, res) {
  const { rows, total, page, pageSize } = await svc.listPublicProducts(req.validated.query);
  const context = await svc.loadProjectionContext(rows);
  res.json({ products: rows.map((p) => publicProductView(p, context)), total, page, pageSize });
}

export async function getPublic(req, res) {
  const product = await svc.getPublicProduct(req.params.idOrSlug);
  const context = await svc.loadProjectionContext([product]);
  res.json({ product: publicProductView(product, context) });
}
