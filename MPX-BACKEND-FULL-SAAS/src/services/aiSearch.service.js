import { Category } from '../models/Category.js';
import { CategoryAttribute } from '../models/CategoryAttribute.js';
import { CURRENCIES } from '../models/enums.js';
import { logger } from '../utils/logger.js';
import { completeJson, isAiConfigured } from './ai.client.js';
import { searchProducts, searchSuppliers } from './search.service.js';
import { resolveCategoryLeafIds } from './search.query.js';

/**
 * M3-E — AI search: a query TRANSLATOR, never a second engine.
 *
 * One OpenAI call turns a sentence into the same filters `/public/search`
 * accepts, everything is validated against real data, and the SAME engine runs.
 * Any failure falls back to a plain keyword search — the buyer always gets
 * results, never an error page.
 */

// §A26/plan M3-E: inject the 40 TOP categories + synonyms ONLY. Injecting every
// sub and its attributes would be thousands of tokens per call (memo I7 says
// keep it cheap) and is chicken-and-egg — the attributes belong to a category
// the model has not resolved yet. Attributes are handled by VALIDATION instead.
async function buildSystemPrompt() {
  const tops = await Category.find({ parentId: null, active: true })
    .select('name synonyms')
    .sort({ order: 1 })
    .lean();

  // A12 lets an admin put synonyms on SUB-categories too, so a top's line must
  // carry its own synonyms PLUS its children's — otherwise "dawai" (seeded on
  // the Pharmaceuticals leaf) would never reach the model. Sub-category NAMES
  // stay out; only their short synonym words are folded up, so the prompt stays
  // cheap (the §A26 cost constraint).
  const subs = await Category.find({ parentId: { $in: tops.map((t) => t._id) }, active: true })
    .select('parentId synonyms')
    .lean();
  const childSynonyms = new Map();
  for (const sub of subs) {
    if (!sub.synonyms?.length) continue;
    const bucket = childSynonyms.get(String(sub.parentId)) ?? [];
    bucket.push(...sub.synonyms);
    childSynonyms.set(String(sub.parentId), bucket);
  }

  const list = tops
    .map((t) => {
      const words = [...new Set([...(t.synonyms ?? []), ...(childSynonyms.get(String(t._id)) ?? [])])];
      return words.length ? `- ${t.name} (${words.join(', ')})` : `- ${t.name}`;
    })
    .join('\n');

  return `You are a search query parser for a B2B import/export marketplace (MPX Global).
The buyer types a natural-language request. Convert it into a STRICT JSON object of
search keywords and structured filters. Return ONLY the JSON — no explanation.

Available categories (map buyer words, including synonyms, to the closest one; use null if none):
${list}

Output JSON shape (include a field only if present in the query; otherwise omit it):
{
  "target": "product" | "supplier",
  "keywords": ["..."],
  "category": "<one category name from the list above>" | null,
  "priceMax": <number> | null,
  "priceIntent": "low" | "high" | null,
  "moqMin": <number> | null,
  "country": "<ISO alpha-2 country code>" | null,
  "currency": "<ISO-4217 code>" | null,
  "attributes": { "<key>": "<value>" },
  "verifiedOnly": true | false
}

Rules:
- Map informal/synonym words to the correct category.
- "cheap", "budget", "sasti", "affordable", "low cost" -> "priceIntent":"low".
- "bulk", "large order", "thok" -> a reasonable "moqMin" (e.g. 1000) if no number is given.
- Never invent categories that are not in the list.
- Return valid JSON only.`;
}

// Everything the model returns is treated as untrusted: unknown categories,
// attributes and currencies are DROPPED, not passed through (memo I7).
async function validateExtraction(raw) {
  const out = { attributesRaw: {} };

  out.target = raw?.target === 'supplier' ? 'supplier' : 'product';
  out.keywords = Array.isArray(raw?.keywords)
    ? raw.keywords.filter((k) => typeof k === 'string' && k.trim()).slice(0, 10)
    : [];

  if (typeof raw?.category === 'string') {
    const cat = await Category.findOne({ name: raw.category, active: true }).select('_id slug').lean();
    if (cat) out.category = cat.slug; // unknown category name → dropped
  }

  if (typeof raw?.country === 'string' && /^[A-Za-z]{2}$/.test(raw.country)) {
    out.country = raw.country.toUpperCase();
  }
  if (typeof raw?.currency === 'string' && CURRENCIES.includes(raw.currency.toUpperCase())) {
    out.currency = raw.currency.toUpperCase();
  }
  if (Number.isFinite(raw?.priceMax) && raw.priceMax >= 0) out.priceMax = raw.priceMax;
  if (Number.isFinite(raw?.moqMin) && raw.moqMin >= 0) out.moqMin = raw.moqMin;
  if (raw?.verifiedOnly === true) out.verifiedOnly = true;
  if (raw?.priceIntent === 'low' || raw?.priceIntent === 'high') out.priceIntent = raw.priceIntent;

  // Attributes are checked against the RESOLVED category's real definitions —
  // this is where "validate against known attributes, drop unrecognised" lands.
  if (out.category && raw?.attributes && typeof raw.attributes === 'object') {
    const leafIds = await resolveCategoryLeafIds(out.category);
    const defs = await CategoryAttribute.find({ categoryId: { $in: leafIds }, filterable: true }).lean();
    const byKey = new Map(defs.map((d) => [d.key, d]));
    for (const [key, value] of Object.entries(raw.attributes)) {
      const def = byKey.get(String(key).toLowerCase());
      if (!def) continue; // hallucinated key → dropped
      if (def.inputType === 'select' && !def.options.includes(value)) continue;
      if (def.inputType === 'number' && !Number.isFinite(Number(value))) continue;
      out.attributesRaw[def.key] =
        def.inputType === 'number' ? Number(value) : def.inputType === 'boolean' ? Boolean(value) : String(value);
    }
  }
  return out;
}

