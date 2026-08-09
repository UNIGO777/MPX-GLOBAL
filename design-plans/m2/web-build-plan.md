# M2 · Web Frontend — Build Plan (screens → React)

> **Sources, in precedence order:**
> 1. **The shipped backend** (`MPX-BACKEND-FULL-SAAS/src/routes|validators|controllers|models`) —
>    every route, field name, enum, limit and response shape below comes from HERE. M2's backend is
>    complete (all phases ✅), so unlike M1 there is no "design now, wire later" anywhere in this plan.
> 2. **`design-plans/m2/m2-webscreens/`** — 28 generated exports in 11 screen folders. The
>    `code.html` in each is the visual truth (layout, copy, states); the `screen.png` is a preview
>    and several are illegibly downscaled — see `m2-webscreens/INDEX.md`.
> 3. **`web-screens-design.md`** — what each screen contains and why. **`app-screens-design.md`** is
>    the mobile app and is NOT built here.
> 4. **`m2-web-screen-details.md`** — the generation prompts; useful for the exclusion lists.
>
> **Part A of `docs/MPX-M2-M3-Build-Prompt.md` outranks all four.**

---

## 0 · What is already true

M1 shipped the whole foundation this plan builds on, and two M2 prerequisites landed on 2026-08-07:

- **TanStack Query** is installed and wired (`lib/queryClient.js`, provider outside `AuthProvider`,
  cache cleared on sign-out). M1 screens stay on their existing `useEffect` fetches — **new screens
  use Query**. Two patterns coexisting is a recorded decision, not drift.
- **A real 404 page** (`pages/public/NotFound.jsx`, `robots: noindex`) — screens 2, 3 and 4 all need
  it for the dead-category / unavailable-product state.
- **`PublicHeader` + `PublicFooter`** (`components/public/`) — the shared guest chrome, already
  used by the landing page and screen 1.
- **Screen 1 is BUILT** (`pages/public/Categories.jsx`) — see §6.

Also already shipped and reusable: `ConsoleShell` (the one fixed shell for buyer/exporter/admin),
`StatusChip`, `VerifiedTick`, `Pagination`, `Skeleton`/`SkeletonRows`, `EmptyState`,
`ErrorState` (renders a `requestId` as a support reference), `Modal` (with the `centered` confirm
variant), `Drawer`, `RowMenu`, `FileDrop`, `CountrySelect`, `Select`, `Field`/`inputClasses`,
`Button`, `Alert`.

## 1 · Design tokens — unchanged from M1

`web/tailwind.config.js` already carries every token the M2 designs use. Nothing new is needed:
primary `#2A4DE0` / `#2340C4` / `#1A2E8F`, canvas `#EAEEFF`, border `#C5C6CF`,
`shadow-card` `0px 4px 20px rgba(0,5,23,0.05)`, warning **pinned** to `#F79009`, 8px radius, pill
buttons, Inter.

**Two chromes, no third.** Screens 1–4 wear `PublicHeader` + `PublicFooter` (guest-visible, B7).
Screens 5–11 sit inside `ConsoleShell`. Nothing in M2 introduces a new layout.

## 2 · Folder structure (additions only)

```
web/src/
  api/            catalogue.js (exists — extend) · products.js (new) · adminCatalogue.js (new)
  components/
    public/       PublicHeader.jsx · PublicFooter.jsx        (exist)
    catalogue/    ProductCard.jsx · PriceLine.jsx · CategoryPicker.jsx ·
                  AttributeFields.jsx · PriceInput.jsx · ProductImageManager.jsx ·
                  CapMeter.jsx · SpecTable.jsx · BlockedBanner.jsx · NoImagePanel.jsx
  pages/
    public/       Categories.jsx (exists) · CategoryListing.jsx · ProductDetail.jsx ·
                  SupplierProfile.jsx
    exporter/     Products.jsx · ProductForm.jsx        (add + edit share ONE component)
    admin/        CategoryManager.jsx · AttributeManager.jsx · ProductMonitoring.jsx ·
                  AuditLog.jsx
  lib/            productStatus.js (status → chip tone/label, one map)
```

