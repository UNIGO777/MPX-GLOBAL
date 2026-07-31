# M3 — Discovery & Search · Backend Build Plan (phased)

> **Module:** Phase-1 Module 3 (Discovery & Search) — keyword search, facets, AI search, saved
> items, SEO surfaces.
> **Scope status:** 100% confirmed Phase-1 / month-1 scope. No Bucket-A/B or D-item red-alerts.
> (Semantic/embedding search, recommendations, analytics, recently-viewed = Phase 2. Enquiry/chat
> = M4. Quotation = deferred.)
> **Backend root:** `MPX-BACKEND-FULL-SAAS/`
> **Sources of truth (precedence order):**
> 1. `docs/MPX-M2-M3-Build-Prompt.md` **Part A §A1–§A27** — note **§A26** (engine reversal) and
>    **§A27** (M3 build parameters) are the newest and override the plan docs.
> 2. `modules-in-detailed/m3-search-filter-3-4days-max/` — `m3.md` · `Search.md` ·
>    `Saved-item.md` · `m3-seo-rules.md`
> 3. `docs/MPX-Module3-COMPLETE-MEMO.md` (granular decisions) · `docs/MPX-COMPLETE-BRAIN.md` §6
>
> ⚠️ Folder images are visual aids; where they disagree with Part A, Part A wins.
>
> **Legend:** ✅ already built (M1/M2) · 🔨 build now · 🧱 needs a decision/dependency · ⏳ deferred

---

## 0. Ground rules for this module (do not violate)

- **Public routes are whitelist-projected** through the shared `toPublic()` (A3). Any new field
  is private by default. Search results carry the **same** projections as M2's browse — a search
  result is not a richer object than a browse result.
- **B7 — verification NEVER filters.** The only permitted verification-shaped query condition is
  the buyer's explicit **opt-in "verified-only" facet** (carve-out already recorded in
  `.claude/rules/m3-public-projection.md`). The default ranking **boosts** verified sellers; it
  never hides unverified ones.
- **Query-level exclusion, always** — `status: 'active'` · not taken down · leaf category active
  under an active top. Never fetch-then-strip.
- **Saving is BUYER-ONLY** (§A13) — `SavedItem.buyerOrgId`, `SCOPE.BUYER_ORG` (already in
  `scoping.js`), ownership-scoped reads/deletes, missing → 404.
- **§A26 — native `$text` only.** No Atlas operators anywhere. **One text index per collection**:
  extend the existing one, never add a second.
- **§A27 — price filter is currency-scoped**; **facet counts exclude their own group**; supplier
  search = company name/description; both public surfaces share one query builder.
- **AI: the OpenAI key never leaves the server**, one call per request, `temperature: 0`, hard
  timeout, rate-limited, JSON validated against real categories/attributes, fallback to keyword
  search on any failure. An unbounded GPT endpoint is a billing incident (api-endpoints B7).
- **M3 introduces NO new permission strings** (final pass — stated so none get invented): every
  surface here is either `publicRoute` or `authenticate + requireRole('buyer')`. The §A25 catalogue
  stays at eight. Admin has no discovery screens (m3.md §8) — do not add an admin search route.
- **M3 writes NO AuditLog entries.** A19 is explicit: the audit trail holds business actions and
  "does **not** record reads, searches, or page views" — so searching, faceting, saving and
  unsaving are all unaudited. Only the 5xx `errorLogs` path applies here.
- **Do not touch** Phase-2 skeleton models. M1 auth flow stays untouched. M2 code is extended
  only where §A26/§A27 require it (the new denorm fields + the shared query builder).
- Smallest change that works. No refactor of adjacent code.

---

## 1. Current state — what M1/M2 already delivered for M3

M3 is materially smaller than its docs suggest, because the M2 build front-loaded it:

| M3 needs | Status |
|---|---|
| `Product.sellerCountry` + `sellerVerified` (country facet + verified boost) | ✅ built (§A23) |
| `Category.synonyms` field + admin edit path (A12) | ✅ built (values 🧱 pending — owner content) |
| `CategoryAttribute.filterable` | ✅ built |
| `toPublic()` + `PUBLIC_FIELDS`/`PUBLIC_DERIVED` on Product/Category/Organisation | ✅ built |
| `getActiveLeafIds()` availability helper (+30s TTL cache, parent-aware) | ✅ built |
| `GET /public/products/:idOrSlug` — product detail (id **or** slug) | ✅ built (M2-F) |
| `GET /exporters/:idOrSlug` — seller profile + `productCount` (§9b), **id or slug** | ✅ built (M1 + M2-F; slug lookup added 2026-07-31 by the M3 verify pass) |
| `GET /public/products` — browse (category + seller filters, pagination) | ✅ built (M2-F) |
| `SCOPE.BUYER_ORG` for `SavedItem` | ✅ built (M2-A) |
| Unique/immutable slugs on Product · Category · Organisation | ✅ built |
| Product images, price shape, attributes `{key,value}` (Mixed, indexed) | ✅ built |

