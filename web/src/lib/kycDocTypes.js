import { config } from '../config.js';

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

// Client-side pre-check mirroring the server's magic-byte allowlist + size cap
// (kyc.storage.service.js). The server re-verifies by content — this only saves
// the user a wasted upload.
export const KYC_ACCEPT = config.kyc.accept;
export const KYC_MAX_BYTES = config.kyc.maxBytes;

export function checkKycFile(file) {
  if (!file) return 'No file selected.';
  const okType = /(pdf|jpe?g|png|webp)$/i.test(file.name) || /(pdf|jpeg|png|webp)/.test(file.type);
  if (!okType || file.size > KYC_MAX_BYTES) {
    return `That file type or size isn't supported. Use a PDF, JPG, PNG or WEBP under ${config.kyc.maxMb} MB.`;
  }
  return null;
}

/**
 * Phone-camera captures picked through the file chooser arrive as HEIC/HEIF
 * (iPhone "High Efficiency" and many Androids) or as JPEGs over the size cap
 * (large sensors) — both then bounce off the allowlist even though the user
 * did nothing wrong (QA, 2026-08-14). When a picked image would fail, this
 * re-encodes it in the browser to an in-policy JPEG (longest side capped,
 * quality 0.85). PDFs and already-valid images pass through untouched. If the
 * browser cannot decode the image at all, the original is returned and
 * `checkKycFile` reports it as before.
 */
export async function normalizeKycFile(file) {
  const isImage = file && (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name ?? ''));
  if (!isImage) return file;
  const inPolicy = /(jpeg|png|webp)/.test(file.type) && file.size <= KYC_MAX_BYTES;
  if (inPolicy) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const MAX_SIDE = 2600; // plenty for a legible document photo
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size > KYC_MAX_BYTES) return file;
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    // Undecodable here (e.g. HEIC on desktop Chrome) — hand back the original
    // so checkKycFile produces the existing, honest error message.
    return file;
  }
}
