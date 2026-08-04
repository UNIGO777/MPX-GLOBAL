import { randomBytes } from 'node:crypto';

import { fileTypeFromBuffer } from 'file-type';

import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

// KYC documents are stored on Cloudinary as PRIVATE assets (see docs/Note.md close
// checklist): a private asset has NO publicly-reachable URL — it can only be
// fetched through a short-lived signed download URL we mint per request. We never
// store or return a raw/public URL; only the Cloudinary public_id (storageKey).

const MAX_BYTES = env.KYC_MAX_FILE_MB * 1024 * 1024; // KYC_MAX_FILE_MB

// Allowlist by TRUE content type (magic bytes), not the client-supplied name/mime.
const ALLOWED = new Map([
  ['application/pdf', { format: 'pdf', resourceType: 'image' }],
  ['image/jpeg', { format: 'jpg', resourceType: 'image' }],
  ['image/png', { format: 'png', resourceType: 'image' }],
  ['image/webp', { format: 'webp', resourceType: 'image' }],
]);

function assertConfigured() {
  if (!isCloudinaryConfigured()) {
    throw new AppError('cloudinary not configured', {
      statusCode: 503,
      clientMessage: 'Document uploads are temporarily unavailable.',
    });
  }
}

// Validate a buffer by MAGIC BYTES (B6). Rejects an empty/oversized file and any
// type not on the allowlist — an attacker renaming a script to .pdf is caught
// here because the real bytes don't match.
export async function verifyKycFile(buffer) {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest('empty file', 'No file was uploaded.');
  }
  if (buffer.length > MAX_BYTES) {
    throw AppError.badRequest('file too large', `File exceeds the ${env.KYC_MAX_FILE_MB} MB limit.`);
  }
  const sniffed = await fileTypeFromBuffer(buffer);
  const allowed = sniffed && ALLOWED.get(sniffed.mime);
  if (!allowed) {
    throw AppError.badRequest('unsupported file type', 'Only PDF, JPG, PNG or WEBP files are allowed.');
  }
  return { mime: sniffed.mime, ...allowed };
}

// Upload a verified KYC document as a PRIVATE asset with a randomised public_id
// (unguessable). Returns the private storage reference to persist — never a URL.
export async function uploadKycDocument({ buffer, orgId, docType }) {
  assertConfigured();
  const { format, resourceType } = await verifyKycFile(buffer);
  const publicId = `mpx/kyc/${orgId}/${docType}_${randomBytes(12).toString('hex')}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, type: 'private', resource_type: resourceType, overwrite: false },
      (err, res) => (err ? reject(err) : resolve(res)),
    );
    stream.end(buffer);
  });

  return { storageKey: result.public_id, format: result.format ?? format, resourceType };
}

// Mint a short-lived signed download URL for a stored private KYC asset (reviewer
// view, M1-D). The URL expires; a leaked link is useless after the TTL.
export function signedKycUrl({ storageKey, format, resourceType = 'image', ttlSeconds = 120 }) {
  assertConfigured();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const url = cloudinary.utils.private_download_url(storageKey, format, {
    resource_type: resourceType,
    type: 'private',
    expires_at: expiresAt,
    attachment: false,
  });
  return { url, expiresAt: new Date(expiresAt * 1000).toISOString() };
}
