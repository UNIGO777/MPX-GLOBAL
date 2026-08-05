import { apiClient } from './client.js';

/**
 * §A22 · own-company endpoints. Field names exactly as the backend validators
 * declare them (`organisation.validators.js`).
 *
 * The PATCH response carries `{ organisation, demoted }` — `demoted: true`
 * means a verified account edited a locked field and the server moved it back
 * to review. The screen renders that outcome; it never computes it.
 */
export const organisationApi = {
  mine: () => apiClient.get('/me/organisation').then((r) => r.data.organisation),

  update: (patch) => apiClient.patch('/me/organisation', patch).then((r) => r.data),

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
