# MPX Global — Phase 1 · Module 3 · **Search & Discovery** (Detailed)

> ## 🔴 Part A / Part B overrides (authoritative — supersede this reference doc)
> - **Search engine is LOCKED to Atlas Search** (Part B) — the "DECISION PENDING" in §5.1 / §13 is **resolved**. The index covers product text + **category name + synonyms** + seller company name; facets come from `CategoryAttribute` where `filterable: true`; **OR within a group, AND across groups**.
> - **Ranking** (Part B): text relevance → **verified-seller boost** → recency → listing completeness. **Verified is a boost, NEVER a filter** — the "verified-only" toggle in §3.1 is a separate, user-selected facet, not the ranking.
> - **§A12** — `synonyms` are **admin-editable** per category (so admin-created categories are searchable). **§A13 (reversed)** — saving is **buyer-only** (`SavedItem.buyerOrgId`; only a buyer account saves — an exporter buys from a separate buyer account per §A21). **§A1** — only `status: active` surfaces; `draft/inactive/archived/taken-down` and deactivated-category products are excluded **in the query**.
> - **🔴 M2↔M3 fixes (facets/filters):** (a) **`country`** facet = the seller's `Organisation.country` (Product has no country field; `countryOfOrigin` is goods-only) — join via `exporterOrgId`. (b) **`on_request` pricing = a separate filter toggle**, NOT caught by the min/max price range (on-request products have no price → a price filter must not drop them). (c) The facet panel **adapts to the leaf `type`** — goods-only facets (MOQ, country-of-origin, HS code) don't render for service categories. (d) A product's `categoryId` is always a **leaf/sub** (tops rejected) so `type` + attribute facets always resolve.

> Everything for the search experience: three search types, synonym matching, faceted filters, AI search, ranking, availability rules, endpoints, screens, and the GPT prompt for AI search.
> Language: this doc and all UI text are in English.
> Status: planning locked (except search-engine choice).

---

## 1. Overview

Buyers (and public/guests) find products and suppliers three ways, all resolving through **one search engine** and **one result surface**:

1. **Keyword search** — type a word; synonym matching maps it to a category (e.g. "medicines" → Pharmaceuticals & Medical). A Products/Suppliers toggle sets what is returned.
2. **Faceted filters** — narrow by category, country, price, MOQ, and dynamic attribute filters generated from `CategoryAttribute`.
3. **AI search** — a modal where the buyer types a natural-language query; a single OpenAI call extracts keywords + structured filters, which run through the same engine and return an AI answer plus results.

Only new model: **`SavedItem`** (see separate doc). Everything else is a read/query layer over existing `Product`, `Category`, `CategoryAttribute`, `Organisation`.

---

## 2. Search type 1 — Keyword search

### 2.1 What it does
- Buyer types text in the search bar.
- A **Products | Suppliers** toggle decides the result type (buyer states intent — no guessing, no GPT).
- The engine matches against **product text + category names + category synonyms + seller names**.

### 2.2 Synonym matching (the core problem it solves)
Buyers don't know our category names. They type "medicines", not "Pharmaceuticals & Medical". So:
- Each category carries a **`synonyms: [String]`** field (e.g. Pharmaceuticals → medicine, medicines, pharma, drugs, tablets, dawai).
- The search index includes **category name + synonyms + product text**, not just product name.
- A query hits any of these → the category and its products/suppliers surface.

> **New requirement locked here:** add `synonyms: [String]` to the `Category` model, seeded per category.

### 2.3 What is searched
| Source | Field(s) |
|---|---|
| Product | name, description, attribute values |
| Category | name, synonyms |
| Seller (Organisation) | company name |

### 2.4 Result
- Products mode → product cards.
- Suppliers mode → seller cards.
- If the query matched a category (via name/synonym), show a "matched category" hint and list that category's items.

---

## 3. Search type 2 — Faceted filters

### 3.1 Standard facets (always available)
- Category → sub-category
- Country / origin
- Price range (min–max)
- MOQ (min)
- Type (goods / service)
- Verified-only toggle

### 3.2 Dynamic attribute facets (the differentiator)
- Generated from `CategoryAttribute` where `filterable: true`.
- Example: Textiles → GSM (range), Material (select), Width. Pharmaceuticals → Form (select), Prescription (Y/N).
- These appear only when a category is active (selected or matched).

