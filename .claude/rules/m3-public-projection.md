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
`GET /public/exporters/:id`, `POST /search/ai`) return **ONLY the whitelisted public fields
below**. Everything else stays private.

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
address) · business type · main categories · public catalogue (active products only) ·
product count · member-since.

> ⚠️ **Capture path — build-prompt §A22.** `logo`, `description`, **business type** and **main /
> working categories** are only enterable through the **company profile screen (§A22, M1 work)**.
> Until that lands, the seller page renders with a company name and a country. 🔴 **"Business type"
> has never been defined and is NOT `entityType`** (`business`/`individual`, which drives the KYC
> document path); the shape of working categories is also undecided. **Ask — do not guess a value
> set, and do not alias business type to `entityType` to make the projection compile.**

**Product** — name · **`slug`** (`/product/:slug` link — §A6) · description · images ·
category (+ type goods/service) · price (mode +
min/max + currency) · MOQ · unit · trade info (goods) / service info (services) · attributes
(specs) · seller public projection · createdAt / listed-since.

**Category** — name · slug · **`image`** (§A11 — the category card cannot render without it) ·
parent / sub tree · type (goods/service — a **sub-category's `type` is stored; a top category's is derived from its children at read time**, not stored; the public contract is unchanged) · filterable attributes ·
active categories only. `synonyms` is **search-only** — used for keyword→category matching,
never returned in the response.

## Private — NEVER on a public route

- **Seller:** KYC documents · direct contact (phone / email) · precise/street address ·
  owner personal IDs / PII · internal & auth fields (userId, tokenVersion, role, verification
  notes) · financial/account details.
- **Product:** `status` internal states (draft/archived) · `takedown { isDown, reason,
  byUserId, at }` · raw `exporterOrgId` / internal owner IDs · any `deletedAt` / soft-delete
  markers · moderation / audit / internal flags.
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
- **B7:** all sellers are shown regardless of KYC; verification is **never a filter and never a
  query condition.** The public projection carries a **`verified` boolean** (derived server-side
  from `kycStatus`) — raw `kycStatus` / `rejected` is never serialised to a public route.

## 🔴 STOP-and-alert — before going beyond this whitelist

RED-ALERT and get explicit owner confirmation **before writing code** that would:

1. **Add a field to any public projection / public route** that is not in the whitelist above
   (this is a widening of what the public API leaks — a conscious decision, not a default).
2. **Serialise a private field** (KYC, contact, exact address, internal/auth, `takedown`
   reason/actor, moderation/audit, raw owner IDs, `deletedAt`) onto a public route.
3. **Return the raw `Organisation` / `Product` document** (or a spread of it) on a public route
   instead of the explicit public projection.
4. **Use `kycStatus` (or verification state) as a filter / query condition** on results.
5. **Hide-in-response instead of exclude-in-query** — returning draft / inactive / archived /
   taken-down / deactivated-category rows and stripping them later.

The alert names the exact field/route, states it widens the public surface, and waits for
confirmation. Do not rationalise "it's just one field" past this.
