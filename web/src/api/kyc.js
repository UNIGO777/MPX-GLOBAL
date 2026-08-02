import { apiClient } from './client.js';

/** Self-service verification + the public exporter read. */
export const kycApi = {
  /**
   * → { kycStatus, entityType, verifiedAt, kycRejectionReason, kycSubmittedAt,
   *     documents: [{ docType, uploadedAt, verifiedAt }] }
   */
  myVerification: () => apiClient.get('/me/verification').then((r) => r.data.verification),

  /**
   * ONE file per request (multipart field `document` + docType [+ entityType on
   * a buyer's first upload]). Multi-row screens submit rows sequentially.
   */
  uploadDocument: ({ file, docType, entityType, onProgress }) => {
    const form = new FormData();
    form.append('document', file);
    form.append('docType', docType);
    if (entityType) form.append('entityType', entityType);
    return apiClient
      .post('/me/kyc/documents', form, {
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then((r) => r.data.kyc);
  },

  /**
   * Public exporter profile — the only self-org source for the exporter panel
   * header until A22 ships (plan §7.4). Whitelist projection only.
   */
  publicExporter: (idOrSlug) => apiClient.get(`/exporters/${idOrSlug}`).then((r) => r.data.exporter),
};
