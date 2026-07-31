import { env } from '../config/env.js';
import { Category } from '../models/Category.js';

/**
 * M3-G — the §A26 replacement for Atlas's fuzzy matching.
 *
 * Native `$text` has NO typo tolerance, so when a query returns ZERO results we
 * compare it against the category name + synonym vocabulary (a few hundred short
 * strings) and offer the closest match. This is not full fuzzy search — it only
 * rescues the common "typed it slightly wrong" case, and only on an empty result
 * set, so it never affects a successful query.
 *
 * Note the analyser already handles singular/plural for us (medicines↔medicine),
 * so this is purely about misspellings.
 */

const CACHE_TTL_MS = 30_000;
let cache = { terms: null, at: 0 };

export function invalidateDidYouMeanCache() {
  cache = { terms: null, at: 0 };
}

// Vocabulary = every active category's name words + its synonyms, each mapped
// back to a category slug so the UI can link straight to it.
async function vocabulary() {
  const now = Date.now();
  const cacheable = env.NODE_ENV !== 'test'; // deterministic tests (see category.service)
  if (cacheable && cache.terms && now - cache.at < CACHE_TTL_MS) return cache.terms;

  const cats = await Category.find({ active: true }).select('name slug synonyms').lean();
  const terms = [];
  for (const cat of cats) {
    const words = new Set([
      ...String(cat.name).toLowerCase().split(/[^a-z0-9]+/i).filter((w) => w.length > 3),
      ...(cat.synonyms ?? []).map((s) => String(s).toLowerCase()).filter((s) => s.length > 3),
    ]);
    for (const term of words) terms.push({ term, slug: cat.slug });
  }

  if (cacheable) cache = { terms, at: now };
  return terms;
}

// Classic Levenshtein — the vocabulary is small and the strings are short, so
// there is no reason to pull in a dependency for this.
function distance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i += 1) {
    const curr = [i];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[cols - 1];
}

// Tolerate 1 edit on short words, 2 on longer ones — enough for a typo, tight
// enough that unrelated words never suggest anything.
const allowed = (word) => (word.length <= 5 ? 1 : 2);

/**
 * @returns {{ term: string, categorySlug: string } | null}
 */
export async function suggest(query) {
  if (!query) return null;
  const words = String(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 3);
  if (words.length === 0) return null;

  const terms = await vocabulary();
  let best = null;

  for (const word of words) {
    for (const entry of terms) {
      if (entry.term === word) return null; // the word IS in the vocabulary — no typo to fix
      const d = distance(word, entry.term);
      if (d <= allowed(word) && (!best || d < best.distance)) {
        best = { term: entry.term, categorySlug: entry.slug, distance: d };
      }
    }
  }

  return best ? { term: best.term, categorySlug: best.categorySlug } : null;
}