**Add and Edit are one component.** The design brief says "keep them visually identical so the flow
feels like one place"; two files guarantees they drift. `ProductForm.jsx` takes a `productId` (absent
= create) and renders the header status strip only when editing.

## 3 · The nine new shared components

Built before any screen — screens 2, 3, 4 all consume `ProductCard`, and 6 + 7 are mostly the form
primitives.

| Component | Contract | Notes |
|---|---|---|
| `NoImagePanel` | `{ label, ratio }` | The tinted monogram/icon fallback. 🔴 **This is the launch look**, not an edge case — category images arrive via admin upload over time (§A20) and products publish without photos. Used on category cards, product cards, galleries and supplier logos so all four degrade identically. |
| `PriceLine` | `{ mode, min, max, currency, unit }` | `fixed` → "INR 220 / meter" · `range` → "INR 800 – 1,400" · `on_request` → "Price on request". 🔴 On-request renders as ordinary information, never greyed. **Currency is the raw ISO code — no conversion exists in Phase 1 (§A27.1); never assume ₹.** |
| `ProductCard` | `{ product, showSeller }` | Cover (or `NoImagePanel`), 2-line-clamped name, `PriceLine`, seller name + `VerifiedTick`, category. **No status chip on the public variant.** `showSeller={false}` on the supplier page, where every card has the same seller. |
| `SpecTable` | `{ attributes }` | Label/value rows. Booleans render "Yes"/"No"; numbers carry their unit. |
| `CapMeter` | `{ caps }` | Renders **only** when `caps.verified === false`. Two bars: live and drafts, plus "Get verified to publish unlimited products." 🔴 Tone is incentive, never scolding. |
| `BlockedBanner` | `{ reason, at }` | Danger banner, reason verbatim + date. 🔴 **Never the acting admin (§A9), never an appeal action (D6 deferred).** |
| `CategoryPicker` | `{ value, onChange }` | Two fields: top (searchable, 40) then sub (loads from the top, disabled until then). 🔴 **The sub is what is stored** — a top is never a valid pick, and there is no goods/service toggle anywhere (§A14). |
| `PriceInput` | `{ value, onChange }` | Segmented Fixed / Range / On request. 🔴 On request **removes** the amount and currency fields entirely — not disabled, gone. Range validates `min < max` inline. |
| `AttributeFields` | `{ defs, values, onChange }` | Renders a leaf's `CategoryAttribute` list in order: `text`→input · `number`→numeric with the **unit inside the field** · `select`→select · `boolean`→Yes/No. |
| `ProductImageManager` | `{ images, onChange }` | Max **5 × 5 MB, JPG/PNG/WEBP** — all three stated *before* the first pick. Two-step: `POST /products/images` returns refs, which then ride in the JSON create/edit. Per-file progress, retry, remove, reorder; first is "Cover". A failed image never blocks the rest of the form. |

## 4 · API layer

Three modules over the existing `apiClient`; query keys live beside the endpoints.

