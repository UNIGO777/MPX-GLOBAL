import multer from 'multer';

import { AppError } from '../utils/AppError.js';
import { MAX_PRODUCT_IMAGES } from '../models/Product.js';

// Memory storage (buffers go straight to Cloudinary, nothing touches disk).
// Size is capped here at the transport layer; magic-byte verification happens in
// image.storage.service (the client mime/name is never trusted — B6).
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // §A25.3

function makeUploader({ files }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_MAX_BYTES, files },
  });
}

function wrapMulterErrors(handler) {
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(AppError.badRequest('image too large', 'Each image must be 5 MB or smaller.'));
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          AppError.badRequest('too many files', `At most ${MAX_PRODUCT_IMAGES} images per upload.`),
        );
      }
      return next(AppError.badRequest('upload failed', 'Invalid upload.'));
    });
}

// Product photos: field `images`, up to 5 files (§A25.3).
export const uploadProductImages = wrapMulterErrors(
  makeUploader({ files: MAX_PRODUCT_IMAGES }).array('images', MAX_PRODUCT_IMAGES),
);

// Category card image: field `image`, single file (A11/A20).
export const uploadCategoryImage = wrapMulterErrors(makeUploader({ files: 1 }).single('image'));