### 3.3 Filter logic
- **OR within a group**, **AND across groups** (e.g. Material = Cotton OR Silk, AND price ≤ 500).
- Show a **count** next to each facet option.
- **Real-time update** — results refresh as filters change.
- Normalise values/units (GSM, kg) so numeric range filters work — this is why `attributes.value` is mixed-type with a `unit`.

---

## 4. Search type 3 — AI search

### 4.1 UX
- A dedicated **✨ AI Search** button opens a **modal**.
- Modal has: a **Products/Suppliers toggle**, a **natural-language query box**, and example prompts.
- On submit → a single OpenAI call extracts keywords + filters → the same engine runs → the results screen shows an **AI answer** (short conversational summary) followed by the normal result cards + an "extracted filters" chip row.

### 4.2 Pipeline
1. Send the buyer's sentence + our filter schema to OpenAI (one call).
2. GPT returns **structured JSON**: keywords + filters (category, price, MOQ, country, attributes) + target (product/supplier).
3. **Validate** the JSON against known categories/attributes (drop anything unrecognised — prevents garbage/injection).
4. Run the **same search/filter engine** on the extracted filters (AI is not a separate engine).
5. Return results + a short AI answer string.

### 4.3 Guardrails
- **Fallback:** if OpenAI fails/times out, run a plain keyword search on the raw query.
- **Rate-limit** per user; **timeout** the call; **OpenAI only**.
- **No embeddings / semantic vectors** in Phase 1 (that's Phase 2).

---

## 5. The one engine — ranking, sort, pagination

### 5.1 Search engine choice (🔴 RESOLVED — Part B: LOCKED to Atlas Search)
- **Atlas Search** — LOCKED (Part B). Fuzzy/typo tolerance, better relevance, built-in facets; already on Atlas.
- ~~Native Mongo text index~~ — not chosen.
- **Ranking (Part B):** relevance → verified-seller **boost** → recency → listing completeness (verified is a boost, never a filter).

### 5.2 Sort
- Relevance (default), Newest, Price (low→high / high→low).

### 5.3 Pagination
- Page-based or infinite scroll; lazy-load facets on mobile.

---

## 6. Availability rules (what shows in results)

- Only products with `status: active`.
- Exclude **taken-down** products and products in **deactivated categories** (cascade).
- Exclude **draft / inactive / archived**.
- **B7:** all sellers are shown regardless of KYC; verification **never filters** results. The public projection carries a **`verified` boolean** (derived server-side from `kycStatus`) — raw `kycStatus`/`rejected` is never exposed. (Frontend renders the tick from `verified`, **not** `kycStatus`.)
- Guests can search; login is required only to save (buyer account).

---

## 7. Cards (3 types)

| Card | Shows | Tap → |
|---|---|---|
| **Product card** | image, name, price (fixed/range/on-request), MOQ, seller + tick, save | Product detail |
| **Supplier card** | logo, name, verified tick, country, product count, save | Seller profile |
| **Category card** | name, image, product count | Filtered listing |

Shared sub-components: verified-tick badge, save button, "unavailable" badge.

---

## 8. Backend endpoints

- `GET /public/search` — keyword + filters + sort + page (query params: `q`, `type=product|supplier`, `category`, `price`, `moq`, `country`, `attr.*`, `sort`, `page`).
- `GET /public/facets` — available filters + counts for the current query/category.
- `POST /search/ai` — AI search (body: `{ query, target }`) → `{ answer, extracted, results }`.
- `GET /public/products/:id` — product detail.
- `GET /public/exporters/:id` — seller profile + their catalogue + tick.
- `POST /saved` · `DELETE /saved/:id` · `GET /saved` — saved items (buyer-scoped).

---

## 9. Screens (web + app)

**Web + app (buyer/public):**
1. **Search results screen** — search bar + Products/Suppliers toggle + dynamic filter sidebar + result grid + sort + count + pagination + save toggle.
2. **AI search modal** — query box + Products/Suppliers toggle + example prompts → AI answer + results.
3. **Product detail** — image gallery, specs (attributes), price, MOQ, seller + tick, save, enquiry (→ M4).
4. **Seller profile** — company info + tick, their catalogue, save supplier.
5. **Category browse** — category cards → filtered listing.
6. **Shared components** — product/supplier/category cards, filter panel, SaveButton, tick badge, unavailable badge.

**App specifics:** filters open as a full-screen modal; facets lazy-load.
**Roles:** buyer/public are the users; exporter can also search — search is a **public page open to all (guests included), never a permission and NOT a buying flow** (an exporter buys only from a **separate buyer account**, §A13/§A21); admin has no search screens.

---

## 10. SEO

- Public discovery / product / category pages are SEO-friendly.
- Filtered URLs: use **canonical** tag pointing to the unfiltered category page and **noindex** the filtered combinations (avoids crawl-budget waste from thousands of filter URLs).

---

## 11. GPT prompt for AI search (keyword/filter extraction)

Use this as the system prompt. The model must return **only JSON** (no prose, no markdown). Then validate the JSON server-side and feed it to the same search engine.

```
SYSTEM PROMPT
-------------
You are a search query parser for a B2B import/export marketplace (MPX Global).
The buyer types a natural-language request. Convert it into a STRICT JSON object of
search keywords and structured filters. Return ONLY the JSON — no explanation, no
markdown, no code fences.

Available categories (map buyer words, including synonyms, to the closest one; use null if none):
- Agriculture, Apparel & Garments, Textiles Fabrics & Yarn, Chemicals Dyes & Solvents,
  Pharmaceuticals & Medical, Electronics & Electrical, Industrial Machinery & Equipment,
  Metals Minerals & Ores, Building & Construction, Packaging Material & Supplies,
  Electricals Lighting & Solar, IT Software & AI Services, Finance Accounting & BPO,
  Healthcare & Clinical Services, Education Training & EdTech, Marketing Design & Digital Services,
  Other
  (…full 40-category list injected here at runtime, with each category's synonyms…)

Output JSON shape (include a field only if present in the query; otherwise omit it):
{
  "target": "product" | "supplier",      // what the buyer wants; default "product"
  "keywords": ["..."],                    // core search terms (product/material names)
  "category": "<one category name>" | null,
  "priceMax": <number> | null,            // if buyer implies a ceiling or "cheap/budget/low"
  "priceIntent": "low" | "high" | null,   // sorting hint when no exact number
  "moqMin": <number> | null,              // if buyer mentions bulk / a minimum quantity
  "country": "<country>" | null,          // shipping/origin preference if stated
  "attributes": { "<key>": "<value>" },   // category-specific specs, e.g. {"Material":"Cotton","Form":"Tablet"}
  "verifiedOnly": true | false
}

Rules:
- Map informal/synonym words to the correct category (e.g. "medicines"→Pharmaceuticals & Medical,
  "kapda"/"cloth"→Textiles Fabrics & Yarn).
- "cheap", "budget", "sasti", "affordable", "low cost" → "priceIntent":"low".
- "bulk", "large order", "thok" → set a reasonable "moqMin" (e.g. 1000) if no number given.
- Only use attribute keys/values that belong to the resolved category.
- If nothing maps, return {"target":"product","keywords":[<original query words>]}.
- Never invent categories or attributes that are not in the provided list.
- Return valid JSON only.

USER MESSAGE
------------
<the buyer's raw query text>
```

### 11.1 Example

Buyer query: **"I need cheap cotton fabric in bulk, 500+ MOQ, shipping to Australia"**

Expected model output:
```json
{
  "target": "product",
  "keywords": ["cotton fabric"],
  "category": "Textiles Fabrics & Yarn",
  "priceIntent": "low",
  "moqMin": 500,
  "country": "Australia",
  "attributes": { "Material": "Cotton" }
}
```

Server then: validate → run the same search engine with these filters → generate a short AI answer ("Searched products in Textiles, prioritised low price, MOQ ≥ 500 …") → return `{ answer, extracted, results }`.

### 11.2 Notes
- Keep the call cheap: one request, low max-tokens, temperature 0 (deterministic parsing).
- Inject the live category + synonym + attribute list into the prompt at runtime so it always matches the DB.
- Always JSON-parse defensively; on parse failure, fall back to keyword search.

---

## 12. Conflict-check (against locked decisions) — ✅ clean
- SavedItem in M3 (moved from M2); B7 all-shown + tick; active-only + takedown-excluded; seller-profile display in M3 (data from M1/M2); AI single-call, no embeddings; toggle for normal search, GPT only in AI search — all consistent. No conflicts.

## 13. Pending decisions — 🔴 RESOLVED
1. **Search engine:** ~~Atlas vs native~~ → **LOCKED to Atlas Search** (Part B).
2. `synonyms: [String]` on Category — **confirmed** and **admin-editable** (Part A §A12).