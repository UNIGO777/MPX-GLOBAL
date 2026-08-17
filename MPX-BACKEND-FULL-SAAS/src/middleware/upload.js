import multer from 'multer';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// In-memory single-file upload for KYC documents. The file never touches disk on
// the app server (B6) — the buffer is magic-byte verified then streamed straight
// to Cloudinary. One document per request (the client uploads each doc separately).
const MAX_BYTES = env.KYC_MAX_FILE_MB * 1024 * 1024; // KYC_MAX_FILE_MB (shared with the storage service)

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
          ? `File exceeds the ${env.KYC_MAX_FILE_MB} MB limit.`
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Upload one file in the "document" field.'
            : 'Could not read the uploaded file.';
      return next(AppError.badRequest(`upload: ${err.code}`, message));
    }
    return next(AppError.badRequest('upload failed', 'Could not read the uploaded file.'));
  });
}

// Single-image upload for the exporter logo (§A22). Same in-memory + magic-byte
// posture as KYC; tighter cap because a logo is a small square image, and the
// storage service re-verifies type and size regardless.
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

const parseLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES, files: 1 },
}).single('logo');

// Single-image upload for the exporter COVER (2026-08-17). Identical posture to
// the logo — memory storage, magic-byte verified downstream — with a slightly
// larger cap because a 4:1 banner is a wider image than a square mark. The
// storage service re-verifies type and size regardless of what multer allowed.
const COVER_MAX_BYTES = 8 * 1024 * 1024;

const parseCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COVER_MAX_BYTES, files: 1 },
}).single('cover');

export function uploadCover(req, res, next) {
  parseCover(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Cover image exceeds the 8 MB limit.'
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Upload one image in the "cover" field.'
            : 'Could not read the uploaded image.';
      return next(AppError.badRequest(`upload: ${err.code}`, message));
    }
    return next(AppError.badRequest('upload failed', 'Could not read the uploaded image.'));
  });
}

export function uploadLogo(req, res, next) {
  parseLogo(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Logo exceeds the 5 MB limit.'
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Upload one image in the "logo" field.'
            : 'Could not read the uploaded image.';
      return next(AppError.badRequest(`upload: ${err.code}`, message));
    }
    return next(AppError.badRequest('upload failed', 'Could not read the uploaded image.'));
  });
}
