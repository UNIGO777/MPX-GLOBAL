---
paths:
  - "**/*[Ss]earch*.{js,jsx,ts,tsx}"
  - "**/*[Pp]ublic*.{js,jsx,ts,tsx}"
  - "**/*[Pp]rojection*.{js,jsx,ts,tsx}"
  - "**/*[Ss]erializ*.{js,jsx,ts,tsx}"
  - "**/*[Ff]acet*.{js,jsx,ts,tsx}"
  - "**/*[Ss]aved[Ii]tem*.{js,jsx,ts,tsx}"
  - "**/[Mm]odels/{Product,Category,Organisation,Organization}.{js,ts}"
  - "**/*{exporter,supplier,seller,product,category}*[Cc]ontroller*.{js,jsx,ts,tsx}"
---

# 🔒 M3 · Public API whitelist projection (search / discovery)

Loaded when working on M3 discovery/search, public routes, or the public projection of
`Product` / `Category` / `Organisation` (seller). **Data-exposure rule: a mistake here leaks
KYC, ownership, moderation or contact data to guests.** Source of truth:
`modules-in-detailed/m3-search-filter/m3.md` §5b–5c and its `Rules.png`.

## The core rule — whitelist, never blacklist

Public routes (`GET /public/search`, `GET /public/facets`, `GET /public/products/:id`,
`GET /exporters/:id`, `POST /search/ai`, **`GET /public/featured`**) return **ONLY the
whitelisted public fields below**. Everything else stays private.

- **Any NEW field defaults to PRIVATE** — it must not appear on a public route until it is
  **explicitly** added to the public whitelist.
- **Private fields are never serialised to public routes.** Not conditionally, not "for admins
  on the same endpoint" — the public projection simply does not contain them.
- **Same projection on web and app.** No richer app payload.
- Product's seller block = the **public seller projection**, never the raw `Organisation`
  document.

## Public whitelist (the ONLY fields a buyer/guest may receive)

**Seller / Supplier** — company/business name · **`slug`** (`/supplier/:slug` link — §A6) · logo ·
description · verified tick = a **`verified` boolean** + `verifiedAt` (derived server-side from
`kycStatus`; the raw `kycStatus` / `rejected` state is **never** exposed — frontend reads
`verified`, not `kycStatus`) · general location (country / city, **not** street
address) · **`entityType`** (`business` | `individual` — the trust signal that replaced the cancelled
"business type"; it reveals nothing about *which* KYC documents were filed) · **`establishedYear`** ·
**`memberSince`** (**year only**, derived from `createdAt` — no schema field, and never the exact
signup timestamp) · public catalogue (active products only) · product count.

> 🚫 **Cancelled 2026-07-30 — `business type` and `main / working categories` are REMOVED from
> this whitelist.** Not deferred, not pending a definition: **dropped.** Do not add a field, a
> projection key, or a whitelist entry for either, and do not treat their absence as an omission
> to fix. **`entityType` is public and carries that signal** — the cancellation left no hole.
>
> 🔒 **`website` is INTERNAL — never public.** It is held for our own verification use. It *was*
> being returned by `GET /exporters/:id` and has been removed. **Do not add it back because it
> looks harmless** — that is exactly how it got there.
>
> ⚠️ **Capture path — build-prompt §A22.** `logo` and `description` exist on `Organisation` but are
> only *enterable* through the **company profile screen (§A22, M1 work)**. Until that lands, the
> seller page renders with a company name and a country. A22 needs **no new model fields**.
>
> ✅ **`productCount` SHIPPED with M2 (2026-07-31).** LIVE listings only:
> `countDocuments({ exporterOrgId, status: 'active', 'takedown.isDown': { $ne: true } })` — same
> shape as the D1 cap query. Computed in the controller next to `toPublic()` (async, so it can't
> live in the sync `PUBLIC_DERIVED`); pinned by the exact-key assertion in `tests/kyc.test.js`.

**How the seller projection is implemented** (copy this for `Product` / `Category`):
`Organisation.PUBLIC_FIELDS` + `PUBLIC_DERIVED` declare the surface on the **model**;
`src/utils/toPublic.js` is the **one** shared serialiser; `exporters.controller.js` calls it. A
controller that hand-rolls an object literal is the bug this pattern exists to prevent — that is how
`website` reached the public response. `tests/kyc.test.js` asserts the **exact** key set, so
widening the whitelist without deciding to will fail a test.

**Product** — name · **`slug`** (`/product/:slug` link — §A6) · description · images ·
category (+ type goods/service) · price (mode +
min/max + currency) · MOQ · unit · trade info (goods) / service info (services) · attributes
(specs) · seller public projection · createdAt / listed-since.

