# M2 — Catalogue · Backend Build Plan (phased)

> **Module:** Phase-1 Module 2 (Catalogue) — categories, attributes, products, moderation, purge.
> **Scope status:** 100% confirmed Phase-1 / month-1 scope. No Bucket-A/B or D-item red-alerts in
> this plan. (D6 seller-unblock-request = ~2026-08-28, NOT here. Featured content = FINALIZE F5.)
> **Backend root:** `MPX-BACKEND-FULL-SAAS/`
> **Sources of truth (precedence order):**
> 1. `docs/MPX-M2-M3-Build-Prompt.md` **Part A §A1–§A25** (A25 = 2026-07-31 build parameters)
> 2. `modules-in-detailed/m2-max-3to6days/` — `M2.md` + `Models.md` + `Category.md`
> 3. `MPX-Category-Form-Fields.html/.pdf` — the per-category attribute name list (seed source)
>
> ⚠️ The folder images (`Models-Chart.png`, `m2.png`, `m2-work.png`, `Other-category-feilds.png`)
> show **pre-Part-A** designs (`type: either`, `resolvedType`, no `archived`, "Featured content",
> manual goods/service pick) — visual aids only, the .md files + Part A win.
>
> **Legend:** ✅ already built · 🔨 build now · 🧱 needs a decision/dependency · ⏳ deferred

---

## 0. Ground rules for this module (do not violate)

- Every new route: **permission or `publicRoute` declared** (boot route-guard refuses otherwise)
  → **zod validation** (zString/zObjectId, unknown keys stripped) → **ownership/permission
  scoping** → business logic → **curated response** (`toPublic()` on public routes; never a raw
  document anywhere).
- **Ownership:** seller reads/writes are `findOne({ _id, exporterOrgId: req.user.orgId })` —
  missing → **404**, never 403 (tracker A6). Staff reads are RBAC-scoped `findOne({ _id })`,
  missing → 404.
- **B6** — no product approval workflow; the seller owns `status`. **B7** — verification never
  filters public results; public responses carry the derived `verified` boolean, **never raw
  `kycStatus`**. **D1/A10/A15** — caps enforced server-side on create AND status change.
- **Takedown never touches `status`** (m5-rules §2). Admin never hard-deletes — the ONLY hard
  delete in the system is the A8 purge job.
- **AuditLog** append-only; **product create AND edit must audit** (A19 — `createdBy` is
  dropped). Audit snapshots: changed fields only, never KYC/tokens/bodies/contact.
- **Query-level exclusion** on every public read (draft/inactive/archived/taken-down/
  deactivated-category excluded **in the query**, not response-stripped).
- **A7 (reconfirmed 2026-07-30):** archived products are kept forever — no archive purge.
- **New public fields** go through `PUBLIC_FIELDS`/`PUBLIC_DERIVED` + the projection rule
  (`.claude/rules/m3-public-projection.md`) — never ad-hoc.
- **Do not touch** Phase-2 skeleton models. **Do not touch M1 auth flow** — the only permitted
  M1 edits in M2 are: `scoping.js` (A2, sanctioned), `permissions.js` (§A25 strings),
  `Organisation.takedownCount` (§A24), the §A23 `sellerVerified` sync hook in
  `verification.service.js` (flagged below, tested), and `exporters.controller.js` +
  `tests/kyc.test.js` for the §9b `productCount` delivery (sanctioned by M2.md §9b).
- Smallest change that works. No refactor of adjacent code.

---

## 1. Current state (what exists today)

- **`Product`** = 2-field stub (`categoryId`, `createdBy`) using `withOrgScope` (generic `orgId`
  + mixin `isActive`) — **full rebuild**: §A2 `exporterOrgId`, §A1 `status` (no `isActive`),
  `createdBy` dropped (A19).
- **`Category`** = 3-field stub (`name`, `slug` required-unique, `parentId`) using
  `withPlatformScope` (mixin `isActive`) — **rebuild**: A4 wants `active`+`prevActive`, NOT the
  mixin's `isActive`.
- **`CategoryAttribute`** — does not exist.
- **`Organisation`** — shipped (M1); gets one new field: `takedownCount` (§A24).
- **Shipped and reusable:** `toPublic()` + `PUBLIC_FIELDS`/`PUBLIC_DERIVED` pattern
  (Organisation), zod `validate` + `zString`/`zObjectId`, `rejectMongoOperators`, rate limiters,
  boot route-guard, `recordAudit()`, multer + magic-byte + Cloudinary infra (KYC path — reuse
  pattern with `type: 'upload'` public assets for product/category images), `slugify()`.
- **Permissions catalogue:** 4 from M1; §A25 adds 4 (below).
- **Tests:** 126/126 green · lint clean. They must stay green after every phase.

