import { apiClient } from './client.js';

/**
 * M2 — the exporter's OWN catalogue (2026-08-18, for the seller home; M2 app
 * screens 5–7 will use the same calls). Exporter-only server-side
 * (`requireRole('exporter')`), and every query is scoped to the caller's org
 * by the service — the app never passes an orgId.
 *
 * `GET /products/mine` answers three questions in ONE request, which is why
 * the seller home needs no other product call:
 *   { products, total, page, pageSize, counts, caps }
 *   • counts — { all, draft, active, inactive, archived } (the stat tiles).
 *     `all` EXCLUDES archived, matching the unfiltered list.
 *   • caps   — { verified: true } once verified, else
 *     { verified: false, active: {used, limit}, drafts: {used, limit} }.
 *     🔴 `active.used` is the CAP count, which excludes taken-down products
 *     (§A10) — so it can legitimately differ from `counts.active`. Use caps
 *     for the allowance meter and counts for the tiles; never swap them.
 *
 * No status param = "All", which excludes archived (owner, 2026-08-11).
 */
export const sellerProductsApi = {
  mine: (params = {}) => apiClient.get('/products/mine', { params }).then((r) => r.data),

  /** Owner read for the edit screen — full `ownView` incl. image REFS
   *  ({url, publicId}: PATCH replaces the whole images array, so the editor
   *  needs the publicIds back) and the takedown block. */
  get: (id) => apiClient.get(`/products/${id}`).then((r) => r.data.product),

  /** Creates as DRAFT — publishing is always the separate status call, so a
   *  half-filled form can be saved without a fight (M2 brief: required specs
   *  are enforced at publish, not at draft-save). */
  create: (body) => apiClient.post('/products', body).then((r) => r.data.product),

  update: (id, patch) => apiClient.patch(`/products/${id}`, patch).then((r) => r.data.product),

  /** 'active' (publish) | 'inactive' (hide). The server owns every refusal:
   *  the D1 cap (verified-aware, taken-down excluded §A10), required-spec
   *  checks, goods moq+unit — surface its message, never pre-judge. */
  setStatus: (id, status) => apiClient.patch(`/products/${id}/status`, { status }).then((r) => r.data.product),

  /** Archive — terminal (no restore; re-list as new). Never called "delete"
   *  in UI copy without saying it archives. */
  archive: (id) => apiClient.delete(`/products/${id}`).then((r) => r.data),

  /** Upload ONE image (multipart field `images`) → its {url, publicId} ref.
   *  The form uploads each photo the moment it's picked — per-photo progress
   *  and retry, one failure never blocks the rest (M2 brief §2). */
  uploadImage: ({ uri, name, mimeType }) => {
    const form = new FormData();
    // React Native FormData takes {uri, name, type}, not a Blob.
    form.append('images', { uri, name, type: mimeType });
    return apiClient
      .post('/products/images', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.images[0]);
  },
};
