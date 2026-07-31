/**
 * §A26 — the denormalised search corpus for a Product.
 *
 * Native MongoDB `$text` cannot join, and `$text` may not appear inside `$or`,
 * so everything a buyer might type has to live on the product document itself:
 *
 *   leaf category name · its synonyms · the product's attribute VALUES ·
 *   the seller's company name
 *
 * This is what makes "medicines" reach a Pharmaceuticals product and
 * "TextileHub" reach that seller's listings, from ONE text index.
 *
 * Kept in one place because four call sites depend on it staying identical:
 * product create, product edit, a category rename/synonym edit, and an
 * organisation rename (A22, when built).
 */

// Tokenise loosely: lowercase, drop punctuation, collapse whitespace, de-dupe.
// The text index does the real analysis (stemming, stop-words) — this only has
// to produce a clean, repeatable bag of words.
function tokenise(value) {
  if (value === null || value === undefined) return [];
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function buildSearchKeywords({ categoryName, synonyms = [], attributes = [], sellerName } = {}) {
  const tokens = [
    ...tokenise(categoryName),
    ...synonyms.flatMap(tokenise),
    // Attribute VALUES only — the key ("gsm") is a machine handle a buyer never types.
    ...attributes.flatMap((attr) => tokenise(attr?.value)),
    ...tokenise(sellerName),
  ];
  return [...new Set(tokens)].join(' ');
}
