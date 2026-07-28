// URL-safe slug generation for public, readable URLs (MPX-SEO-Rules §1):
// lowercase, fold accents, strip non-alphanumerics (keep hyphens), spaces->hyphens,
// collapse repeats, trim edge hyphens. This is the pure base transform; collision
// handling (append a short id-derived suffix) is done where the slug is assigned,
// so a clash never yields a duplicate.
//
// NFKD decomposes accented letters ("Café" -> "Cafe" + combining mark) and the
// non-alphanumeric strip below then drops the leftover combining mark, so accents
// fold to their base letter without a separate diacritics pass.
export function slugify(input) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '') // keep only a-z / 0-9 / whitespace / hyphen
    .trim()
    .replace(/[\s_]+/g, '-') // whitespace / underscore -> hyphen
    .replace(/-+/g, '-') // collapse repeats
    .replace(/^-+|-+$/g, ''); // trim edge hyphens
}
