import { randomBytes } from 'node:crypto';

import { fileTypeFromBuffer } from 'file-type';

import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { AppError } from '../utils/AppError.js';

// PUBLIC image assets (product photos, category card images) — unlike KYC
// documents these are meant to be world-readable, so they upload as the default
// public `upload` type. Verification is still magic-byte based (B6): the
// client-supplied name/mime is never trusted. NO PDF here — images only.

const MAX_BYTES = 5 * 1024 * 1024; // §A25.3 — 5 MB per image

const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function assertConfigured() {
  if (!isCloudinaryConfigured()) {
    throw new AppError('cloudinary not configured', {
      statusCode: 503,
      clientMessage: 'Image uploads are temporarily unavailable.',
    });
  }
}

export async function verifyImageFile(buffer) {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest('empty file', 'No file was uploaded.');
  }
  if (buffer.length > MAX_BYTES) {
    throw AppError.badRequest('file too large', 'Image exceeds the 5 MB limit.');
  }
  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed || !ALLOWED.has(sniffed.mime)) {
    throw AppError.badRequest('unsupported file type', 'Only JPG, PNG or WEBP images are allowed.');
  }
  return { mime: sniffed.mime, format: ALLOWED.get(sniffed.mime) };
}

// Upload one verified image under the given folder prefix. The prefix encodes
// ownership (`mpx/products/{orgId}` / `mpx/categories`) — product refs are later
// validated against the caller's own prefix, so keep it exact.
export async function uploadPublicImage({ buffer, folder }) {
  assertConfigured();
  await verifyImageFile(buffer);
  const publicId = `${folder}/${randomBytes(8).toString('hex')}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'image', overwrite: false },
      (err, res) => (err ? reject(err) : resolve(res)),
    );
    stream.end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

// Best-effort delete (A8 purge, image replacement). Failures are the caller's
// to log — a missing remote asset must never block the local operation.
export async function deletePublicImage(publicId) {
  assertConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}
