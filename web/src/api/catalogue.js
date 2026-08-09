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

  /** Public browse. `category` and `seller` both accept an id or a slug. */
  products: (params) => apiClient.get('/public/products', { params }).then((r) => r.data),

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
  product: (idOrSlug) => ['catalogue', 'product', idOrSlug],
  exporter: (idOrSlug) => ['catalogue', 'exporter', idOrSlug],
};
