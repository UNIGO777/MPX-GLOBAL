# M2 · Web Screens — Design Brief

> **11 screens** for the M2 (Catalogue) milestone, web only: buyer browse, exporter catalogue
> management, super-admin/employee category system + moderation.
> This is a **design** document: what each screen contains, every field on it, and the states that
> need artwork. No API or code detail.
> Product: **MPX Global** — B2B import/export marketplace. Indian exporters, international buyers.
>
> **Scope rule:** this brief contains **only** the screens named in
> `modules-in-detailed/m2-max-3to6days/` — `M2.md` §5 (web panels) + `m2.png` / `m2-work.png` —
> corrected by `docs/MPX-M2-M3-Build-Prompt.md` **Part A** (§A1–§A20, §A23–§A25) and grounded in
> the **shipped M2 backend** (`build-plans/m2/backend-plan.md`, all phases ✅, 186/186 tests).
> Nothing inferred, nothing added. See §12 for the gaps that leaves.
>
> ⚠️ Three folder images show **pre-Part-A** designs and must NOT be drawn from directly:
> `Other-category-feilds.png` (manual goods/service pick, free-form specs — **all cancelled**,
> §A14/§A17), `Models-Chart.png` (`type: either`, `resolvedType` — removed), `Flow-Chart-Backend.png`
> ("view-only" admin — superseded by §A25 grantable takedown). The `.md` files + Part A win.
>
> Companion: `design-plans/m1/web-screens-design.md` — same tokens, same shell, one product.

---

## 1. Design foundations

Everything in `design-plans/m1/web-screens-design.md` §1 carries over unchanged: tone, one type/spacing
scale, responsive at 1440/1024/768/375, accessibility as "done", four drawn states per screen, and
the layout shell (top bar + permission-driven sidebar). This section adds only what M2 introduces.

**Three audiences on this milestone:**

| Panel | Who | Feel |
|---|---|---|
| Public / buyer | international importers, **including guests** — browse needs no login | rich, visual, product-forward; this is the shop window |
| Exporter | Indian sellers, mixed digital literacy, listing their livelihood | guided, forgiving — a long dynamic form must never feel like a tax return |
| Admin / employee | catalogue operators | dense, fast; moderation is a serious act and must look like one |

**The catalogue is the first public content surface.** Product, category and supplier pages are
public and must be **indexable** (`web-design.md` SEO section): real URLs (`/product/:slug`,
`/category/:slug`, `/supplier/:slug`), one `<h1>`, meta/canonical handled at build. Design pages
that read well as landing pages from a search result, not just as in-app views.

**Images do heavy lifting here.** Cloudinary-served, correct sizing, lazy-load below the fold,
fixed aspect ratio (no layout shift). Every image slot needs a designed **no-image fallback** —
most early listings and many categories will not have one. A grey broken-image icon is a defect.

### 1.1 The verified tick — same single convention as M1

One badge: `success` check + "Verified". **No "not verified" badge, no warning chip, ever.**
Absence of the tick is the only signal. In M2 the tick appears on: product cards (seller line),
product detail (seller block), the supplier profile header, and admin tables. It is driven by the
server's derived `verified` boolean — **raw verification status never appears on any public
surface, and verification never filters or hides anything public** (B7): unverified sellers'
products browse exactly like verified ones, tick aside.

### 1.2 Product status vocabulary — the M2 addition

Four seller-owned lifecycle states plus one **admin overlay**. One visual language everywhere:

| Status | Colour | Seller-facing label | Meaning |
|---|---|---|---|
| Draft | `muted` | "Draft" | never published; visible only to the seller |
| Active | `success` | "Live" | published, visible in the public catalogue |
| Inactive | `warning` | "Hidden" | was live, seller hid it; can go live again |
| Archived | `muted`, struck tone | "Archived" | seller deleted it; kept but terminal |

**Blocked (takedown) is not a status — it is an overlay.** An admin takedown hides the product
from the public but does **not** change `status`; a product can be "Live · Taken down". Design the
blocked treatment as a distinct `danger` layer (banner/chip) stacked on whatever status chip the
row already has — never as a fifth status value.

**Rules the visuals must not contradict:**
- **Draft is one-way.** Once published, a product can never return to Draft. No "revert to draft"
  action exists anywhere.
- **Delete = Archive, always.** One "Delete" action; it archives. **Archived is terminal** — no
  un-archive, no edit, no status change. The recovery path is "list it again as a new product",
  and the copy says so.
- **These states are private.** The public catalogue shows only Live products — a buyer never
  sees a status chip, a draft, a hidden product, or anything about a takedown.

### 1.3 The caps — unverified sellers only (D1 · §A10 · §A15)

- Max **3 Live** products while unverified — and **taken-down products do not count** toward the 3
  (§A10): a block frees a slot.
- Max **10 Drafts** while unverified (§A15).
- Verification lifts both. Verified accounts see **no cap UI at all**.

Design one **cap meter** component (see §2) and use it identically on the product list and the
form screens. Tone: incentive to verify, never a scolding.

---

## 2. Shared components to design once

