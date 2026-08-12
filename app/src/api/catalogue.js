import { apiClient } from './client.js';

/**
 * M2 catalogue — public reads (mirrors `web/src/api/catalogue.js`). No token
 * required: a guest browses the catalogue (B7), and the server excludes
 * everything unavailable (draft/inactive/archived/taken-down/deactivated
 * category) IN THE QUERY — the client never filters a response for
 * availability.
 *
 * Only `tree` is here for now (Category browse, screen 1). The rest of the
 * set (`category`, `products`, `product`, `exporter`) lands with screens 2–4.
 */
export const catalogueApi = {
  /**
   * The whole active tree: every top category with its `subs` nested.
   * One call — the browse picker needs each top's sub list, and that's not a
   * field on a category by itself (the public projection is
   * name/slug/image/parentId/type only).
   */
  tree: () => apiClient.get('/categories').then((r) => r.data.categories),
};