---

## 2. Phases (build order, with dependencies)

| ID | Phase | Depends on | Status |
|----|-------|-----------|--------|
| **M2-A** | Base layer: scoping + permissions + deps | — | ✅ DONE 2026-07-31 |
| **M2-B** | Models: Category · CategoryAttribute · Product · `takedownCount` | A | ✅ DONE |
| **M2-C** | Seed: 40 tops + ~262 subs + Other×2 + attribute defaults | B | ✅ DONE |
| **M2-D** | Category endpoints (public reads + admin manage + images) | B, C | ✅ DONE |
| **M2-E** | Product endpoints (seller CRUD, status/caps, images, delete) | B, C | ✅ DONE |
| **M2-F** | Public catalogue reads + projections + seller `productCount` | E | ✅ DONE |
| **M2-G** | Admin moderation (monitoring list, takedown/restore, counter) | E | ✅ DONE |
| **M2-H** | Purge job (`node-cron`, A8 180-day) | G | ✅ DONE |
| **M2-I** | Cross-cutting: `errorLogs`, redact list, §A23 sync hook | B | ✅ DONE |
| **M2-J** | Test matrix close-out (Part D definition of done) | all | ✅ DONE — **186/186 green, lint clean** (was 126 pre-M2) |

**BUILT 2026-07-31 in one pass** (backend only — screens are a separate effort). Every Part D
checkbox in §M2-J has a named test. Synonyms content still pending from the owner (non-blocking).

---

### M2-A · Base layer — scoping, permissions, dependency  🔨

**Goal:** the one sanctioned M1-infra change (A2) + §A25 groundwork, with zero behaviour change.

- `src/models/scoping.js`: add **two scope types** — `SCOPE.EXPORTER_ORG` →
  `{ exporterOrgId: user.orgId }` and `SCOPE.BUYER_ORG` → `{ buyerOrgId: user.orgId }`. This
  completes A2's "teach scoping.js the new field names" in one pass; `Product` uses the first
  now, M3's `SavedItem` uses the second later. Existing scopes untouched.
- `src/config/permissions.js`: add §A25's four grantable strings —
  `CATEGORY_READ: 'category:read'` · `CATEGORY_MANAGE: 'category:manage'` ·
  `PRODUCT_READ: 'product:read'` · `PRODUCT_TAKEDOWN: 'product:takedown'`.
  (Catalogue writes are grantable by owner decision 2026-07-31; governance stays hard-gated.)
- `npm i node-cron` (owner-approved 2026-07-31).
- **Exit:** 126/126 still green, lint clean, boot passes.

---

### M2-B · Models  🔨

