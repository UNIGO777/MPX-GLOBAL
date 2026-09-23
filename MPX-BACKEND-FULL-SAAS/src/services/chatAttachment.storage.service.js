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
 * Images (D9, 2026-09-23) and, since 2026-09-24, DOCUMENTS — PDF, .docx and
 * .xlsx only (D10: red alert raised, owner confirmed "make it"). Any further
 * type is a new decision and needs its own alert.
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

// --- D10 · documents (2026-09-24) -------------------------------------------

/**
 * Allowlist by TRUE content type. Deliberately narrow:
 *  - no legacy .doc/.xls (OLE containers — the classic macro carrier, and they
 *    cannot be inspected the way a zip can);
 *  - no macro-enabled .docm/.xlsm — `file-type` reports those as their own
 *    mime, so they fall out of this map without a special case;
 *  - no zip, no executable, no "any file". Each addition is a decision.
 */
const DOC_ALLOWED = new Map([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
]);

/**
 * Active content we refuse outright. Not a scanner (M4-15 puts content
 * detection in Phase 2) — a cheap, conservative screen for the constructs that
 * make a document DO something when opened:
 *  - PDF: embedded JavaScript, launch actions, embedded files;
 *  - Office: a VBA project or ActiveX, even inside a file named .docx (a
 *    renamed .docm keeps its vbaProject.bin — the zip stores entry names in
 *    plain text, so the name is visible without unpacking).
 * A PDF can hide these inside a compressed object stream, so this lowers the
 * risk rather than removing it; the forced download (see the signed URL) and
 * the private store are the other two layers.
 */
const PDF_ACTIVE = /\/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA)\b/;
const OFFICE_ACTIVE = /vbaProject\.bin|activeX\//i;

function assertNoActiveContent(buffer, format) {
  const text = buffer.toString('latin1');
  const bad = format === 'pdf' ? PDF_ACTIVE.test(text) : OFFICE_ACTIVE.test(text);
  if (bad) {
    throw AppError.badRequest(
      'document has active content',
      format === 'pdf'
        ? 'This PDF contains scripts or embedded files, which can\'t be sent. Save or print it as a plain PDF and try again.'
        : 'This file contains macros or ActiveX controls, which can\'t be sent. Save it as a plain .docx or .xlsx and try again.',
    );
  }
}

/**
 * The name shown to the other party. User-supplied, so: no path, no control or
 * bidi characters (a right-to-left override can make "invoice‮fdp.exe" read as
 * "invoiceexe.pdf"), capped, and the EXTENSION IS OURS — taken from the sniffed
 * type, never from what the client called the file.
 */
export function cleanDocumentName(originalName, format) {
  const base = String(originalName ?? '')
    .split(/[\\/]/)
    .pop()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\.[^.]*$/, '')
    .trim()
    .slice(0, 100);
  return `${base || 'document'}.${format}`;
}

/** Validate a document by size, true type and active content. */
export async function verifyChatDocument(buffer) {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest('empty file', 'No file was uploaded.');
  }
  if (buffer.length > MAX_BYTES) {
    throw AppError.badRequest('file too large', `File exceeds the ${env.CHAT_ATTACHMENT_MAX_MB} MB limit.`);
  }
  const sniffed = await fileTypeFromBuffer(buffer);
  const format = sniffed && DOC_ALLOWED.get(sniffed.mime);
  if (!format) {
    throw AppError.badRequest('unsupported file type', 'Only PDF, Word (.docx) or Excel (.xlsx) files can be sent.');
  }
  assertNoActiveContent(buffer, format);
  return { mime: sniffed.mime, format };
}

/**
 * Upload a verified document as a PRIVATE raw asset. Same id scheme and
 * `overwrite: false` as images (M4-13: messages are append-only). A raw asset
 * has no format of its own, so the extension rides on the public id.
 *
 * Verification runs BEFORE the configuration check, so a bad file is refused
 * the same way whether or not storage is up.
 */
export async function uploadChatDocument({ buffer, originalName, conversationId }) {
  const { format, mime } = await verifyChatDocument(buffer);
  assertConfigured();
  const publicId = `mpx/chat/${conversationId}/${randomBytes(12).toString('hex')}.${format}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, type: 'private', resource_type: 'raw', overwrite: false },
      (err, res) => (err ? reject(err) : resolve(res)),
    );
    stream.end(buffer);
  });

  return {
    kind: 'document',
    storageKey: result.public_id,
    format,
    mime,
    bytes: result.bytes ?? buffer.length,
    name: cleanDocumentName(originalName, format),
  };
}

/**
 * Signed URL for a stored document — same TTL reasoning as images — with
 * `attachment: true`, so the browser DOWNLOADS it rather than rendering it
 * inline. A PDF opened inside our origin's tab would run in the viewer with
 * whatever it carries; a download hands it to the person's own reader instead.
 */
export function signedChatDocumentUrl({ storageKey, ttlSeconds = 600 }) {
  assertConfigured();
  return cloudinary.utils.private_download_url(storageKey, '', {
    resource_type: 'raw',
    attachment: true,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}
