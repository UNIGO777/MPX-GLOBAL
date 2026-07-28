# MPX Global — COMPLETE PROJECT BRAIN (everything, for a new account)

> This is the full portable context. Read this + the referenced files and you have the ENTIRE project: context, rules, every module in detail, the current problem, and what to build next. M3's exhaustive detail is in a companion file (MPX-Module3-COMPLETE-MEMO.md); M1 & M2 are fully detailed below.
> As of 28 July 2026. Chat language = Hinglish. UI/demos = English (rule).

> ## 🔴 Part A overrides (authoritative — supersede this doc)
> `docs/MPX-M2-M3-Build-Prompt.md` **Part A (A1–A20)** is precedence-1 and wins over anything here. This round's items:
> - **§A17 — no free-form specs anywhere.** "Other" (goods/services) = ordinary categories with a small **FIXED** `CategoryAttribute` set. The free-form key-value idea (5.11 below) is **cancelled**.
> - **§A18 — blocked-product purge = 180 days** (not 90).
> - **§A19 — logging.** `Product.createdBy` **dropped** (superseded by AuditLog); **product create AND edit must write AuditLog**; AuditLog append-only/permanent; a **separate MongoDB `errorLogs`** collection (errors only, **90-day TTL**, strict exclusion list).
> - **§A20 — admin uploads category images, incl. TOP categories** — a deliberate exception to top = activate/deactivate-only (5.17 below).
> - **Organisation / company profile = PENDING** (not scoped): the backend has **no Organisation endpoints** yet, which blocks `GET /public/exporters/:id`; raise before building — do not design it. (Full note in `modules-in-detailed/m3-search-filter/m3.md`.)
> - ⚠️ Older lines below also predate **A1–A16** (e.g. 5.11 `type=either`, 5.14 status without `archived`, 5.15 cap without the taken-down exclusion) — Part A supersedes them; see the build prompt.

═══════════════════════════════════════════════════════
## PART 0 — HOW TO USE THIS IN A NEW ACCOUNT
═══════════════════════════════════════════════════════
0.1 Memory does NOT transfer between accounts. These files ARE the portable memory.
0.2 In the new chat: paste/upload this file first, then the module docs + M3 memo.
0.3 First message to new Claude: "This is the MPX handoff — absorb it, follow the standing rules, we continue at [Module 4 / M2 schemas]."
0.4 Re-establish the two standing rules immediately (see Part 2).

