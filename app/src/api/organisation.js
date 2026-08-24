import { apiClient } from './client.js';

/**
 * §A22 · own-company endpoints. Field names exactly as the backend validators
 * declare them (`organisation.validators.js`).
 *
 * 🔴 The PATCH response is still `{ organisation, demoted }`, but under the
 * verification redesign (2026-08-19) **`demoted` is now hard-coded `false`** —
 * it survives only as a contract stub so old clients don't break. Read the
 * outcome from `organisation.pendingChanges` instead; branching on `demoted`
 * now silently means "never". The app was still telling verified companies
 * their tick had been removed until 2026-08-23.
 *
 * What happens now, on a VERIFIED org: editing a locked field (name · country ·
 * address · entityType) does NOT touch the live profile or the tick. The change
 * is parked in `Organisation.pendingChanges`, the company uploads fresh
 * supporting documents, and the values apply only when a reviewer approves.
 * On an UNVERIFIED org, edits still apply live — there is nothing to protect.
 *
 * The server decides all of this and audits it; these calls only report it.
 */
export const organisationApi = {
  mine: () => apiClient.get('/me/organisation').then((r) => r.data.organisation),

  update: (patch) => apiClient.patch('/me/organisation', patch).then((r) => r.data),

  /** Withdraw a parked change. The live profile was never altered, so this
   *  simply drops it — it is not a rollback. */
  cancelPendingChanges: () =>
    apiClient.delete('/me/organisation/pending-changes').then((r) => r.data.organisation),

  uploadLogo: ({ uri, name, mimeType }) => {
    const form = new FormData();
    // React Native's FormData takes {uri,name,type}, not a Blob.
    form.append('logo', { uri, name, type: mimeType });
    return apiClient
      .post('/me/organisation/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.organisation);
  },

  removeLogo: () => apiClient.delete('/me/organisation/logo').then((r) => r.data.organisation),
};

/** Mirror of the server cap (organisation.validators.js) for the counter. */
export const DESCRIPTION_MAX = 500;
