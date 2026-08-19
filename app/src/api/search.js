import { apiClient } from './client.js';

/**
 * M3 — discovery search (2026-08-19). Same endpoints and rules as web; the
 * two surfaces render exactly the same public data by rule.
 *
 * `GET /public/facets` — same params as search, returns per-group counts the
 * UI renders VERBATIM (never computes its own):
 *   facets: { category[], subCategory[], country[{value,count}],
 *             goodsOrService[], verified[], price{min,max,currency},
 *             moq{min,max}, attributes[{key,name,inputType,unit,bounds|options}] }
 * Works in BOTH modes (§0.1) — supplier mode returns country + verified only.
 * The selected leaf category stays pinned in even at count 0; render the 0.
 *
 * `POST /search/ai` — ONE cost-controlled call. Returns the results
 * THEMSELVES (page 1) plus:
 *   message   — the model's own sentence to the buyer (may be null)
 *   answer    — templated, count-honest fallback line
 *   extracted — the filters it derived {target, keywords[], category,
 *               country, priceMax, moqMin, verifiedOnly, attributes…}
 *   fallback  — true when the AI step failed and these are plain keyword
 *               results: render as a NORMAL search, no error state (brief §4)
 * Never claim counts from `message` — the model hasn't seen the results.
 *
 * Attribute filters go over the wire in BRACKET notation (`attr[gsm][min]`),
 * which is axios's default object serialisation — never dotted keys
 * (`rejectMongoOperators` 400s any dotted key).
 */
export const searchApi = {
  facets: (params) => apiClient.get('/public/facets', { params }).then((r) => r.data),
  // Body is {query} ONLY (mirrors web): the model decides product-vs-supplier
  // itself — it comes back as `extracted.target` / `type`.
  aiSearch: (query) => apiClient.post('/search/ai', { query }).then((r) => r.data),
};
