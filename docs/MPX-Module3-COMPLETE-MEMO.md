# MPX Global — Module 3 (Discovery & Search) — COMPLETE MEMO

> Every single decision made for M3, down to the smallest detail. Nothing omitted. Numbered so nothing is missed.
> Language rule: all UI text English. Standing rule: conflict-check every new decision.

> ## 🔴 Part A overrides (authoritative — supersede this doc)
> `docs/MPX-M2-M3-Build-Prompt.md` **Part A (A1–A22)** is precedence-1 and wins over anything here. This round's items:
> - **§A17** no free-form specs anywhere ("Other" = fixed `CategoryAttribute` fields). **§A18** blocked-product purge = 180 days. **§A19** `Product.createdBy` dropped → product create AND edit write AuditLog (append-only/permanent); a separate MongoDB `errorLogs` (90-day TTL, strict exclusion list). **§A20** admin uploads category images incl. top categories (exception to activate/deactivate-only).
> - **§A21** dual accounts, separate login portals, two-step signup with Organisation claim/create.
> - **Organisation / company profile = ✅ SCOPED by §A22** (was PENDING; supersedes U2 below): company profile view/edit is **M1 work** — it is the missing capture path for **logo + description** (P2's public seller fields). KYC-checked fields (name, country, address, `entityType`) **lock after verification**; changing one drops `kycStatus` → `submitted` and withholds the tick. **No new model fields needed** — the work is the edit endpoint, the lock and the demotion.
> - **🚫 CANCELLED 2026-07-30 — "business type" + seller "main/working categories".** Removed from the public seller list (P2/M2 below), not deferred; `entityType` covers the purpose. **🔒 `website` is internal, never public** (it was being returned and has been removed). **✅ `establishedYear` IS public** — already returned, now whitelisted.

---

## A. Scope & models

A1. M3 = buyer/public-facing discovery. Search + saved items + product detail + seller profile + category browse.
A2. Search/filter and save-favourite were deliberately moved OUT of M2 and INTO M3.
A3. Only ONE new model in M3: **SavedItem**. Everything else is a read/query layer over existing models.
A4. Reused models: Product, Category, CategoryAttribute (from M2); Organisation (from M1).
A5. Category model gets ONE new field in M3: `synonyms: [String]`.
A6. Product needs new indexes (not a new model): text index (name+description+searchable attribute values), filter indexes on categoryId, status, country, attributes.key, attributes.value.
A7. No new model for "recently viewed" / "search history" — those are Phase 2, skipped.

## B. SavedItem model

B1. Polymorphic: one model handles both products and suppliers.
B2. Fields: `{ buyerOrgId, targetType:'product'|'supplier', targetId, savedAt, createdAt, updatedAt }`.
B3. `targetId` points to Product (if product) or Organisation (if supplier).
B4. **Unique compound index** `(buyerOrgId, targetType, targetId)` → blocks duplicate saves (can't save same thing twice).
B5. Index on `buyerOrgId` → fast saved-list retrieval.
B6. Buyer-scoped: all saved queries filtered by buyerOrgId; unsave uses `findOne({_id, buyerOrgId})` (ownership check).
B7. Future extensibility: can add `targetType:'category'` later without a new model.

## C. SavedItem availability rules (temporary vs permanent)

C1. **Temporarily unavailable** (product inactive/hidden, category deactivated, taken-down) → item STAYS in saved list, shown greyed as "currently unavailable" (may come back).
C2. **Permanently gone** (soft-deleted/archived OR hard-deleted) → item REMOVED from saved items via cleanup (post-delete hook / cascade). No dead entries.
C3. Chat/enquiry is unaffected by soft-delete (record preserved; product detail shows "not available").
C4. Enforcement: display = read-time status lookup (show "currently unavailable" for temporary); cleanup = on permanent delete remove SavedItem rows.
C5. Works the same regardless of who caused it — seller, admin, or future employee.

## D. Seller product delete logic (decided here, affects SavedItem)

D1. Seller CAN delete own products.
D2. **DRAFT** product (never published, no enquiry/save/references) → **HARD delete** (clean removal).
D3. Product that was **ever live/active** (may have enquiry/chat/save/order refs) → **SOFT delete / archive** (`status: archived`).
D4. UI shows "Delete" in both cases; backend decides hard vs soft (by whether it was ever published / has references).
D5. Consistent with M2 "takedown, not delete" philosophy.
D6. SavedItem read-time filter + cleanup handles both automatically.

## E. Search — three types (buyer does NOT choose keyword vs AI; both work)

E1. **Type 1 — Keyword search:** buyer types text; a **Products | Suppliers toggle** sets result type. Fast, no AI.
E2. **Type 2 — Faceted filters:** buyer narrows via filters (no typing needed).
E3. **Type 3 — AI search:** buyer types a natural-language sentence in a modal.
E4. All three resolve through ONE search engine and ONE result surface.
E5. They complement each other, not replace — same engine reused.
E6. Semantic/embedding search is NOT a 4th type in Phase 1 — deferred to Phase 2 (no embeddings).

## F. Keyword search + synonym matching (the "medicines" problem)

F1. Problem: buyer types "medicines"; doesn't know our category is "Pharmaceuticals & Medical".
F2. Solution is BACKEND's job, not the buyer's — buyer never has to pick keyword vs AI.
F3. Each Category has `synonyms: [String]` (e.g. Pharmaceuticals → medicine, medicines, pharma, drugs, tablets, dawai; Textiles → cloth, fabric, kapda, yarn).
F4. Search index includes **category name + synonyms + product text** (not just product name).
F5. Query flow: "medicines" → matches Pharmaceuticals via synonym → that category + its products/suppliers surface.
F6. Products also have their own searchable text (name + description + attribute values), so "paracetamol" matches the product directly even without the category name.
F7. `synonyms` seeded at seed-time; `synonyms` is search-only (not shown publicly as a field, though category is public).
F8. What is searched: Product (name, description, attribute values); Category (name, synonyms); Seller/Organisation (company name).
F9. If query matched a category, show a "matched category" hint + list that category's items.

## G. Products / Suppliers toggle (recommendation: toggle, NOT GPT)

G1. In normal keyword search, a Products | Suppliers toggle lets the buyer state intent explicitly.
G2. Decided: use a **toggle**, NOT GPT, for normal search — explicit, fast, free, reliable, no latency/cost, no wrong guesses.
G3. GPT is used only in AI search (where it also infers product-vs-supplier itself).
G4. Toggle also makes filters context-aware (products mode → product filters; suppliers mode → supplier filters).
G5. The AI search MODAL also has its own Products/Suppliers toggle (buyer chooses before submitting).

## H. Faceted filters

H1. **Standard facets:** category → sub-category, country/origin, price range (min–max), MOQ (min), type (goods/service), verified-only toggle.
H2. **Dynamic attribute facets:** generated from CategoryAttribute where `filterable: true`. Appear only when a category is active (selected or matched).
H3. Examples: Textiles → GSM (range), Material (select), Width; Pharmaceuticals → Form (select), Prescription (Y/N).
H4. Filter logic: **OR within a group, AND across groups** (e.g. Material=Cotton OR Silk, AND price ≤ 500).
H5. Show a **count** next to each facet option.
H6. **Real-time update** — results refresh as filters change.
H7. Values/units normalised (GSM, kg) so numeric range filters work — this is why attributes.value is mixed-type with a `unit`.
H8. On app, filters open as a **full-screen modal**; lower facets **lazy-load**.

## I. AI search (modal + answer)

I1. UX: a dedicated **✨ AI Search button** opens a **MODAL** (not a separate page/mode).
I2. Modal contains: a **Products/Suppliers toggle**, a **natural-language query box**, and **example prompts** (clickable to fill).
I3. On submit → modal closes → results screen shows: an **AI answer** (short conversational summary) + normal result cards + an **"extracted filters" chip row**.
I4. Pipeline: send buyer sentence + our filter schema to OpenAI (ONE call) → GPT returns structured JSON (keywords + filters) → validate → run the SAME engine → return answer + results.
I5. AI is NOT a separate engine — it only converts the sentence into filters that feed the normal engine.
I6. GPT infers target (product/supplier) too, but the modal toggle is the explicit control.
I7. **Guardrails:** validate the JSON against known categories/attributes (drop unrecognised → prevents garbage/injection); fallback to plain keyword search on failure/timeout; rate-limit per user; timeout the call; OpenAI only; temperature 0; low max-tokens; inject live category+synonym+attribute list into the prompt at runtime; defensive JSON parsing.
I8. **No embeddings / no semantic vectors** in Phase 1.
I9. Full GPT system prompt + example is documented in modules-in-detailed/m3-search-filter-3-4days-max/Search.md §11 (returns strict JSON only).
I10. JSON shape: `{ target, keywords[], category|null, priceMax|null, priceIntent"low"/"high"|null, moqMin|null, country|null, attributes{}, verifiedOnly }`.
I11. Prompt rules: map synonyms to category; "cheap/budget/sasti/low"→priceIntent low; "bulk/thok"→moqMin ~1000; only use attribute keys from the resolved category; never invent categories/attributes; if nothing maps, return keywords = original query words.

## J. Search engine (DECISION: Atlas Search)

J1. **Locked: Atlas Search** (not native Mongo text index).
J2. Reasons: already on Atlas (free/built-in, no extra infra); fuzzy/typo tolerance ("medisin"→medicine); better relevance ranking; built-in faceting + counts; easier autocomplete/"did you mean".
J3. Native text index would only be better if hosting had to stay portable (self-host) — not the case here.

## K. Ranking (default order of results)

K1. Fiverr-style full ranking (ratings/orders/reviews/promoted) is NOT possible in Phase 1 (no order/review data yet).
K2. **Phase 1 default ranking order:** (1) text relevance (Atlas score on product name + description + seller name) → (2) **verified sellers boosted above unverified** → (3) recency → (4) listing completeness (has images/full details).
K3. **Verified-first is a ranking BOOST, not a filter** — both verified & unverified still shown (consistent with B7). Boosting also incentivises verification.
K4. Buyer can override with sort: relevance (default), newest, price (low→high / high→low).
K5. Full quality ranking (ratings, order count, response time, promoted listings, new-seller rotation) → Phase 2.

## L. Availability rules (what appears in results)

L1. Only `status: active` products appear.
L2. Draft / inactive / archived excluded.
L3. Taken-down products excluded.
L4. Products in deactivated categories excluded (cascade).
L5. **Query-level enforcement** — excluded IN THE QUERY, not just hidden in the response (prevents leaks).
L6. **B7:** all sellers shown regardless of KYC; verification is **NEVER a filter**. The public projection carries a **`verified` boolean** (+ `verifiedAt`), derived server-side from `kycStatus` — raw `kycStatus` / `rejected` is **never** exposed (frontend renders the tick from `verified`, not `kycStatus`).
L7. Guests can search; login required ONLY to save (buyer account — saving is buyer-only, §A13).
L8. Public whitelist adds **`slug`** on Product + Seller (for `/product/:slug`, `/supplier/:slug` links, §A6) and **`image`** on Category (§A11 — card cannot render without it). New fields default **PRIVATE** (§A3); these are explicitly public.
L9. Exporters can also search — search is a **public page open to all (guests included), never a permission**. This is **NOT a buying flow**: an exporter who wants to buy uses a **separate buyer account** (§A13 / §A21).
L10. Admin has NO search screens.

## M. Cards (3 types)

M1. **Product card:** image, name, price (fixed/range/on-request), MOQ, unit, seller name + tick, save (heart), category tag. Tap → product detail.
M2. **Supplier card:** logo, name, verified tick, country, product count, save. Tap → seller profile.
M3. **Category card:** name, image, product count. Tap → filtered listing.
M4. Shared sub-components across cards: verified-tick badge, save button, "unavailable" badge.

## N. Screens (web + app)

N1. **Search results screen** (web+app): search bar + Products/Suppliers toggle + dynamic filter sidebar + result grid + sort + count + pagination + save toggle.
N2. **AI search modal** (web+app): query box + Products/Suppliers toggle + example prompts → AI answer + results.
N3. **Product detail page** (web+app): image gallery, specs (attributes), price, MOQ, seller + tick, save, enquiry button (→ M4).
N4. **Seller profile page** (web+app): company info + verified tick, their catalogue, save supplier.
N5. **Category browse screen** (web+app): category cards (tree) → tap → filtered listing.
N6. **Saved list screen** (web+app): tabs Products | Suppliers, "currently unavailable" tag, unsave, empty state.
N7. **Shared components**: product card, supplier card, category card, filter panel, SaveButton (toggle, optimistic), tick badge, unavailable badge.
N8. Save toggle sits on every card + product detail + seller profile.
N9. Navigation: product detail has a **seller link** → seller profile (buyer can jump from product to seller).
N10. Saved list accessible from header/menu; saved-count badge; buyer dashboard saved widget.
N11. App specifics: filters = full-screen modal; facets lazy-load; swipe-to-unsave optional; guest prompted to login when saving.

## O. Backend endpoints

O1. `GET /public/search` — keyword + filters + sort + page (params: q, type=product|supplier, category, price, moq, country, attr.*, sort, page).
O2. `GET /public/facets` — available filters + counts for the current query/category.
O3. `POST /search/ai` — AI search (body {query, target}) → {answer, extracted, results}.
O4. `GET /public/products/:id` — product detail (public projection only).
O5. `GET /public/exporters/:id` — seller profile + catalogue + tick (public projection only).
O6. `POST /saved` · `DELETE /saved/:id` · `GET /saved` — saved items (buyer-scoped, ownership-checked).

## P. Public vs Private data (WHITELIST projection — critical)

P1. **Rule:** public routes return ONLY whitelisted public fields; any NEW field defaults to PRIVATE unless explicitly added. Whitelist, never blacklist. Same projection on web + app. Private fields never serialised on public routes.

P2. **SELLER public:** company name, logo, description, verified tick + since-date (status only), general location (country/city — NOT exact street), **`establishedYear`**, public catalogue (active products only), member-since, product count. *(**business type** + **main categories**: cancelled 2026-07-30. **`website`**: internal, never public.)*
P3. **SELLER private:** KYC documents (business/personal ID — super admin/employee review only), owner personal ID/PII, direct contact phone/email (reached ONLY via M4 enquiry), precise/street address, internal/auth fields (userId, tokenVersion, role, verification notes, audit trail), financial/account details.

P4. **PRODUCT public:** name, description, images, category/sub-category (+type), price (mode+min/max+currency), MOQ+unit, trade info (HS code, origin, supply ability, lead time, packaging), service info (engagement/delivery/team/timeline), attributes (specs), seller public projection, listed-since.
P5. **PRODUCT private:** internal status states (draft/archived), takedown{isDown,reason,byUserId,at}, raw exporterOrgId/internal owner IDs, seller's private fields, moderation/audit fields, deletedAt/soft-delete markers.

P6. **CATEGORY public:** name, slug, parent/sub tree, type (goods/service), synonyms (search only), filterable attributes, active categories only.
P7. **CATEGORY private:** inactive categories, order/admin flags.

P8. **Who sees private:** Super admin/Employee → KYC docs, takedown reason, audit, moderation. Seller → own drafts/docs/contact (ownership-scoped only). Contact → reached only via M4 enquiry (phone/email hidden to stop scraping/spam/off-platform leakage).
P9. Verified tick reflects STATUS only; KYC documents stay admin-only.
P10. When an entity is deactivated/archived/taken-down, its public page returns 404/410 (or 301 to category) and drops from sitemap.

## Q. Empty / no-results state

Q1. Never a blank screen. Show a clear message: "No products found for 'xyz'".
Q2. If filters are applied, show "Try removing some filters" + a **"Clear all filters"** button.
Q3. "Did you mean" suggestions using Atlas fuzzy matching.
Q4. If the query matched a category but no products, offer "Browse {category}" link.
Q5. Popular/featured fallback if nothing at all matches.
Q6. AI-search nudge: "Try describing what you need" → opens AI modal.

## R. SEO (part of M3; full rules in modules-in-detailed/m3-search-filter-3-4days-max/m3-seo-rules.md)

R1. Slug-based readable public URLs: /product/:slug, /supplier/:slug, /category/:slug, /category/:parent/:child; search = /search?q=... (query params).
R2. Slug rules: auto-generate from name (lowercase, hyphens, strip specials); unique suffix on clash; slug IMMUTABLE (301-redirect old→new on rename; never break indexed links); slug stored as indexed unique field on Product, Category, Organisation.
R3. On-page: title, meta description, single H1, canonical, Open Graph + Twitter tags, image alt from name.
R4. JSON-LD structured data: Product schema (name/image/price/seller), Organization for sellers (city-level address only), BreadcrumbList + ItemList for categories. Never inject private data.
R5. Canonical + noindex: base pages (product/seller/category) indexable; filtered URLs → noindex,follow + canonical to base; search pages → noindex,follow.
R6. Dynamic sitemap.xml (active products/sellers/categories only; exclude drafts/inactive/archived/taken-down/filter/search URLs); robots.txt disallows /search + filter patterns.
R7. Content visibility: only public-projected fields in HTML/meta/JSON-LD; only active entities get indexable pages + sitemap entries.
R8. Performance (ranking factor): lazy-load below-fold images, explicit width/height (avoid CLS), sized/WebP images (Cloudinary), healthy Core Web Vitals.
R9. **React SPA stays for now** (decision: no change to stack). SSR/prerender for public pages is deferred (client-only React indexes poorly) — but keep emitting titles/meta/canonical/JSON-LD client-side and keep slugs + sitemap ready so a later SSR migration doesn't break URLs.
R10. SEO rules delivered as modules-in-detailed/m3-search-filter-3-4days-max/m3-seo-rules.md, formatted to MERGE into Claude Code project rules so generated code follows them.

## S. Boundary — NOT in M3

S1. Semantic/embedding search, recommendations, analytics → Phase 2.
S2. Enquiry / chat → Module 4.
S3. Quotation → deferred.
S4. Recently-viewed / search-history → Phase 2.
S5. Full quality ranking (ratings/orders/promoted) → Phase 2.

## T. Conflict-checks done during M3 (all resolved clean)

T1. SavedItem moved from M2 to M3 — consistent.
T2. Verified-first ranking vs B7 — NOT a conflict (boost, not filter; both still shown).
T3. Admin takedown (not hard delete) carried into product privacy — consistent.
T4. Seller "delete" reconciled to soft-delete (archive) for published products — consistent with takedown philosophy.
T5. Contact hidden on public profile, reached via M4 — consistent with privacy + chat module.
T6. Seller profile/card display placed in M3 (data from M1/M2) — consistent; noted M2 buyer-view should point to M3.

## U. Open items touching M3

U1. "Other" (#40) is a top category but products map to sub-categories → needs a sub under Other or an exception (flagged, unresolved).
U2. ✅ **RESOLVED by build-prompt §A22** — M1 lacked a dedicated Organisation/company-profile setup/edit screen (logo/description/address). It is now scoped as M1 work for **both** exporter (logo + description + public-page preview) and buyer (name/country/address/`entityType` only), with lock-after-verification on the KYC-checked fields. **Fully closed:** the two field definitions that were still open here — business type and working categories — were **cancelled** on 2026-07-30, and A22 needs **no new model fields**.

## V. Related M3 docs
- modules-in-detailed/m3-search-filter-3-4days-max/m3.md — full module doc (incl. detailed public/private sections 5b, 5c).
- modules-in-detailed/m3-search-filter-3-4days-max/Saved-item.md — SavedItem model + availability/delete rules.
- modules-in-detailed/m3-search-filter-3-4days-max/Search.md — search detail + full GPT prompt (§11).
- modules-in-detailed/m3-search-filter-3-4days-max/m3-seo-rules.md — SEO rules for Claude Code.
- MPX-Discovery-UI.html / index.html — working demo (keyword+synonym, filters, AI modal + answer, product/supplier toggle, save).