**So M3's real remaining surface is:** the search/facet engine, the three §A26 denorms, `SavedItem`
+ its availability rules, AI search, and the SEO endpoints.

**Tests:** 191/191 green, lint clean. They must stay green after every phase.

---

## 2. Phases (build order, with dependencies)

| ID | Phase | Depends on | Status |
|----|-------|-----------|--------|
| **M3-A** | §A26 denorms + text indexes + backfill script | — | ✅ DONE 2026-07-31 |
| **M3-B** | Shared query builder + `GET /public/search` (keyword, sort, paginate) | A | ✅ DONE |
| **M3-C** | `GET /public/facets` (standard + dynamic, §A27 counts) | B | ✅ DONE |
| **M3-D** | `SavedItem` model + endpoints + availability rules + cleanup hook | — | ✅ DONE |
| **M3-E** | AI search `POST /search/ai` (guardrails, fallback, limits) | B | ✅ DONE |
| **M3-F** | SEO: `sitemap.xml` + `robots.txt` — *`/exporters/:idOrSlug` shipped earlier* | B | ✅ DONE |
| **M3-G** | "Did you mean" (zero-result category/synonym suggester) | B | ✅ DONE |
| **M3-H** | Test matrix close-out + docs sync | all | ✅ DONE — **274/274 green** (192 pre-M3) |

**BUILT 2026-07-31 in one pass** (backend only — screens are a separate effort).
**Verification:** the full suite was run **19 times** — 274/274 on 18 of them, with one
unreproduced failure early in that sequence; **14 consecutive clean runs** followed the central
Redis-flush fix in `tests/setup.js`. Lint clean; production-mode boot + route-guard pass.
Owner content still pending (non-blocking): the top-40 synonyms list and the OpenAI key.

---

### M3-A · §A26 denorms, text indexes, backfill  🔨

**Goal:** make one-collection text search + faceting possible, with no stale copies.

**`Product` — three new internal-only fields** (never in `PUBLIC_FIELDS`; the projection rule's
private list gets them in the same pass):
- **`searchKeywords`** (String, `select:false`) — the denormalised search corpus: leaf **category
  name + its `synonyms` + the product's attribute values + the seller's company name**,
  space-joined and lowercased. *(Verify-pass fix: the company name was missing — memo **F8/K2**
  require product relevance to consider the seller name, so "TextileHub" in Products mode must
  return their listings. §A26 updated in the same pass.)*
- **`categoryType`** (`goods|service`) — copy of the leaf's `type`; powers the type facet.
- **`topCategoryId`** (ObjectId) — the leaf's parent; powers the category facet counts.

**Indexes:**
- `Product`: **ONE compound text index** — `{ name: 'text', searchKeywords: 'text',
  description: 'text' }` with weights `{ name: 10, searchKeywords: 5, description: 1 }`.
- `Product`: filter indexes on `categoryType`, `topCategoryId` (the §A23 pair already exists).
- `Organisation`: text index on `{ name: 'text', description: 'text' }` (weights `name` 10) —
  §A27.3 supplier search.
- ⚠️ Record in **both** models (Product AND Organisation): **only one text index per collection** —
  extend the compound index, never add a second.

**Sync points (the whole correctness story — write these deliberately):**
| Trigger | Action |
|---|---|
| Product create / edit (name, attributes, category) | rebuild `searchKeywords`; set `categoryType` + `topCategoryId` from the leaf |
| Admin renames a category **or** edits its `synonyms` | `updateMany` rebuild of `searchKeywords` for that category's products (rare, bounded) |
| **Organisation renamed** (A22 edit path, when built) | `updateMany` rebuild of `searchKeywords` for that org's products — the company name is in the corpus. Hook recorded in §A22.2 step 5 alongside the M4 conversation-name sync |
| Admin changes a sub-category's `type` | already blocked once products exist (M2-D) — no sync needed, note why |
| Org verify / demote / country edit | existing §A23 sync (untouched) |

**Non-issue, stated so it isn't read as a gap:** memo **H7** mentions "normalise units so numeric
range filters work" — no normalisation code is needed, because `unit` lives on the
`CategoryAttribute`, so every value of one attribute already shares a unit.

