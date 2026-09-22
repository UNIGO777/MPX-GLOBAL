import { randomBytes } from 'node:crypto';

import { fileTypeFromBuffer } from 'file-type';

import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

/**
 * M4 · chat image attachments (D9 — scope override granted 2026-09-23).
 *
 * 🔴 PRIVATE ASSETS, MODELLED ON KYC — NOT ON PRODUCT IMAGES. A product photo is
 * advertising: public by definition, served from a permanent URL. A chat image
 * is one company's private commercial correspondence with another, and the two
 * must not share a storage pattern. So this mirrors `kyc.storage.service.js`:
 * a Cloudinary asset of `type: 'private'` under an unguessable id, no publicly
 * reachable URL ever stored or returned, and a short-lived signed URL minted per
 * request. Reusing the public product path here would have made every chat image
 * readable by anyone who guessed or was forwarded the link, forever.
 *
 * 🔴 IMAGES ONLY, deliberately. The override was granted for "attachments like
 * images". PDFs and other documents are still what `m4.md` M4-14 parks with the
 * Quotation module — widening this allowlist is a separate decision and needs
 * its own alert.
 *
 * ⚠️ Nothing scans what is sent: `m4.md` M4-15 puts content detection in Phase 2.
 * The controls here are type, size and access — not content.
 */

const MAX_BYTES = env.CHAT_ATTACHMENT_MAX_MB * 1024 * 1024;

// Allowlist by TRUE content type (magic bytes), never the client-supplied name
// or mime (B6). A script renamed to .jpg is caught here because its real bytes
// do not match. GIF is included because people genuinely send one; SVG is NOT —
// it is a document format that can carry script, and it has no place being
// rendered from a private store into two companies' chat.
const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

function assertConfigured() {
  if (!isCloudinaryConfigured()) {
    throw new AppError('cloudinary not configured', {
      statusCode: 503,
      clientMessage: 'Image sending is temporarily unavailable.',
    });
  }
}

/** Validate by magic bytes, size and emptiness. Returns the true type. */
export async function verifyChatImage(buffer) {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest('empty file', 'No image was uploaded.');
  }
  if (buffer.length > MAX_BYTES) {
    throw AppError.badRequest(
      'file too large',
      `Image exceeds the ${env.CHAT_ATTACHMENT_MAX_MB} MB limit.`,
    );
  }
  const sniffed = await fileTypeFromBuffer(buffer);
  const format = sniffed && ALLOWED.get(sniffed.mime);
  if (!format) {
    throw AppError.badRequest(
      'unsupported file type',
      'Only JPG, PNG, WEBP or GIF images can be sent.',
    );
  }
  return { mime: sniffed.mime, format };
}

/**
 * Upload a verified image as a PRIVATE asset. Returns the storage reference to
 * persist — never a URL.
 *
 * The id is keyed by conversation so an operator can see what belongs to what,
 * and carries 12 random bytes so it cannot be guessed from the conversation id
 * alone. `overwrite: false` because messages are append-only (M4-13): a second
 * upload must never be able to replace the image a previous message points at.
 */
export async function uploadChatImage({ buffer, conversationId }) {
  assertConfigured();
  const { format, mime } = await verifyChatImage(buffer);
  const publicId = `mpx/chat/${conversationId}/${randomBytes(12).toString('hex')}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, type: 'private', resource_type: 'image', overwrite: false },
      (err, res) => (err ? reject(err) : resolve(res)),
    );
    stream.end(buffer);
  });

  return {
    storageKey: result.public_id,
    format: result.format ?? format,
    mime,
    bytes: result.bytes ?? buffer.length,
    width: result.width ?? null,
    height: result.height ?? null,
  };
}

/**
 * Mint a short-lived signed URL for a stored chat image.
 *
 * 🔴 The TTL is the access control. Membership is checked when the thread is
 * READ, and the URL that read hands back stops working shortly after — so a
 * link copied out of the page, or left in a stale client, is useless. Longer
 * than KYC's 120s because a chat thread is scrolled and re-read rather than
 * opened once, and an image that dies mid-scroll reads as a broken thread.
 */
export function signedChatImageUrl({ storageKey, format, ttlSeconds = 600 }) {
  assertConfigured();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return cloudinary.utils.private_download_url(storageKey, format, {
    resource_type: 'image',
    expires_at: expiresAt,
  });
}