// Turn the validated extraction into the engine's own parameter shape.
function toSearchParams(extracted, fallbackQuery) {
  const q = extracted.keywords.length ? extracted.keywords.join(' ') : fallbackQuery;
  const params = {
    q,
    page: 1,
    pageSize: 20,
    currency: extracted.currency ?? 'INR',
    sort: extracted.priceIntent === 'low' ? 'priceAsc' : extracted.priceIntent === 'high' ? 'priceDesc' : 'relevance',
  };
  if (extracted.category) params.category = extracted.category;
  if (extracted.country) params.country = extracted.country;
  if (extracted.priceMax !== undefined) params.priceMax = extracted.priceMax;
  if (extracted.moqMin !== undefined) params.moqMin = extracted.moqMin;
  if (extracted.verifiedOnly) params.verifiedOnly = true;
  params.attributes = Object.entries(extracted.attributesRaw).map(([key, value]) => ({ key, values: [value] }));
  return params;
}

function answerFor(extracted, total) {
  const bits = [];
  if (extracted.category) bits.push(`in ${extracted.category.replace(/-/g, ' ')}`);
  if (extracted.country) bits.push(`from ${extracted.country}`);
  if (extracted.priceMax !== undefined) bits.push(`under ${extracted.priceMax}`);
  if (extracted.moqMin !== undefined) bits.push(`MOQ ${extracted.moqMin}+`);
  if (extracted.verifiedOnly) bits.push('verified sellers only');
  const scope = bits.length ? ` ${bits.join(', ')}` : '';
  return total === 0
    ? `No matches${scope}. Try removing a filter or describing it differently.`
    : `Found ${total} ${extracted.target === 'supplier' ? 'suppliers' : 'products'}${scope}.`;
}

/**
 * Runs the AI pipeline. NEVER throws for an AI-side problem: on any failure the
 * caller gets plain keyword results with `fallback: true`.
 */
export async function aiSearch({ query }) {
  const runKeyword = async (target = 'product') => {
    const params = { q: query, page: 1, pageSize: 20, currency: 'INR', sort: 'relevance', attributes: [] };
    return target === 'supplier' ? searchSuppliers(params) : searchProducts(params);
  };

  if (!isAiConfigured()) {
    // No key configured (e.g. before the client provides one) — behave exactly
    // like a failure: keyword results, flagged, never a 5xx.
    const results = await runKeyword();
    return { answer: null, extracted: null, results, target: 'product', fallback: true };
  }

  let extracted;
  try {
    const system = await buildSystemPrompt();
    const raw = await completeJson({ system, user: query });
    extracted = await validateExtraction(JSON.parse(raw));
  } catch (err) {
    // Log the SHAPE of the failure only — never the key, never the raw payload.
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'ai search failed; falling back to keyword');
    const results = await runKeyword();
    return { answer: null, extracted: null, results, target: 'product', fallback: true };
  }

  const params = toSearchParams(extracted, query);
  const results =
    extracted.target === 'supplier'
      ? await searchSuppliers({ ...params, category: undefined, attributes: [] })
      : await searchProducts(params);

  return {
    answer: answerFor(extracted, results.total),
    extracted: {
      target: extracted.target,
      keywords: extracted.keywords,
      category: extracted.category ?? null,
      country: extracted.country ?? null,
      priceMax: extracted.priceMax ?? null,
      moqMin: extracted.moqMin ?? null,
      verifiedOnly: Boolean(extracted.verifiedOnly),
      attributes: extracted.attributesRaw,
    },
    results,
    target: extracted.target,
    fallback: false,
  };
}
