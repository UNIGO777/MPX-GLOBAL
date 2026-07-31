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

/**
 * The ONE composed public product shape — browse, detail and search all return
 * exactly this (A3). A search result is never a richer object than a browse
 * result; keeping a single view is what guarantees that.
 *
 * Every block goes through the shared `toPublic()` whitelist: the product's own
 * fields, a category block, and the seller's PUBLIC projection (never the raw
 * Organisation — m3.md §5c.3).
 */
export function publicProductView(product, { categories, organisations }) {
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