**Featured landing content** (FINALIZE F5b, `GET /public/featured`) — the product / category /
supplier cards are **exactly the projections above**, composed by the same `toPublic()` calls.
A landing card is never a richer object than the entity's own public read, and
`tests/f5b-featured.test.js` asserts the key sets match. The **only** fields this route adds are
the banner's own admin-authored presentation — `image` · `title` · `subtitle` · `linkUrl` — plus
the curation `order`. 🚫 Never public from `FeaturedItem`: `publicId` (the internal Cloudinary
asset id, `select: false`), `active`, `startsAt` / `endsAt`, `createdBy`.
⚠️ **A featured row is a POINTER, never a snapshot.** Do not denormalise a product name, price or
seller name onto it "to save a lookup": the public read re-resolves every target through the same
availability rules, which is what makes a taken-down product or a blocked company leave the
landing page on its own. A cached copy would keep a blocked supplier on the front page.

**Category** — name · slug · **`image`** (§A11 — the category card cannot render without it) ·
parent / sub tree · type (goods/service — a **sub-category's `type` is stored; a top category's is derived from its children at read time**, not stored; the public contract is unchanged) · filterable attributes ·
active categories only. `synonyms` is **search-only** — used for keyword→category matching,
never returned in the response.

## Private — NEVER on a public route

- **Seller:** KYC documents · direct contact (phone / email) · precise/street address ·
  **`website`** (internal — our verification use only, 2026-07-30) · `buyerSide` / `exporterSide` ·
  owner personal IDs / PII · internal & auth fields (userId, tokenVersion, role, verification
  notes) · financial/account details.
- **Product:** `status` internal states (draft/archived) · `takedown { isDown, reason,
  byUserId, at }` · raw `exporterOrgId` / internal owner IDs · **`sellerCountry` +
  `sellerVerified`** (§A23 denormalised search-index copies — internal-only; the public response
  carries country/verified via the **seller projection**, never these raw fields) · any
  `deletedAt` / soft-delete markers · moderation / audit / internal flags.
- **Category:** inactive categories · order / admin flags.

## Who may see private data (and where)

- **Super admin / Employee** — KYC docs (verification only) · takedown reason · audit ·
  moderation fields. On staff routes, never bolted onto a public route.
- **Seller (own only)** — own drafts · own docs · own contact / address · own listing's
  `takedown` reason + date (Part A §A9) — **never `takedown.byUserId` / the acting admin**.
  Ownership-scoped (`orgId` match), per security-baseline A6.
- **Contact = via M4** — phone/email stay hidden; buyers connect only through enquiry / chat.
  Never expose contact to enable off-platform / scraping.

## Query-level enforcement (not just response-hiding)

The exclusion happens **in the query**, not by filtering the response afterwards:

- Return **only `status: active`** — draft / inactive / archived / taken-down excluded in the
  query itself.
- Products in **deactivated categories** are excluded (cascade).
- **B7:** all sellers are shown regardless of KYC; verification is **never a default filter or
  ranking gate.** The public projection carries a **`verified` boolean** (derived server-side
  from `kycStatus`) — raw `kycStatus` / `rejected` is never serialised to a public route.
  **The ONE carve-out (2026-07-30):** the buyer's explicit, opt-in **"verified-only" facet
  toggle** (Search.md §3.1, locked plan) may filter on the derived verified state — only when
  the buyer selects it, never by default, and it still never serialises raw `kycStatus`.

## 🔴 STOP-and-alert — before going beyond this whitelist

RED-ALERT and get explicit owner confirmation **before writing code** that would:

1. **Add a field to any public projection / public route** that is not in the whitelist above
   (this is a widening of what the public API leaks — a conscious decision, not a default).
2. **Serialise a private field** (KYC, contact, exact address, internal/auth, `takedown`
   reason/actor, moderation/audit, raw owner IDs, `deletedAt`) onto a public route.
3. **Return the raw `Organisation` / `Product` document** (or a spread of it) on a public route
   instead of the explicit public projection.
4. **Use `kycStatus` (or verification state) as a default filter / query condition** on results.
   *(Exception, already decided 2026-07-30: the buyer's opt-in "verified-only" facet toggle —
   Search.md §3.1 — is allowed and needs no alert. Anything beyond that opt-in toggle does.)*
5. **Hide-in-response instead of exclude-in-query** — returning draft / inactive / archived /
   taken-down / deactivated-category rows and stripping them later.

The alert names the exact field/route, states it widens the public surface, and waits for
confirmation. Do not rationalise "it's just one field" past this.