All M1 primitives (buttons, inputs, chips, tables, modals, toasts, skeletons, empty/error states,
drawer, tabs, pagination) are reused. New for M2:

**Category picker — two fields, not a tree control.** Field 1: top category (searchable select,
40 entries, optional thumbnail). Field 2: sub-category, loads after field 1 (its subs), disabled
until then. **The sub-category is what is chosen** — a top category alone is never a valid pick,
and there is no "pick the parent" affordance. Two levels only.

**Dynamic attribute field renderer.** Renders a category's field list top-to-bottom in its
declared order, one control per `inputType`: `text` → text input · `number` → numeric input with
its **unit as a suffix inside the field** ("120 gsm") · `select` → select from the defined
options · `boolean` → toggle/segmented Yes–No. Required fields marked; helper text slot per
field. This one component is most of the product form — design it to hold 5–15 fields gracefully.

**Price input — one control, three modes.** Segmented switch: **Fixed / Range / On request.**
Fixed → one amount + currency. Range → min + max + one currency (inline error when min ≥ max).
On request → the amount and currency fields **disappear entirely** (not disabled — gone), replaced
by one line: "Buyers will see 'Price on request'." Currency is a searchable select of ISO codes.

**Product image manager.** Up to **5 images, 5 MB each, JPG/PNG/WEBP only** — show all three
limits *before* the first pick. Drag-drop + browse; per-image thumbnail, progress, error, remove,
reorder (first image = cover, labelled as such). Images upload **immediately on selection**
(before the product is saved) — so per-image progress is real, and a failed image never blocks the
rest of the form.

**Product card.** Cover image (fixed ratio, fallback) · name (2-line clamp) · price line
("₹1,200 / piece", "₹800–1,400", or "Price on request") · seller name + verified tick · category.
Used on browse, category pages and the supplier profile. No status chip on public cards — cards
for the seller's own list are a separate variant with the status chip and row actions.

**Cap meter.** "2 of 3 live listings" + "7 of 10 drafts" with a quiet fill bar and one line —
*"Get verified to publish unlimited products."* Rendered **only** while unverified.

**Attribute spec table.** Label–value rows for the buyer-facing detail page (Material — Cotton ·
GSM — 120 gsm). Boolean values render as "Yes" / "No", numbers with their unit.

**Blocked banner (seller-side).** `danger` banner carrying the admin's reason verbatim + the
takedown date. **Never who acted** (§A9). Used on the seller's list rows and edit screen.

---

## 3. Screen inventory — 11

| # | Screen | Route | Panel | Named in |
|---|---|---|---|---|
| 1 | Category browse | `/categories` | public | M2.md §5.2 "Category browse — tree" · `m2.png` |
| 2 | Catalogue browse / category listing | `/category/:slug` | public | M2.md §5.2 "Catalogue browse" · §4.2 `GET /public/products` |
| 3 | Product detail | `/product/:slug` | public | M2.md §5.2 "Product detail" · `m2.png` |
| 4 | Supplier profile + catalogue | `/supplier/:slug` | public | M2.md §5.2 "Seller profile" + §9b productCount |
| 5 | Exporter — my products | `/exporter/products` | exporter | M2.md §5.1 "Product list" + "Draft view" + cap indicator |
| 6 | Exporter — add product | `/exporter/products/new` | exporter | M2.md §5.1 "Add product" + "Product form" · `ServiceXproduct.png` |
| 7 | Exporter — edit product | `/exporter/products/:id/edit` | exporter | M2.md §5.1 "Edit product + status toggle" |
| 8 | Admin — category manager | `/admin/categories` | admin (`category:read` / `category:manage`) | M2.md §5.3 "Category tree view" + top toggle + sub CRUD · §A20 |
| 9 | Admin — attribute manager | `/admin/categories/:id/attributes` | admin (`category:manage`) | M2.md §5.3 "Attribute (fields) manager" |
| 10 | Admin — product monitoring | `/admin/products` | admin (`product:read` / `product:takedown`) | M2.md §5.3 "Product monitoring" + "Product takedown" |
| 11 | Admin — audit log view | `/admin/audit` | admin | M2.md §5.3 "Audit log view (read-only)" |

**"Draft view" (M2.md §5.1) is a named filter of screen 5**, not a separate route — the list's
status tabs include Drafts. **"Product takedown" is the modal pair on screen 10.** Neither is
padded into its own screen.

**Admin panel is web-only and permission-driven.** M2.md labels §5.3 "Super Admin", but §A25
made the four catalogue permissions **grantable to employees** (`category:read` ·
`category:manage` · `product:read` · `product:takedown`). Design screens 8–10 both with and
without the write actions — a `category:read`-only employee sees the tree but no edit affordance.

### Do not design — deferred or out of scope, with sources

- **Featured / banner content** — struck through in M2.md §5.3 itself: 🚫 moved to **FINALIZE
  (F5)**. No "feature this product" toggle, no banner manager, nowhere.
