import { readFileSync } from 'node:fs';

/**
 * The HS code reference list for the product form's picker (owner, 2026-09-24).
 *
 * Source: UN Comtrade's public classification file for HS 2022 (`H6.json`,
 * https://comtradeapi.un.org/files/v1/app/reference/H6.json), downloaded
 * 2026-09-24. Converted to `src/data/hs2022.json`: the 5,613 six-digit
 * subheadings plus the 1,229 four-digit heading titles. Static reference data —
 * no collection, no seed script; it is loaded once into memory.
 *
 * To move to a newer HS edition: replace the JSON with the same shape
 * (`{ headings: { "5208": "…" }, codes: [["520811", "…"], …] }`) and update
 * this note.
 */
const DATA = JSON.parse(readFileSync(new URL('../data/hs2022.json', import.meta.url), 'utf8'));

// One row per code, with a lower-cased haystack of its own description AND its
// heading's, so "cotton" finds every subheading under a cotton heading even
// when the subheading's own words don't repeat it.
const ROWS = DATA.codes.map(([code, description]) => {
  const heading = DATA.headings[code.slice(0, 4)] ?? '';
  return { code, description, haystack: `${description} ${heading}`.toLowerCase() };
});
const BY_CODE = new Map(ROWS.map((r) => [r.code, r]));

export const HS_EDITION = DATA.edition;

/** Strip the separators people type ("5208.11", "5208 11", "5208-11"). */
export const normaliseHsCode = (value) => String(value ?? '').replace(/[\s.-]/g, '');

export function isKnownHsCode(code) {
  return BY_CODE.has(normaliseHsCode(code).slice(0, 6));
}

/**
 * Digits → code-prefix match ("5208" lists the heading's subheadings; an
 * 8-digit national code finds its 6-digit parent). Words → every word must
 * appear; ranked by where the first one lands in the code's OWN description,
 * so a direct hit beats a heading-only hit.
 */
export function searchHsCodes(query, limit = 20) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];

  const digits = normaliseHsCode(q);
  if (/^\d+$/.test(digits)) {
    const prefix = digits.slice(0, 6);
    return ROWS.filter((r) => r.code.startsWith(prefix))
      .slice(0, limit)
      .map(({ code, description }) => ({ code, description }));
  }

  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return [];
  return ROWS.filter((r) => words.every((w) => r.haystack.includes(w)))
    .map((r) => {
      const own = r.description.toLowerCase().indexOf(words[0]);
      return { r, rank: own === -1 ? 10000 : own };
    })
    .sort((a, b) => a.rank - b.rank || a.r.code.localeCompare(b.r.code))
    .slice(0, limit)
    .map(({ r }) => ({ code: r.code, description: r.description }));
}