```js
// api/catalogue.js  (public — no token needed; guests browse, B7)
tree()                       GET /categories                      → categories[] with nested subs
category(idOrSlug)           GET /categories/:idOrSlug
attributes(idOrSlug)         GET /categories/:idOrSlug/attributes  → { category, attributes[] }
products({category, seller, page, pageSize})
                             GET /public/products                 → { products, total, page, pageSize }
product(idOrSlug)            GET /public/products/:idOrSlug       → { product }
exporter(idOrSlug)           GET /exporters/:idOrSlug             → { exporter } (+ productCount)

// api/products.js  (exporter — requireRole('exporter'))
mine({status, page, pageSize})  GET /products/mine   → { products, total, page, pageSize, counts, caps }
create(body)                    POST /products
update(id, patch)               PATCH /products/:id
setStatus(id, status)           PATCH /products/:id/status   body { status: 'active'|'inactive' }
archive(id)                     DELETE /products/:id
uploadImages(files)             POST /products/images        multipart field `images`

// api/adminCatalogue.js  (staff — permission-gated per route)
tree()                       GET    /admin/categories                     category:read
attributes(id)               GET    /admin/categories/:id/attributes      category:read
toggle(id)                   PATCH  /admin/categories/:id/toggle          category:manage
createSub(body)              POST   /admin/categories                     category:manage
updateCategory(id, patch)    PATCH  /admin/categories/:id                 category:manage
deleteCategory(id)           DELETE /admin/categories/:id                 category:manage
uploadImage(id, file)        POST   /admin/categories/:id/image           category:manage
createAttr(id, body)         POST   /admin/categories/:id/attributes      category:manage
updateAttr(id, attrId, p)    PATCH  /admin/categories/:id/attributes/:attrId
deleteAttr(id, attrId)       DELETE /admin/categories/:id/attributes/:attrId
products(filters)            GET    /admin/products                       product:read
takedown(id, reason)         POST   /admin/products/:id/takedown          product:takedown
restore(id)                  POST   /admin/products/:id/restore           product:takedown
audit(filters)               GET    /admin/audit                          audit:read
```

**Field limits, from the validators — mirror them client-side for UX, the server is authoritative:**
product `name` ≤200 · `description` ≤5,000 · `attributes` ≤50 entries, each value a primitive ·
takedown `reason` **3–500, required** · category `name` ≤120 · `synonyms` ≤100 chips of ≤60 ·
attribute `name` ≤120 · `key` ≤60 matching `^[a-z0-9_]+$` · `options` ≤100 · `unit` ≤20 ·
`order` 0–10,000 · list `pageSize` ≤100 (audit ≤50).

## 5 · Routes

```
/categories                              Categories.jsx        public   ✅ built
/category/:slug                          CategoryListing.jsx   public
/product/:slug                           ProductDetail.jsx     public
/supplier/:slug                          SupplierProfile.jsx   public
/exporter/products                       Products.jsx          exporter
/exporter/products/new                   ProductForm.jsx       exporter
/exporter/products/:id/edit              ProductForm.jsx       exporter
/admin/categories                        CategoryManager.jsx   staff · category:read
/admin/categories/:id/attributes         AttributeManager.jsx  staff · category:read
/admin/products                          ProductMonitoring.jsx staff · product:read
/admin/audit                             AuditLog.jsx          staff · audit:read
```

Admin screens join the existing lazy-loaded admin chunk. **The sidebar hides what a 403 would
refuse — it is never the thing that protects data**; every route is re-checked server-side.

**Nav updates in the same change:** exporter sidebar "Products" flips from a "Soon" chip to a live
link to `/exporter/products`; the admin sidebar's "Audit log" chip becomes a link to `/admin/audit`
and gains a "Categories" and a "Products" item, both permission-filtered. Update the matching
`docs/UiWebNotes.md` rows to Done.

## 6 · Screens ↔ designs ↔ endpoints

Design folder = `design-plans/m2/m2-webscreens/screen-NN-.../`.

### Public (1–4) — `PublicHeader` + `PublicFooter`, guest-visible

Nothing on these four may reveal product status, takedown in any form, raw verification status,
seller contact details or internal ids. Unavailable rows are excluded **in the query**, so the only
"unavailable" treatment needed is the shared 404.

| # | Screen | Endpoint(s) | States to build |
|---|---|---|---|
| 1 | **Category browse** ✅ built | `GET /categories` | loading · loaded · empty · error. Cards currently **static** — see §8. |
| 2 | **Category listing** | `GET /categories/:slug` + `GET /public/products?category=<slug>` | loading · results · **empty category (common at launch)** · error · unknown/deactivated slug → **404 page**. Sibling sub chips from the parent's `subs`. Pagination, newest first, **no sort control**. |
| 3 | **Product detail** | `GET /public/products/:slug` | loading · loaded · **goods variant** · **service variant** (no MOQ/HS/origin) · **sparse listing** (no images, no description, one attribute — must still look intentional) · not found → 404 · error. |
| 4 | **Supplier profile** | `GET /exporters/:slug` + `GET /public/products?seller=<slug>` | loading · loaded · **unverified (identical, minus the tick — no badge in its place)** · **zero products (header still renders in full)** · not found → 404 · error. |