**`Category` (rebuild)** — `name` (required, trim) · `slug` (required, unique, lowercase;
generated from name pre-validate via `slugify` when absent — seed supplies explicit slugs;
**immutable after create**) · `parentId` (ref Category, `null` = top) · `type`
(`'goods'|'service'` — **A16 validator: required when `parentId` set, must be ABSENT when
`parentId` null**) · `active` (Boolean, default true) · `prevActive` (Boolean, set only by the
top-toggle cascade) · `order` (Number, default 0) · `image` (String, optional — A11) ·
`synonyms` ([String], default []). Scope: `declareScope(schema, SCOPE.PLATFORM)` **directly**
(A4 — do NOT use `withPlatformScope`; Category has `active`, not the mixin's `isActive`).
Indexes: `slug` unique · `parentId` · `{ parentId: 1, active: 1, order: 1 }`.

**`CategoryAttribute` (new)** — `categoryId` (ref, required, index) · `name` (required) · `key`
(required; stable machine key, **immutable after create** — display `name` may change, `key`
never, so old products don't break) · `inputType` (enum `text|number|select|boolean`) ·
`options` ([String] — only meaningful for `select`; validator: non-empty when select) · `unit`
(optional) · `required` (Boolean, default false) · `filterable` (Boolean, default false) ·
`order` (Number). Scope: PLATFORM. Index: compound unique `(categoryId, key)`.

**`Product` (rebuild — plain schema, no mixins)** —
- `exporterOrgId` (ref Organisation, required, index) + `declareScope(SCOPE.EXPORTER_ORG)`
- `categoryId` (ref Category, required, index) — **leaf-only enforced in the service** (needs a
  lookup; model can't see the parent)
- `name` (required) · `description` · `images` (**array of `{ url, publicId }`, max 5** —
  `publicId` is internal-only, needed so the A8 purge can actually delete Cloudinary assets;
  the public projection maps this to a plain URL list)
- `price { mode: 'fixed'|'range'|'on_request', min, max, currency }` — currency validated
  against a static **ISO-4217 allowlist** const in `enums.js` (no new dep)
- goods-only: `moq` (Number) · `unit` · `hsCode` · `countryOfOrigin` (ISO alpha-2, uppercase) ·
  `supplyAbility` · `leadTime` · `packaging` · `terms`
- service-only: `engagementType` · `deliveryModel` · `teamSize` · `pricingModel` · `timeline`
- `attributes` [{ `attributeId` ref, `key`, `value` **Mixed** }]
- `status` enum `'draft'|'active'|'inactive'|'archived'`, **default `'draft'`**, index —
  **NO `isActive`** (A1); one-way-draft enforced in the service
- `slug` (unique, generated from name + suffix-on-clash; **archive marker appended on archive**
  — A6)
- `takedown { isDown (default false), reason, byUserId, at }`
- `sellerCountry` (String 2, index) · `sellerVerified` (Boolean, default false, index) — **§A23
  denorm, internal-only, NEVER in any public projection**
- **`createdBy` dropped** (A19 — AuditLog on create/edit replaces it)
- Indexes: `{ exporterOrgId: 1, status: 1 }` (cap query, /mine, §9b count) ·
  `{ categoryId: 1, status: 1 }` · `{ 'attributes.key': 1, 'attributes.value': 1 }` ·
  `{ 'takedown.isDown': 1, 'takedown.at': 1 }` (purge scan) · `slug` unique · `sellerCountry`.

**`Organisation`** — add `takedownCount: { type: Number, default: 0 }` (§A24 — increment-only;
NOT in `PUBLIC_FIELDS`, so private by default).

**Index/migration note:** dev gets indexes via autoIndex + the seed's `syncIndexes()`; before
any deploy run `syncIndexes` per environment (A21-migration lesson — autoIndex never drops
old indexes; the Product/Category stubs' old indexes must be synced away).

**Tests (model-level):** A16 type-on-leaf validator (top with type rejected, sub without type
rejected) · images >5 rejected · price mode shapes · status defaults draft · attr `(categoryId,
key)` uniqueness.

---

### M2-C · Seed — taxonomy + attribute defaults  🔨

**File:** `src/seed/catalogue.js` + npm script `seed:catalogue`. **Idempotent** (upsert by
`slug`; re-run = no dupes, no clobbering admin edits — only inserts missing rows). Runs
`syncIndexes()` first (superadmin-seed pattern).

- **40 top categories** from `Category.md` — `parentId: null`, **NO `type`** (A16), `active:
  true`, `order` = list position, slug from name.
- **~250 sub-categories** from `Category.md`'s per-top lists — `type: 'goods'` for tops 1–34,
  `'service'` for 35–39.
- ⚠️ **Slug de-dup in the seed data** (second-verify catch): the tree has duplicate names —
  e.g. top **"Footwear" (#6)** and Leather's sub **"Footwear"** would both slugify to
  `footwear` and collide on the unique index. Rule: on a clash the SUB gets a parent-prefixed
  slug (`leather-footwear`); the seed data file resolves all clashes explicitly so a re-run is
  deterministic (no random suffixes in seeded slugs).
- **"Other" (#40)** → exactly two subs: **Other goods** (`goods`) + **Other services**
  (`service`) (A14), each with a small **FIXED** attribute set (A17): `Specification` (text) +
  `Application` (text) — no free-form mechanism anywhere.
- **CategoryAttribute defaults** (§A25.2) from the Form-Fields list, one data file
  (`src/seed/catalogue.data.js`) mapping each sub-category → its field names with:
  - numeric-sounding (GSM, Purity %, MOQ-like, Team size, Moisture %, Thickness, …) →
    `number` (+ `unit` where obvious: gsm, %, mm, kg) · `filterable: true`
  - Y/N fields (Organic, Prescription, Printing, Handmade, …) → `boolean` · `filterable: true`
  - everything else → `text` · `filterable: false`
  - **`select` options are NEVER invented** — those fields seed as `text` until an admin defines
    options in the attribute manager (screen exists in M5's spec; the API ships in M2-D)
  - `required: false` everywhere (admin tightens later — safer than guessing)
- **`synonyms` seed EMPTY** — 🧱 the top-40 synonym list is owner content (Category.md: "Do NOT
  invent it"); the A12 admin edit path (M2-D) is the entry point when the list arrives.
- **No images seeded** (A20 — admin uploads through the panel).

**Tests:** seed twice → same counts (idempotent) · tops have no `type` · Other has exactly two
typed subs · a spot-checked category's attributes match the data file.

---

### M2-D · Category endpoints  🔨

**Public reads** (`publicRoute` + `generalLimiter`; non-staff see **active only**):
- `GET /categories` — full tree (tops + nested subs)
- `GET /categories/top` — tops only (browse cards)
- `GET /categories/:parentId/subcategories` — lazy children (product-form dropdown)
- `GET /categories/:id` — single (**param accepts id OR slug** — SEO §1 mandates
  `/category/:slug` public URLs; same parity rule as the product-detail read)
- `GET /categories/:id/attributes` — the dynamic-form field list
- All through a Category public projection: `name, slug, image, parentId, type (subs),
  filterable-attribute shape` — **`order` is NOT returned** (the projection rule lists it
  private; the server sorts BY it and the client receives the rows already ordered),
  **`synonyms` never returned** (search-only), inactive never returned, no admin flags.

**Admin manage** (`authenticate` + `requirePermissions`):
- `GET /admin/categories` (`category:read`) — **the admin tree read**: full tree INCLUDING
  inactive rows + `prevActive` + `synonyms` + per-sub attribute summary. *(The public endpoints
  hide inactive, so without this the m5 category-tree screen cannot render — gap caught in the
  plan-verify pass.)*
- `PATCH /admin/categories/:id/toggle` (`category:manage`) — **top:** cascade per A4 (write each
  sub's current `active` → `prevActive`, set subs inactive; reactivate restores each sub from
  `prevActive` and clears the marker — a sub the admin had switched off stays off). **Sub:**
  plain flip, with two rules:
  - **activating** a sub whose parent top is inactive → **409** (otherwise an "active" sub sits
    invisible under a dead top and the availability filter has to special-case it);
  - **deactivating** a sub while its top is cascade-off is **ALLOWED and sets
    `prevActive: false`** (third-verify catch: the sub is already inactive from the cascade, so
    a plain flip would be a no-op and the admin's *intent* would be lost — the top's later
    reactivation would resurrect a sub the admin had deliberately refused. Writing
    `prevActive: false` records the intent so restore keeps it off — the exact guarantee
    m5-rules §12 promises).
- `POST /admin/categories` (`category:manage`) — **sub-only** (`parentId` required AND must be a
  top — depth stays 2); `type` required; `synonyms` optional tags (A12).
- `PATCH /admin/categories/:id` (`category:manage`) — **sub:** name/order/synonyms (`type`
  change **blocked once the sub has products** — a type flip would orphan goods/service fields
  on existing rows; **`parentId` immutable** — no re-parenting); **top:** name/order tweak +
  `synonyms` *(A12-spirit — flagged default: the top-40 synonym list lands after seeding and
  needs an entry path that isn't a reseed)*. Slug immutable everywhere.
- `DELETE /admin/categories/:id` (`category:manage`) — **sub-only**; blocked (409) while
  products or children exist.
- `POST /admin/categories/:id/image` (`category:manage`) — multipart single image, 5 MB,
  magic-byte allowlist (jpg/png/webp), **public** Cloudinary asset — **tops AND subs** (A20's
  deliberate exception to top=toggle-only). Behind the dedicated **`uploadLimiter`** (see M2-E).
- Attribute CRUD (`category:manage`), sub-categories only:
  `POST /admin/categories/:id/attributes` · `PATCH .../attributes/:attrId` (name, options, unit,
  required, filterable, order — **`key` AND `inputType` immutable** after create: a
  number→select flip would corrupt the typed `value`s already stored on products; delete +
  recreate under a new key is the safe path) · `DELETE .../attributes/:attrId` (existing
  products keep their `{key, value}` snapshot — nothing breaks).
- Public availability: `GET /categories/:parentId/subcategories` with an **inactive parent
  returns empty**, and the browse helper's `activeLeafIds` = subs with `active: true` **AND an
  active parent** (defensive — the toggle guard above should make the second condition
  redundant, but the filter must not depend on that).
- **AuditLog on every admin write** (A19): `category.create/update/toggle/delete`,
  `category.attribute.create/update/delete`, `category.image.upload`.

**Tests:** cascade + `prevActive` restore (incl. the already-off sub) · top-create blocked ·
sub-delete blocked with products/children · type-change blocked with products · employee WITH
`category:manage` 200 / without 403 · public tree hides inactive · attributes CRUD · key **and
inputType** immutability · sub-activate under inactive top → 409.

---

### M2-E · Product endpoints — seller side  🔨

**Image handling — TWO-STEP (plan-verify fix):** a single multipart create can't cleanly carry
the nested `attributes[]`/`price{}` JSON alongside files (multer text fields are flat strings).
So:
- `POST /products/images` — `authenticate` + `requireRole('exporter')` + a **dedicated
  `uploadLimiter` (~30 requests/hour per user — NOT `generalLimiter`)**: third-verify catch —
  the general 300/15-min budget × 5 files × 5 MB ≈ 7.5 GB per window of orphan-able Cloudinary
  storage; this endpoint is the storage-abuse surface, the exact class the KYC doc-cap fix
  closed. Multer array `images`, **max 5 files × 5 MB** (§A25.3), magic-byte per file
  (jpg/png/webp — no PDF for product photos), public Cloudinary upload under
  `mpx/products/{orgId}/…`, returns `{ url, publicId }[]`.
- Product create/edit are then **plain JSON** referencing those refs. The service validates
  every submitted `publicId` **starts with the caller's own `mpx/products/{orgId}/` prefix** —
  no cross-seller image references. Orphan uploads (uploaded, never attached) are **accepted for
  MVP** (a later cleanup can sweep them); flagged in §6.

**Route guards (spelled out so no route ships ambiguous):** every seller product route —
`POST /products`, `POST /products/images`, `PATCH /products/:id`, `PATCH /products/:id/status`,
`DELETE /products/:id`, `GET /products/mine` — is `authenticate` + `requireRole('exporter')`;
the `exporterOrgId` ownership filter in the query does the per-document isolation.

- `POST /products` — `authenticate` + `requireRole('exporter')`:
  0. **Org guard:** the caller's org must have `exporterSide: true` (defensive — `requireRole`'s
     superadmin bypass would otherwise let a superadmin create a product owned by the platform
     org; caught in the plan-verify pass).
  1. zod: name, description, categoryId, price (mode rules: `fixed` → `min` required (the single
     value), `max` must be absent; `range` → `min < max`; `on_request` → no min/max; `currency`
     required unless on_request, ISO-4217 allowlist), goods/service fields, attributes array —
     **`attributes[].value` = primitive union `string | number | boolean` ONLY; objects and
     arrays rejected at the boundary** (third-verify catch: `value` is a Mixed path that is
     indexed and becomes an M3 filter target — an operator object must be impossible here, not
     just improbable; `rejectMongoOperators` is the backstop, this union is the primary gate).
  2. **Leaf check:** category exists AND `parentId` set — a top category is rejected (M2↔M3
     fix; without a leaf there is no `type`, no form, no facets).
  3. **Type-driven validation:** leaf `type = goods` → service-only fields rejected, and vice
     versa.
  4. **Attribute validation:** every submitted `{key, value}` must match a `CategoryAttribute`
     of that leaf (unknown keys rejected); value type must match `inputType` (`number` →
     numeric, `boolean` → boolean, `select` → value ∈ options, `text` → string).
     **Draft = shape-valid only; `required` attributes are enforced at PUBLISH, not create** —
     a seller may save an incomplete draft.
  5. **A15 draft cap:** unverified org with 10 drafts → 409.
  6. Set `sellerCountry` + `sellerVerified` from the owning Organisation (§A23), generate slug
     (suffix-on-clash; an insert-race E11000 on the unique slug index retries once with a random
     suffix — same pattern as `createOrgHandlingDuplicates` in auth), save as `draft`, **audit
     `product.create`**.
- `PATCH /products/:id` — `findOne({ _id, exporterOrgId })` → 404; **`archived` is TERMINAL**
  (second-verify catch: no un-archive path exists anywhere in the spec — edits AND status
  changes on an archived product → 409; re-listing = a new product on the freed clean slug);
  **a rename never regenerates `slug`** (A6 immutability — the public URL keeps the old name,
  exactly like Organisation renames); same validation; category change re-validates attributes
  against the new leaf; **audit `product.update`** (changed field names + old→new for safe
  fields only).
- `PATCH /products/:id/status` — transitions:
  - `draft → active`: full publish validation (required attributes present, ≥1 image? — no
    image minimum mandated anywhere; **default: images optional**) + **D1 cap**: org unverified
    AND `countDocuments({ exporterOrgId, status: 'active', 'takedown.isDown': { $ne: true } })
    >= 3` → 409 (**A10 — taken-down excluded**, so a block frees a slot). *(Note: the cap only
    blocks NEW publishes — if a later A22 demotion drops a verified org back to `submitted`
    while it holds >3 active, existing listings stay live; nothing auto-unpublishes. Recorded
    so it isn't later read as a bug.)*
  - `active ↔ inactive`: free.
  - anything → `draft`: **409 — one-way** (A1).
  - `archived` via this endpoint: rejected — delete is the only archive path (A5).
  - While `takedown.isDown`: **status change blocked (409)** — flagged default; restore must
    return the product to exactly the state the admin froze (m5-rules §2 restore semantics).
  - **Audit `product.publish` / `product.unpublish`**.
- `DELETE /products/:id` — always soft (A5): `status = 'archived'` + slug gets
  `--archived-<4char>` marker (A6 — frees the clean slug for re-listing); **audit
  `product.archive`**. Kept forever (A7).
- `GET /products/mine` — paginated (capped), all own statuses, own `takedown.reason` + `at`
  visible, **`takedown.byUserId` NEVER serialised** (A9 — curated view, not toJSON).

**Tests:** 4th-active 409 + verified-org uncapped + takedown-frees-slot · 11th draft 409 ·
one-way draft · publish requires required-attrs · cross-org read/edit/delete 404 (A2 test
mandate) · price-mode matrix · unknown attribute key rejected · select value ∉ options rejected
· top-category rejected · archive slug marker + clean-slug re-list · **archived is terminal
(edit/status on archived → 409)** · rename keeps the slug · /mine hides `byUserId` ·
images >5 / >5 MB / wrong-type rejected · cross-seller image ref (foreign `publicId` prefix)
rejected · `attributes[].value` object/array → 400 (primitive union) · uploadLimiter fires
(429 past the hourly budget).

---

### M2-F · Public catalogue reads + projections  🔨

- **`Product.PUBLIC_FIELDS` + `PUBLIC_DERIVED`** on the model (A3 pattern): name · slug ·
  description · images (**mapped to plain URL list** — `publicId` internal) · price · goods
  fields · service fields · attributes (key+value only) · `listedSince` (createdAt) · category
  block (id/name/slug/type from the leaf) · **seller block = the Organisation public projection
  via `toPublic()`** (name, slug, logo, verified, entityType, …) — never raw `exporterOrgId`.
  **Never:** status, takedown (any part), exporterOrgId, sellerCountry, sellerVerified,
  attributeId, publicId.
- `GET /public/products` (`publicRoute` + `generalLimiter`) — M2 browse (full search = M3):
  filters `category` (slug or id → its leaf ids) **and `seller` (org id/slug → `exporterOrgId`)
  — this is what renders the public seller page's catalogue; without it that page has no product
  source (gap caught in the plan-verify pass)**, `page`/`pageSize` (capped), sort newest
  (`createdAt` + `_id` tiebreaker). **Query-level availability:** `status: 'active'` ·
  `'takedown.isDown': { $ne: true }` · `categoryId ∈ activeLeafIds` (helper: active-category id
  list, tiny in-memory cache invalidated by admin category writes — collection is ~290 rows;
  **per-process cache, so a short TTL ~30s backstops staleness** if hosting ever runs more than
  one process — same single-process assumption as the cron job).
- `GET /public/products/:id` — same availability **in the query**; anything else → 404.
  **Param accepts id OR slug** (24-hex → `_id` lookup, else `slug` lookup) — SEO §1 mandates
  `/product/:slug` public URLs, so the frontend will fetch by slug; building it now avoids an
  M3 contract break (second-verify addition; slug is unique+indexed, so it's one branch).
- **Seller `productCount` unblock (M2.md §9b — the pending whitelist entry):**
  `GET /exporters/:id` gains `productCount = countDocuments({ exporterOrgId, status: 'active',
  'takedown.isDown': { $ne: true } })`. Update: `PUBLIC_DERIVED`, the projection rule's ⏳
  marker, and **`tests/kyc.test.js` exact-whitelist assertions** (deliberate widening — the
  test failing without the update is the A3 pattern working).
- **Category public projection** wired in M2-D reads.

**Tests (Part D):** every public route asserts **exact `PUBLIC_FIELDS` key set** + explicit
absence of `takedown`/internal ids/contact · query-inspection: draft/inactive/archived/
taken-down/deactivated-category rows never returned (create one of each, assert absent) ·
productCount correctness (active only, taken-down excluded) · pageSize cap.

---

### M2-G · Admin moderation  🔨

- `GET /admin/products` (`product:read`) — monitoring list: filters `category`, `subCategory`,
  `status` (**exactly three options** per m5: Active=`status:'active'` ·
  Inactive=`status:'inactive'` · **Blocked=`takedown.isDown:true`** — never conflated with
  status), `sellerOrgId`, `q` (escaped prefix on name). **`draft` and `archived` rows are NOT
  shown** (m5 §4). Columns include seller org name (lookup), `takedown` info **incl. `byUserId`
  — A9 hides the acting admin from the SELLER only; this staff view shows it (m5-features
  screen 8: "who took it down, when and why")**, **purge countdown**
  (derived from `takedown.at` + 180d), the seller's `Organisation.takedownCount`. Paginated
  (capped) + stable sort.
- `POST /admin/products/:id/takedown` (`product:takedown` — grantable, §A25) — body `reason`
  required (min 3); staff fetch by `_id` → 404; already down → 409; **`status: 'archived'` →
  409** (second-verify catch: a taken-down archived row would match the purge query and get
  hard-deleted at 180d — a direct **A7 violation**; archived rows must never become purgeable).
  Sets `takedown { isDown: true, reason, byUserId: actor, at: now }` — **`status` untouched** —
  and `Organisation.updateOne({ _id: exporterOrgId }, { $inc: { takedownCount: 1 } })` (§A24).
  **Audit `product.takedown`** (actor + reason). *(Defence-in-depth: the purge query also adds
  `status: { $ne: 'archived' }` so the invariant holds even if data drifts.)*
- `POST /admin/products/:id/restore` (`product:takedown`) — not down → 409. Clears the takedown
  object (`isDown: false`, reason/byUserId/at unset — the AuditLog rows are the history);
  product returns to whatever `status` the seller left. **`takedownCount` is NOT decremented.**
  **Audit `product.restore`**.

**Tests:** takedown leaves `status` untouched + frees a D1 slot · counter increments on
takedown, unchanged on restore · Blocked filter reads `takedown.isDown` (an inactive product is
not "blocked") · reason required (400) · **takedown on an archived product → 409 (A7 guard)** ·
employee with `product:takedown` can act / without →
403 · unknown id → 404 · draft/archived absent from the monitoring list.

---

### M2-H · Purge job — A8, 180 days, `node-cron`  🔨

**File:** `src/jobs/purgeBlockedProducts.js` + registration in `server.js`.

- Schedule: daily (e.g. `15 3 * * *`) via **`node-cron`** (owner-approved) + **one catch-up run
  at boot**; the whole job is **disabled when `NODE_ENV === 'test'`**.
- Query: `{ 'takedown.isDown': true, 'takedown.at': { $lte: now − 180d }, status: { $ne:
  'archived' } }` (A8/A18 — 180, the old 90 figure is stale; the `status` clause +
  the takedown-endpoint guard together guarantee **archived products are NEVER purged** — A7).
- Per product, in order: destroy Cloudinary assets by stored `publicId` (best-effort; log
  failures, still proceed) → write the **AuditLog purge entry FIRST-CLASS**: snapshot
  `{ productName, sellerCompanyName, takedownReason, takedownBy, takedownAt, purgedAt }`
  (A8 — an entry holding only an ObjectId is useless once the row is gone; actor = system:
  `actorId: null`, `meta.job: 'purge'`) → `deleteOne`. Idempotent; summary log line
  (`purged: N`).
- This is the **only** hard delete in the system.
- ⚠️ Single-process assumption: `node-cron` runs in-process. If hosting ever moves to multiple
  processes (the M4 Redis-adapter scenario), pin this job to ONE instance (env flag) — the job
  is idempotent so duplicates aren't dangerous, but they would double-write audit rows.

**Tests:** unit-test the job function with an injected `now` — >180d blocked row purged with a
complete audit snapshot; 179d row untouched; archived row untouched; restore before the
threshold escapes the purge.

---

### M2-I · Cross-cutting — errorLogs, redaction, §A23 sync  🔨

- **`ErrorLog` model** (collection `errorLogs`, A19): `{ statusCode, message, stack, route,
  method, requestId, userId?, orgId?, occurredAt }` · **TTL index 90 days** on `occurredAt` ·
  PLATFORM scope. Wired in `errorHandler`: **5xx only**, fire-and-forget (a logging failure must
  never affect the response), **exclusion list enforced by construction** — no request bodies,
  no headers, no KYC/tokens/OTPs/contact (AuditLog stays permanent — no TTL there).
- **pino `redact` extension** (A19 backstop): add `passwordHash`, `storageKey`,
  `kycDocuments`, `*.passwordHash`, `*.storageKey`, contact fields.
- **§A23 sync hook** — `verification.service.js` `reviewOrg()`: after the org save,
  `Product.updateMany({ exporterOrgId: org._id }, { $set: { sellerVerified: toStatus ===
  'verified' } })`. (Verify → boost on; a reject was never verified, so `false` is a no-op.)
  The **A22 demotion + country-change syncs attach to the A22 edit endpoint when it is built**
  (M1 work, hook point already recorded in §A22.2 step 5). Product **create** sets both denorm
  fields from the org (M2-E). ⚠️ This is a deliberate, tested touch of an M1 file — keep it to
  the one `updateMany`.

**Tests:** 5xx writes an errorLogs row (and 4xx doesn't; no body captured) · verify flips
`sellerVerified` on all the org's products · M1 verification tests still green.

---

### M2-J · Test matrix close-out (Part D definition of done)

Every box below has a named test before M2 is called done:

- [ ] Public routes return **only** their `PUBLIC_FIELDS` (exact key-set assertions) — and
      explicitly never `takedown`, internal ids, seller contact, `sellerCountry/Verified`
- [ ] Cross-org product read/edit/delete → 404 (A2 mandate)
- [ ] Unverified: 4th active → 409 · 11th draft → 409; verified: uncapped
- [ ] Taking down a product leaves `status` untouched **and frees a cap slot** (A10)
- [ ] Published product can never return to draft (A1)
- [ ] Top-category deactivate hides its products from public reads; reactivate restores subs
      from `prevActive` (deliberately-off sub stays off) (A4)
- [ ] Draft / inactive / archived / taken-down / deactivated-category rows absent from every
      public result — **verified by query/product-of-each-state inspection**
- [ ] Archive appends the slug marker and frees the clean slug (A6); archived rows survive the
      purge job (A7)
- [ ] Purge: >180d blocked row deleted with a complete name-snapshot audit entry (A8)
- [ ] `takedownCount` increment-only (§A24)
- [ ] Product create AND edit write AuditLog entries (A19)
- [ ] `sellerVerified` sync on verify (§A23)
- [ ] All M1 tests (126) still green · lint clean · boot route-guard passes

*(The synonym search test — "medicines" → Pharmaceuticals — lands in M3 with the **native `$text`
index** (§A26 reversed the Atlas decision: production is a self-hosted VPS); M2 only carries the
field + the A12 edit path.)*

---

## 4. NOT in M2 (boundary — do not build here)

Search/filters/facets/AI + `SavedItem` (→ M3) · enquiry/chat (→ M4) · quotation (deferred) ·
employee panel surface (month 2; permissions ship now, screens don't) · ~~featured/banner~~
(FINALIZE F5) · seller unblock-request (D6, ~2026-08-28) · notifications (D5) · hard delete
except A8 · Media model · level-3 categories · the M3 **native `$text` index** + its
`searchKeywords`/`categoryType`/`topCategoryId` denorms (§A26 — with
`sellerCountry`/`sellerVerified` already in place from here).

## 5. Gotchas / risks (recorded so they don't bite)

- **Mongoose 9:** hooks are throw/async style (no `next(err)`) — bit us in M1.
- **Express 5:** `req.query` is a read-only getter — read validated query from `req.validated`.
- **Index sync:** rebuilt Category/Product stubs change indexes — `syncIndexes()` per
  environment before deploy (autoIndex never drops).
- **Cap race:** two concurrent publishes can both pass the count check → 4 active. Accepted for
  MVP (same class as M1's accepted races) — noted, not engineered around.
- 🧱 **Restore can leave a seller OVER the D1 cap** (found in the 2026-07-31 review, left as-is
  pending an owner decision): a takedown frees a slot, the seller publishes a replacement, and the
  admin's restore then makes 4 live. Blocking or downgrading the restore would break m5-rules §2
  ("a restore returns the product to exactly the state the admin froze"), so the code keeps that
  guarantee. The state self-corrects — the seller cannot publish again until back under the cap.
  **Owner may choose:** leave it, or have restore return the product as `inactive` when the seller
  is at the cap.
- **kyc.test exact-whitelist will fail when `productCount` lands** — that's the A3 pattern
  working; update the assertion in the same commit (deliberate widening).
- **`vitest --no-file-parallelism`** for reliable full-suite runs (M1 lesson).
- Category `type` change / delete guards exist specifically so seeded data can't be mutated
  into an inconsistent state under live products.
- **Blocked-org products stay publicly visible after M2** — F1-A blocks the org + users and
  404s the seller profile, but the products cascade is **F1-B** (FINALIZE) and is deliberately
  NOT built here. Do not report it as an M2 bug, and do not sneak a read-side org filter into
  the browse query (that would silently half-implement F1-B). **Note: M2 shipping `takedown`
  UNBLOCKS F1-B's products half** — schedule it in FINALIZE right after M2 (chats half still
  waits on M4).

## 6. Owner checkpoints (🧱 — none block the start)

1. **Top-40 `synonyms` list** — owner content, arrives any time; entered via the A12 admin path
   (or a one-off data script when the list lands). Until then keyword→category search (M3) is
   half-blind — known, accepted.
2. **Flagged defaults** (already noted above; say the word to change any): seller status-change
   **blocked while taken down** · top categories accept `synonyms` edits via PATCH (A12-spirit)
   · publish does **not** require an image · `required:false` on all seeded attributes ·
   **"Other goods"/"Other services" fixed attribute set = `Specification` + `Application`**
   (A17-minimal — the exact fields were never specified) · **two-step image upload** (upload →
   refs → JSON create; orphan uploads accepted for MVP) · **activating a sub under an inactive
   top is blocked (409)**.

## 7. Security-tracker touchpoints

Ownership scoping on Product (**A6**) · default-deny + new grantable permissions (**A5**) ·
input validation incl. Mixed-type attributes (**B2**) · upload allowlist + magic bytes + size
caps (**B6**) · append-only audit incl. purge snapshot (**C10**) · rate limits on public reads
(**B7**). Name these IDs when each phase ships so the owner can record evidence.
