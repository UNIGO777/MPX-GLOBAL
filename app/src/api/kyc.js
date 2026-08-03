import { apiClient } from './client.js';

/**
 * KYC — the caller's OWN verification only. There is no endpoint here that reads
 * anyone else's status; staff review lives on the web console behind
 * `kyc:view`, deliberately not in the app.
 *
 * ⚠️ The uploaded file is NEVER returned. `/me/verification` gives per-document
 * METADATA only — `docType`, `uploadedAt`, `verifiedAt` — because KYC assets are
 * stored private and are only ever reachable through a short-lived signed URL
 * minted for a reviewer. So no screen can show a thumbnail, a filename or a file
 * size: the server does not have them to give.
 */
export const kycApi = {
  /**
   * → { kycStatus, entityType, verifiedAt, kycRejectionReason, kycSubmittedAt,
   *     documents: [{ docType, uploadedAt, verifiedAt }] }
   *
   * `kycRejectionReason` is only populated when the status is `rejected`, and it
   * is the owner's own data — show it in full, they cannot fix what they can't see.
   */
  getVerification: () => apiClient.get('/me/verification').then((r) => r.data.verification),

  /**
   * Upload one document. Multipart: file field `document`, text `docType`, and
   * `entityType` ONLY when the account has none yet (a buyer's first upload —
   * an exporter got theirs at signup and the server rejects a mismatch).
   *
   * One successful upload flips the whole organisation to `submitted`.
   */
  uploadDocument: ({ uri, name, mimeType, docType, entityType }) => {
    const form = new FormData();
    // React Native's FormData takes this {uri,name,type} shape rather than a Blob.
    form.append('document', { uri, name, type: mimeType });
    form.append('docType', docType);
    if (entityType) form.append('entityType', entityType);

    return apiClient
      .post('/me/kyc/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

/**
 * Which document types the server accepts for each entity type. Mirrors
 * `KYC_DOCS_BY_ENTITY` in the backend enums — the upload is rejected if these
 * drift, so keep them in step.
 */
export const KYC_DOC_TYPES = {
  business: [
    { value: 'registration', label: 'Registration certificate' },
    { value: 'gst', label: 'GST certificate' },
    { value: 'certificate', label: 'Certificate of incorporation' },
    { value: 'other', label: 'Other business document' },
  ],
  individual: [
    { value: 'pan', label: 'PAN card' },
    { value: 'aadhaar', label: 'Aadhaar' },
    { value: 'passport', label: 'Passport' },
    { value: 'other', label: 'Other identity document' },
  ],
};

/** Human labels for a docType coming back from the server. */
export const DOC_TYPE_LABEL = Object.fromEntries(
  [...KYC_DOC_TYPES.business, ...KYC_DOC_TYPES.individual].map((d) => [d.value, d.label]),
);

// Mirrors the server's own limits so the UI can fail fast with a useful message
// instead of round-tripping a 10 MB photo to be told no.
export const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const KYC_MAX_DOCS = 20;
export const KYC_ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
