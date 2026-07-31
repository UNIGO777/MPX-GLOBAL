import mongoose from 'mongoose';

/**
 * Public single-entity reads accept EITHER a 24-hex ObjectId OR a slug, because
 * SEO §1 serves public pages at `/product/:slug`, `/category/:slug` and
 * `/supplier/:slug` while internal callers hold ids.
 *
 * The check is deliberately strict (`isValidObjectId` alone accepts any 12-byte
 * string, including plausible slugs), so a slug can never be mistaken for an id.
 */
export function isObjectIdLike(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value)) && mongoose.isValidObjectId(value);
}

/** `{ _id }` for an id, `{ slug }` (lowercased) otherwise. Compose with the rest of the filter. */
export function idOrSlugFilter(idOrSlug) {
  return isObjectIdLike(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
}