- **Search, filters, facets, sort, "did you mean", saved/favourite items** — Module 3
  (M2.md §9). Screens 1–4 get **no search box and no filter rail**. Don't draw a disabled one
  either — M3 will design that surface; an M2 placeholder would prejudge it.
- **Enquiry / chat CTA** — Module 4 (M2.md §9). The product detail and supplier profile ship
  from this brief **without** a "Send enquiry" button; M4's brief adds it. If build order forces
  a placeholder, it follows the `web-ui-notes.md` ledger rule (visible "coming soon", logged).
- **Quotation** — Bucket A, deferred (`docs/month1-not-doing.md`). Nothing quote-shaped anywhere.
- **Seller unblock-request flow** — D6, scheduled ~2026-08-28 (backend-plan header). The blocked
  banner has **no** "appeal" or "request review" action.
- **Notification centre / any notification UI** — D5 deferred.
- **Employee-only pieces** (per-employee dashboards, enquiry routing, ticket handling) — Bucket A.
- **Level-3 sub-sub-categories** — not in Phase 1 (M2.md §9). The picker is two levels, full stop.
- **Hard delete anywhere in the UI** — the only hard delete is the automated 180-day purge job
  (§A8); no screen offers one.

---

## 4. Public / buyer screens (1–4)

Read-only. No login required — design them logged-out first; a logged-in buyer sees the same
pages inside the buyer shell. **Nothing on these four screens may reveal:** product status,
takedown (any part), raw verification status, seller contact details or street address, or any
internal identifier. Draft / hidden / archived / taken-down products and deactivated categories
simply **do not exist** here — excluded at source, so no "unavailable" treatments are needed
except the dead-link state below.

### 1 · Category browse — `/categories`

The catalogue's front door: all top categories as cards.

**Contains:** page header ("Browse categories") · a responsive card grid of the ~40 top
categories — each card: category image (§A11 — with a designed fallback since images are
admin-uploaded later and **will be missing at launch**), name, and its sub-category count or a
teaser of 2–3 sub names · clicking a card expands or navigates to its sub-category list · each
sub links to screen 2.

**Goods / services grouping is derived, not stored** (§A16): if the page groups tops under
"Products" and "Services" headings, a top with mixed children (e.g. "Other") appears under
**both**. Simplest compliant design: one flat grid, grouping optional.

**States:** loading (skeleton card grid) · loaded · **image-missing fallback on most cards
(launch reality — design it as the primary look, not an edge case)** · error.

**Design notes:** deprioritised categories (Category.md list — Gems, Toys, Handicrafts, …) still
appear; `order` drives sequence and arrives pre-sorted. Card target ≥ 44px, whole card clickable.
This page is indexable — real links, real headings, no click-to-reveal-only content.

---

### 2 · Catalogue browse / category listing — `/category/:slug`

Products of one sub-category (or of a top, aggregating its subs), as a paginated card grid.

**Contains:** breadcrumb (Categories → top → sub) · category name as `<h1>` + optional category
image strip · **product card grid** (§2 component) · pagination (newest first — the only order in
M2; no sort control) · sibling sub-category chips for lateral movement.

**States:** loading (skeleton cards) · results · **empty category** — a real state, common at
launch: *"No products in this category yet."* with a link back to `/categories` (and, if the
viewer is a signed-in exporter, a quiet "Sell in this category" link to screen 6) · error ·
**category not found / deactivated → 404 page** (a deactivated category's URL dies publicly —
design the shared 404, not a special "temporarily unavailable" page that leaks the difference).

**🔴 No filter rail, no search box, no sort dropdown** — Module 3. The page layout should leave
room for M3's filter rail (a left column that currently holds the sibling chips) so M3 doesn't
force a re-layout, but nothing filter-shaped is drawn now.

**Design notes:** cards show the price line exactly as the seller set it — "Price on request" is
a normal, unremarkable rendering, not a degraded one (services will mostly use it). Seller name +
tick on every card; unverified sellers' cards are identical minus the tick.

---

### 3 · Product detail — `/product/:slug`

The money page — where a buyer decides this listing (and this platform) is credible.

**Layout:** two columns at desktop — left: **image gallery** (main image + thumbnail strip, up to
5, keyboard-navigable, lightbox on click; single no-image fallback panel when the seller uploaded
none — images are optional at publish) · right: product summary; below: full description + specs.

**Contains, in order:**
- breadcrumb (category trail) · product **name** (`<h1>`) · listed-date line ("Listed Mar 2026" —
  from `listedSince`)
- **price block** — large: fixed ("₹ 1,200 · per piece" using the goods `unit` where present) ·
  range ("₹ 800 – 1,400") · or "**Price on request**" styled as information, not absence
- **seller block** — company name + verified tick + country + entity type, linking to screen 4.
  Content comes from the same public seller projection as the supplier page — **never** email,
  phone, street address or website
- **trade / service facts strip** — the fixed fields that exist for this product's type:
  goods → MOQ (+unit), HS code, country of origin, supply ability, lead time, packaging, payment
  terms · service → engagement type, delivery model, team size, pricing model, timeline. Render
  only filled fields; never a wall of "—"