Helper `buildSearchKeywords(product, leaf)` lives in one place and is called from every path —
the M2 product service and the category service both import it.

**Backfill script** `scripts/backfill-m3-search-fields.mjs` — populates the three fields for
existing products, idempotent, safe to re-run, logs a count. Must be run per environment before
search goes live (same discipline as the A21 migrations).

**Tests:** create sets all three · attribute/category edit rebuilds keywords · category rename +
synonym edit bulk-syncs its products · backfill is idempotent · the three fields never appear in
any public response (extend the existing exact-key assertions).

---

### M3-B · The one engine — shared query builder + `GET /public/search`  🔨

**`buildAvailabilityFilter()` + `buildFacetFilter(params)`** — extracted into
`services/search.query.js` and used by **both** `/public/products` (M2 browse) and
`/public/search` (§A27.4). M2's existing browse switches to it; behaviour unchanged, tests prove it.
⚠️ **Browse keeps its EXACT shipped param set** (`category`, `seller`, `page`, `pageSize`) — sharing
the builder must not silently turn browse into a second search endpoint. Only the internal filter
construction is shared (verify-pass clarification).

**`GET /public/search`** (`publicRoute` + a dedicated **`searchLimiter`**) — the api-endpoints rule
names **search** explicitly among the endpoints that must be rate limited, and a text-search +
`$facet` request costs far more than the plain reads `generalLimiter` was sized for. Keyed per user
when signed in, per IP otherwise (the `uploadLimiter` pattern). `/public/facets` shares it;
**M2's `/public/products` browse keeps `generalLimiter`** — it stays a cheap read and its shipped
behaviour must not change (final pass, stated so the limiter swap doesn't leak across).
Params:
`q` · `type=product|supplier` (default product) · `category` (id/slug — top or leaf) ·
`country` · `priceMin`/`priceMax` + **`currency`** (§A27.1) · `onRequest=true` (separate toggle —
on-request products have no price and must not be dropped by a range) · `moqMin` (goods) ·
`goodsOrService` · `verifiedOnly` (opt-in) · `sort=relevance|newest|priceAsc|priceDesc` ·
`page`/`pageSize` (capped), plus **two attribute filter forms** (verify-pass fix — the single
value-match form could not express the numeric ranges memo **H3/H7** explicitly require,
e.g. "GSM 100–150"):
- `attr[<key>]=v1,v2` — **value match**, OR within the group (select / boolean / text)
- `attr[<key>][min]` / `attr[<key>][max]` — **numeric range** (number attributes only)

🔴 **BRACKET syntax, never dotted — this is a hard constraint, not a style choice** (second
verify pass): our own `rejectMongoOperators` middleware rejects **any** request key containing a
dot (`/^\$|\./`), and the `qs` "extended" parser does **not** expand dots into objects
(`allowDots` is off). So a `?attr.gsm=140` query would arrive as the literal key `"attr.gsm"` and
be **400-rejected before reaching the controller** — the previously-planned syntax could never
have worked. Bracket notation nests into `{ attr: { gsm: … } }`, whose keys are clean.

Both forms compile to `attributes: { $elemMatch: { key, value … } }`; AND across different keys.
The validator resolves each `<key>` against real `CategoryAttribute` rows and **rejects unknown
keys** and range syntax on a non-number attribute.

**Products path:** `$match` (availability + filters, `$text` when `q` present) →
`$addFields` score (`$meta: 'textScore'`) → `$sort` → `$facet` for rows+total → projection through
`toPublic()`. ⚠️ `$text` **must** sit in the first `$match` and the `textScore` projection must
precede `$facet` — build the pipeline so a later edit cannot reorder it.
**Ranking (unchanged intent):** `textScore` → `sellerVerified` boost → recency → completeness
(has images / filled fields). Without `q`, relevance falls back to newest.

🔴 **Price SORT carries the same mixed-currency flaw §A27.1 fixed for the price FILTER** (second
verify pass — previously undefined). Sorting `100 USD` against `100 INR` numerically is
meaningless, and on-request products have no number at all. Rule, so nothing is invented at build
time: **`sort=priceAsc|priceDesc` never changes the result SET** (a sort must not silently filter);
it orders in three tiers —
1. products priced in the **selected `currency`** (default `INR`), by `price.min` asc/desc,
2. then products in **other currencies**, by recency,
3. then **on-request** products, by recency.
Deterministic, honest, and no FX conversion is implied anywhere.

**Suppliers path (§A27.3):** `Organisation` text search on name/description, filtered to
`exporterSide: true, isActive: true`; returns the seller public projection + `productCount`.
- ⚠️ **`productCount` must be batched** (verify-pass fix): a page of 20 sellers must not fire 20
  `countDocuments` calls. One `$lookup` with a pipeline (or a grouped count over the page's org
  ids) computed once per request.
- **Supplier-mode filters are deliberately NARROW** (verify-pass gap — previously undefined):
  only **country** and **verified-only** apply, and sorts are **relevance | newest** (no price).
  Reason: **"working categories" were cancelled (§A22.5)**, so an Organisation has no category,
  price or MOQ of its own — those are product concepts. A build session must not invent a
  supplier↔category association from their listings; that was considered and rejected in §A27.3.
- **Sellers with zero live listings DO appear** in supplier results (flagged default, second
  verify pass): they are real, publicly-visible companies (B7 — a profile is public from signup),
  and `productCount: 0` tells the buyer the truth. Hiding them would be a visibility gate that no
  decision authorises.
- **Product-only params are rejected in supplier mode, not silently ignored** (final pass):
  `sort=priceAsc|priceDesc`, `priceMin/Max`, `moqMin`, `onRequest`, `goodsOrService`, `category`
  and any `attr[...]` with `type=supplier` → **400** naming the offending parameter. Silent
  ignoring hides a frontend bug; an explicit error surfaces it in development.

**B7 holds on both paths** — verification is never a query condition unless `verifiedOnly` is
explicitly set by the buyer.

**Tests:** keyword hits name/description · **synonym hit** ("medicines" → Pharmaceuticals product,
via `searchKeywords`) · availability exclusions (draft/inactive/archived/taken-down/dead-category)
still hold under search · verified boost orders results without filtering unverified out ·
`verifiedOnly` filters only when asked · **on-request products survive a price filter via the
toggle and are excluded from a range** · currency scoping (§A27.1: a USD product does not match an
INR range) · attribute OR/AND semantics · sorts · pageSize cap · supplier path returns sellers,
not products · exact public key-set on every result row · **M2 browse tests still green** after the
builder swap.

---

### M3-C · `GET /public/facets` — counts and available filters  🔨

**Contract:** takes the **same query params as `/public/search`** (verify-pass clarification) —
facet counts are always "for the current query", so `q` and every active filter must be passed in.
In `type=supplier` mode it returns only the two supplier facets (country, verified).

- **Standard facets:** category (by `topCategoryId`, then leaves when a top is selected) · country
  (`sellerCountry`) · price buckets **within the selected currency** · MOQ buckets (goods only) ·
  `goodsOrService` (`categoryType`) · verified-only.
- **Dynamic attribute facets:** from `CategoryAttribute` where `filterable: true`; none when no
  category is selected. `select`/`boolean` → value counts; `number` → range bounds (min/max) so the
  UI can render a slider.
  **When a TOP is selected, show the INTERSECTION of its leaves' filterable keys — not the union**
  (final pass; previously ambiguous). A union across ~8 leaves would list attributes that most of
  the visible products cannot have, so nearly every option would read as 0 and the panel would look
  broken. The intersection shows only what is meaningful for the whole top; selecting a leaf then
  reveals that leaf's full set. *(Attributes are matched by `key`, which is immutable — M2-D.)*
- **Price buckets need a currency** (second verify pass — previously undefined): buckets are
  computed **within the selected `currency`, defaulting to `INR`**, and the response echoes which
  currency they describe so the UI can label the slider. Never bucket across currencies.
- **Type-aware:** goods-only facets (MOQ, country-of-origin, HS code) are **absent** for a service
  category — the panel adapts to the leaf `type`.
- **§A27.2 counting:** each facet group's counts are computed with all filters applied **except
  that group's own** (one small aggregation per group); the result set itself has all filters.
  ⚠️ Consequence to accept: a facets request with `q` runs **one `$text` search per facet group**
  (~5–8 small aggregations). Fine at Phase-1 volumes; if it ever isn't, the fix is caching per
  (query, filters) — **not** collapsing to the cheaper counting model, which §A27.2 rejected.

**Tests:** counts exclude own group (select Cotton → Silk still shows a non-zero count) · counts
respect the other filters · attribute facets appear only with a category and only for
`filterable` · goods-only facets absent on a service category · number facets return bounds ·
inactive categories/leaves never appear.

---

### M3-D · `SavedItem` — model, endpoints, availability, cleanup  🔨

**Model** (the only new model in M3): `{ buyerOrgId, targetType: 'product'|'supplier', targetId,
savedAt }` · **unique compound `(buyerOrgId, targetType, targetId)`** (duplicate save impossible at
the DB level) · index on `buyerOrgId` · `declareScope(SCOPE.BUYER_ORG)`.

⚠️ **`targetId` is a plain `ObjectId` with NO `ref`** (third verify pass): it points at a `Product`
**or** an `Organisation` depending on `targetType`, so a static `ref` would be wrong half the time
and `populate()` would silently resolve against the wrong collection. Resolve it manually by
`targetType` (or use `refPath` if populate is ever genuinely needed).

**Endpoints** (`authenticate` + `requireRole('buyer')`; the org must be `buyerSide` — same
defensive guard as M2's exporter check):
- `POST /saved` — `{ targetType, targetId }`; validates the target **exists and is publicly
  visible at save time**; duplicate → 409 (or idempotent 200 — **flagged default: 409**).
- `DELETE /saved/:id` — `findOne({ _id, buyerOrgId })` → 404 if not the caller's.
- `GET /saved?targetType=` — paginated (capped), newest first, each row carrying the target's
  **public projection** + an **`available` boolean + `unavailableReason`**. ⚠️ The availability
  check is **batched per page** (one products query + one orgs query for the page's target ids),
  never a lookup per row.

🔴 **The saved list must NOT reuse `getPublicProduct()` / `getPublicExporter()`** (third verify
pass — this would silently break the module's central rule). Those helpers apply the availability
filter **in the query** and therefore **404 exactly the rows the saved list is required to keep
and flag**. The saved read loads targets **without** the availability filter, then evaluates
availability itself and marks each row. Reuse the **projection** (`toPublic` + `PUBLIC_FIELDS`),
never the availability-filtered **read path**.

**Availability rules (the heart of this phase — Saved-item.md §3):**
| Target state | Saved list |
|---|---|
| product inactive / taken down / category deactivated | **stays**, flagged `available: false` ("currently unavailable") |
| supplier org deactivated or blocked | **stays**, flagged unavailable |
| product **archived** (seller delete) | **removed by cleanup** — no dead entries |
| product **purged** (A8 180-day) | **removed by cleanup** |

**Cleanup hooks:** the M2 `archiveProduct()` path and the A8 purge job both delete that product's
`SavedItem` rows. Both are existing code — the hook is added there, and both get a test.

⚠️ **The read path must still tolerate a dangling `targetId`** (second verify pass): rows saved
before these hooks existed, or any future path that removes a target without them, would otherwise
render a broken entry. `GET /saved` **skips a target it cannot load**. Defensive, not a substitute
for the hooks. *(Final-pass correction: the one-off orphan sweep belongs **here in M3-D**, not in
the M3-A backfill script — `SavedItem` does not exist until this phase, so M3-A could not sweep a
collection that isn't there yet.)*

**Tests:** duplicate save blocked by the index · cross-buyer unsave → 404 · exporter account
cannot save (403) · inactive/taken-down/dead-category target stays flagged unavailable ·
**archive removes the saved rows** · **purge removes the saved rows** · saved list returns public
projections only · pageSize cap.

---

### M3-E · AI search — `POST /search/ai`  🔨

- **One** OpenAI call per request: system prompt from `Search.md` §11, `temperature: 0`, low
  max-tokens, **hard timeout** (~8s), key from `env` only, **never** exposed to a client.
- 🔴 **NO new dependency — call the HTTP API with the built-in `fetch`** (final pass: the plan had
  quietly assumed an OpenAI client library, and CLAUDE.md forbids adding a dependency without
  asking). Node 20 ships global `fetch` + `AbortController`, which is all a single
  `POST /v1/chat/completions` with a timeout needs. It also keeps the call trivially mockable in
  tests. 🧱 If the owner would rather have the official `openai` SDK, say so — that is a
  dependency decision, not a build-time default.
- **Runtime injection — the 40 TOP categories + their synonyms ONLY** (🔴 third verify pass;
  `Search.md` §11's "inject the live category + synonym + **attribute** list" is not buildable as
  written). Two reasons: *(a)* **cost/latency** — the tree is 40 tops + ~262 subs, and every
  sub's attributes on top of that would be thousands of tokens on **every** search, flatly
  contradicting memo I7's "keep the call cheap, low max-tokens"; *(b)* **a chicken-and-egg** — the
  attributes we would want to inject belong to *the category the model has not resolved yet*, and
  a second call is banned (single-call rule). So: inject tops + synonyms (~a few hundred tokens),
  let the model name a category, and handle attributes on the **validation** side below.
- **Strict validation (this is where attributes are handled):** parse defensively; resolve the
  named category against the DB; then check every returned attribute key/value against **that
  category's** real `CategoryAttribute` rows and **drop anything unknown** — which is exactly what
  memo I7's "validate against known categories/attributes, drop unrecognised" asks for, just
  post-hoc instead of pre-injected. Coerce types; ignore unknown JSON fields. The validated object
  then runs through the **same engine as M3-B** — AI is a query *translator*, never a second engine.
- **Fallback:** any failure/timeout/parse error → plain keyword search on the raw query, and the
  response says so (`fallback: true`) rather than erroring.
- **Route shape (verify-pass gap — was undefined):** the endpoint is **public** (guests may use
  it), but the limiter is supposed to key per user when signed in. The existing `authenticate`
  **throws** without a token, so this needs a small **`optionalAuthenticate`** middleware —
  populates `req.user` when a valid Bearer token is present, otherwise continues anonymously,
  and **never** throws. It carries the `__public` marker so the boot route-guard still sees a
  declaration. Same middleware is what any future "personalised but public" read would use.
- **Rate limits:** per **user** when authenticated, per **IP** for guests (decided 2026-07-30) —
  a dedicated `aiLimiter`, tighter than `generalLimiter`, keyed off `req.user?.userId ?? ip`
  (exactly the pattern `uploadLimiter` already uses).
- **Per-organisation daily quota** as well (third verify pass — the api-endpoints rule requires it
  in as many words: *"AI endpoints also need a per-organisation quota — an unbounded GPT endpoint
  is a billing incident waiting to happen"*). A rate limit smooths bursts; the quota caps the day's
  spend. Guests fall back to the per-IP limiter only. **Stored in Redis** (final pass — it needs a
  store, and Redis is already the rate-limit backend and is required in production): a
  `q:ai:<orgId>:<YYYY-MM-DD>` counter with a 24h TTL. If Redis is absent in dev the quota is a
  no-op — the same degradation the limiters already accept — never a hard failure.
- **Response:** `{ answer, extracted, results, fallback }`.
- 🧱 Needs the **OpenAI key** to exercise end-to-end; unit tests mock the client, and one
  integration test is skipped unless a key is present.

**Tests (client mocked):** valid JSON → correct filters reach the engine · hallucinated category /
unknown attribute key dropped · malformed JSON → keyword fallback (200, `fallback: true`) ·
timeout → fallback · rate limit fires · **no key material in any response or log** · guests
allowed, per-IP keyed.

---

### M3-F · SEO endpoints  🔨

**✅ Prerequisite already SHIPPED (2026-07-31, pulled forward out of this phase).** The verify pass
found that the SEO spec serves seller pages at **`/supplier/:slug`** and the sitemap emits exactly
those URLs, while the API was **`GET /exporters/:id`, id-only** — so that page had no endpoint to
call. Fixed immediately rather than left for this phase: `GET /exporters/:idOrSlug` now takes the
same 24-hex-or-slug branch as product/category detail, the id behaviour is byte-for-byte unchanged
(kyc.test's exact-key assertions still green), and the duplicated id-or-slug helper (this was its
third copy) moved to the shared `src/utils/idOrSlug.js`. Covered by a test in `m2-public.test.js`
(slug === id payload · buyer-only org 404 by slug · blocked org 404 by slug · unknown slug 404).
**192/192 green.**

🔴 **Two delivery questions the SEO doc never answers — settle them before writing this phase**
(third verify pass):
1. **Absolute URLs need a configured public web origin.** A sitemap must emit
   `https://<web-domain>/product/<slug>`, and `robots.txt` must point at an absolute sitemap URL.
   The backend has no such value today → add **`PUBLIC_WEB_URL`** to `config/env.js` (required in
   production, defaulted in dev). Without it the sitemap is unusable and there is nothing to
   guess safely.
2. **These two files must be served from the WEB domain, not the API domain.** A crawler reads
   `https://mpx-web/robots.txt` and `.../sitemap.xml`; a sitemap sitting at `api.…/sitemap.xml`
   listing web URLs is cross-domain and mostly ignored. Since M3 builds them in the backend, the
   deployment must **reverse-proxy `/sitemap.xml` and `/robots.txt` from the web host to the API**
   (one nginx rule on the VPS — cheap, and it keeps generation dynamic). 🧱 Flag it to the owner
   with the VPS setup; do not silently ship endpoints nobody routes to.

- `GET /sitemap.xml` (`publicRoute`) — **active only**: products (`/product/:slug`), sellers
  (`/supplier/:slug`), categories — **tops as `/category/:slug` and subs as
  `/category/:parentSlug/:childSlug`** (final pass: SEO §1 defines both forms and the sitemap must
  pick one per row; the nested form is the canonical URL for a sub, so emitting the flat form too
  would create duplicate content). Each with `lastmod`. Drafts, inactive,
  archived, taken-down, dead-category rows, and every filtered/search URL are excluded. Cached
  in-process (short TTL) since it is a crawler-facing full scan; sitemap-index split if >50k URLs
  (not expected at Phase-1 volumes, but the split path is written).
- `GET /robots.txt` (`publicRoute`) — allow base public pages, `Disallow: /search`, disallow
  filter query patterns, reference the sitemap URL.
- **404/410 semantics** already hold from M2 (a non-public product/category/seller 404s) — a test
  pins them as an SEO guarantee, not just an API behaviour.
- Meta/canonical/OG/JSON-LD are **frontend** (SPA) — backend only supplies the projected data.
  SSR/prerender stays deferred (m3-seo-rules §8).

**Tests:** *(the `/exporters/:slug` cases already ship — see above)* · sitemap contains an active product and **not** a
draft/archived/taken-down/dead-category one · slugs (never ObjectIds) in the URLs · robots
disallows `/search` · sitemap is valid XML.

---

### M3-G · "Did you mean" (the §A26 fuzzy replacement)  🔨

Native `$text` has no typo tolerance, so: **only when a query returns zero results**, run a
closest-match pass (normalised edit distance) over the in-memory **category name + synonym** list
(~300 short strings, cached) and return `didYouMean: { term, categorySlug }` alongside the empty
result set. No extra dependency; no effect on non-empty queries.

Applies to the **AI fallback path too** (second verify pass): when AI search falls back to keyword
and that also returns zero, the response carries `didYouMean` as well — the buyer gets the same
help regardless of which entry point they used.

⚠️ The cached name+synonym list is **invalidated by the same admin category writes** that already
invalidate `activeLeafIds` (third verify pass) — otherwise a freshly-edited synonym is suggestible
only after a restart. Hook both caches in one place.

✅ **A quiet win worth recording so nobody "fixes" it away:** the text index runs the default
**English** analyser, whose stemming maps `medicines` → `medicin` ← `medicine`. So singular/plural
and common word forms already match **without** any fuzzy engine — the exact "medicines" case memo
F1 worries about. Do not set `default_language: 'none'` to "avoid surprises"; it would remove this.

**Tests:** "medisin" (zero hits) → suggests the Pharmaceuticals category · a good query returns no
suggestion · nonsense returns none (distance threshold) · suggester never runs on a non-empty
result set.

---

### M3-H · Test matrix close-out (definition of done)

- [ ] Synonym search works end to end ("medicines" → Pharmaceuticals products) — Part D's named case
- [ ] Draft / inactive / archived / taken-down / deactivated-category products never appear in
      **search, facets, sitemap, or saved lists** (query-level, per surface)
- [ ] B7: unverified sellers appear in results; `verifiedOnly` filters **only** when the buyer asks;
      raw `kycStatus` absent everywhere
- [ ] Every result row asserts the **exact public key set**; the three §A26 denorms never leak
- [ ] §A27.1 currency scoping · on-request toggle · §A27.2 facet-count semantics
- [ ] Saved: duplicate blocked · cross-buyer 404 · buyer-only · unavailable-vs-removed rules ·
      archive **and** purge cleanup
- [ ] AI: guardrails, fallback, rate limit, no key leakage · guests allowed via `optionalAuthenticate`
- [ ] SEO: sitemap active-only, robots disallows search, **`/exporters/:slug` resolves**
- [ ] Seller company name is searchable in Products mode (searchKeywords corpus)
- [ ] Numeric attribute **range** filter works (GSM 100–150) via **bracket** params, is rejected on
      a non-number attribute, and a **dotted** `attr.gsm` param is 400'd by `rejectMongoOperators`
- [ ] Price sort tiers correctly (selected currency → other currencies → on-request) and **never
      changes the result set**
- [ ] Price facet buckets are currency-scoped and echo their currency
- [ ] `GET /saved` skips a dangling target instead of erroring, and **still returns** an
      inactive/taken-down target flagged unavailable (i.e. it did not reuse the availability-filtered read)
- [ ] AI prompt injects tops+synonyms only; a hallucinated attribute key is dropped at validation
- [ ] AI per-organisation daily quota fires independently of the rate limiter
- [ ] Sitemap URLs are absolute against `PUBLIC_WEB_URL`; subs use `/category/:parent/:child`
- [ ] Supplier mode 400s a product-only param (price/moq/attr/category/sort=price)
- [ ] Attribute facets under a TOP show the intersection of its leaves' keys
- [ ] No new permission string and no AuditLog row is produced anywhere in M3
- [ ] Supplier mode exposes ONLY country + verified facets and relevance/newest sorts
- [ ] M2 browse still accepts exactly its shipped params after the shared-builder swap
- [ ] M1 + M2's 191 tests still green · lint clean · route-guard passes

---

## 4. NOT in M3 (boundary — do not build here)

Semantic/embedding search · recommendations · analytics · recently-viewed / search history ·
full quality ranking (ratings, orders, promoted) — **all Phase 2** · enquiry/chat (**M4**) ·
quotation (deferred) · admin search screens (m3: admin has none) · SSR/prerender (deferred) ·
frontend screens (separate effort) · any FX conversion (§A27.1).

## 5. Gotchas / risks (recorded so they don't bite)

- **One text index per collection** — the single hardest constraint of §A26, and it now applies to
  **Organisation too**. A future "let's also index X" must extend the compound index, not add another.
- **`searchKeywords` staleness** is the main correctness risk: every sync point in M3-A needs its
  test, or a renamed category silently stops matching.
- **Native `$text` matches whole words only** — no partial/prefix matching. Buyers typing "cott"
  get nothing; that is expected behaviour now, not a bug (M3-G softens only the zero-result case).
- **Backfill must run per environment** before search goes live (like the A21 index migrations).
- **`$text` + `$facet` in one pipeline:** `$text` must be in the FIRST `$match` stage — build the
  pipeline so this never gets reordered. Two more MongoDB constraints that bite silently:
  `$text` **cannot appear inside `$or`** (our availability filter is pure AND, so keep it that
  way), and `{ $meta: 'textScore' }` must be projected **before** `$facet`, since the sub-pipelines
  cannot see the text metadata.
- **Query params must never contain a dot.** `rejectMongoOperators` 400s any dotted request key and
  `qs` does not expand dots — so every nested filter uses **bracket** notation (`attr[gsm][min]`).
  This already invalidated one draft of the attribute-filter syntax; do not reintroduce it.
- **Blocked-org products still surface** (the accepted F1-B gap, now pinned by an M2 test) — search
  inherits it. Do **not** quietly add an org filter here; that is F1-B's decision.
- `vitest --no-file-parallelism` for reliable full-suite runs.

## 6. Owner checkpoints (🧱)

1. **Top-40 `synonyms` list** — owner content. Without it, synonym search only works for whatever
   an admin has typed in. **This is now the single biggest functional gap in M3**; the code path,
   the index and the admin edit screen all exist and wait for values.
2. **OpenAI API key** — client dependency (FINALIZE). AI search builds and unit-tests without it;
   the end-to-end path cannot be exercised until it lands.
3. **Flagged defaults** (say the word to change): duplicate save → **409** (not idempotent 200) ·
   AI timeout **8s** · sitemap cache TTL **1h** · did-you-mean distance threshold tuned to catch
   1–2 character typos only · **AI per-org quota 100 calls/day** · sellers with **zero** listings
   still appear in supplier results.
4. **🧱 VPS/deployment:** `PUBLIC_WEB_URL` must be set in production, and the web host must
   **reverse-proxy `/sitemap.xml` + `/robots.txt` to the API**. Both belong in the same
   conversation as the self-hosted-MongoDB setup (§A26 ops notes) — raise them together.
5. **🧱 One dependency question (final pass):** AI search is planned with the **built-in `fetch`**
   and **no new package**. Say the word if the official `openai` SDK is preferred instead — that is
   the only open dependency decision left in M3.

---

## 8. Verification record

This plan was verified **four times** before any code, each pass applying a different lens, and the
findings are all folded in above: **(1)** against the source docs and Part A — 8 gaps; **(2)**
against the actual shipped middleware and parser behaviour — 9 findings, including a query-param
syntax that our own `rejectMongoOperators` would have 400'd; **(3)** against the AI/SEO/SavedItem
internals — 7 findings, including a saved-list design that would have silently deleted the
module's central availability rule; **(4)** a final exhaustive sweep phase-by-phase — 8 findings,
including an ordering bug inside this plan itself and an unflagged dependency.
**32 findings total, all resolved.** Anything discovered from here is a build-time decision, not a
planning gap.

## 7. Security-tracker touchpoints

Public whitelist projections on every new surface (**A3**) · ownership scoping on SavedItem
(**A6**) · default-deny route declarations (**A5**) · input validation incl. `attr.*` and the
AI JSON (**B2**) · rate limiting on search + AI, with a per-org/IP quota on the GPT endpoint
(**B7**) · no secret in any response or log (**tracker rule 4**). Name these when each phase ships.
