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

  return `You are the search-query parser for a B2B import/export marketplace (MPX Global).
The buyer writes ONE line, informally, in English, Hindi, Hinglish or a mix, often with
typos and filler words. Turn it into a STRICT JSON search query. Return ONLY the JSON.

Your job is to produce a query that FINDS the buyer what they asked for. A filter you
guessed is worse than no filter at all: it silently hides stock they wanted, and they
never learn why. When in doubt, leave a filter out and let the keywords do the work.

CATEGORIES — map the buyer's words, including the synonyms in brackets, to exactly ONE
of these names. If none clearly fits, use null. NEVER output a name that is not listed:
${list}

OUTPUT SHAPE (omit any field the buyer did not actually express):
{
  "target": "product" | "supplier",
  "keywords": ["..."],
  "category": "<one name from the list above>" | null,
  "priceMax": <number> | null,
  "priceIntent": "low" | "high" | null,
  "moqMin": <number> | null,
  "country": "<ISO alpha-2>" | null,
  "currency": "<ISO-4217>" | null,
  "attributes": { "<spec name>": "<value>" },
  "verifiedOnly": true | false
}

keywords — REQUIRED and never empty. This is what actually searches the catalogue.
- Keep the product/service words. Drop filler ("mujhe", "chahiye", "I need", "looking
  for", "please", "kya aap") and drop any word you already captured in another field.
- ALWAYS add the ENGLISH term alongside a Hindi/Hinglish one:
  "dawai" -> ["dawai","medicine"], "kapda" -> ["kapda","fabric"],
  "chawal" -> ["chawal","rice"], "masala" -> ["masala","spices"].
  The catalogue is indexed in English, so the English word is what matches.
- Fix obvious typos ("cottn" -> "cotton"). Max 10 entries.
- If the line has no clear product word, fall back to the buyer's own significant words.

HARD FILTERS — set ONLY from a value the buyer actually stated. These EXCLUDE results.
- priceMax: only an explicit cap — "under 500", "500 se kam", "max ₹500".
- moqMin: only an explicit quantity — "MOQ 1000", "1000 pieces minimum", "500+ order".
- country: ISO alpha-2 of where they want to BUY FROM — "India" -> "IN", "UAE" -> "AE",
  "China" -> "CN". Exactly two uppercase letters, never a full country name.
- currency: ISO-4217 — "rupees"/"₹" -> "INR", "dollars"/"$" -> "USD", "€" -> "EUR".
- attributes: only specs they actually named, as {"spec":"value"} — e.g. "120 gsm"
  -> {"gsm":"120"}, "in blue" -> {"colour":"blue"}. Omit entirely if none. (These are
  illustrations: use whatever spec word the buyer used; unknown ones are dropped later.)
- verifiedOnly: true only if they ask for verified / genuine / trusted / certified sellers.

NEVER GUESS A NUMBER. "bulk", "thok", "wholesale", "large order", "container load" state
an INTENT, not a quantity — leave moqMin null. "cheap", "sasti", "budget", "affordable"
are NOT a price cap — leave priceMax null and use priceIntent instead. Inventing a number
here is the single worst mistake you can make: it hides matching stock behind a limit the
buyer never asked for.

SOFT SIGNAL — priceIntent only re-orders results, it never removes any:
- "low" for cheap / sasti / budget / affordable / low cost / kam daam / economical.
- "high" for premium / best quality / high grade / top / superior.

target — "supplier" ONLY when they ask for companies rather than goods (supplier,
manufacturer, exporter, vendor, factory, "kaun banata hai", "who supplies").
Otherwise "product".

Return valid JSON only.`;
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

/**
 * The filters that were ACTUALLY applied, given the target.
 *
 * §A27.3: supplier mode's engine takes `q` / `country` / `verifiedOnly` and
 * nothing else — a company is not "in" one category and carries no price or MOQ,
 * so `searchSuppliers` ignores category, priceMax, moqMin and attributes. Both
 * the answer sentence and the `extracted` echo are built from THIS, not from the
 * raw extraction: telling a buyer "Found 12 suppliers in textiles, under 500"
 * when neither filter was applied is a false claim about their own results —
 * they would reasonably believe the list was narrowed when it is the full set.
 *
 * The key set stays identical in both modes, so the client response shape never
 * changes; the unapplied fields are simply null/empty.
 */
function appliedExtraction(extracted) {
  if (extracted.target !== 'supplier') return extracted;
  return {
    target: 'supplier',
    keywords: extracted.keywords,
    country: extracted.country,
    verifiedOnly: extracted.verifiedOnly,
    attributesRaw: {},
  };
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

  // Report what the engine actually did, not what the model asked for.
  const applied = appliedExtraction(extracted);

  return {
    answer: answerFor(applied, results.total),
    extracted: {
      target: applied.target,
      keywords: applied.keywords,
      category: applied.category ?? null,
      country: applied.country ?? null,
      priceMax: applied.priceMax ?? null,
      moqMin: applied.moqMin ?? null,
      verifiedOnly: Boolean(applied.verifiedOnly),
      attributes: applied.attributesRaw,
    },
    results,
    target: applied.target,
    fallback: false,
  };
}
