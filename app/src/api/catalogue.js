import { apiClient } from './client.js';

/**
 * M2 catalogue — public reads (mirrors `web/src/api/catalogue.js`). No token
 * required: a guest browses the catalogue (B7), and the server excludes
 * everything unavailable (draft/inactive/archived/taken-down/deactivated
 * category) IN THE QUERY — the client never filters a response for
 * availability.
 *
 * `tree` lands with screen 1 (Category browse). `search` added 2026-08-17 for
 * the Home screen's real-data carousels ("Recently Listed" / "Verified
 * Suppliers") — same `GET /public/search` endpoint the web app uses, not a
 * separate app-only query. The rest of the set (`category`, `product`,
 * `exporter`) still lands with screens 2–4 (product detail / supplier profile
 * aren't built yet — see the Home screen's own note on why those cards are
 * non-interactive for now).
 */
export const catalogueApi = {
  /**
   * The whole active tree: every top category with its `subs` nested.
   * One call — the browse picker needs each top's sub list, and that's not a
   * field on a category by itself (the public projection is
   * name/slug/image/parentId/type only).
   */
  tree: () => apiClient.get('/categories').then((r) => r.data.categories),

  /**
   * Chunked tree (2026-08-17) — same endpoint with `?limit/offset`, returning
   * `{ categories, total, offset, limit, hasMore }`. The browse screen loads
   * tops in pages as the user scrolls instead of all 40 up front; chunks are
   * whole tops (each with ALL its subs) — the server never pages subs away.
   */
  treeChunk: (params) => apiClient.get('/categories', { params }).then((r) => r.data),

  /** Public product detail by id or slug (M2 screen 3) — same projection the
   *  web detail page renders; 404 covers every unavailable case
   *  indistinguishably (draft/hidden/archived/taken down/dead category). */
  product: (idOrSlug) => apiClient.get(`/public/products/${idOrSlug}`).then((r) => r.data.product),

  /** A category's attribute DEFINITIONS (labels/units per key) — the product
   *  payload carries `{key, value}` snapshots only; labels live on the
   *  category (same split web's SpecTable documents). */
  categoryAttributes: (idOrSlug) =>
    apiClient.get(`/categories/${idOrSlug}/attributes`).then((r) => r.data.attributes),

  /** Public exporter/supplier profile by id or slug (M2 screen 4) — the B7
   *  whitelist projection incl. `productCount` (live listings only). */
  exporter: (idOrSlug) => apiClient.get(`/exporters/${idOrSlug}`).then((r) => r.data.exporter),

  /**
   * `type: 'product' | 'supplier'`, `sort`, `pageSize` — same contract as the
   * web app's search. Home only ever asks for `sort: 'newest'` (real,
   * server-supported — never a fabricated "popular"/"best seller" ranking
   * this product has no data to back).
   */
  search: (params) => apiClient.get('/public/search', { params }).then((r) => r.data),
};