**Screen 2's left column is where M3's filter rail will live.** Give it a real width now and put the
sibling chips in it — so M3 does not force a re-layout — but draw nothing filter-shaped.

**Screen 3's facts strip renders only filled fields**, never a wall of "—". Goods fields come from
`moq/unit/hsCode/countryOfOrigin/supplyAbility/leadTime/packaging/terms`; service fields from
`engagementType/deliveryModel/teamSize/pricingModel/timeline`. The response carries whichever group
applies, because the leaf's type decided it at create time.

**Screen 4's seller block fields are exactly** `name · slug · country · description · logo ·
entityType · establishedYear` + derived `verified · verifiedAt · memberSince · productCount`.
🔴 `website` is **internal and never public** — it has reached a public response once before.

### Exporter console (5–7) — `ConsoleShell`

| # | Screen | Endpoint(s) | The parts that are easy to get wrong |
|---|---|---|---|
| 5 | **My products** | `GET /products/mine?status=` | Tabs **All · Live · Hidden · Drafts · Archived** from `counts`; `CapMeter` from `caps`. 🔴 **`caps.active.used` deliberately differs from `counts.active`** — the cap excludes taken-down rows (§A10, a block frees a slot), the tab count does not. "2 of 3" beside a Live tab of 3 is **correct**. There is **no Blocked tab**: a taken-down product stays in its status tab wearing an extra danger chip. Row actions by state; Archived rows have **no** actions. |
| 6 | **Add product** | `POST /products/images` → `POST /products` | Three zones; B and C are **absent** (not greyed) until a sub-category is chosen. Saving creates a **draft** — required specs are **not** enforced here. Draft-cap block appears **before** the seller fills anything in. |
| 7 | **Edit product** | `PATCH /products/:id` · `PATCH /products/:id/status` · `DELETE /products/:id` | Header status strip + contextual Publish/Hide + Delete. 🔴 Rename note: "Your product's web address stays the same" (slug immutable, §A6). **Blocked variant keeps the fields editable** so the seller can fix the content; only Publish/Hide are refused. **Archived never opens the form** — terminal notice + "Create a new listing". |

**Publish refusals are two different messages and must not be merged** — the server answers 409 for
the cap and 400 for missing required specs:
- cap → "You've reached 3 live products. Get verified to publish more." + a link to KYC
- specs → "Add Material and GSM before publishing." + a link into the form

**Delete copy owns the semantics:** *"This archives the product… to sell it again later, create a
new listing."* Button "Archive product". 🔴 Never "permanently deleted" — the data is kept (§A7).

**After any mutation, invalidate `['products','mine']`** — rows, `counts` and `caps` all arrive from
that one call, so one invalidation refreshes the table, the tabs and the meter together.

### Staff (8–11) — `ConsoleShell`, permission-driven

Every write here lands in the audit log; a discreet "Changes are recorded" note sets expectations on
8–10. **Read-only variants OMIT actions rather than disabling them** — a browsing view, not a wall
of greyed buttons.

| # | Screen | Endpoint(s) | The parts that are easy to get wrong |
|---|---|---|---|
| 8 | **Category manager** | `GET /admin/categories` + toggle/CRUD/image | Two-pane; **shows inactive rows** (public reads hide them, this must not). Tops are toggle-only **except the §A20 image upload — a deliberate exception, annotate it in code**. Cascade modal must explain `prevActive`: subs switched off individually stay off. Sub panel: slug and (once products exist) type are read-only. |
| 9 | **Attribute manager** | `GET /admin/categories/:id/attributes` | 🔴 `key` and `inputType` are **immutable after create** — read-only on edit, each with its teaching line. Nearly every seeded field is a `text` an admin will want as a `select`; without that copy it gets filed as a bug. Delete confirm: existing products keep their saved value. |
| 10 | **Product monitoring** | `GET /admin/products` · takedown · restore | Status filter is **exactly three**: Active · Inactive · Blocked. 🔴 **Drafts and archived are not in this list at all** and no filter reveals them. Takedown `reason` is **required, 3–500**, and is shown to the seller. Purge countdown on blocked rows (180 days). Staff-only: **who** took it down — never in anything the seller sees. |
| 11 | **Audit log** | `GET /admin/audit` (+ `/:id` for the drawer) | 🔴 **Strictly read-only** — no edit, delete, cleanup or export control anywhere. `pageSize` ≤50. `target.name` is populated but **nullable** — render "—", never a guess (§9.1). Purge rows are self-contained via their snapshot; show them as plain text, not links. |

**Screen 10's search is SUBSTRING, not prefix.** `adminProducts.service.js` builds
`new RegExp(escapeRegex(q), 'i')` with no `^`, deliberately. Use a plain "Search product name"
placeholder — 🔴 `web-screens-design.md` §10's *"Starts with…"* label is **stale** and should be
corrected there.

**Screen 11's date range rejects an inverted `from`/`to` (400).** Validate client-side too: an empty
page reads as "no activity", which is the opposite of the truth for someone investigating.

## 7 · Shared behaviours (every screen)

- **All four states drawn**: loading (skeletons, never a bare spinner for content), empty, error,
  success — plus each screen's own special states.
- **Errors** surface `error.response.data.error.requestId` through `ErrorState` as a support
  reference; never a raw server message.
- **Ownership failures are 404s, never 403s** — a 403 would confirm the record exists. Render the
  shared not-found page, not a permission message.
- **Ordering is the server's.** Categories arrive pre-sorted by `order`; products are newest-first.
  Never re-sort client-side — alphabetising the category tree would bury what the owner chose to
  lead with.
- **Verified is a tick or nothing.** No "unverified" badge, no grey chip, no explanatory text.
- **Prices**: no float maths anywhere, no conversion, render the ISO code as given.
- **Responsive at 1440 / 1024 / 768 / 375**; wide admin tables scroll inside their own container;
  tap targets ≥44px.
- **Any control shipped non-operational** gets a `docs/UiWebNotes.md` row **in the same change**.

## 8 · Build order

Each step ends green: `npm run build` clean, and the owner reviews before the next starts.

1. **Shared components** (§3) + `api/catalogue.js` extension. Nothing renders yet; this is what
   makes steps 2–4 small.
2. **Screen 2** — and in the same change **flip screen 1's cards to `<Link>`**, delete its
   "coming shortly" line and mark its `UiWebNotes` row Done. Screen 1 is deliberately static until
   its destination exists.
3. **Screens 3 + 4** — they share `ProductCard`, `SpecTable` and the seller block.
4. **Screen 5** — first console screen; establishes the tab + cap + row-action pattern.
5. **Screens 6 + 7** — one `ProductForm`; the largest single step in the module.
6. **Screen 8**, then **9** (9 is reached from 8's "Fields" action).
7. **Screen 10**, then **11**.
8. **Nav + ledger pass** — exporter "Products", admin "Categories"/"Products"/"Audit log" go live;
   landing-page category text becomes real links to `/categories`; `UiWebNotes` rows closed.

Public screens (2–4) come first deliberately: they are the SEO surface, they need no auth to test,
and they prove `ProductCard` before three more screens depend on it.

## 9 · Prerequisites and known gaps

### 9.1 ✅ Screen 11's "Target" name — RESOLVED 2026-08-09

`target` now carries a **`name`** on both the list and the detail route. Resolution order:

1. **The entity's CURRENT name**, batch-resolved one query per entity type on the page (the same
   shape as the existing actor lookup, never per row). A renamed target reads under its new name so
   the row still points at something findable.
2. **The name the entry snapshotted**, when the row no longer exists — this is what makes a purge
   row self-contained (§A8 snapshots `productName` + `sellerCompanyName`).
3. **`null`** otherwise. Genuinely nullable: a takedown records its reason and a publish records its
   status, so a deleted target may have no name anywhere. **Render "—"; never invent one.**

Types are an **allowlist** (`NAMEABLE` in `auditViewer.service.js`): Product · Organisation ·
Category · CategoryAttribute · User · FeaturedItem. `Conversation` is excluded (titles are composed
at read time from company names — A22.3 — and never stored) and so is `PendingSignup` (someone who
never completed signup). Adding a model to the audit trail therefore cannot quietly widen this
screen.

Write sites still record no name for takedown/publish/restore. That is fine now — the live lookup
covers them — but if a future change wants historical names for deleted targets, that is the
separate, deliberate decision to add `name` to those `after` payloads.

### 9.2 `PortalLayout` constrains content to 860px

`layouts/PortalLayout.jsx` wraps children in `max-w-[860px]` — the M1 panels' design measure. That
suits screens 6 and 7 (forms) but is too narrow for **screen 5's product table**, which the design
draws full-width. Widen the measure for that route or let the page opt out of the inner wrapper;
do **not** restyle `ConsoleShell`, which is owner-locked.

While there: that file's comment says a buyer's Organisation "has no read endpoint until A22" —
**stale**, `GET /me/organisation` shipped. The exporter header can carry the company name now.

### 9.3 Prerequisites

✅ **Catalogue seeded 2026-08-09** — 40 tops · 261 subs · 1,376 attributes. Verified against Part A:
no top carries a `type` and every sub does (§A16), "Other" is the two typed subs (§A14), and every
seeded attribute is optional with **no `select` options** (§A25.2 — e.g. Cotton fabric has
`material · gsm · width · weave · colour · pattern`, all optional text/number).

Two launch realities the seed confirms empirically, both already designed for: **zero categories
have an image** (§A20 — admin uploads arrive over time, so the monogram fallback IS the normal look)
and **zero have synonyms** (owner content, still unwritten — screen 8's tags input is the entry path
and will be empty for all 40).

⚠️ **There is no product seed.** Products must be created through the UI or a script, so screens 2–4
render their empty states until some exist. Screen 6 is the first that can create one — consider
building a couple of listings by hand after step 5 so screens 2–4 can be reviewed with real content.

| Gap | Status |
|---|---|
| **Buyer entry point to screens 1–4** | ✅ Decided 2026-08-07 — **not being added**. No "Browse" sidebar item; the public pages are reached from landing links only. Do not re-raise. |
| **Restore-over-cap** | ✅ Decided 2026-08-07 — **left as-is**. A restore may put an unverified seller at 4 live; it self-corrects. No warning is designed, and no copy may promise the cap is never exceeded. |
| **Top-40 `synonyms`** | Owner content, still unwritten. Screen 8's tags input is the entry path and will be empty for all 40 tops on day one — design the empty state accordingly. Not a blocker. |
| **Category page for a TOP category** | Open (web brief §10.4): whether `/category/:slug` for a top gets its own indexable listing or only the `/categories` grid is an M3/SEO call. **Build the sub case; a top slug currently aggregates its subs server-side.** |
| **SEO furniture** | Only per-page `<title>` is in scope here. Meta/canonical/JSON-LD/sitemap arrive with M3 (`m3-seo.md` §8 defers SSR); slugs are already correct so nothing breaks later. |
| **`GET /products/mine` has no category name** | `ownView` returns `categoryId` only. Screen 5 resolves the leaf name from the cached category tree — one extra query key, no extra round trip per row. |

## 10 · What M2 web deliberately does NOT build

Search · filters · facets · sort · "did you mean" · saved/favourite items (**M3**) · enquiry and
chat CTAs (**M4**) · quotation (deferred, Bucket A) · featured/banner content (FINALIZE F5) ·
seller unblock-request (D6, ~2026-08-28) · notification UI (D5) · employee-only dashboards
(Bucket A) · level-3 categories · any hard-delete control · the mobile app's 7 screens
(`app-screens-design.md`).