═══════════════════════════════════════════════════════
## PART 1 — PROJECT CONTEXT
═══════════════════════════════════════════════════════
1.1 Client: MPX Global — a B2B IMPORT/EXPORT marketplace connecting Indian exporters with international buyers.
1.2 Client is an Australian entity (domain pcba.com.au). Senior decision-maker: Girish.
1.3 Agency: NxtGenDigitals (owner: Naman). Built with Claude Code in Trae IDE.
1.4 Phase 1 fee: ₹7,70,000 (taxes extra), web + app, first phase of a larger ~₹20L arrangement, built standalone.
1.5 Two original quotations: web (NXT/2026/MPX-02) and app (NXT/2026/MPX-APP-02); combined ~₹4.2L after a 40% "partnership discount"; later consolidated into the single ₹7.7L MVP fee.
1.6 Stack: React.js (web SPA) + Node.js + MongoDB (Atlas) + Cloudinary + JWT; React Native (Expo) app; OpenAI GPT for AI; Socket.io for chat; VPS hosting.
1.7 Backend repo: MPX-BACKEND-FULL-SAAS — built for the FULL engagement (25 models incl. Phase-2 escrow/payment skeletons). Extras stay as skeletons (do NOT delete). Phase 1 uses a subset.
1.8 Payment: 70% advance / 30% on delivery; 3 months free support, then AMC.
1.9 Quoted timelines: ~8 weeks web, ~6 weeks app.
1.10 Client priority: MAXIMUM liability protection — would rather lose the project than risk fund-loss/data-loss claims; wants everything done quote-safely and legally clean.
1.11 Advanced modules named in quotes (mostly Phase 2): AI trade matchmaking, AI business advisor, buyer concierge, Deal Room + milestone escrow, trust score, incentives directory, investment layer, trade financing, premium network.
1.12 Phase-2 add-on idea: AI-generated deal contract + eSign (auto-generated from deal terms, both parties sign via email before payment); proposed ~₹1.2L. Price increases must come from genuinely NEW scope, not re-pricing quoted scope.
1.13 Landing page: client chose the blue Stitch design (Inter font, navy-blue #2F6BFF accent, deep-navy #0A1E3F/#16346B, soft-blue-tint sections, verified green #12b76a) as FINAL — over gold/navy brand versions. Later client shifted the blue toward a ROYAL BLUE family (same layout, verified green, white/ivory). A separate formal brand identity existed (Midnight Navy #0B1F3A, Champagne Gold #C8A96A, Ivory #F8F7F3, Charcoal, Red #E60000, Playfair+Inter) but was NOT used for the landing page.
1.14 Month-1 build scoped as 3 sequential SOW docs in order: backend first, then web, then app.

═══════════════════════════════════════════════════════
## PART 2 — STANDING RULES (always follow)
═══════════════════════════════════════════════════════
2.1 CONFLICT-CHECK RULE: whenever Naman states a new decision, check it against ALL prior locked decisions. If it conflicts, flag it FIRST in a 🔴 RED ALERT (name the old decision + the impact) BEFORE proceeding. No conflict → proceed silently. This is Claude's responsibility, not Naman's to remember.
2.2 UI-LANGUAGE RULE: every UI, demo, HTML page, or mockup is ALWAYS in English, even though chat is Hinglish. (Stored in /preferences.md.)
2.3 STYLE: Hinglish chat, blunt/concise, heavy use of flow-chart visualizations (Naman likes them), end substantive turns with clear next-step options.

═══════════════════════════════════════════════════════
## PART 3 — MODULE MAP & STATUS (BUILD ORDER — ignore quote numbers)
═══════════════════════════════════════════════════════
3.1 Build order is 1→2→3→4 (dependency), NOT the quote's numbering.
3.2  1. Identity & Access (auth) — ✅ DONE (built + tested, 24 tests)
3.3  2. Catalogue — ✅ PLANNED + LOCKED (next to build)
3.4  3. Discovery & Search — ✅ PLANNED + LOCKED
3.5  4. Enquiry & Chat — ⬜ NEXT TO PLAN (Socket.io real-time; Conversation/Message + Inquiry models; this is where buyer↔seller contact happens)
3.6  Super Admin — built ACROSS every module + a thin console; NOT a separate step.
3.7  Seller Verification — mostly done in M1; only resubmit-after-reject remains.
3.8  Employee Panel — DEFERRED (month-1-ke-baad); M1 has auth only; super admin does ops in month 1.
3.9  Notifications — DEFERRED (OTP only in M1; WhatsApp/email/push later).
3.10 Quotation & Negotiation — DEFERRED (month-1-ke-baad).
3.11 Quote's own numbering was: 1 Landing&Auth, 2 Catalogue, 3 Chat&AI-search, 4 Quotation, 5 Super Admin, 6 Employee, 7 Seller Verification, 8 Notifications. (M6 after M5 only because the quote listed them so — not a real order.)

═══════════════════════════════════════════════════════
## PART 4 — MODULE 1: IDENTITY & ACCESS (DONE)
═══════════════════════════════════════════════════════
4.1 Auth for all 4 panels built + tested (24 tests).
4.2 Security: argon2id passwords; JWT access + tokenVersion; rotating refresh with reuse→family-revoke; OTP (hashed, locked); server-authoritative auth middleware; default-deny RBAC + ownership scoping that THROWS; startup route-guard.
4.3 Endpoints: buyer/exporter signup, login/OTP, refresh, employee approve/verify, superadmin seed.
4.4 ACCESS MODEL — BUYER: full access at signup, no gate. Verification OPTIONAL → only earns a verified/trusted tick, never gates access. Buyer KYC docs optional.
4.5 ACCESS MODEL — EXPORTER: LIMITED at signup — max 3 ACTIVE/published products (drafts allowed; only live listings capped). Verification MANDATORY to sell beyond 3 (not cosmetic). Verified → tick + full access. Exporter KYC: business ID proof, or personal ID if not a business. Manual employee review.
4.6 B7: both buyer & exporter profiles are PUBLIC from signup (kycStatus pending); verified tick added only after employee verification — public visibility NOT gated behind verification. (Girish's decision.)
4.7 ON HOLD: superadmin TOTP 2FA built but on hold (D4 — OTP login for now); notifications incl. WhatsApp on hold (D5); OTP printed to terminal in dev only (no delivery provider); mustChangePassword field exists, enforcement not built.
4.8 GAP (unresolved): no dedicated Organisation/company-profile setup/edit screen (logo/description/address/docs). Recommended to add in M1 for exporter + buyer.

═══════════════════════════════════════════════════════
## PART 5 — MODULE 2: CATALOGUE (LOCKED)
═══════════════════════════════════════════════════════
### 5A. Models (3 new; Organisation/User/AuditLog reused from M1; NO Media model — images = Cloudinary URLs)
5.1 Category (SINGLE model, self-referencing tree — NOT separate Category/SubCategory; that was considered then reverted):
    { name, slug, parentId (null=top/parent, else sub), type: goods|service|either, active, order, prevActive (for cascade restore), synonyms:[String] (added for M3 search) }
5.2 CategoryAttribute (per-category fields as DATA — data-driven, no per-category schema):
    { categoryId, name, key, inputType(text|number|select|boolean), options[], unit, required, filterable, order }
5.3 Product:
    { exporterOrgId, categoryId (maps to a sub-category), name, description, images[] (Cloudinary URLs),
      price{mode:fixed|range|on_request, min, max, currency},
      goods fields: moq, unit, hsCode, countryOfOrigin, supplyAbility, leadTime, packaging, terms,
      service fields: engagementType, deliveryModel, teamSize, pricingModel, timeline,
      attributes:[{attributeId, key, value}] (value MIXED type: number/string/boolean per inputType),
      resolvedType (only for "Other"), status: draft|active|inactive,
      takedown{isDown, reason, byUserId, at} }

### 5B. Category tree
5.4 40 top categories = 39 real + "Other" (#40 catch-all).
5.5 Categories 1–34 = goods; 35–39 = services (IT/Software/AI, Finance/BPO, Healthcare/Clinical, Education/EdTech, Marketing/Design); 40 = Other.
5.6 Services are treated as PRODUCTS in the SAME Product model — no separate service entity. For services: unit=project/hour/month, price often on-request, trade fields optional/NA, attributes are engagement/tech-stack/delivery-type.
5.7 2 levels only (quote says "level 2"). parentId keeps level-3 possible later with NO new model (change-request/Phase 2).
5.8 Products map to a sub-category (leaf). ~230+ sub-categories starter set. Full per-category field list is in MPX-Category-Form-Fields.pdf/html.
5.9 Some low-signal categories kept but deprioritized (no homepage/SEO priority): Gems & Jewellery, Sports/Toys/Games, Handicrafts, Paper, Rubber, Plastic & PVC, Office Supplies, Telecom & Mobile.

### 5C. Category type drives the product form
5.10 Category carries `type`; the form adapts: GOODS → MOQ + trade fields (HS code, origin, supply ability, lead time, packaging); SERVICE → engagement type/delivery model/team size/pricing model/timeline, NO MOQ.
5.11 Seller NEVER manually picks product-vs-service — the category decides. 🔴 **Part A §A14/§A17 override:** "Other" is now **two typed sub-categories** (Other goods / Other services) — the seller does NOT manually pick, `type=either` is **removed**, and specs are a **small FIXED CategoryAttribute set — NO free-form key-value** anywhere.
5.12 Pricing is flexible & optional: fixed price, price range (min–max), or "on request" (no price).
5.13 The product form is ONE universal form: parent (common) fields open first (category, name, description, images, price), then category-driven fields load. Category-specific spec fields come from CategoryAttribute → the form auto-builds (data-driven; no hardcoded per-category form).

### 5D. Product status & the 3-active cap
5.14 status: draft (default on create, not live) / active (published, live in discovery) / inactive (was live, seller hid it). Seller can switch.
5.15 D1 cap = max 3 ACTIVE/published products for UNVERIFIED exporters. Drafts allowed but capped at a sane ~10 to prevent abuse. Cap is on LIVE listings, not total uploads. (This resolved a conflict where M1 originally said "3 upload total".)
5.16 attributes.value is MIXED type so numeric range filters (GSM 100–150, power 5–10) work; inputType decides the type.

### 5E. Super admin category management (web)
5.17 TOP categories: activate/deactivate ONLY (seeded; NO create/edit/delete) — 🔴 **Part A §A20 exception: admin can also upload an `image` on top categories** (narrow, deliberate; write it as such). Quote-safe because "Category management" has no specific verb. (Naman considered giving edit/full-control to top, then decided to keep it locked — backbone stays controlled; top delete is dangerous due to cascade.)
5.18 SUB-categories: full create/edit/delete/manage.
5.19 For each sub-category, admin can ADD/EDIT/DELETE its fields (CategoryAttribute) → creating a sub-category + defining its fields auto-builds that sub-category's product form.
5.20 CASCADE: deactivate a top category → all its sub-categories auto-deactivate (products hide). On REACTIVATE → subs return to their PREVIOUS state (a sub the admin manually turned off stays off) — so store prevActive before cascading.

### 5F. Product moderation
5.21 Admin can TAKE DOWN / deactivate / suspend a product (sensitive/illegal/spam) → hidden from discovery but data PRESERVED (evidence for disputes/legal), with AuditLog + reason. NOT hard delete (product is seller-owned, B6; delete destroys evidence and breaks the quote's "view-only"). Repeat offenders → suspend seller account (M1 user management).
5.22 (Chart wording note: an earlier chart said super admin product = "view-only"; corrected to "monitor + takedown".)

### 5G. Seller delete logic
5.23 Seller CAN delete own products. DRAFT (no refs) → HARD delete. Ever-published (may have refs) → SOFT delete/archive (status:archived). UI shows "Delete" either way; backend decides.

### 5H. Panels
5.24 Exporter (web+app): add/edit product, category→dynamic fields, images (Cloudinary), pricing modes, own list, draft/publish, 3-active cap.
5.25 Buyer (web+app): read-only in catalogue (browse/detail/specs); search/filter + save-favourite belong to M3.
5.26 Super Admin (web): category toggle/sub-CRUD/attribute mgmt/product monitoring+takedown/featured content/audit view.
5.27 Employee NOT built in M2 (super admin does monitoring in month 1).

### 5I. Category/Sub-category endpoints (public read added later)
5.28 GET /categories (full tree), GET /categories/top, GET /categories/:parentId/subcategories (lazy — for product-form sub dropdown), GET /categories/:id, GET /categories/:id/attributes.
5.29 Admin: PATCH toggle top, POST sub-only, PATCH, DELETE sub-only, attribute CRUD.

### 5J. Open M2 items
5.30 "Other" (#40) is a TOP category but products map to sub-categories → needs a sub under Other or an exception. Flagged, UNRESOLVED.
5.31 Final Mongoose schemas (3 models with indexes + validation + ownership-scoping + cascade logic) — decisions locked, code NOT yet written.

═══════════════════════════════════════════════════════
## PART 6 — MODULE 3: DISCOVERY & SEARCH (LOCKED)
═══════════════════════════════════════════════════════
> Full granular detail (150+ numbered points) is in the companion file MPX-Module3-COMPLETE-MEMO.md. Summary of the locked essentials:

6.1 Only new model = SavedItem (polymorphic { buyerOrgId, targetType:'product'|'supplier', targetId, savedAt }, unique index buyerOrgId+targetType+targetId). Everything else = read/query layer + Product indexes. Category gains synonyms:[String].
6.2 THREE search types, one engine: (1) keyword + Products/Suppliers TOGGLE + synonym matching; (2) faceted filters (standard + dynamic attribute filters from CategoryAttribute filterable=true, OR-in/AND-across, counts, real-time); (3) AI search MODAL (query box + toggle + example prompts → single OpenAI call → keywords+filters JSON → same engine → AI answer + results; validate, fallback, rate-limit, no embeddings).
6.3 Synonym matching solves "buyer types 'medicines', category is 'Pharmaceuticals'": Category.synonyms + index = category name + synonyms + product text. Buyer never chooses keyword vs AI.
6.4 Toggle (not GPT) for normal product/supplier intent; GPT only in AI search (AI modal also has its own toggle).
6.5 SEARCH ENGINE = Atlas Search (locked — already on Atlas; fuzzy/typo tolerance, relevance, built-in facets).
6.6 DEFAULT RANKING (Phase 1): relevance → VERIFIED sellers boosted → recency → completeness. Verified-first is a BOOST not a filter (B7 still shows both). Full quality ranking (ratings/orders) = Phase 2. Buyer can sort (relevance/newest/price).
6.7 3 cards: product, supplier, category (shared: tick badge, save button, unavailable badge).
6.8 Availability: only status:active, exclude draft/inactive/archived/taken-down + deactivated-category products; QUERY-LEVEL enforcement (not response-hiding). B7: all sellers shown, kycStatus = tick only, never a filter. Guests can search; login only to save; exporters can also search; admin has no search screens.
6.9 SavedItem availability: temporary-unavailable → stays as "currently unavailable"; permanently-gone (archived/deleted) → removed via cleanup. Chat unaffected by soft-delete.
6.10 PUBLIC vs PRIVATE (WHITELIST projection; new fields default private): 
     - Seller public: name, logo, description, tick+since, general location (city not street), business type, categories, active catalogue, member-since, product count. Private: KYC docs, direct contact (via M4 only), exact address, internal IDs, financial.
     - Product public: name, description, images, category+type, price, MOQ/unit, trade/service info, attributes, seller public projection, listed-since. Private: draft/archived status, takedown{reason,byUserId}, raw owner IDs.
     - Category public: name, slug, tree, type, synonyms(search only), filterable attributes, active only. Private: inactive cats, admin flags.
6.11 Screens (web+app): search results, AI modal, product detail, seller profile, category browse, saved list, shared components. App: filters=full-screen modal, facets lazy-load, swipe-to-unsave.
6.12 Endpoints: GET /public/search, GET /public/facets, POST /search/ai, GET /public/products/:id, GET /public/exporters/:id, POST|DELETE|GET /saved.
6.13 Empty/no-results state: message + clear-filters + did-you-mean (fuzzy) + category/AI fallback.
6.14 Recently-viewed/search-history = Phase 2 (skipped).
6.15 AI GPT prompt: converts buyer sentence → strict JSON {target, keywords, category, priceMax, priceIntent, moqMin, country, attributes, verifiedOnly}; temperature 0, one call, inject live category+synonym+attribute list, defensive parse + keyword fallback. Full prompt in MPX-Module3-Search.md §11.

═══════════════════════════════════════════════════════
## PART 7 — SEO RULES (part of M3; for Claude Code)
═══════════════════════════════════════════════════════
7.1 Slug-based readable URLs: /product/:slug, /supplier/:slug, /category/:slug, /category/:parent/:child; /search?q=... (params).
7.2 Slug: auto from name, unique suffix on clash, IMMUTABLE (301 old→new on rename), indexed unique on Product/Category/Organisation.
7.3 On-page: title, meta description, single H1, canonical, OG/Twitter, image alt. JSON-LD (Product/Organization/BreadcrumbList+ItemList) — never private data.
7.4 Canonical + noindex on filtered/search URLs pointing to base page (avoid crawl-budget waste). Base pages indexable.
7.5 Dynamic sitemap.xml (active/public only); robots.txt disallow /search + filters.
7.6 Only public-projected fields in HTML/meta/JSON-LD; only active entities indexable + in sitemap; deactivated → 404/410 or 301.
7.7 Performance: lazy-load images, explicit dimensions (CLS), sized/WebP (Cloudinary), healthy Core Web Vitals.
7.8 STACK DECISION: React SPA stays for now (no change). SSR/prerender for public pages is DEFERRED, but keep emitting meta/canonical/JSON-LD client-side + keep slugs/sitemap ready so later SSR migration doesn't break URLs.
7.9 Delivered as MPX-SEO-Rules.md — MERGE into Claude Code project rules.

═══════════════════════════════════════════════════════
## PART 8 — CURRENT STATE & WHAT'S NEXT
═══════════════════════════════════════════════════════
8.1 WHERE WE STOPPED: Module 3 fully locked (search + saved + ranking + public/private + SEO + GPT prompt). The working demo (English UI) exists.
8.2 THE PROBLEM WE WERE JUST ON: finalizing M3 discovery — specifically synonym matching, the AI-search modal (with product/supplier toggle + AI answer), ranking (verified-first), and public/private data rules. All resolved and locked.
8.3 IMMEDIATE NEXT OPTIONS (Naman to pick):
   (a) Plan MODULE 4 — Enquiry & Chat (buyer↔seller contact; contact is hidden on profiles, connection only via enquiry/chat; real-time Socket.io; Conversation/Message + Inquiry models). ← natural next.
   (b) Write M2 FINAL MONGOOSE SCHEMAS (3 models, indexes + validation + ownership-scoping + cascade) — all decisions locked, code pending.
8.4 UNRESOLVED OPEN ITEMS (carry forward):
   - "Other" (#40) top-category-vs-sub-category mapping gap (needs a sub under Other or an exception).
   - M1 missing Organisation/company-profile setup/edit screen.
   - Seller verification resubmit-after-reject.
8.5 PENDING SCHEMA/DECISIONS already resolved this session: attributes.value=mixed; product status draft/active/inactive; D1 cap=3 active; search engine=Atlas Search; synonyms field=yes; ranking=verified-first; recently-viewed=Phase 2.

═══════════════════════════════════════════════════════
## PART 9 — ALL FILES PRODUCED (portable package)
═══════════════════════════════════════════════════════
Handoff/master:
- MPX-COMPLETE-BRAIN.md (this file)
- MPX-HANDOFF.md (shorter handoff)
- MPX-Module3-COMPLETE-MEMO.md (M3, exhaustive/granular)

Module docs:
- MPX-Module1-Identity-Access.md
- MPX-Module2-Catalogue-Full.md
- MPX-Module3-Discovery-Full.md
- MPX-Module3-SavedItem-Model.md
- MPX-Module3-Search.md (includes the full AI GPT prompt §11)

Category system:
- MPX-Category-Tree.md / .pdf
- MPX-Category-Model-Schema.md
- MPX-Category-Form-Fields.pdf / .html (interactive)

Month-1 backend scope:
- MPX-Phase1-Month1-Backend-SOW.md
- MPX-Month1-Backend-KARNA-HAI.md
- MPX-Month1-Backend-NAHI-KARNA.md
- MPX-Month1-Backend-Modules.md

SEO:
- MPX-SEO-Rules.md (merge into Claude Code rules)

Demos (English UI):
- MPX-Discovery-UI.html / index.html (full working search demo)
- MPX-Search-Demo.html (synonym demo)

═══════════════════════════════════════════════════════
## PART 10 — CODED DECISION SHORTHAND (glossary)
═══════════════════════════════════════════════════════
- B6 = product has no approval flow; seller-owned; only active/inactive toggle; admin can takedown (not delete).
- B7 = all sellers/products shown regardless of KYC; kycStatus only drives the verified tick, never a filter; profiles public from signup.
- D1 = unverified exporter cap = 3 ACTIVE products (drafts allowed).
- D4 = admin TOTP 2FA built but on hold (OTP login for now).
- D5 = notifications (incl. WhatsApp) on hold.
