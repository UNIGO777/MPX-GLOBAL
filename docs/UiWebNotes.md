# Web UI — Non-operational elements ledger

> **Rule:** `.claude/rules/web-ui-notes.md` (STRICT). **Every** rendered button, link, form,
> toggle, tab, filter, menu item or control that is **not yet wired to real behaviour** MUST be
> logged here — in the same change that creates it. No exceptions, nothing too small to skip.
>
> When you wire an element up, set its **Status → Done** (or delete the row). Keep this honest.
> Prefer not shipping dead controls at all; if a placeholder must exist, make it visibly
> non-final (`disabled` / "coming soon") so no user thinks it works.

Status legend: **Pending** = renders but does nothing real · **Done** = wired to real behaviour.

| Date | Page / Component | Element (label) | What's missing / expected behaviour | Why deferred | Status |
|------|------------------|-----------------|-------------------------------------|--------------|--------|
| _—_ | _(none yet — no web frontend built)_ | | | | |

---

## ⚠️ API contract changes the web screens must follow

Backend response shapes that changed after the web was designed. A screen still reading the OLD
field will break silently.

### 2026-07-31 · M3 Discovery — new public endpoints the web/app can now call

All are **public** (guests included); login is needed only to save.

| Endpoint | Notes for the frontend |
|---|---|
| `GET /public/search` | `q` · `type=product\|supplier` · `category` · `seller` · `country` · `currency` (default INR) · `priceMin/priceMax` · `onRequest=true` · `moqMin` · `goodsOrService` · `verifiedOnly=true` · `sort=relevance\|newest\|priceAsc\|priceDesc` · `page`/`pageSize` (≤100) · **attribute filters use BRACKETS**: `attr[gsm]=140`, `attr[gsm][min]=100&attr[gsm][max]=150`, `attr[material]=Cotton,Silk` (OR within a key). ⚠️ **Dotted params like `attr.gsm` are rejected with 400** — always brackets. Response: `{ type, products[], total, page, pageSize, didYouMean }` |
| `GET /public/facets` | Takes the **same params** as search. Returns `{ category[], country[], goodsOrService[], verified[], price{min,max,currency}, moq{min,max}, attributes[] }`. Counts for a group ignore that group's own selection, so a filtered option list never collapses to zeros |
| `POST /search/ai` | Body `{ query }` (2–500 chars). Returns `{ answer, extracted, fallback, type, products[]/suppliers[], total, didYouMean }`. **`fallback: true` means the AI step failed and these are plain keyword results — render them normally, no error state.** Guests allowed |
| `GET /saved` · `POST /saved` · `DELETE /saved/:id` | **Buyer accounts only** (401 for guests, 403 for exporters/staff). `POST` body `{ targetType: 'product'\|'supplier', targetId }`; duplicate → **409**. `GET` returns `{ items[], total, page, pageSize }`, each item carrying `available` + `unavailableReason` — **an unavailable item is still listed, greyed, not removed** |
| `GET /sitemap.xml` · `GET /robots.txt` | Generated from `PUBLIC_WEB_URL`. **Deployment must reverse-proxy these two from the web domain to the API**, otherwise crawlers never see them |

**Supplier mode is narrow by design:** with `type=supplier` the product-only params
(`category`, `seller`, `priceMin/Max`, `moqMin`, `onRequest`, `goodsOrService`, `attr[...]`,
`sort=price*`) return **400**, naming the offending parameter.

### 2026-07-31 · `GET /exporters/:id` now accepts a SLUG too

The public seller endpoint takes **an ObjectId or the organisation's `slug`** —
`GET /exporters/textilehub-exports` returns exactly the same payload as `GET /exporters/<id>`.
This is what lets the SEO route `/supplier/:slug` fetch its data (product and category detail
already worked this way). **No breaking change** — existing id calls are unaffected, and the
response field set is unchanged.

### 2026-07-30 · Auth responses curated + admin sides fix (code audit fixes)

1. **`POST /auth/buyer/signup`, `/auth/exporter/signup`, `/auth/verify-otp`** — the `user` object is
   now a **curated view**: `{ id, name, email, mobile, role, orgId, isActive, mustChangePassword }`.
   Changes a screen must follow: read **`user.id`** (there is no `_id`), and **`user.mobile` is now
   the e164 string** (was the `{ countryCode, number, e164 }` object). Internal fields
   (`tokenVersion`, `isEmailVerified`, `permissions`, timestamps) are no longer returned.
2. **`POST /auth/exporter/signup` no longer accepts `businessProfile`** (registrationNumber / taxId /
   establishedYear) — the field is stripped at the boundary (A5: captured at verification, not
   signup). Do not build a signup input for it.
3. **`GET /admin/users/:id`** — `user.org.buyerSide` / `exporterSide` used to be **always `false`**
   (populate bug); they now carry real values. A screen written against the buggy shape would have
   shown every company as side-less.
4. **KYC upload (`POST /me/kyc/documents`)** — new **409** case: "Document limit reached" once an
   organisation holds 20 stored documents.

### 2026-07-30 · A21 · `organisation.type` → `buyerSide` / `exporterSide`

`Organisation.type` is no longer `buyer`/`exporter` (it is now `business`/`platform`, and NOT a
buyer-vs-exporter discriminator). Three response shapes **dropped `type` and now return two
booleans `buyerSide` + `exporterSide`** instead. Update any screen that read `org.type` to decide
buyer-vs-exporter — read the flags:

| Endpoint(s) | Object | OLD field | NEW fields |
|---|---|---|---|
| `POST /employee/buyers/:id/approve\|reject`, `POST /employee/exporters/:id/verify\|reject` | `organisation` | `type: 'buyer'\|'exporter'` | `buyerSide`, `exporterSide` (booleans) |
| `GET /admin/users`, `GET /admin/users/:id` | `user.org` | `type` | `buyerSide`, `exporterSide` |
| `GET /employee/orgs/:id/kyc/documents` | top-level | `type` | `buyerSide`, `exporterSide` |

(One company may have both sides true — a screen must not assume exactly one.)
