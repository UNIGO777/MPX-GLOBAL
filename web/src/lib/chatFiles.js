/**
 * Chat attachments on the client (D9 images · D10 documents).
 *
 * These checks are for the SENDER'S benefit only — a clear message before an
 * 8 MB upload, instead of a "Not sent" after it. The server re-checks every file
 * by its real bytes and is the only thing that decides.
 */

// Mirrors the server's CHAT_ATTACHMENT_MAX_MB default.
export const CHAT_FILE_MAX_MB = 8;

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export const DOCUMENT_ACCEPT = [
  '.pdf',
  '.docx',
  '.xlsx',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

const DOC_EXT = /\.(pdf|docx|xlsx)$/i;

export const isImageFile = (file) => /^image\/(jpeg|png|webp|gif)$/.test(file?.type ?? '');

/** A reason the file can't be sent, or null. */
export function chatFileProblem(file, kind) {
  if (file.size > CHAT_FILE_MAX_MB * 1024 * 1024) {
    return `That file is over ${CHAT_FILE_MAX_MB} MB. Please send a smaller one.`;
  }
  if (kind === 'document' && !DOC_EXT.test(file.name)) {
    return 'Only PDF, Word (.docx) or Excel (.xlsx) files can be sent.';
  }
  if (kind === 'image' && !isImageFile(file)) {
    return 'Only JPG, PNG, WEBP or GIF images can be sent.';
  }
  return null;
}

/** "PDF", "DOCX", "XLSX" — from the server's format, or the local file name. */
export const fileBadge = (formatOrName) =>
  String(formatOrName ?? '').split('.').pop().slice(0, 4).toUpperCase() || 'FILE';

export function formatFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