- **description** (up to 5,000 chars — design for long text: readable measure, "read more" fold
  optional)
- **specifications table** (§2 attribute spec table) — the category's dynamic attributes

**States:** loading (gallery + text skeleton) · loaded · sparse listing (no images, no
description, 1 attribute — must still look intentional; the facts strip and seller block carry
it) · **not found → 404** (covers draft/hidden/archived/taken-down/dead-category — publicly they
are all the same 404, deliberately indistinguishable) · error.

**🔴 Copy constraints:** never render a status word, a "this seller is not yet verified" line, or
an enquiry CTA (M4). The gallery never shows more than the seller's images — no stock filler.

---

### 4 · Supplier profile + catalogue — `/supplier/:slug`

M1 designed the profile header (public preview, §A22); M2 fills its lower half with the live
catalogue. Design them as one page.

**Contains:** company header — logo (fallback: monogram), company name (`<h1>`) + **verified
tick**, country, entity type (Business / Individual), description · **"N products"** count
(active listings only — the §9b `productCount`; taken-down excluded server-side) · **catalogue
grid** — this seller's live products as product cards, paginated.

**States:** loading · loaded · **seller with zero live products** — the profile still renders in
full (a seller is public from signup); the catalogue area gets a calm *"No products listed yet"*
— never an error, never "this supplier is inactive" · not found → 404 · error.

**🔴 Copy constraints:** absence of tick = nothing shown (no "unverified"). No contact details,
no website, no verification status or history. The product count and the visible grid must agree
— both exclude taken-down items, so they will; if pagination truncates, the count still reads as
the total.

---

## 5. Exporter panel (screens 5–7)

All three live inside the exporter shell (M1). The sidebar's "Products" item — logged as a
disabled "Soon" chip in `docs/UiWebNotes.md` — goes live with these screens; update that ledger
row to Done in the same change.

### 5 · My products — `/exporter/products`

The seller's control room: every product they own, in any state.

**Header row:** "My products" · **cap meter** (§2 — unverified only) · primary button **"Add
product"** (disabled with an explanatory tooltip-plus-inline-line only when the relevant cap
blocks *creation* — i.e. at 10 drafts unverified: *"Draft limit reached (10). Publish or delete a
draft, or get verified."*).

**Status tabs:** All · Live · Hidden · **Drafts** (the named "Draft view") · Archived. Tab counts
visible. Blocked items are **not a tab** — they surface within their status tab carrying the
blocked overlay chip (a blocked product still has a status).

**Table / card list columns:** cover thumbnail · name · category (leaf) · price line · status
chip (§1.2) · **blocked chip when taken down** · created date · row actions.

**Row actions by state:**
- Draft → Edit · **Publish** · Delete
- Live → Edit · **Hide** · Delete
- Hidden → Edit · **Publish** · Delete
- Archived → *(none — view-only row, visually quieted)*
- Any blocked row → Edit and status actions **disabled** with the inline reason (see below);
  Delete stays available

**Publish** runs the real checks, so design its failures inline on the row/toast:
- **Cap hit (unverified, 3 live):** *"You've reached 3 live products. Get verified to publish
  more."* + a "Get verified" link to the KYC screen. If one of their live products is currently
  taken down, the meter already excludes it — the copy must never imply a blocked product uses a
  slot (§A10).
- **Missing required specs:** publish validation enforces required attributes **at publish, not
  at draft-save** — the error names the missing fields and links into the edit form: *"Add
  Material and GSM before publishing."*

**Delete** is a confirmation modal (destructive variant) whose copy owns the semantics:
*"This archives the product. It disappears from the catalogue and can't be edited or restored —
to sell it again later, create a new listing. Your product name and web address become free to
reuse."* Button: "Archive product". Never the word "permanently deleted" — the data is kept.

**Blocked rows:** the row carries the blocked chip; expanding it (or opening edit) shows the
**blocked banner** (§2): reason verbatim + date. Status change is refused while blocked — copy:
*"This product was removed by the MPX team and can't be changed until it's restored."* **No
admin identity, no appeal path (D6 deferred).**

**States:** loading (skeleton rows) · populated · **first-run empty** — the most important empty
state in the module: illustration + *"List your first product"* + Add product CTA + one line on
the cap for unverified sellers · per-tab empty · row-level loading during an action · error.

---

### 6 · Add product — `/exporter/products/new`

One page, three zones that reveal in order. Not a multi-step wizard — a single form where the
category choice unlocks the rest (`ServiceXproduct.png`: parent form → pricing → type branch).

**Zone A — category (always visible first).**

| Label | Type | Required | Helper |
|---|---|---|---|
| Category | searchable select — 40 tops | ✔ | "Pick the closest match — 'Other' is there if nothing fits" |
| Sub-category | select, loads from the chosen top | ✔ | "This decides which details we'll ask for" |

Until a sub-category is chosen, zones B and C are hidden (not greyed — absent, with a hint:
*"Choose a category to continue"*). Changing the sub-category later re-renders zone C's dynamic
fields — warn before discarding entered spec values: *"Changing category clears the
specifications you've filled in."* The seller **never picks goods vs service** — the sub-category
decides it silently (§A14/§A16), including under "Other" (two typed subs: Other goods / Other
services).

