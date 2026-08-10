import { apiClient } from './client.js';

/**
 * §A22 · The caller's OWN Organisation — read and edit.
 *
 * The org is always resolved from the token server-side; there is no id in any
 * of these calls, so this API cannot be pointed at someone else's company.
 *
 * 🔴 `update` returns `{ organisation, demoted }`. `demoted: true` means the
 * caller was VERIFIED and changed a locked field (name / country / address /
 * entityType) — the server has dropped them back to `submitted`, withheld the
 * tick, and queued them for re-review. The screen must say so; a silent demotion
 * reads as a lost tick with no explanation.
 */
export const organisationApi = {
  mine: () => apiClient.get('/me/organisation').then((r) => r.data.organisation),

  update: (patch) => apiClient.patch('/me/organisation', patch).then((r) => r.data),

  /** Exporter storefront only. Field name `logo`; JPG/PNG/WEBP, magic-byte checked. */
  uploadLogo: (file) => {
    const form = new FormData();
    form.append('logo', file);
    return apiClient
      .post('/me/organisation/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.organisation);
  },

  removeLogo: () => apiClient.delete('/me/organisation/logo').then((r) => r.data.organisation),
};

export const organisationKeys = {
  mine: ['organisation', 'mine'],
};
