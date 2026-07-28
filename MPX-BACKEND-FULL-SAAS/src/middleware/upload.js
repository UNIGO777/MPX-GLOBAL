import multer from 'multer';

import { AppError } from '../utils/AppError.js';

// In-memory single-file upload for KYC documents. The file never touches disk on
// the app server (B6) — the buffer is magic-byte verified then streamed straight
// to Cloudinary. One document per request (the client uploads each doc separately).
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (mirrors the storage-service cap)

const parse = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
}).single('document');

// Wrap multer so its errors become typed AppErrors handled centrally (never a raw
// multer error to the client).
export function uploadKycDocument(req, res, next) {
  parse(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File exceeds the 10 MB limit.'
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Upload one file in the "document" field.'
            : 'Could not read the uploaded file.';
      return next(AppError.badRequest(`upload: ${err.code}`, message));
    }
    return next(AppError.badRequest('upload failed', 'Could not read the uploaded file.'));
  });
}
