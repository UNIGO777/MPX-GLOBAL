import { apiClient } from './client.js';

/**
 * §A22 · The caller's OWN Organisation — read and edit.
 *
 * The org is always resolved from the token server-side; there is no id in any
 * of these calls, so this API cannot be pointed at someone else's company.
 *
 * 🔴 PENDING-CHANGE MODEL (owner redesign, 2026-08-19 — retires demote-on-edit).
 * On a VERIFIED org, a locked-field change (name / country / address /
 * entityType) does NOT apply live and does NOT touch the tick: it lands in
 * `organisation.pendingChanges` ({changedFields, values, state, submittedAt,
 * rejectionReason}) and earns its way in through fresh documents + an admin
 * approval. `demoted` still arrives as a constant `false` for old-bundle
 * compatibility — nothing may key on it.
 *
 * ⚠️ Revert semantics: the server drops a pending field when a patch sends it
 * EQUAL to the live value — so the screen must SEND pending fields even when
 * they match live, or a user could never back one field out.
 */
export const organisationApi = {
  mine: () => apiClient.get('/me/organisation').then((r) => r.data.organisation),

  update: (patch) => apiClient.patch('/me/organisation', patch).then((r) => r.data),

  /** Back out of the whole pending change (409 when none exists). */
  cancelPendingChanges: () =>
    apiClient.delete('/me/organisation/pending-changes').then((r) => r.data.organisation),

  /** Exporter storefront only. Field name `logo`; JPG/PNG/WEBP, magic-byte checked. */
  uploadLogo: (file) => {
    const form = new FormData();
    form.append('logo', file);
    return apiClient
      .post('/me/organisation/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.organisation);
  },

  removeLogo: () => apiClient.delete('/me/organisation/logo').then((r) => r.data.organisation),

  /** Exporter storefront only — the supplier page's banner. Field name
   *  `cover`; same magic-byte checks as the logo, 8 MB cap (wider image). */
  uploadCover: (file) => {
    const form = new FormData();
    form.append('cover', file);
    return apiClient
      .post('/me/organisation/cover', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.organisation);
  },
  removeCover: () => apiClient.delete('/me/organisation/cover').then((r) => r.data.organisation),
};

export const organisationKeys = {
  mine: ['organisation', 'mine'],
};
