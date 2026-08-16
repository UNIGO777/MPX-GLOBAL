# M3 · Web Screens — Design Brief

> **8 screens** for the M3 (Discovery & Search) milestone, web only.
> This is a **design** document: what each screen contains, every control on it, and the states
> that need artwork. No API or code detail.
> Product: **MPX Global** — B2B import/export marketplace. Indian exporters, international buyers.
> Companion: `design-plans/m3/app-screens-design.md` — the two surfaces must feel like one product.
>
> **Scope rule (same discipline as the M1 briefs):** this brief contains **only** the screens named
> in `modules-in-detailed/m3-search-filter-3-4days-max/` — `m3.md` §8, `Search.md` §9,
> `Saved-item.md`, `m3-seo-rules.md`, plus the folder images (`m3.png`, `m3allscreens.png`,
> `Search-screens.png`, `Saved-items-ui.png`, `Search-flow-chart.png`, `Rules.png`,
> `product-delete-flow.png`) and the interactive `Search-demo.html`. Nothing inferred, nothing
> added. See §11 for the gaps that leaves.
>
> **The backend for every screen here is SHIPPED** (`build-plans/m3/backend-plan.md`, all phases
> ✅ 2026-07-31, 274/274 tests green). Unlike M1, design is not ahead of plumbing — what each
> screen may show is pinned by real, tested responses. The public field lists in this brief are
> **contractual**: they mirror `.claude/rules/m3-public-projection.md`, and a designer adding a
> field the projection doesn't return is drawing a screen that cannot be built.
>
> ⚠️ **STATUS 2026-08-14 — four of the eight screens are BUILT and iterated.** Screens **4–7**
> (`/categories`, `/category/:slug`, `/product/:slug`, `/supplier/:slug`) shipped ahead of this
> milestone (M2 pull-forward, then owner-directed design passes 2026-08-11 → 2026-08-14). Their
> sections below have been corrected to **as-built** — treat those passages as descriptions of
> shipped reality, not proposals. Screens **1 (hero wiring) · 2 · 3 · 8** remain unbuilt and are
> still genuine design work; where their assumptions collided with what shipped, a dated
> supersession note marks the change. Standing owner preference recorded the same day: the
> category page is **full-bleed** (`w-full`, slim side padding) — never cap its container width.

---

## 1. Design foundations

**Tone.** M3 is the platform's **public storefront** — the first module guests, buyers and search
engines actually see. It has to read as a serious, dense-but-calm trade catalogue: closer to a
professional B2B directory than a consumer shop. Confidence comes from clarity — real counts,
honest empty states, no fake urgency, no decorative noise.

**Audiences on these screens:**

| Audience | Who | Feel |
|---|---|---|
| Guest | not signed in — can use everything except save | zero friction, no login walls on browse |
| Buyer | signed-in buyer account | same surface + save/saved-list |
| Exporter | signed-in exporter account — may search but **cannot save** (§A13) | same public surface. ⚠️ Superseded 2026-08-14 (owner): the save heart is now VISIBLE to all; a non-buyer tap opens a gate modal — "Log in with a buyer account to save this product" (guest → Login button to sign-in; signed-in non-buyer → OK only). Capability stays buyer-only; the server rejects non-buyer saves regardless. Spec: `web-build-plan.md` Phase 5 |
| Crawler | Googlebot | every public page carries correct head/meta — §8 |

There is **no admin surface in M3**: *"admin has no search screens"* (`m3.md` §8 roles line). Do
not design any moderation, takedown or admin view in this brief.

**Type & spacing.** Same tokens as M1 — one type scale, one spacing scale, Tailwind config as the
single source of truth (`web-design.md`). The M3 grid density is new (card grids, facet panels)
but it is built from the same primitives, not a second system.

**Responsive.** Every screen works at **1440 / 1024 / 768 / 375**. Card grids reflow
(4 → 3 → 2 → 1 columns). No horizontal page scroll ever.
⚠️ **Superseded 2026-08-14 (filters):** this line originally said "the filter sidebar becomes a
slide-over drawer under 1024". As shipped on `/category/:slug`, filters are **never** a
persistent sidebar at any width: a "Filters" button (with active-filter count badge) opens a
**full-screen sheet on phones** and a **right-side drawer at lg+**. The left rail is
**navigation only** (Specialisations). Screen 2's design should follow this shipped pattern
rather than the two-column sidebar this brief originally assumed.

**Accessibility is "done", not polish.** Real labels on every filter control; visible focus on
cards and hearts; touch targets ≥ 44px; text contrast ≥ 4.5:1; never colour alone — the tick has
an icon + the word "Verified", the unavailable state has a label, not just grey.
`prefers-reduced-motion` respected on grid transitions.
⚠️ **Superseded 2026-08-12 (facet controls):** "facet checkboxes are real checkboxes" no longer
describes the shipped surface — select/text/boolean options render as **pill buttons**
(`aria-pressed`, "+" icon unselected / check on a filled pill selected, per the owner's
reference mockup), with each option's live count moved to `title`/`aria-label` rather than
visible text. Number attributes and price stay real min/max inputs.

**Every screen needs four states drawn, not one:** loading (skeleton cards, not a spinner), empty,
error, success. M3 adds a fifth that matters more here than anywhere: **zero results** — see §1.4.

### 1.1 The verified tick — same single convention as M1

One badge: a **verified tick**, shown only when the seller is verified. **No "not verified"
badge, no red cross, no warning chip, anywhere.** Absence of the tick is the only signal.

- The tick renders from the server-derived **`verified` boolean** (+ optional `verifiedAt` for
  "since 2026"). The public payload **never contains raw `kycStatus`** and never a `rejected`
  state — there is nothing else the UI *could* render from, by design (B7).