**Zone B — the common form.**

| Label | Type | Required | Helper |
|---|---|---|---|
| Product name | text, max 200 | ✔ | — |
| Description | textarea + counter, max 5,000 | ○ | "Details, use cases, certifications…" |
| Images | product image manager (§2) — max 5 × 5 MB, JPG/PNG/WEBP | ○ | "First image is the cover" |
| Price | price input (§2) — Fixed / Range / On request | ✔ mode | currency required unless On request |

**Zone C — type-driven fields + specifications.**

*Goods sub-categories* (fixed fields, all optional):

| Label | Type | Helper |
|---|---|---|
| Minimum order quantity | number + Unit (text, e.g. "pieces", "kg") | shown together as one labelled pair |
| HS code | text | "Harmonised System code, if you know it" |
| Country of origin | searchable country select | — |
| Supply ability | text | e.g. "10,000 units per month" |
| Lead time | text | e.g. "2–3 weeks" |
| Packaging | text | — |
| Payment terms | text | e.g. "30% advance, 70% on shipment" |

*Service sub-categories* (fixed fields, all optional): Engagement type · Delivery model · Team
size · Pricing model · Timeline — plain text inputs with example placeholders ("Project /
hourly / dedicated team", "Remote / onsite / hybrid").

*Specifications:* the **dynamic attribute renderer** (§2) with this sub-category's fields, in
order, required ones marked. Seeded attributes are mostly optional text/number/boolean; selects
appear once an admin defines options.

**Actions:** **"Save draft"** (primary at this stage) · "Cancel". Saving creates the product as a
**Draft** — publishing is a separate, deliberate act from screen 5 or 7. Required specs are *not*
enforced on draft-save (only name, category and a valid price shape are) — the form must let a
seller save half-finished work without a fight.

**States:** pre-category (zone A only) · full form · saving · field errors · **draft cap hit**
(unverified, 10 drafts — a blocking notice *before* they fill anything in, not after: *"You've
reached the 10-draft limit. Publish or delete a draft, or get verified."*) · image
uploading/failed per file · success → the new draft's row on screen 5 (or straight into screen 7)
with a toast offering **"Publish now"**.

**Design notes:** this is the longest form in the product — sticky in-page section nav (Category ·
Details · Pricing · Specifications) at desktop, plain scroll below 1024. Autosave is not built;
warn on navigate-away with unsaved changes. Number fields show their unit inside the input.
Optional is the norm here, so mark **required** fields (the few) rather than littering "optional".

---

### 7 · Edit product — `/exporter/products/:id/edit`

Screen 6's form, pre-filled, plus lifecycle controls. Keep them visually identical so the flow
feels like one place.

**Differences from screen 6:**
- **Header status strip:** current status chip + the contextual action (Publish / Hide) + Delete.
  For a Draft, "Publish" here runs the same cap + required-spec checks as screen 5.
- **Category may change** — with the same spec-clearing warning; the new leaf's fields re-render
  and old values that don't map are dropped (say so).
- **🔴 A rename never changes the public web address.** The slug is immutable (§A6). One quiet
  line under the name field, shown only when the name has been edited: *"Your product's web
  address stays the same."* Without it, a rename gets reported as a broken-URL bug later.
- **Blocked variant:** the blocked banner (reason + date, no admin identity) sits at the very
  top; Publish/Hide are disabled with the blocked explanation; **editing fields remains allowed**
  (the seller can fix the offending content while blocked) and Delete remains available.
- **Archived products never reach this screen** — their rows carry no edit action; a direct URL
  hit shows a "This product is archived" terminal notice with a "Create a new listing" CTA, not
  the form.

**States:** loading (form skeleton) · loaded · saving · field errors · publish-blocked (cap /
required specs) · blocked variant · archived terminal notice · not found (404 — including any
attempt to open another seller's product; never a 403) · error.

---

## 6. Admin panel (screens 8–11)

Dense, table-first, inside the admin shell. Every write action here lands in the audit log — a
discreet footer note on screens 8–10 ("Changes are recorded") sets expectations. Employee vs
superadmin is invisible in the chrome; what varies is which actions render, driven by granted
permissions (server-supplied — the UI never decides).

### 8 · Category manager — `/admin/categories`

The full tree — **including inactive rows** (the public endpoints hide them; this view must not).

**Layout:** two-pane. Left: the 40 tops as a scrollable list (name, image thumb, active state,
sub count). Right: the selected top's detail — its own controls + its sub-category table.

**Top-category controls** (tops are seeded — no create, no delete, no structural edit):
- **Active toggle** — with the cascade confirmation modal (below)
- **Image upload** — single image, 5 MB, JPG/PNG/WEBP. 🔴 This field on tops is a **deliberate
  §A20 exception** to "top = toggle-only" — annotate it in the design file so a later pass
  doesn't "fix" it away. The 40 top images arrive through this control, not a seed.
- Name / order tweak · **synonyms** tags input (comma/enter to add — feeds search, never shown
  publicly; helper: "Keywords buyers might type — e.g. medicine, pharma, dawai")

**Cascade confirmation (deactivating a top):** destructive modal stating the real consequence:
*"This hides ‹top› and all N of its sub-categories from the catalogue. Every product in them
disappears from public view until you reactivate. Sub-categories you had already switched off
individually will stay off when you reactivate."* That last sentence is the `prevActive`
behaviour (§A4) — it's subtle enough that the modal is where users learn it.

**Sub-category table** (per selected top): name · type chip (Goods / Service) · active toggle ·
product-count-safe delete · attribute count (→ screen 9) · image thumb · order · actions
(Edit · Fields · Delete).

**Sub-category create / edit — side panel**

| Label | Type | Required | Notes |
|---|---|---|---|
| Parent (top) | read-only value on edit; fixed on create | ✔ | re-parenting does not exist |
| Name | text, max 120 | ✔ | slug is generated once and **immutable** — show it read-only under the name on edit |
| Type | radio: Goods / Service | ✔ create | **locked once the sub has products** — show as read-only value with *"Can't change: products exist in this category"* |
| Synonyms | tags input | ○ | search keywords, admin-editable (§A12) |
| Order | number | ○ | — |
| Image | image upload | ○ | fallback used on cards when empty |

**Refusals to design as clear inline messages, not generic failures:**
- Activating a sub whose **top is off**: *"Turn on ‹top› first — a sub-category can't be active
  under an inactive parent."*
- Deleting a sub with products (or children): *"Can't delete — N products use this category.
  Deactivate it instead."* (Deactivate offered as the alternative action in the same message.)
- Deactivating a sub **while its top is cascade-off** is allowed and meaningful — it records
  that this sub must stay off when the top returns. The toggle should confirm: *"‹sub› will stay
  off even after ‹top› is reactivated."*

**Read-only variant:** with `category:read` only, everything renders minus toggles, panels and
upload affordances — a browsing view, not a wall of disabled buttons.

**States:** loading · tree loaded · inactive rows visually muted but fully readable · panel
(default / saving / error) · toggle in-flight (row-level) · empty sub list ("No sub-categories
yet — add one") · error.

---

### 9 · Attribute manager — `/admin/categories/:id/attributes`

The per-sub-category field designer — what M2.md calls "Fields (attribute) manage". Reached from
a sub's "Fields" action. **Sub-categories only** — a top has no attributes.

**Header:** sub-category name + type chip + parent trail.

**Attribute table:** name · key (mono, muted) · input type chip · unit · options count (selects) ·
required? · filterable? · order · actions (Edit · Delete).

**Create / edit — side panel**

| Label | Type | Required | Notes |
|---|---|---|---|
| Display name | text, max 120 | ✔ | what sellers and buyers see; safe to change later |
| Key | text, lowercase snake_case, max 60 | ✔ create | **immutable after create** — read-only on edit, with *"Fixed so existing products keep working"*. Offer auto-generate from the name |
| Input type | select: Text / Number / Yes–No / Select | ✔ create | **immutable after create** — the fix for a wrong type is delete + recreate under a new key; say exactly that in the helper |
| Options | tags/list input | ✔ when Select | one per line/chip; max 100. Editable later (add/remove options) |
| Unit | text, max 20 | ○ | e.g. gsm, kg, % — shown inside seller inputs and buyer specs |
| Required | toggle | ○ | "Sellers must fill this before publishing" |
| Filterable | toggle | ○ | "Available as a buyer filter (arrives with search)" |
| Order | number | ○ | — |

**Delete confirmation:** *"Products that already have ‹name› keep their saved value — it just
stops being asked for new listings."* True (values are snapshots), and it makes delete feel as
safe as it actually is.

**🔴 The seeded-select reality, in copy:** attribute defaults were seeded as `text` wherever a
select's options weren't specified (options are never invented — §A25.2). Since input type is
immutable, "turning" a seeded text field into a select = delete + recreate. The panel's helper on
Input type must teach this, or admins will file it as a bug: *"Type can't change later. To
convert an existing field, delete it and create a new one with a different key."*

**States:** loading · table · empty ("No fields yet — sellers will only see the standard form") ·
panel states · delete confirm · error. Read-only variant for `category:read`.

---

### 10 · Product monitoring — `/admin/products`

The moderation surface: watch new products, take down bad ones, restore. `product:read` sees;
`product:takedown` acts.

**Filters / controls**

| Control | Type | Notes |
|---|---|---|
| Search | text | **prefix match on product name — label it "Starts with…"** (same convention as M1's user table) |
| Category | select (top, then optional sub) | — |
| Status | select: **Active · Inactive · Blocked** — exactly three | Blocked = taken down, regardless of status; never a fourth option |
| Seller | org picker/search | — |
| Nearing purge | toggle | blocked > ~150 days — feeds from the same rule as the purge countdown |
| Rows per page | 20 / 50 / 100 | — |

**🔴 Drafts and archived products are not in this list at all** (m5 rule) — no filter reveals
them. Do not design a "Drafts" or "Archived" admin view.

**Table columns:** thumbnail · product name · seller company (+ their **takedown count** — a
small `danger`-tinted counter like "3 takedowns", the repeat-offender signal, §A24) · category ·
status chip · **blocked chip** with takedown date · **purge countdown** on blocked rows ("purges
in 42 days" — `warning` under 30) · listed date · actions.

**Row actions:** View (public-style detail preview, staff-eyes) · **Take down** (danger — only
with `product:takedown`) · **Restore** (blocked rows only, same permission).

**Take down — modal**

| Label | Type | Required | Notes |
|---|---|---|---|
| Reason | textarea + counter | ✔ | 3–500 chars; helper: **"This is shown to the seller — say what's wrong and what would fix it"** |

Consequence line in the modal: *"The product disappears from the public catalogue immediately.
The seller keeps it and sees this reason. If it stays blocked for 180 days it is permanently
deleted."* That last clause is §A8 — the one place the purge is user-visible; it belongs here.

**Restore — confirmation:** *"The product returns to exactly the state the seller left it in
(live products go live again). The seller's takedown count is not reduced."* ⚠️ One recorded
nuance (backend-plan §5, owner decision pending): a restore **can** put an unverified seller over
the 3-live cap — the state self-corrects (they can't publish again until under it). Do not design
a warning for it; just don't design copy that promises the cap is never exceeded.

**Staff sees what the seller doesn't:** the blocked row's detail shows **who** took it down and
when (m5 monitoring spec) — the §A9 secrecy is seller-side only. Keep the admin identity out of
any copy that could be screen-shotted to a seller (i.e. it lives in the staff table, never in
the reason field's preview).

**States:** loading · results · no matches (names active filters, offers clear) · row processing ·
**already handled elsewhere** (*"This product is no longer in that state"* + refresh) ·
read-only variant (no action buttons at all — not disabled ones) · error.

---

### 11 · Audit log view — `/admin/audit`

Read-only ledger of catalogue and governance actions (M2.md §5.3). The admin sidebar's "Audit
log" item is currently a "Soon" chip in `docs/UiWebNotes.md` — flips to Done with this screen.

**Contains:** filter row (date range · action type — product create/publish/unpublish/archive/
takedown/restore/purge, category and attribute actions, org/user governance actions · actor) ·
table: timestamp · actor (name/role — "System · purge job" for automated entries) · action ·
target (name + type; **purge rows show the snapshotted product + company names** — the row is
self-contained because the product no longer exists, §A8) · reason where one applies.

**🔴 Strictly read-only.** No edit, no delete, no "clean up", no export-with-redact. Row detail
(drawer) may show the audited diff for safe fields — never KYC values, tokens or contact data
(the backend never stores them in audit rows; the design must not imply they exist).

**States:** loading · results · empty range · error. Pagination, newest first.

---

## 7. Permission variants — one map

| Permission | Screen 8 | Screen 9 | Screen 10 | Screen 11 |
|---|---|---|---|---|
| `category:read` | view tree (no writes) | view fields | — | — |
| `category:manage` | full | full | — | — |
| `product:read` | — | — | view list (no actions) | — |
| `product:takedown` | — | — | + takedown & restore | — |
| superadmin | everything | everything | everything | everything |

An employee with none of these never sees the catalogue section in the sidebar (M1's
zero-permission shell rule covers that state). Audit view: gating not named in M2.md — see §12.

---

## 8. Role redirect touchpoints

No new redirects. Exporters land on `/exporter` (M1) — its dashboard's "product allowance
notice" and placeholder catalogue tile now link to screen 5 (update the M1 tile from "coming
soon" to live, and its `UiWebNotes.md` row to Done). Buyers/guests reach screens 1–4 from the
landing page's category content — the landing's static category text (ledger rows dated
2026-08-01) becomes real links to `/categories` and `/category/:slug` in the same change.

---

## 9. Cross-screen checklist before handing designs over

- [ ] Every screen has loading, empty, error and success states drawn
- [ ] Status vocabulary (§1.2) identical everywhere; Blocked always an overlay, never a fifth status
- [ ] No status chip, takedown trace, or verification status on any public surface
- [ ] Verified tick only as a tick; unverified sellers browse identically minus the tick (B7)
- [ ] Cap meter appears only for unverified sellers; blocked products visibly don't consume a slot
- [ ] Publish failures name the exact blocker (cap vs missing required specs) with a next step
- [ ] Delete copy says "archive, terminal, re-list as new" — never "gone forever" or "restorable"
- [ ] No "revert to draft" affordance anywhere
- [ ] Seller-side blocked treatment shows reason + date, never who; no appeal action (D6)
- [ ] "Other" behaves as two ordinary sub-categories; no goods/service toggle anywhere (§A14)
- [ ] Price input: On request removes amount fields entirely; range validates min < max inline
- [ ] Image limits (5 × 5 MB, JPG/PNG/WEBP) stated before first pick; per-file progress and errors
- [ ] Rename note on product edit: "web address stays the same"
- [ ] Admin tree shows inactive rows; public screens never do
- [ ] Cascade modal explains `prevActive` ("individually-off subs stay off")
- [ ] §A20 top-category image upload present and annotated as deliberate
- [ ] Attribute key + input type immutable after create, with teaching copy
- [ ] Admin product status filter = exactly Active / Inactive / Blocked; no drafts/archived view
- [ ] Takedown modal: reason required, shown-to-seller helper, 180-day purge consequence line
- [ ] Prefix searches labelled "Starts with…"
- [ ] Permission variants drawn: read-only versions omit actions rather than disabling them
- [ ] Audit view strictly read-only; purge rows self-contained via snapshots
- [ ] Every not-yet-wired control follows `web-ui-notes.md` (visible "coming soon" + ledger row)
- [ ] Checked at 1440 / 1024 / 768 / 375; wide tables scroll in their own container

---

## 10. Decisions

### ✅ Backend is ahead of design this time

Unlike M1, the M2 backend is **fully shipped** (backend-plan: all phases ✅, 186/186 tests).
Every state in this brief is real and populatable — no "design now, wire later" caveat. The
validation limits quoted (name 200 · description 5,000 · reason 3–500 · synonyms ≤100 ·
options ≤100 · attributes ≤50 · images 5×5 MB) are the enforced server values; error states
should be designed against them, not invented thresholds.

### ✅ The two reads these screens needed were added 2026-08-07

Both were found by reading this brief against the shipped API, and both are now live:

- **`GET /admin/categories/:id/attributes`** (`category:read`) — screen 9's data source. The public
  attribute route could not serve it: it hides inactive categories, and it omits the attribute `id`
  that Edit/Delete need. Returns `id` + `order`; refuses a top category.
- **`GET /products/mine`** now takes `?status=` and returns `counts` (per-status, for the tabs) and
  `caps` (`{verified:true}` when verified, else used/limit for live + drafts). 🔴 `caps.active.used`
  excludes taken-down rows while `counts.active` does not — the meter reading "2 of 3" beside a Live
  tab of 3 is **correct** (§A10, a block frees a slot) and both briefs' checklists require it.

### Still open

1. **Brand palette** — unchanged from M1; confirm before final visual design.
2. ~~**Restore-over-cap**~~ — ✅ **DECIDED 2026-08-07 — owner: leave as-is.** A restore may put an
   unverified seller at 4 live products; the state self-corrects. No warning is designed, and no
   copy anywhere may promise the cap is never exceeded. Do not re-raise.
3. **Top-40 synonyms content** — owner-authored list still pending; screen 8's synonyms input is
   the entry path when it arrives. Not a design blocker.
4. **Category page for a TOP category** — this brief renders `/category/:slug` for subs and lets
   a top aggregate its subs; whether tops get their own indexable listing page or only the
   `/categories` grid is an M3/SEO call. Flagged, not decided here.

---

## 11. What M2 deliberately leaves for M3/M4 on these screens

So nobody "finishes" these pages later without a plan: M3 adds search, filter rail, facets,
sort, save-to-favourites, and SEO furniture (meta/canonical/JSON-LD per `m3-seo.md`) to screens
1–4. M4 adds the enquiry CTA to screens 3–4. Both arrive through their own briefs — the layouts
here reserve space (left rail on screen 2, action slot on screens 3–4) but draw nothing.

---

## 12. Gaps the sources leave — flagged, not silently filled

| Gap | Detail | What this brief did |
|---|---|---|
| **Buyer web entry point** | No doc names how a buyer reaches the catalogue from inside the buyer shell (the M1 buyer sidebar has Search/Enquiries "Soon" chips but no "Browse" item). | Assumed the public screens 1–4 double as the buyer-shell browse surface + landing links (§8). ✅ **DECIDED 2026-08-07 — owner: leave it.** No "Browse catalogue" sidebar item; screens 1–4 stay reachable from public/landing links only. Do not re-raise. |
| **Audit-view permission** | M2.md names the audit screen but no permission string for it; §A25's four don't cover audit read. Backend's audit endpoint gating is defined in M5's spec, not M2. | ✅ **RESOLVED — it is `audit:read`** (grantable; `routes/admin.routes.js`), shipped with M5 and deliberately separate from `organisation:read`. Screen 11 gates on it. |
| **Admin "View" of a product** | Screen 10 gives staff a detail preview; no doc names a dedicated admin product-detail screen. | Kept it a preview drawer/modal of the public rendering, not a new screen. |
| **Currency display for buyers** | Prices render in the seller's chosen ISO currency with no conversion (Phase 1 has none — §A27.1). No doc addresses buyer-side currency hinting. | Cards/detail show the raw currency code. Nothing else designed. |
| **Sub-category image fallback** | §A11 says "sensible fallback" for missing sub images but no doc defines it. | Left to visual design: recommend the parent top's image, then a neutral tile. |
| **Exporter dashboard tile** | M1's `/exporter` placeholder tiles ("coming soon") for catalogue now have a real target; no doc re-specifies that dashboard. | Noted the tile flips live (§8); did not redesign the dashboard. |
