import { apiClient } from './client.js';

/**
 * FINALIZE F5b — curated landing content.
 *
 * Admin rows (featured:manage) carry curation state plus the pointer
 * resolution: { id, kind, targetId, image, title, subtitle, linkUrl, order,
 * active, startsAt, endsAt, createdAt, target: {name,slug,image}|null,
 * targetLive }. `target: null` means the record was hard-deleted;
 * `targetLive: false` means it no longer qualifies for the landing page.
 *
 * 🔑 The pointer rule: `kind` and `targetId` are NOT patchable — the server
 * refuses repointing a slot. The affordance is delete + add, and this module
 * deliberately offers no "retarget" call.
 *
 * The public read lives here too: one call, four groups, already
 * availability-filtered and ordered — the landing page's single round trip.
 */
export const featuredApi = {
  // public — no auth
  landing: () => apiClient.get('/public/featured').then((r) => r.data),

  // admin (featured:manage)
  list: () => apiClient.get('/admin/featured').then((r) => r.data.items),
  create: (payload) => apiClient.post('/admin/featured', payload).then((r) => r.data.item),
  // Banners are multipart: the image file rides with the create.
  createBanner: (formData) =>
    apiClient.post('/admin/featured/banner', formData).then((r) => r.data.item),
  update: (id, patch) => apiClient.patch(`/admin/featured/${id}`, patch).then((r) => r.data.item),
  replaceImage: (id, formData) =>
    apiClient.post(`/admin/featured/${id}/image`, formData).then((r) => r.data.item),
  remove: (id) => apiClient.delete(`/admin/featured/${id}`),
};

export const featuredKeys = {
  landing: ['public', 'featured'],
  admin: ['admin', 'featured'],
};
