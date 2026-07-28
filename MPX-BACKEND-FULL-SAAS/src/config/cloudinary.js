import { v2 as cloudinary } from 'cloudinary';

import { env } from './env.js';

// Cloudinary credentials live only in .env (never in source). They are optional
// until the KYC upload path is exercised, so we configure lazily and let callers
// assert configuration before an actual upload / signed-URL call.
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function isCloudinaryConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

export { cloudinary };