- Verification **never gates visibility**: unverified sellers and their products appear in every
  result, ranked lower by a server-side boost the UI does not reproduce. The only
  verification-shaped control a buyer ever sees is the **opt-in "Verified sellers only" facet
  toggle** (§3.1 of Search.md — an allowed carve-out, off by default).

~~⚠️ `.claude/rules/web-design.md` still says "show the tick when `kycStatus === 'verified'`"~~ —
✅ **FIXED 2026-08-10**: the rule now reads from the derived `verified` boolean (with the
self-scoped own-status exception spelled out). Brief and rule agree; the §11 row is closed.

### 1.2 Availability vocabulary (saved list + dead links)

Two words carry the whole availability story. Use exactly these, everywhere:

| State | Where seen | Label | Meaning |
|---|---|---|---|
| Available | everywhere | *(no label)* | normal |
| Currently unavailable | saved list; a saved item's detail page | "Currently unavailable" (`muted` badge + greyed card) | temporarily hidden (seller hid it, takedown, category deactivated) — **may return**, so it stays saved |
| Gone | — | *(never labelled)* | archived/purged items are **removed from the saved list by the backend** — the UI never shows a "deleted" tombstone |

🔴 **Never say why something is unavailable.** Takedown reasons, seller status, category state —
all internal. "Currently unavailable" is the entire public copy.

### 1.3 Price display — one component, three modes

Product price has three server-driven modes; design one `Price` component with all three:

| Mode | Display |
|---|---|
| Fixed | `₹ 450 / metre` (amount + currency + unit) |
| Range | `₹ 450 – 620 / metre` |
| On request | **"Price on request"** — quiet text, not an error style |

"On request" is a first-class, legitimate mode (services especially) — it must not look like
missing data.

### 1.4 Zero results is a designed state, not a failure

Native text search matches **whole words only** — no typo tolerance, no partial matching
("cott" finds nothing; that is expected behaviour, §A26). The replacement is the server's
**"did you mean"** suggestion on zero-result queries. So the empty-results state is a real,
common state and gets real design:

- headline ("No results for **'medisin'**") · the **did-you-mean chip** when the server sends one
  ("Did you mean **Pharmaceuticals & Medical**?" — tapping it re-runs the search) · a
  "clear filters" action when filters are active (name the active filters) · a link to category
  browse. Never a bare "0 results" line.

---

## 2. Shared components to design once

These carry every M3 screen — design them before any page. (`m3.md` §8.7 names the set.)

**The three cards** (`m3.md` §6 fixes their contents — do not add fields):

| Card | Shows | Tap → |
|---|---|---|
| **Product card** | image, name, price (§1.3), MOQ + unit (goods), seller name + tick, save heart | `/product/:slug` |
| **Supplier card** | logo, company name, verified tick, country, product count, save heart | `/supplier/:slug` |
| **Category card** | name, image, product count | that category's page |

⚠️ **Superseded 2026-08-11→14 (product card — SHIPPED shape):** the shared `ProductCard` is a
B2B merchandising card: image (hover zoom + "View details" slide-up) · name · **spec chips**
(first two short attribute values; numeric chips humanise snake_case keys) · price + /unit ·
MOQ line · **seller row** (monogram · name · tick · country) — or a category line when the
seller row is off. It has **no save heart yet** (SaveButton is still unbuilt M3 work; the
heart placeholders that exist today are on `ProductListCard` AND — since later on
2026-08-14, owner request during the Phase-1 review — the `/product/:slug` gallery. Two
UiWebNotes rows; screen 8 wires both). A second, **page-scoped horizontal card**
(`ProductListCard`) ships on `/category/:slug` from `md+`: wide image column that scales with
the viewport (md 320 / lg 300 / xl 360 / 2xl 400px), title + category/tick line, hero price,
lead-spec block beside the price (truncating), 2-line description, seller/listed footer, and
disabled "Inquiry" + heart placeholders.

- Product-card seller line links to the seller page; the tick sits beside the seller name.
- Supplier card with `productCount: 0` is a **normal state** — sellers with zero live listings
  do appear (B7; flagged backend default). Copy: "No live listings yet", never hidden.
- Card images come from Cloudinary with explicit width/height (no layout shift), lazy-loaded
  below the fold, alt text from the entity name (§8).

**SaveButton** — the heart/bookmark toggle, used on product card, supplier card, product detail,
seller profile. States: unsaved · saved (filled) · in-flight (optimistic — flips immediately,
reverts on failure with a toast) · **guest** (tap → sign-in prompt, §7) · **hidden** for signed-in
non-buyer accounts (an exporter/staff token gets a 403 — don't render a control that can only
fail). Toast copy: "Saved" / "Removed from saved".

**Verified tick badge** (§1.1) · **Unavailable badge** (§1.2).

**Search bar** — text input + submit, with the **Products | Suppliers** segmented toggle beside
it and the **✨ AI Search** button. Appears on the landing hero and persists at the top of search
results. Enter submits; the toggle re-runs the current query in the other mode.

**Filter panel** (Search.md §3):
⚠️ **Superseded in part, 2026-08-11→14 — a SUBSET of this panel is SHIPPED** as
`FilterSidebar`, live on `/category/:slug` (owner-directed pull-forward): **verified-only
toggle · price min/max** (single server-supplied currency shown in the group title — no
currency *select* on this surface) · **dynamic attribute groups** (pills for
select/text/boolean, min/max for number, live counts per §A27.2) · **applied-filter chips with
per-chip remove + Clear All**. It renders inside the Filters **sheet (phones) / right-side
drawer (lg+)** — never a persistent sidebar. The groups below that are NOT on the category
page (Category, Country, currency select, include-price-on-request, MOQ, Goods/Services)
remain future `/search` work; when screen 2 is built, extend the shipped component rather than
re-deriving the panel.
- **Standard groups:** Category (tops → leaves once a top is chosen) · Country (seller's
  country) · Price range (min/max **+ a currency select**, §1 of §A27 — see screen 2) ·
  "Include price-on-request" toggle · MOQ (goods only) · Goods / Services · "Verified sellers
  only" toggle.
