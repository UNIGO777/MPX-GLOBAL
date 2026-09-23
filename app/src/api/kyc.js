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
 * Labels for every docType the server can send back.
 *
 * 🔴 What is OFFERED and what is RENDERABLE are two different lists. This map is
 * the RENDERABLE one and must stay a superset: a type dropped from the pickers
 * still has documents stored under it, and without a label they show as a blank
 * row on the verification screen for a file the reviewer can still open.
 */
export const DOC_TYPE_LABEL = {
  // Cross-border generics — named for the instrument, not for any one country's
  // title for it (UK/EU VAT, US EIN, UAE trade licence all land on `tax`/`licence`).
  registration: 'Company registration certificate',
  tax: 'Tax registration certificate',
  licence: 'Trade or business licence',
  passport: 'Passport',
  national_id: 'National ID card',
  driving_licence: 'Driving licence',
  // India
  gst: 'GST certificate',
  iec: 'Import Export Code (IEC)',
  pan: 'PAN card',
  aadhaar: 'Aadhaar (masked only)',
  certificate: 'Certificate of incorporation',
  other: 'Other document',
};

/**
 * Which documents we ask for, BY COUNTRY then entity type. Mirrors the backend's
 * `KYC_DOCS_DEFAULT` / `KYC_DOCS_BY_COUNTRY` (src/models/enums.js) — the server
 * is authoritative and rejects the upload if these drift, so keep them in step.
 *
 * DEFAULT + OVERRIDES, never a per-country table: the picker offers the whole
 * ISO list, so a table would be permanently incomplete, and a wrong document
 * NAME reads worse than a generic one.
 */
export const DOCS_DEFAULT = {
  business: ['registration', 'tax', 'licence', 'other'],
  individual: ['passport', 'national_id', 'driving_licence'],
};

export const DOCS_BY_COUNTRY = {
  IN: {
    business: ['registration', 'gst', 'certificate', 'iec', 'other'],
    // Aadhaar is MASKED ONLY. The label cannot enforce that — the reviewer can.
    // `other` stays out for individuals: it was the back door that made an
    // Aadhaar unfindable by query.
    individual: ['pan', 'aadhaar', 'passport'],
  },
};

/**
 * The picker options for one company: `[{ value, label }]`.
 * Unknown or missing country falls through to the default set, so a company we
 * have no country for still gets a usable list rather than an empty screen.
 */
export function docTypesFor({ country, entityType }) {
  if (!entityType) return [];
  const set = DOCS_BY_COUNTRY[String(country ?? '').toUpperCase()] ?? DOCS_DEFAULT;
  return (set[entityType] ?? []).map((value) => ({ value, label: DOC_TYPE_LABEL[value] ?? value }));
}

// Mirrors the server's own limits so the UI can fail fast with a useful message
// instead of round-tripping a 10 MB photo to be told no.
export const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const KYC_MAX_DOCS = 20;
export const KYC_ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Shown on the upload screens for individuals, and the reason the Aadhaar slot
 * can exist at all. It is a DETERRENT, not a control — nothing here can tell a
 * masked file from an unmasked one. The reviewer is the control.
 */
export const AADHAAR_NOTICE =
  'Aadhaar must be the MASKED version only — the one where the first 8 digits show as XXXX. ' +
  'Download it from myaadhaar.uidai.gov.in (choose "Masked Aadhaar"). A full Aadhaar will be deleted, not reviewed.';
