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
   * `type: 'product' | 'supplier'`, `sort`, `pageSize` — same contract as the
   * web app's search. Home only ever asks for `sort: 'newest'` (real,
   * server-supported — never a fabricated "popular"/"best seller" ranking
   * this product has no data to back).
   */
  search: (params) => apiClient.get('/public/search', { params }).then((r) => r.data),
};
