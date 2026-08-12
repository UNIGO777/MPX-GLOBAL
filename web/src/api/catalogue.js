import { apiClient } from './client.js';

/**
 * M2 catalogue endpoints — the PUBLIC reads.
 *
 * No token is needed: a guest browses the catalogue (B7), and the server
 * excludes everything unavailable (draft · inactive · archived · taken down ·
 * deactivated category) **in the query**, so the client never filters a response
 * for availability. If a row came back, it is public.
 */
export const catalogueApi = {
  /**
   * The whole active tree: every top category with its `subs` nested.
   *
   * One call, because the browse grid needs each top's sub COUNT and a teaser of
   * its sub names, and neither is a field on a category — the public projection
   * is name/slug/image/parentId/type only. It also supplies the parent name and
   * sibling list on a category page, for the same reason.
   */
  tree: () => apiClient.get('/categories').then((r) => r.data.categories),

  /** One category by id OR slug. 404s for unknown, inactive, or a sub under a
   *  cascade-off top — deliberately indistinguishable from each other. */
  category: (idOrSlug) => apiClient.get(`/categories/${idOrSlug}`).then((r) => r.data.category),

  /** A category's form/spec field definitions, pre-sorted by `order`. */
  attributes: (idOrSlug) =>
    apiClient.get(`/categories/${idOrSlug}/attributes`).then((r) => r.data),

  /** Public browse — paging only, no filters (confirmed server-side: the
   *  `/public/products` schema accepts `category`/`seller`/`page`/`pageSize`
   *  and nothing else; zod strips anything more). `category`/`seller` both
   *  accept an id or a slug. Kept for surfaces that don't need filtering. */
  products: (params) => apiClient.get('/public/products', { params }).then((r) => r.data),

  /**
   * The filterable equivalent of `products` — same product projection, same
   * category resolution (`resolveCategoryLeafIds`, so a top page still
   * aggregates its children), same newest-first default. Adds `verifiedOnly`,
   * `priceMin`/`priceMax`, `sort`, and category-specific `attr[...]` filters.
   * `attr` keys must already be in the exact bracket form the backend wants —
   * `"attr[material]": "Cotton,Silk"` or `"attr[gsm][min]"`/`"attr[gsm][max]"`
   * — build them with `buildAttrParams` below, don't hand-roll a nested object
   * (axios's default param serialiser doesn't reliably bracket-encode nested
   * objects the way this API needs).
   *
   * 🔴 `attr[...]` is REJECTED (400) if `category` isn't also set — always
   * pass `category` on this page, which is true here by construction.
   */
  search: (params) => apiClient.get('/public/search', { params }).then((r) => r.data),

  /**
   * Facet definitions + LIVE counts for the current filter selection — same
   * query params as `search` (minus paging), literally the same validator on
   * the backend. `facets.attributes[]` is pre-filtered to `filterable: true`
   * already and carries counts, so it's the right source for the sidebar's
   * checkboxes — not `attributes()` above, which returns every
   * attribute (filterable or not) for the product FORM, with no counts. Each attribute's own
   * selection is excluded from ITS OWN option counts server-side (§A27.2) —
   * never recompute that client-side.
   */
  facets: (params) => apiClient.get('/public/facets', { params }).then((r) => r.data),

  /** Public product detail by id or slug. */
  product: (idOrSlug) =>
    apiClient.get(`/public/products/${idOrSlug}`).then((r) => r.data.product),

  /** Public seller profile — carries `productCount` (live listings only). */
  exporter: (idOrSlug) => apiClient.get(`/exporters/${idOrSlug}`).then((r) => r.data.exporter),
};

/** Query keys live with the endpoints so an invalidation can never mistype one. */
export const catalogueKeys = {
  tree: ['catalogue', 'tree'],
  category: (idOrSlug) => ['catalogue', 'category', idOrSlug],
  attributes: (idOrSlug) => ['catalogue', 'attributes', idOrSlug],
  products: (params) => ['catalogue', 'products', params],
  search: (params) => ['catalogue', 'search', params],
  facets: (params) => ['catalogue', 'facets', params],
  product: (idOrSlug) => ['catalogue', 'product', idOrSlug],
  exporter: (idOrSlug) => ['catalogue', 'exporter', idOrSlug],
};

/**
 * Builds the literal `"attr[key]"` / `"attr[key][min]"` / `"attr[key][max]"`
 * param entries `search`/`facets` need, from a plain selection object shaped
 * `{ [attrKey]: string[] }` (checkbox/select attributes — joined with a comma
 * for OR, per the API contract) or `{ [attrKey]: { min?, max? } }` (number
 * attributes). Literal bracket keys, not a nested object — axios's default
 * param serialiser doesn't reliably bracket-encode nested objects, and this
 * API's contract is exact ASCII brackets in the query string.
 */
export function buildAttrParams(selections = {}) {
  const params = {};
  for (const [key, val] of Object.entries(selections)) {
    if (val == null) continue;
    if (Array.isArray(val)) {
      if (val.length > 0) params[`attr[${key}]`] = val.join(',');
    } else if (typeof val === 'object') {
      if (val.min != null && val.min !== '') params[`attr[${key}][min]`] = val.min;
      if (val.max != null && val.max !== '') params[`attr[${key}][max]`] = val.max;
    }
  }
  return params;
}
