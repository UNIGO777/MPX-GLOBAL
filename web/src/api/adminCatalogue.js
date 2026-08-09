import { apiClient } from './client.js';

/**
 * Staff catalogue endpoints (§A25's four grantable permissions).
 *
 * `category:read` covers the two reads; `category:manage` covers every write.
 * The SERVER gates each route — the screens only hide what a 403 would refuse
 * anyway (CLAUDE.md #2/#5), so a missing permission must never be the reason a
 * request is not attempted.
 */
export const adminCatalogueApi = {
  /**
   * The full tree INCLUDING inactive rows, `prevActive`, `synonyms` and each
   * sub's `attributeCount`. The public read hides all of that — this screen must
   * not, or an admin cannot find the category they switched off.
   */
  tree: () => apiClient.get('/admin/categories').then((r) => r.data.categories),

  /**
   * A sub-category's field definitions, with `id` and `order`.
   *
   * NOT the public `/categories/:idOrSlug/attributes`: that one 404s for an
   * inactive category (so a cascade-off sub's fields would be unmanageable) and
   * omits the `id` that PATCH/DELETE need.
   */
  attributes: (id) => apiClient.get(`/admin/categories/${id}/attributes`).then((r) => r.data),

  /** Top-category on/off. Cascades to subs, remembering each one's `prevActive`. */
  toggle: (id) => apiClient.patch(`/admin/categories/${id}/toggle`).then((r) => r.data.category),

  /** Sub-categories only — the 40 tops are seeded and cannot be created. */
  createSub: (body) => apiClient.post('/admin/categories', body).then((r) => r.data.category),
  update: (id, patch) => apiClient.patch(`/admin/categories/${id}`, patch).then((r) => r.data.category),
  remove: (id) => apiClient.delete(`/admin/categories/${id}`).then((r) => r.data),

  /** §A20: allowed on TOP categories too — a deliberate exception to toggle-only. */
  uploadImage: (id, file) => {
    const form = new FormData();
    form.append('image', file);
    return apiClient
      .post(`/admin/categories/${id}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.category);
  },

  createAttribute: (id, body) =>
    apiClient.post(`/admin/categories/${id}/attributes`, body).then((r) => r.data.attribute),
  /** `key` and `inputType` are IMMUTABLE — the server does not accept them here. */
  updateAttribute: (id, attrId, patch) =>
    apiClient.patch(`/admin/categories/${id}/attributes/${attrId}`, patch).then((r) => r.data.attribute),
  deleteAttribute: (id, attrId) =>
    apiClient.delete(`/admin/categories/${id}/attributes/${attrId}`).then((r) => r.data),

  // --- moderation (product:read / product:takedown) --------------------------

  /**
   * The monitoring list. 🔴 Drafts and seller-archived rows are NOT in it and no
   * filter reveals them — moderation acts on what is live or was live.
   * `status` is exactly three: active · inactive · blocked.
   */
  products: (params) => apiClient.get('/admin/products', { params }).then((r) => r.data),

  /** Reason is REQUIRED (3–500) and is shown to the seller verbatim. */
  takedown: (id, reason) =>
    apiClient.post(`/admin/products/${id}/takedown`, { reason }).then((r) => r.data),
  restore: (id) => apiClient.post(`/admin/products/${id}/restore`).then((r) => r.data),

  // --- audit (audit:read) ----------------------------------------------------

  audit: (params) => apiClient.get('/admin/audit', { params }).then((r) => r.data),
  auditEntry: (id) => apiClient.get(`/admin/audit/${id}`).then((r) => r.data.entry),
};

export const adminCatalogueKeys = {
  tree: ['admin', 'categories'],
  attributes: (id) => ['admin', 'categories', id, 'attributes'],
  products: ['admin', 'products'],
  productsPage: (params) => ['admin', 'products', params],
  audit: (params) => ['admin', 'audit', params],
  auditEntry: (id) => ['admin', 'audit', 'entry', id],
};
