/**
 * Mirror of the backend's KYC enums (src/models/enums.js — KYC_DOC_TYPE +
 * KYC_DOCS_BY_ENTITY). The server is authoritative; these exist so the
 * document-type dropdowns can only ever offer values the API will accept.
 *
 * ⚠️ The design mockups listed types like "VAT / Tax Certificate" and
 * "Export License" — those are NOT in the backend enum and are deliberately
 * not offered (owner instruction: field names follow the backend).
 */

export const DOC_TYPE_LABELS = {
  registration: 'Company registration',
  gst: 'GST / tax document',
  certificate: 'Certificate',
  pan: 'PAN',
  aadhaar: 'Aadhaar',
  passport: 'Passport',
  other: 'Other',
};

export const DOC_TYPES_BY_ENTITY = {
  business: ['registration', 'gst', 'certificate', 'other'],
  individual: ['pan', 'aadhaar', 'passport', 'other'],
};

export const ENTITY_LABELS = {
  business: 'Business',
  individual: 'Individual',
};

// Client-side pre-check mirroring the server's magic-byte allowlist + 10 MB cap
// (kyc.storage.service.js). The server re-verifies by content — this only saves
// the user a wasted upload.
export const KYC_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
export const KYC_MAX_BYTES = 10 * 1024 * 1024;

export function checkKycFile(file) {
  if (!file) return 'No file selected.';
  const okType = /(pdf|jpe?g|png|webp)$/i.test(file.name) || /(pdf|jpeg|png|webp)/.test(file.type);
  if (!okType || file.size > KYC_MAX_BYTES) {
    return "That file type or size isn't supported. Use a PDF, JPG, PNG or WEBP under 10 MB.";
  }
  return null;
}
