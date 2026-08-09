import { apiClient } from './client.js';

/**
 * The exporter's own product endpoints. Every one is `requireRole('exporter')`
 * server-side, and each query is additionally scoped by `exporterOrgId` — a
 * product belonging to another seller returns **404, never 403** (a 403 would
 * confirm the row exists).
 */
export const productsApi = {
  /**
   * The seller's list. `status` is optional — omit it for the "All" tab.
   *
   * The response carries `counts` (per-status, for the tabs) and `caps` (the
   * meter) alongside the rows, so one call refreshes the table, the tabs and the
   * meter together and they can never disagree with each other.
   */
  mine: (params) => apiClient.get('/products/mine', { params }).then((r) => r.data),

  /** ONE own product — the edit form's load. Another seller's is a 404 (A6). */
  one: (id) => apiClient.get(`/products/${id}`).then((r) => r.data.product),

  create: (body) => apiClient.post('/products', body).then((r) => r.data.product),
  update: (id, patch) => apiClient.patch(`/products/${id}`, patch).then((r) => r.data.product),

  /** Only `active` | `inactive` are reachable — draft is one-way (§A1). */
  setStatus: (id, status) =>
    apiClient.patch(`/products/${id}/status`, { status }).then((r) => r.data.product),

  /** Soft-delete: the server sets `status: 'archived'` and frees the slug (§A5/§A6). */
  archive: (id) => apiClient.delete(`/products/${id}`).then((r) => r.data.product),

  /**
   * Step one of the two-step image flow: files up, refs back. The refs then
   * travel in the JSON create/edit — never the files themselves.
   */
  uploadImages: (files) => {
    const form = new FormData();
    for (const file of files) form.append('images', file);
    return apiClient
      .post('/products/images', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.images);
  },
};

export const productKeys = {
  /** ONE key for the whole list — invalidating it refreshes rows, counts and caps. */
  mine: ['products', 'mine'],
  minePage: (params) => ['products', 'mine', params],
};