- **Dynamic attribute groups** — appear only when a category is active; generated from that
  category's filterable attributes (select/boolean → checkbox lists with counts; number → a
  min–max range slider with server-supplied bounds, e.g. GSM 100–150).
- Every option shows its **count**; counts for a group are computed ignoring that group's own
  selection (server behaviour §A27.2), so sibling options never all read 0 — the UI just renders
  the numbers it is given.
- OR within a group, AND across groups — reflect it in copy ("any of these") not in a diagram.
- **Clear all filters** action; per-group clear; an **active-filter chip row** above results with
  per-chip remove.
- Goods-only groups (MOQ, and goods trade facets) **do not render** for a service category —
  the panel adapts, it never shows disabled groups.

**Sort select** — Relevance (default with a query) · Newest · Price: low to high · Price: high to
low. See screen 2 for the price-sort honesty note.
⚠️ **Shipped form 2026-08-14:** on `/category/:slug` sort is a **pure dropdown** (`SortMenu` —
text-button trigger "Sort: {label}" + listbox with check-marked active option; owner: "no text
field"), with Newest · Price ↑ · Price ↓ (no Relevance — there is no query on that surface).
Screen 2 should reuse this control, adding Relevance when a query is present. The hybrid
type-to-filter Combobox is NOT used for sort anywhere.

**Pagination** — page-based pager with total count ("1–20 of 214"). (Infinite scroll is an open
decision — §10.)

**Did-you-mean chip** (§1.4) · **AI answer panel + extracted-filter chips** (screen 3) ·
**Breadcrumb** (category pages, product detail) · **SEO head block** (title/meta/canonical/OG/
JSON-LD per page — §8; a content requirement per screen, not a visual).

---

## 3. Screen inventory — 8

| # | Screen | Route | Audience | Named in |
|---|---|---|---|---|
| 1 | Landing — discovery wiring | `/` | public | `Search-flow-chart.png` "search entry" · UiWebNotes ledger (hero + categories pending) · `GET /public/featured` (F5b) |
| 2 | Search results | `/search?q=…&type=product\|supplier` | public | `m3.md` §8.1 · `Search-screens.png` |
| 3 | AI search modal (+ AI results treatment) | overlay on 1–2 | public | `m3.md` §8.2 · `Search-demo.html` |
| 4 | Category browse — all categories ✅ **shipped** | `/categories` | public | `m3.md` §8.5 "category cards → filtered listing" |
| 5 | Category page — top & leaf ✅ **shipped** | `/category/:slug` (⚠️ **flat for BOTH levels as built** — slugs are globally unique; the nested `/category/:parentSlug/:childSlug` form was never implemented) | public | `m3.md` §8.5 · `m3-seo-rules.md` §1 |
| 6 | Product detail ✅ **shipped** | `/product/:slug` | public | `m3.md` §8.3 · `m3allscreens.png` |
| 7 | Seller public profile ✅ **shipped** | `/supplier/:slug` | public | `m3.md` §8.4 · §5b |
| 8 | Saved items | `/saved` | **buyer only** | `m3.md` §8.6 · `Saved-items-ui.png` |

All eight exist for guests except **8** (buyer-only). Screens 5–7 are the **indexable SEO
surfaces**; screen 2 is explicitly noindexed (§8).

### Do not design — confirmed by the M3 boundary (`m3.md` §11, backend plan §4)

- **Semantic / embedding / vector search, recommendations, "similar products", analytics,
  recently-viewed** — all Phase 2 (Bucket B). No UI hint of any of them, not
  even a "coming soon" tile.
  > ⚠️ **CARVE-OUT — search history, owner-approved 2026-08-16.** A **Recent searches** row
  > ships on `/search`'s idle state. It was built before this boundary was re-read (my miss);
  > raised to the owner as a 🔴 alert on 2026-08-16 and the owner ruled **"keep the recent
  > search as it is"**. Scope of the exception, do not widen it: the last 5 query strings in
  > the browser's `localStorage` only (`mpx:recent-searches`) — **no endpoint, no server
  > storage, no per-user record, no analytics**, each chip individually removable plus a
  > Clear action. The rest of this bullet (semantic search, recommendations, similar
  > products, analytics, recently-viewed) is UNCHANGED and still needs a red-alert.
  > **Do not remove the Recent row as "out of scope" — it is a conscious owner decision.**
- **Enquiry / chat screens** — Module 4. Screens 6–7 carry an **entry point** ("Send enquiry"
  button) and nothing more — no chat drawer, no message composer, no enquiry form. Until M4's
  screens exist the button is visibly "coming soon" + a `docs/UiWebNotes.md` row (strict rule).
- **Quotation** — deferred (Bucket A). No "request quotation" affordance anywhere.
- **Admin / employee screens** — M3 has none ("admin has no search screens"). Takedown and
  product-moderation UI belongs to M2/M5 briefs, not here.
- **Trust score, directories, subscriptions** — Bucket B skeletons; never surface.
- **Autocomplete / search-as-you-type** — lost with Atlas (§A26), out of M3 scope. Do not design
  a suggestion dropdown on the search bar.

---

## 4. Discovery entry (screens 1–3)

### 1 · Landing — discovery wiring — `/`

The landing page itself shipped with the M1 web build. M3's job here is to **wire the parts that
were logged as pending** in `docs/UiWebNotes.md` and give them their real design:

**Contains:**
- **Hero search bar** — becomes the real search entry: input + Products|Suppliers toggle +
  ✨ AI Search button. Submitting goes to `/search`. (Currently a decorative preview — that
  ledger row flips to Done.)
- **Featured strip(s)** — from the single landing content call: admin-curated **banners**
  (image + title + subtitle + link), **featured products**, **featured categories**,
  **highlighted suppliers**. The cards are exactly the three shared cards from §2 — a featured
  card is **never richer** than a search-result card (same projection, by contract). Banners are
  the only element with their own presentation fields (image, title, subtitle, link).
- **Category groups** — become real links into screens 4–5 (ledger row flips to Done).

**States:** loading (skeleton strips) · loaded · **featured empty** (admin has curated nothing —
collapse the strip entirely, never show an empty rail) · error (drop the strip silently; the
landing must not break because curation failed).

**Design notes:** banners rotate or stack — keep motion subtle and pausable
(`prefers-reduced-motion`). A banner's link may target a product/category/supplier page or a
relative path — never an external domain. Featured content self-heals server-side (a taken-down
product simply stops appearing) — design the strip to look right with 0–N items.

**🔴 Copy constraint:** nothing on the landing implies verification is required to appear —
featured suppliers may be unverified (tick present or absent per §1.1, nothing else).

---

### 2 · Search results — `/search?q=…&type=…`

The workhorse. One screen serves both sides of the **Products | Suppliers** toggle, keyword
queries, category-filtered arrivals, and AI-search results (screen 3 lands here).

**Layout:** persistent search bar on top (query editable in place) → active-filter chip row →
result area (toolbar: result count, sort, toggle · card grid · pagination).
⚠️ **Superseded 2026-08-14 (was "two columns: filter sidebar left ~280px; drawer under
1024"):** follow the shipped `/category` pattern instead — a "Filters" button (active-count
badge) opening the sheet (phones) / right-side drawer (lg+) at every width, a flat typographic
toolbar (count · Filters · "Sort: {label} ⌄" pure dropdown, + the Products|Suppliers toggle
this screen adds), and the shipped `FilterSidebar` extended with this screen's extra groups
(§2). No persistent sidebar column.

**Controls**

| Control | Type | Notes |
|---|---|---|
| Search query | text input | whole-word matching — no autocomplete (§A26) |
| Products \| Suppliers | segmented toggle | re-runs the query; switching **resets product-only filters** (see below) |
| Sort | select | Relevance · Newest · Price ↑ · Price ↓ (suppliers mode: Relevance · Newest only) |
| Filter panel | §2 component | facets for the current query, live counts |
| Pagination | pager | page size capped at 100 server-side |

**Products mode — the full facet set** (§2). Two facet behaviours that need explicit design:

1. **Price is currency-scoped (§A27.1).** The price range group carries a **currency select
   (default INR)**. The filter means "priced 100–500 *in INR*" — products in other currencies are
   excluded from that filtered result, honestly, and the helper line under the slider must say
   so: *"Shows products priced in INR only."* There is **no currency conversion anywhere** — do
   not design a converted price, ever.
2. **"Include price-on-request" is a separate toggle**, not part of the range — on-request
   products have no number and a price range must not silently drop them. Default on when no
   range is set; when a range is active the toggle's label reads *"Also show price-on-request
   listings"*.

**Price sort is tiered, not filtered** — `Price ↑/↓` never changes the result *set*: products in
the selected currency sort by price, then other currencies by recency, then on-request by
recency. Design a quiet one-line note when a price sort is active with mixed currencies present:
*"Sorted by price in INR; other currencies and price-on-request shown after."*

**Suppliers mode — deliberately narrow** (§A27.3): only **Country** and **Verified sellers
only** facets; sorts are Relevance · Newest. Category, price, MOQ and attribute filters do not
exist for suppliers (an Organisation has no category of its own — cancelled §A22.5) — the panel
must collapse to its two groups, not show disabled ones. Switching to Suppliers with product
filters active **drops them visibly** (the chip row empties — animate it so it reads as
intentional).

**Result grid:** product cards or supplier cards (§2). Optional per-card **match tag**
("category match" — seen in `Search-demo.html`) when the hit came via a category name/synonym;
nice-to-have, not required.

**Matched-category hint** (Search.md §2.4): when the query resolved to a category via a synonym
("medicines"), show a hint above the grid — *"Showing results in **Pharmaceuticals & Medical**"*
with a link to that category page.

**States:** loading (skeleton grid + skeleton facet panel) · results · **zero results**
(§1.4 — did-you-mean chip, clear-filters, browse link) · **error** (retry + support code) ·
facet-panel loading independent of grid (facets are a second call — the grid must not wait for
the panel) · rate-limited (search has its own tighter limiter — a calm "You're searching very
fast — try again in a moment", never a raw 429).

**🔴 Copy constraints:**
- Never a "verified results only by default" — unverified sellers are always present; the
  verified toggle is opt-in and clearly a filter the *buyer* chose.
- Never explain ranking ("boosted", "sponsored" — neither exists as UI copy).
- The URL carries the whole state (query, type, filters, sort, page) so results are shareable —
  and this page is **noindex,follow** (§8): no SEO copywriting needed here.

**Design notes:** filter changes update results in place (the query updates the URL without a
full navigation). Keep the toolbar sticky so sort/toggle stay reachable mid-scroll. Under 1024
the Filters button badge shows the active-filter count.

---

### 3 · AI search — modal + results treatment

A **✨ AI Search** button (landing hero + search results toolbar) opens a **modal**
(`m3.md` §3.3, `Search-demo.html`).

**Modal contains**

| Element | Notes |
|---|---|
| Heading | "✨ AI Search" |
| Products \| Suppliers toggle | same segmented control as everywhere |
| Query textarea | natural language, 2–500 chars, character counter near the limit |
| Example prompts | 2–3 tappable chips that fill the box — e.g. "cheap cotton fabric in bulk" · "medicines with no prescription" · "industrial solvent under 100" |
| Actions | "Search with AI" primary (loading state — this call can take seconds; say so: "Thinking…") · Cancel |

**Result treatment** — lands on screen 2 with two additions above the grid:
1. **AI answer panel** — a short conversational summary ("Searched Textiles, prioritised low
   price, MOQ ≥ 500…"). One or two sentences, visually distinct (subtle tint), dismissible.
2. **Extracted-filter chip row** — the filters the AI derived (keyword · category · price ·
   MOQ · country · attributes), each chip removable; removing one re-runs a normal search.

**States:** modal default · loading ("Thinking…", inputs locked, cancellable) · results ·
**fallback** — 🔴 the AI step can fail (timeout, parse error); the server then returns **plain
keyword results with `fallback: true`. Render them as a normal search — no error state, no
apology banner** (pinned in `docs/UiWebNotes.md` API notes). At most a quiet line: *"Showing
keyword results."* · zero results (same §1.4 treatment, did-you-mean included) · rate-limited /
**daily limit reached** (AI has a per-organisation daily quota — copy: *"You've reached today's
AI search limit — regular search still works"*, with the search bar right there) · guest use is
allowed (no login wall on the modal).

**🔴 Copy constraints:** never expose the raw extracted JSON, the model name, or token/cost
language. Never imply AI results are a different engine — they are the same results, filtered.

**Design notes:** guests can use AI search — do not design a sign-in gate on the button. Keep
example prompts honest to what filters can express (category, price ceiling, MOQ, country,
attribute) — a prompt promising something the engine can't do writes a support ticket.

---

## 5. Browse surfaces (screens 4–5)

### 4 · Category browse — all categories — `/categories` ✅ SHIPPED

The visual directory: category cards → filtered listings (`m3.md` §8.5).

**As built (2026-08-11):** page heading · grid of **photo category cards** with hover zoom and
**sub-category chips** on each card · a **client-side quick-find filter** (matches category and
sub names locally — navigation aid, not server search) · 2-up on phones, server category order
preserved. Each card → screen 5. The goods/services section split from the original brief was
not built.

**States:** loading (skeleton grid) · loaded · error. (A true "no categories" state is
practically impossible — design it anyway as a one-liner.)

**Design notes:** only **active** categories arrive; product counts come from the server —
never compute or cache them client-side. All 40 top-category images are now real photos
(2026-08-11) and 252/261 sub-categories have images (2026-08-14); the no-image fallback tile
(neutral monogram) remains the standard for the rest.

✅ **Route resolved:** `/categories` is the live index URL (the "placeholder — confirm before
build" caveat is closed; §11 row updated).

---

### 5 · Category page — `/category/:slug` ✅ SHIPPED (flat route for BOTH levels)

The **indexable** category surfaces — heavily iterated with the owner 2026-08-11 → 2026-08-14.
The passage below is **as built**, superseding the original header/rail/sidebar layout:

- **Masthead** — the page's one brand moment: category name in stepped display type
  (2xl → 3xl → 4xl), one promise line ("Sourced directly from Indian exporters — every verified
  tick is checked by MPX"), **real-data chips only** (specialisation count / "Part of {top}" /
  listing count once loaded), and the category's own photo dissolving in from the right via a
  CSS mask (photo hidden below `sm` — text leads on phones). The earlier "N results | {name}"
  heading is gone; the count moved to the toolbar.
- **Left rail (lg+)** — **Specialisations only**: sticky card of photo rows (thumb · name ·
  marker; current row tinted + accent bar + check; "All {top}" row on sub pages), quiet
  small-caps label. **No filters live in the rail.**
- **Below lg** — a **specialisation selector card** (thumb · current name · "Change ⌄") opening
  a full-height **searchable sheet** (the admin category manager's phone pattern; search matches
  **names only** — synonyms are search-only and never public).
- **Flat typographic toolbar** — "{N} products · | Filters (badge)" left, "Sort: {label} ⌄"
  (pure `SortMenu` dropdown) right, over one hairline. No boxed bar.
- **Filters** — the "Filters" button opens the facet surface at **every** width: full-screen
  sheet on phones, right-side drawer at lg+ (see §2's shipped `FilterSidebar` subset).
- **Products** — compact 2-up `ProductCard` grid below `md`; horizontal `ProductListCard` stack
  from `md+` (scaling image column). Off-white canvas (`bg-surface-subtle/50`); **full-bleed
  page width (standing owner preference — never cap it)**.
- **Both levels use the same flat route and layout**; a sub page adds the parent to the
  breadcrumb and the "All {top}" rail row. Attribute facets at top level show the
  **intersection** of its leaves' filterable attributes (server behaviour — a short panel there
  is correct, not broken).

**States (all shipped):** loading (skeletons matched per-breakpoint card shape) · results ·
**empty category** ("No products in this category yet" + browse link) · **filtered-to-zero**
(distinct state: "No products match these filters" + Clear filters) · error (request-id +
retry) · **404** — an inactive/unknown category renders the standard not-found page (genuinely
404s, never a soft shell).

**SEO (per §8):** clean URL indexable; **any filter/sort/page param → noindex + canonical to the
clean category URL** (✅ shipped: canonical always points at the clean base, `noindex,follow`
added whenever a filter or non-default sort is active). Title: **owner ruled 2026-08-14 — keep
the shipped `"{Category} — MPX Global"` for now; the brief's keyword-first
`"{Category} Suppliers & Products | MPX Global"` template is PENDING**, to be revisited when
the SEO pass lands (don't change it piecemeal before then). JSON-LD `BreadcrumbList` +
`ItemList` not yet emitted.

**🔴 Copy constraint:** filtering inside a category never changes the visible URL identity in a
way that reads as a new page — the canonical stays the clean category page; do not design
"filter landing pages" with their own headings (that is the crawl-budget trap §4 of the SEO
rules exists to prevent).

---

## 6. Detail pages (screens 6–7)

### 6 · Product detail — `/product/:slug` ✅ SHIPPED

The conversion surface. Everything shown is from the **public product projection** — the field
list below is the complete license (`m3.md` §5c.1); nothing else exists to show.

**As built (2026-08-11 → 2026-08-14):**
- **Gallery** — images with thumbnails + a working **fullscreen lightbox** (pure client-side
  zoom); "+N" overflow tile past four thumbs; first image is the OG image; alt from product
  name; sticky/self-start on desktop so a single photo doesn't strand dead space.
- **Buy panel** (right) — category eyebrow · product name (`h1`) · "Listed {date}" · headline
  **spec chips** · **tinted price block** (§1.3 price + MOQ/supply-ability row) · **supplier
  card** (logo/monogram · name + tick · member-since · country · entity type → screen 7) ·
  **trade-facts card** (icon per row; goods set OR service set per the product's type — the
  other never renders) · disabled "Send Enquiry".
- **Description | Specifications side by side at lg+** (owner, 2026-08-14 — reverses the
  2026-08-12 full-width stacking; a lone panel still spans full width; stacked below lg).
  `SpecTable` renders single-column rows in the half-width panel (`columns={1}`); description
  text at `max-w-4xl` (a 65ch measure marooned in the full-bleed card was superseded the same
  day). Long prose folds behind "Read more"; always plain text.
- **"More in {category}"** — 2-up/4-up row of the **shared `ProductCard`** (chips · price ·
  MOQ · seller row with tick). ⚠️ The page-scoped `RelatedProductCard` fork (owner call,
  2026-08-12) was **deleted 2026-08-14** — the owner's "fix below cards" superseded it; the row
  now matches `/category` exactly. Falls back to the parent category (relabelled honestly) when
  the leaf has too few products.

**Actions:** "Send Enquiry" ✅ shipped as a **visibly disabled placeholder** (the M4 entry
point, logged in `docs/UiWebNotes.md`). Heart: the page originally shipped WITHOUT one (F1,
caught 2026-08-14) — a **disabled heart placeholder was added the same day** at owner request
(gallery top-right, same treatment as `ProductListCard`'s, logged). Screen 8 wires both hearts
for real, with the owner's non-buyer gate modal (`web-build-plan.md` Phase 5). Never
live-looking no-ops.

**States:** loading (skeleton: gallery block + text lines) · loaded · **404 / gone** — a draft,
archived, taken-down or dead-category product genuinely 404s (standard not-found page with a
search bar and category links; a friendly dead-end that offers a way forward) · error ·
**"currently unavailable" variant** — reached from a saved-list link when the product is
temporarily hidden: show the §1.2 badge and suppress save/enquiry actions; never the reason.

**🔴 Copy constraints:**
- Never render or hint at: status, takedown, seller's raw org id, moderation anything.
- Never show seller contact (phone/email/website) — contact happens via enquiry (M4), by
  explicit product decision. Do not design a "contact seller" mailto/tel affordance.
- No stock/urgency invention ("only 3 left") — no such data exists.

**SEO (per §8):** indexable; title `"{Product} — {Seller} | MPX Global"`; JSON-LD `Product`
schema with offers (price/currency/availability) and seller organisation; canonical to the clean
product URL.

---

### 7 · Seller public profile — `/supplier/:slug` ✅ SHIPPED

The seller's public page — public **from signup**, tick or no tick.

**As built (2026-08-11 → 2026-08-13):** brand **gradient cover band** with the ring-4
overlapping logo, name + tick, **stat chips** (including the product-count chip with a box
icon — deliberately not a badge shape on possibly-unverified pages), a products toolbar
matching `/category`, and a 2/3/4-up grid of the shared `ProductCard`. The projection gained
**`coverImage`** (2026-08-13, supplier-banner asset, same public-asset reasoning as `logo` —
⚠️ **no upload endpoint exists yet**, so it renders only when seeded). The page DOES carry a
**disabled "Start Conversation" button** (2026-08-13, owner-requested, `docs/UiWebNotes.md` —
an earlier revision of this brief wrongly said none shipped; corrected 2026-08-14 against the
code). **Owner ruling 2026-08-14: it stays visible and disabled through M4 wiring** — how a
company-level conversation reconciles with M4's product-scoped threads is deferred (m4 brief
gap 7). No save heart shipped here; the copy constraints held (no contact details of any kind).

The whitelist below is the **complete** public surface (`m3.md` §5b.1 / projection rule); the
design must be built to look good with exactly this and nothing more:

| Field | Display |
|---|---|
| Company name | `h1`, with **verified tick** beside it when `verified` (+ "since {year}" from `verifiedAt`) |
| Logo | avatar-style; designed fallback (initial on tinted ground) — most sellers won't have one early |
| Description | "About" block; plain text |
| Entity type | "Registered business" / "Individual seller" — a quiet chip next to the tick |
| General location | country (+ city if present) — **never a street address** |
| Established year | "Established 2011" |
| Member since | "On MPX since 2024" — **year only** |
| Product count | "{n} live listings" |
| Public catalogue | the seller's **active** products as product cards, paginated |

**Actions:** **Save supplier** (buyer heart) · "Send enquiry" entry point (M4 — same
coming-soon + ledger treatment as screen 6).

**States:** loading · loaded · **empty catalogue** ("No live listings yet" — normal for new
sellers, calm not apologetic) · **sparse profile** (no logo, no description — just name +
country; this is the *default* for every seller until they fill §A22's company profile screen —
design it deliberately so a sparse page still looks composed, not broken) · 404 (unknown slug,
buyer-only org, or blocked org — all plain 404, indistinguishable) · error.

**🔴 Copy constraints:**
- **No verification status other than the tick.** Never "pending", "in review", "rejected",
  "unverified" — absence of the tick is the entire story (§1.1).
- **Never** phone, email, **website** (explicitly internal — it was once leaked and removed; do
  not design a website row "because profiles usually have one"), street address, KYC anything.
- Business type / "main categories they deal in" were **cancelled 2026-07-30** — do not design
  rows for them; `entityType` carries that signal. Their absence is a decision, not a gap.

**SEO (per §8):** indexable; title `"{Company} — Supplier | MPX Global"` (the old template's
"{mainCategory}" is unavailable — categories-per-seller was cancelled; flag in §11); JSON-LD
`Organization` (name, logo, url, address at  **city level only**).

---

## 7. Saved items (screen 8)

### 8 · Saved items — `/saved` — buyer only

The buyer's saved products and suppliers (`m3.md` §8.6, `Saved-items-ui.png`).

**Access:** signed-in **buyer accounts only**. A guest hitting `/saved` gets the sign-in flow
then returns here. An exporter/staff account never sees the nav entry (server 403s anyway).

**Structure:** page heading + count · **Products | Suppliers tabs** · card grid per tab ·
pagination.

**Card treatment:**
- Available items: the standard §2 cards, hearts filled; unsave = tap the heart (optimistic,
  toast "Removed from saved", with an "Undo" affordance in the toast if cheap — otherwise
  omit; do not design a confirmation modal for unsave).
- **Unavailable items stay listed**: greyed card + "Currently unavailable" badge (§1.2). Tap
  still navigates (product page shows the unavailable variant). They are **not** removed and
  the UI never removes them — only the backend does, when an item is *permanently* gone, in
  which case it simply never arrives.

**Navigation into this screen** (from `Saved-items-ui.png`): a header/menu **"Saved"** link in
the buyer shell · optionally a saved widget/count on the buyer dashboard. The saved-count badge
is nice-to-have; if shown it must come from the server total, not a client counter.

**Guest save prompt** (belongs to SaveButton but drawn with this screen): a guest tapping any
heart gets a small dialog/popover — *"Sign in as a buyer to save products and suppliers"* +
Sign in / Create buyer account actions + cancel. It returns them to where they were, with the
save applied, after auth. Never a full-page redirect that loses the results.

**States:** loading (skeleton grid) · list · **empty per tab** ("Nothing saved yet — tap the ♡
on any product to keep it here", with a "Start browsing" CTA — genuinely inviting; every buyer
starts here) · unavailable mix (drawn explicitly: available + greyed cards in one grid) · error
· unsave in-flight/failed (heart reverts + toast).

**🔴 Copy constraints:**
- Duplicate saves cannot happen (server blocks; the heart is a toggle) — never design a
  "already saved" error.
- Never explain *why* something is unavailable, and never show a "removed by admin" or
  "seller deleted this" message — items permanently gone just don't appear.

---

## 8. SEO requirements — design/content rules for the public pages

The web brief owns these because titles, headings, alt text and URL behaviour are content
design. Source: `m3-seo-rules.md` + `.claude/rules/m3-seo.md`. The backend already serves
`sitemap.xml` + `robots.txt`; the pages must hold up their end.

**Indexability map**

| Page | Indexable? | Canonical | Notes |
|---|---|---|---|
| Landing `/` | ✅ | self | |
| Product `/product/:slug` | ✅ | self (clean) | 404/410 when not active |
| Seller `/supplier/:slug` | ✅ | self | |
| Category `/category/:slug` (⚠️ flat for both levels as built — no nested leaf URL) | ✅ | self (clean) | |
| Category with any filter/sort/page params | ❌ `noindex,follow` (✅ shipped) | the clean category URL (✅ shipped) | the crawl-budget rule |
| Search `/search?…` | ❌ `noindex,follow` | — | robots also disallows `/search` |
| Saved `/saved` | ❌ (auth-gated) | — | |
| Categories index `/categories` | ✅ (route live) | self | |

**Every indexable page emits:** a keyword-first `<title>` (templates in screens 5–7); a
150–160-char meta description from the entity's description with a templated fallback; exactly
one `h1` = the entity name; canonical link; OG + Twitter tags (`og:image` = product image /
seller logo / category image); charset, language, viewport meta.

**JSON-LD:** Product → `Product` (+offers, seller org) · Seller → `Organization` (city-level
address only) · Category → `BreadcrumbList` + `ItemList`. JSON-LD mirrors **visible, public**
content only — never private fields, never data the page doesn't show.

**Slugs & URLs:** slugs are server-generated and **immutable** — the UI never edits, invents or
"cleans" a URL; never a raw ObjectId in a visible path. All internal links between screens 1–8
use slugs.

**Performance is an SEO deliverable:** lazy-load below-the-fold images, fixed dimensions
(CLS), right-sized Cloudinary variants, route-level code-splitting for the discovery pages.

**Honest limitation to record, not solve:** this is a client-rendered SPA — SSR/prerender is
explicitly deferred (SEO rules §8). Emit everything client-side anyway so the later migration
changes no URLs and no content.

---

## 9. Cross-screen checklist before handing designs over

- [ ] Every screen has loading, empty, error, success — and **zero-results** where results exist
- [ ] Verified tick only ever a tick — no "unverified"/"pending"/"rejected" surface anywhere public
- [ ] Tick rendered from `verified` (+`verifiedAt`) — no design annotation references `kycStatus`
- [ ] Every field on screens 6–7 appears in the public whitelist — nothing added "because profiles usually have it"
- [ ] No contact details (phone/email/**website**), street address, status or moderation data on any public surface, page, meta or JSON-LD
- [ ] Price component covers fixed / range / **on request** everywhere a price shows
- [ ] Price filter carries its currency; on-request has its own toggle; price sort note drawn
- [ ] Suppliers mode collapses to country + verified facets and relevance/newest sorts
- [ ] Zero-results state includes the did-you-mean chip and clear-filters
- [ ] AI fallback renders as normal results — no error treatment
- [ ] Enquiry buttons (6, 7) are visibly "coming soon" until M4 + logged in `docs/UiWebNotes.md`
- [ ] Saved list draws the greyed "Currently unavailable" card in-grid; no reason ever shown
- [ ] Guest save prompt returns the user to context; no login wall on any browse/search surface
- [ ] Save control hidden for signed-in non-buyer accounts
- [ ] Search/filtered URLs noindex + canonical per §8; product/seller/category pages emit full head + JSON-LD
- [ ] 404 states genuinely 404 (product/seller/category) — no soft empty shells
- [ ] Sparse seller profile (no logo/description) and zero-listing supplier card both drawn — they are the launch-day default
- [ ] Card grids checked at 1440 / 1024 / 768 / 375; filter drawer under 1024
- [ ] Focus states, labels, 44px targets, alt text on all cards and controls

---

## 10. Decisions

### ✅ Working assumptions (flag to change)

1. **Pagination over infinite scroll** on web (`m3.md` §3.4 allows either). Pagination is the
   assumption here because it is shareable, SEO-sane and matches the admin-table convention;
   infinite scroll remains the app's pattern. Say the word to flip it.
2. **AI search opens as a modal** (per the plan docs and demo), returning into the standard
   results screen — not a separate "AI results" page.
3. ~~**`/categories`** as the category-index route — the SEO doc doesn't name one (§11).~~
   ✅ Resolved — `/categories` shipped as the live index route.

### Still open

1. **Brand palette** — unchanged from M1: confirm before final visual design.
2. **Match tags on result cards** ("category match") — demo-only nicety; in or out?
3. **Saved-count badge in the buyer header** — `Saved-items-ui.png` names it; cheap but adds a
   live counter to the shell. In or out?
4. **Synonyms content is owner-pending** (backend checkpoint #1) — until the top-40 synonym list
   is entered, "medicines → Pharmaceuticals" style demos won't work with real data. Design demos
   should use category names that match literally, or the review will look broken when it isn't.
5. **OpenAI key is owner-pending** — until it lands, AI search always takes the fallback path.
   Fine for design review (fallback renders as normal results by design), but stakeholders
   should be told before a demo.

---

## 11. Scope: boundaries respected, and the gaps

Kept strictly to screens named in the M3 folder. What that leaves:

| Gap | Detail | Consequence / recommendation |
|---|---|---|
| ~~**Category-index route unnamed**~~ | ✅ **Resolved as built:** `/categories` is live and indexable. Note also that leaf pages shipped on the **flat** `/category/:slug` (slugs globally unique) — the SEO doc's nested `/category/:parentSlug/:childSlug` form was never implemented; if nesting is ever wanted it is a URL migration (301s), not a tweak. | None — recorded. |
| ~~**Seller SEO title template references cancelled data**~~ | `m3-seo-rules.md` §2 example: `"{companyName} — {mainCategory} Supplier"`, but main/working categories were **cancelled** (§A22.5). | ✅ **FIXED 2026-08-14** — `/supplier/:slug` now emits `"{companyName} — Supplier \| MPX Global"` (verified in-browser). The SEO doc predates the cancellation. |
| ~~**`web-design.md` stale tick line**~~ | ✅ **FIXED 2026-08-10** — the rule now reads the derived `verified` boolean (self-scoped own-status exception spelled out). | None — brief and rule agree. |
| **Enquiry entry points dead until M4** | Screen 6 shipped "Send Enquiry" as a visibly disabled placeholder, logged in `docs/UiWebNotes.md` ✅ (no heart there — corrected 2026-08-14, F1). Screen 7 **also shipped a disabled "Start Conversation"** (2026-08-13 — corrected 2026-08-14; an earlier revision wrongly said none). Owner rulings 2026-08-14: screen 6's "Send Enquiry" is the ONE door M4 wires; the category-card "Inquiry" is deactivated at wiring; screen 7's button stays disabled pending the company-level-vs-product-scoped decision (m4 gap 7). | Keep all disabled-until-real; wire only screen 6's. |
| **Buyer shell nav** | The buyer sidebar's "Search suppliers" ledger row unlocks with these screens; a "Saved" entry must be added to the buyer shell (named in `Saved-items-ui.png`), which is a small M1-shell change owned by this milestone. | Add "Search" + "Saved" to buyer nav when wiring; flip the ledger rows. |
| **Exporter-facing discovery** | Exporters may search (public pages) but never save. No exporter-shell nav entry for search is named anywhere. | Public pages are reachable by URL regardless; add no exporter nav entry without an owner nod. |
| **SSR/prerender deferred** | Client-rendered SPA indexes imperfectly; accepted and recorded (SEO rules §8). | Not a design problem; emit correct head/meta client-side per §8. |
