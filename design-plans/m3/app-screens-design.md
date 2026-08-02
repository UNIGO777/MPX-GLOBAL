# M3 · Mobile App Screens — Design Brief

> **8 screens** for the M3 (Discovery & Search) milestone, **mobile app only** (React Native /
> Expo, iOS + Android).
> This is a **design** document: what each screen contains, every control on it, and the states
> that need artwork. No API or code detail.
> Companion: `my-plans/m3/web-screens-design.md` — the two surfaces must feel like one product,
> and both render **exactly the same public data** (same projection on web and app, by rule).
>
> **Scope rule:** only screens named in `modules-in-detailed/m3-search-filter-3-4days-max/` —
> `m3.md` §8 (+ its "App specifics" line), `Search.md` §9, `Saved-item.md`, the folder images
> (`m3allscreens.png`, `Search-screens.png`, `Saved-items-ui.png`, `Search-flow-chart.png`,
> `Rules.png`), and `Search-demo.html`. Nothing inferred, nothing added. Gaps in §10–§11.
>
> **The backend is SHIPPED** (`build-plans/m3/backend-plan.md`, ✅ 2026-07-31) — the field lists
> here are contractual, pinned by `.claude/rules/m3-public-projection.md`. A designer adding a
> field the projection doesn't return is drawing a screen that cannot be built.

---

## 1. Before anything else — what M3 is in the app

**Discovery is the buyer's reason to open the app.** M1 gave the app auth and profile; M3 gives
it something to *do*: search, browse, product pages, seller pages, saving. The buyer's dead
"Search ⏳" tab from the M1 brief comes alive here.

**The app has two roles only: Buyer and Exporter.** No staff surface, ever. M3 adds nothing
staff-shaped — *"admin has no search screens"* (`m3.md` §8).

- **Buyer** — the full experience: search, browse, detail pages, **save + saved list**.
- **Exporter** — may search and view every public page (search is public, never a permission),
  but **cannot save** (§A13 — saving is buyer-account-only; an exporter who wants to buy uses a
  separate buyer account, §A21). The save affordance is simply **absent** on an exporter
  session — never a disabled heart, never an upsell dialog.

**Guests:** the plan says search is open to guests on web *and* app — but the shipped M1 app
shell has **no guest path** (welcome → portal → login; nothing browsable signed-out). Whether
the app gains a "browse as guest" entry is a **navigation-shell decision the owner hasn't
made** — flagged in §10, not designed here. Every screen in this brief works signed-in; nothing
in it *requires* auth except saving, so a guest mode later is additive, not a redesign.

**The app is not a smaller web app.** Same tokens, native patterns: full-screen filter modal
instead of a sidebar (named in `m3.md` §8 App specifics), bottom sheets, infinite scroll with
pull-to-refresh, lazy-loaded facets, optional swipe-to-unsave. No SEO surface exists in the app
— slugs, canonical, JSON-LD are web-brief concerns; the app just navigates by id/slug
internally.

### 1.1 Design foundations

**Match the web tokens** — same palette (starter `primary` indigo `#4f46e5`, brand still
unconfirmed), same status colours, same type ramp at mobile sizes. A buyer moving between web
search and app search should see the same product, tick and price treatment.

**Platform conventions.** iOS back-swipe + large titles; Android hardware back + ripple. The
search stack must handle deep back-chains gracefully (results → product → seller → product…)
— native back always works, and the tab bar stays reachable.

**Safe areas + keyboard.** Search input focused = keyboard up; the results list and the search
bar must not jump. Filter modal's Apply button pinned above the keyboard when a numeric field
(price, MOQ) is focused. Numeric keypad for price/MOQ inputs.

**Touch targets ≥ 44px** — hearts on cards are the risk item; give them a generous hit slop.

**Offline is a state you must draw.** Every data screen: offline message + retry, never an
endless spinner. Search results already fetched stay visible; a failed next-page append shows
an inline retry row, not a full-screen error.

**Images:** Cloudinary-sized variants, fixed aspect boxes (no jumping grids), designed
no-image fallbacks (product placeholder tile; seller initial-on-tint) — sparse data is the
launch-day norm.

### 1.2 The verified tick — same rule as web, restated

**One badge: the verified tick, shown when `verified` is true.** No "not verified" badge, no
red cross, no warning chip. Absence of the tick is the only signal. The public payload never
contains raw `kycStatus` or any rejected state — there is nothing else to render. Verification
never filters results; the only verification control a buyer sees is the **opt-in "Verified
sellers only" filter toggle**.

### 1.3 Availability vocabulary — same two words as web

| State | Label | Behaviour |
|---|---|---|
| Available | *(none)* | normal |
| Currently unavailable | "Currently unavailable" — muted badge, greyed card | stays in the saved list; detail page shows the badge and hides actions |
| Permanently gone | *(never labelled)* | removed server-side — the app never shows a tombstone or a "deleted" message |

🔴 Never say *why* something is unavailable — takedown reasons and seller status are internal.

### 1.4 Price — one component, three modes

Fixed (`₹ 450 / metre`) · Range (`₹ 450 – 620 / metre`) · **"Price on request"** (quiet text,
legitimate mode, not an error). Used on cards, detail, and the saved list.

### 1.5 Zero results is a designed state

Native text search matches whole words — no typo tolerance, no autocomplete (§A26). The
compensation is the server's **"did you mean"** suggestion on zero-result queries. The empty
state gets: headline with the query · did-you-mean chip (tap re-runs) · clear-filters action
when filters are active · a "Browse categories" escape. Never a bare "0 results".

---

## 2. Shared components to design once

**The three cards** (`m3.md` §6 — contents fixed, do not add fields):

| Card | Shows | Tap → |
|---|---|---|
| **Product card** | image, name, price (§1.4), MOQ + unit (goods), seller name + tick, save heart | Product detail |
| **Supplier card** | logo, company name, tick, country, product count, save heart | Seller profile |
| **Category card** | name, image, product count | that category's results |

Product cards render 2-up in a grid or single-column list — pick one per screen and keep it;
supplier cards are full-width rows. A supplier card with `productCount: 0` is normal — copy
"No live listings yet"; such sellers do appear (B7).

**SaveButton (heart)** — on both cards + both detail screens. States: unsaved · saved ·
in-flight (optimistic — flips instantly, reverts with a toast on failure) · **absent** for
exporter sessions (§1). Toast/snackbar: "Saved" / "Removed from saved". Duplicate saves can't
happen (it's a toggle) — never design an "already saved" error.

**Verified tick badge** (§1.2) · **Unavailable badge** (§1.3) · **Price** (§1.4).

**Search header** — search input + **Products | Suppliers** segmented toggle + **✨ AI** button
+ filter button with an **active-filter count badge**. Sits atop screens 1–2.

**Filter modal** (screen 3) · **Sort sheet** — bottom sheet: Relevance (default with a query) ·
Newest · Price low→high · Price high→low (suppliers mode: Relevance · Newest only).

**Active-filter chip row** — horizontal scroll of applied filters, per-chip remove, "Clear all".

**Did-you-mean chip** (§1.5) · **AI answer panel + extracted-filter chips** (screen 4).

**Infinite-scroll list machinery** — footer loader, inline "couldn't load more — retry" row,
"end of results" terminator, pull-to-refresh. Designed once, used on every result surface.

---

## 3. Screen inventory — 8

| # | Screen | Role | Group | Named in |
|---|---|---|---|---|
| 1 | Search home (Search tab) | buyer (· exporter §10) | search stack | `Search-flow-chart.png` "search entry (web + app)" |
| 2 | Search results | all | search stack | `m3.md` §8.1 |
| 3 | Filters — full-screen modal | all | search stack | `m3.md` §8 App specifics: "filters open as a full-screen modal" |
| 4 | AI search modal | all | search stack | `m3.md` §8.2 |
| 5 | Category browse | all | search stack | `m3.md` §8.5 |
| 6 | Product detail | all | pushed | `m3.md` §8.3 |
| 7 | Seller profile | all | pushed | `m3.md` §8.4 |
| 8 | Saved items | **buyer only** | saved stack | `m3.md` §8.6 · `Saved-items-ui.png` |

A category tap does **not** get its own page in the app — it opens screen 2 pre-filtered to
that category ("category cards → filtered listing", `m3allscreens.png`). The web's SEO-shaped
category pages have no app equivalent, deliberately.

**Never design, in any milestone:** payment release / payout / escrow screens (web-only by
contract) · staff surfaces.

**Not in M3 (the boundary — `m3.md` §11, backend plan §4):** semantic/AI-embedding search,
recommendations, "similar products", recently-viewed, **search history** (do not design a
"recent searches" list — it is named Phase 2) · enquiry/chat screens (M4 — screens 6–7 carry an
entry-point button only) · quotation (deferred) · autocomplete/search-as-you-type (lost with
Atlas, out of scope).

---

## 4. Search stack (screens 1–5)

### 1 · Search home — the Search tab's resting state

What the tab shows before any query. M1 shipped this tab as a "coming soon" placeholder;
M3 replaces it.

**Contains:** search header (§2 — input, toggle, ✨ AI, filter button) · **category grid**
(top-category cards → screen 2 pre-filtered) · optionally a featured strip fed by the same
curated landing content as the web (banners/featured cards — same three card components; a
featured card is never richer than a search-result card).

**States:** default (categories loaded) · loading (skeleton category grid) · offline ·
error (retry).

**Design notes:** no recent-searches list (Phase 2 — §3). Tapping the input focuses it in
place; submitting pushes screen 2. The AI button must be visible without scrolling — it is a
headline feature, not a buried extra.

**🔴 Copy constraint:** nothing here implies login is needed to search — search is open;
only saving prompts for a buyer account.

---

### 2 · Search results

One screen for both toggle modes, keyword queries, and category-filtered arrivals; AI results
(screen 4) also land here.

**Contains:** search header (query editable in place) · active-filter chip row · toolbar:
result count ("214 results") + sort button (opens the sort sheet) · **result list** — product
cards or supplier cards, infinite scroll with pull-to-refresh.

**Products mode filters** live in screen 3. Two behaviours restated because the UI copy owns
them:
- **Price filter is currency-scoped** — the filter means "priced 100–500 *in INR*"; products in
  other currencies are excluded from that filtered result. No conversion anywhere, ever.
- **Price sort is tiered, never a filter** — selected-currency products by price, then other
  currencies, then price-on-request. When a price sort is active, a quiet note under the
  toolbar: *"Sorted by price in INR; other currencies and price-on-request after."*

**Suppliers mode is deliberately narrow:** only Country + Verified-only filters; Relevance ·
Newest sorts. Switching the toggle with product filters active **drops them visibly** — the
chip row clears with a subtle animation so it reads as intentional, not a bug.

**Matched-category hint** (Search.md §2.4): when the query resolved via a category synonym,
a hint chip above the list — *"Showing results in **Pharmaceuticals & Medical**"*.

**States:** loading (skeleton cards) · results · appending (footer loader) · append-failed
(inline retry row) · end of results · **zero results** (§1.5) · offline (kept results + banner;
retry) · error · rate-limited (calm "You're searching very fast — try again in a moment").

**🔴 Copy constraints:** never "verified only" by default; never ranking language ("boosted",
"sponsored"); unavailable/moderation states never appear in results (excluded server-side —
if a card arrived, it's live).

---

### 3 · Filters — full-screen modal

The app-specific pattern, named in the plan: filters open as a **full-screen modal** over the
results, with lazy-loaded facet data.

**Structure:** header ("Filters", close ×, "Clear all") · scrollable facet groups ·
footer bar pinned: **"Show 214 results"** (live count — updates as selections change) +
Clear all.

**Facet groups**

| Group | Control | Notes |
|---|---|---|
| Category | drill-down list: tops → leaves | selecting a top reveals its leaves; count per row |
| Country | searchable checkbox list | seller's country; counts |
| Price range | min/max inputs + **currency select (default INR)** | numeric keypad; helper: *"Shows products priced in INR only"* |
| Include price-on-request | switch | separate from the range — on-request items have no number |
| MOQ | min input | **goods only** |
| Goods / Services | segmented | |
| Verified sellers only | switch | opt-in; off by default |
| *Dynamic attribute groups* | per attribute: checkbox list (select/boolean) or min–max slider with server bounds (number) | appear only when a category is active; counts per option |

- Counts per option are server-computed ignoring that group's own selection — the UI renders
  the numbers it is given, never computes its own.
- Goods-only groups **disappear** for a service category (the panel adapts — no disabled
  groups).
- Suppliers mode: the modal collapses to **Country + Verified only**.

**States:** loading (skeleton groups — facets lazy-load after the modal opens) · loaded ·
count updating (footer button shows a mini-loader, stays tappable) · zero-count preview
("Show 0 results" is legal — the footer keeps working; the results screen then shows §1.5) ·
offline · error.

**Design notes:** selections apply on "Show results", not per-tap (each count refresh is a
server call — batching keeps the modal responsive). "Clear all" resets but doesn't close.
State survives closing and reopening the modal.

---

### 4 · AI search modal

Opened from the ✨ button on screens 1–2. (`m3.md` §3.3; example prompts from
`Search-demo.html`.)

**Contains**

| Element | Notes |
|---|---|
| Heading | "✨ AI Search" |
| Products \| Suppliers toggle | same segmented control |
| Query box | multiline, natural language, 2–500 chars |
| Example prompts | tappable chips that fill the box — "cheap cotton fabric in bulk" · "medicines with no prescription" · "industrial solvent under 100" |
| Submit | "Search with AI" — loading state "Thinking…" (this call takes seconds; keep it cancellable) |

**Result treatment** — lands on screen 2 with, above the list: the **AI answer panel** (one–two
conversational sentences, dismissible) and the **extracted-filter chip row** (keyword ·
category · price · MOQ · country · attributes; chips removable — removing one re-runs a normal
search).

**States:** default · thinking (cancellable) · results · **fallback** — 🔴 if the AI step
fails/times out, the server returns **plain keyword results flagged as fallback. Render them as
a normal search — no error state.** At most a quiet "Showing keyword results." line ·
zero results (§1.5, did-you-mean included) · **daily limit reached** (per-organisation AI
quota — *"You've reached today's AI search limit — regular search still works"*) · offline ·
rate-limited.

**🔴 Copy constraints:** never show raw extracted JSON, model names, or cost/token language;
never present AI results as a different result type — they are the same cards, same engine.

---

### 5 · Category browse

The visual directory in the search stack (a tab-bar destination or a "Browse categories" entry
from screen 1 — nav decision in §8).

**Contains:** heading · grid of **top-category cards** (name, image, product count) · tap →
screen 2 filtered to that category (its leaves then appear as filter options / a chip rail on
results). Optional goods/services section split.

**States:** loading (skeleton grid) · loaded · offline · error. Design the no-image category
tile (initial on tint) — admin images may be missing early.

---

## 5. Detail screens (6–7)

### 6 · Product detail

Pushed from any product card. Everything below is the complete public field license
(`m3.md` §5c.1) — nothing else exists to show.

**Contains:**
- **Gallery** — swipeable images, page dots, tap to zoom; fixed aspect box.
- **Header** — product name · price (§1.4) · MOQ + unit (goods) · category line (top › leaf).
- **Actions row** — save heart (buyer) · **"Send enquiry"** primary (M4 entry point — see
  below).
- **Seller strip** — logo, company name + tick, country → pushes screen 7. Never contact
  details.
- **Specs** — attribute key/value/unit rows, collapsible if long.
- **Trade info** (goods: HS code, origin country, supply ability, lead time, packaging) **or**
  **service info** (engagement type, delivery model, team size, timeline) — whichever matches
  the product's type; the other never renders.
- **Description** — plain text, "read more" fold.
- **Listed since** — the only date shown.

**"Send enquiry" → M4.** Design the button now (it is this page's primary action); until M4's
screens exist it ships visibly "coming soon"/disabled and is logged in the project's
non-operational-UI ledger — never a live-looking dead button.

**States:** loading (skeleton) · loaded · **not found / gone** (archived, taken-down,
dead-category → a friendly full-screen "This listing is no longer available" with a back/browse
action — the app's version of the web 404; **no reason ever**) · **currently-unavailable
variant** (reached from a saved link: §1.3 badge, save + enquiry hidden) · offline · error.

**🔴 Copy constraints:** never status/takedown/moderation/owner-id anything; never seller
contact (phone/email/website — contact is via enquiry only, deliberate anti-scraping decision);
no invented urgency or stock.

---

### 7 · Seller profile

Pushed from a supplier card or a product's seller strip. Public from signup — tick or nothing.
The complete public surface (`m3.md` §5b.1):

| Field | Display |
|---|---|
| Company name | title, with **verified tick** (+ "since {year}") when verified |
| Logo | avatar; designed initial fallback |
| Description | "About" block, plain text |
| Entity type | "Registered business" / "Individual seller" chip beside the tick |
| General location | country (+ city) — never a street address |
| Established year | "Established 2011" |
| Member since | "On MPX since 2024" — year only |
| Product count | "{n} live listings" |
| Catalogue | the seller's **active** products as product cards, infinite scroll |

**Actions:** **Save supplier** heart (buyer) · "Send enquiry" entry point (same M4
coming-soon + ledger treatment as screen 6).

**States:** loading · loaded · **empty catalogue** ("No live listings yet" — calm, normal for
new sellers) · **sparse profile** (no logo, no description — the default until sellers fill the
§A22 company-profile screen; design it to look composed, not broken) · not found (unknown /
blocked / buyer-only org — one indistinguishable "not available" state) · offline · error.

**🔴 Copy constraints:** no verification state other than the tick — never "pending",
"in review", "rejected", "unverified". Never phone, email, **website** (internal-only — it was
once leaked from this very surface and removed), street address, or KYC anything. No "business
type" / "main categories" rows — cancelled 2026-07-30; `entityType` carries that signal.

---

## 6. Saved items (screen 8)

### 8 · Saved items — buyer only

The buyer's saved products and suppliers (`Saved-items-ui.png`).

**Access:** buyer sessions only. Exporter sessions have no entry point to this screen and no
hearts anywhere to fill it (§1).

**Structure:** title + count · **Products | Suppliers tabs** · card list per tab · infinite
scroll · pull-to-refresh.

**Card treatment:**
- Available: standard cards, hearts filled. **Unsave** = tap the heart (optimistic, snackbar
  "Removed from saved") — plus **swipe-to-unsave** as the optional app nicety the plan names
  (swipe reveals a remove action; never destructive without the reveal step). No confirmation
  dialog for unsave.
- **Unavailable items stay listed**: greyed card + "Currently unavailable" badge. Tap still
  opens the detail screen in its unavailable variant. The app never removes them — permanently
  gone items simply never arrive from the server.

**Entry points** (from `Saved-items-ui.png`): a **"Saved" item in the buyer's navigation**
(tab or Profile-screen row — §8) · hearts everywhere navigate context, not to this screen.
Optional saved-count badge — must come from the server total if shown.

**States:** loading (skeleton list) · list · **empty per tab** ("Nothing saved yet — tap the ♡
on any product to keep it here" + "Start browsing" CTA — the first-run state for every buyer,
make it inviting) · mixed available/unavailable (drawn explicitly) · unsave failed (heart
reverts + snackbar) · offline (cached list visible + banner) · error.

**🔴 Copy constraints:** never explain why an item is unavailable; never show a "removed" or
"seller deleted" tombstone; never an "already saved" error (the heart is a toggle).

---

## 7. What saving looks like to a non-buyer

Stated once so no screen invents its own behaviour:

- **Guest (if/when a guest mode exists — §10):** tapping a heart opens a bottom sheet —
  *"Sign in as a buyer to save products and suppliers"* + Sign in / Create buyer account /
  cancel. After auth, return to the same place with the save applied. Never a full-screen
  redirect that loses the results.
- **Exporter session:** hearts are **absent**, not disabled — the server would 403, so the
  control must not exist. No upsell copy about creating a buyer account on discovery surfaces
  (that conversation belongs to the account screens, if anywhere).
- **Buyer session:** hearts everywhere (§2).

---

## 8. Navigation — how M3 slots into the M1 shells

**Buyer tab bar** (M1 brief: Home ✔ · Search ⏳ · Enquiries ⏳ · Messages ⏳ · Profile ✔):
- **Search tab goes live** — it opens screen 1; results, filters, AI, category browse, and both
  detail screens live in its stack.
- **Saved needs a home.** `Saved-items-ui.png` names a header/menu "Saved" link and a dashboard
  widget, not a tab. Options: (a) a row on the **Profile/dashboard** screen ("Saved · {n}"),
  (b) a bookmark icon in the Search stack header, (c) its own tab. Recommendation: **(a) + (b)**
  — no tab-bar change, two natural entries. Owner call (§10).
- Enquiries/Messages tabs stay "coming soon" (M4).

**Exporter tab bar** (Home ✔ · Catalogue ⏳ · Enquiries ⏳ · Profile ✔): **no change in M3.**
Exporters can reach public pages via links (e.g. their own public preview), but no exporter
search tab is named in any source — do not add one without an owner nod (§10).

**Stack behaviour:** product → seller → product chains can get deep; native back walks the
chain, the tab button pops to the stack root. Search state (query, filters, scroll position)
survives tab-switching.

---

## 9. Cross-screen checklist before handing designs over

- [ ] Every screen has loading, empty, error **and offline** drawn; result lists add appending / append-failed / end-of-list
- [ ] Zero-results drawn with did-you-mean chip + clear-filters (screens 2, 4)
- [ ] Verified tick only ever a tick — no "unverified"/"pending"/"rejected" anywhere; rendered from `verified`, never `kycStatus`
- [ ] Every field on screens 6–7 is in the public whitelist — nothing added
- [ ] No contact (phone/email/**website**), street address, status, or moderation data on any surface
- [ ] Price component covers fixed / range / on-request everywhere
- [ ] Price filter shows its currency; on-request is a separate toggle; tiered price-sort note drawn
- [ ] Suppliers mode: two filters, two sorts, product filters visibly dropped on toggle
- [ ] Filter modal: lazy-load state, live result-count footer, goods-only groups absent for services
- [ ] AI fallback renders as normal results — no error treatment; AI daily-limit state drawn
- [ ] Hearts: optimistic flip + revert, absent for exporter sessions, ≥44px hit area
- [ ] Saved list draws greyed "Currently unavailable" cards in-list; swipe-to-unsave has a reveal step
- [ ] "Send enquiry" (6, 7) visibly "coming soon" until M4 + logged in the non-operational-UI ledger
- [ ] Sparse seller profile and zero-listing supplier card drawn — launch-day defaults
- [ ] No recent-searches, no recommendations, no "similar products" anywhere (Phase 2)
- [ ] Keyboard never covers the focused input or the filter modal's Apply button
- [ ] Checked on a small (~375pt) and a large (~430pt) phone; safe areas correct
- [ ] Dark mode fully done or explicitly out — same decision as M1, both surfaces at once

---

## 10. Decisions

### ✅ Working assumptions (flag to change)

1. **Infinite scroll on the app, pagination on web** — both allowed by `m3.md` §3.4; this split
   matches platform conventions.
2. **Filters apply on "Show results"**, not per-tap (screen 3) — keeps the modal responsive on
   mobile networks.
3. **Category tap opens filtered results** — no standalone category page in the app (§3).
4. **Saved entry = Profile/dashboard row + bookmark icon in the search header** (§8) — no
   tab-bar change.

### Still open — owner calls

1. **Guest browse in the app.** The plan says guests can search on the app, but the M1 shell
   has no signed-out path except auth. Adding "browse as guest" to the welcome screen is a
   navigation-shell change with real surface area (auth prompts on save, session-less state).
   Decide before this milestone's app build; this brief is guest-ready but designed signed-in.
2. **Exporter search entry.** Exporters may search (public), but no source names an exporter
   nav entry. In (add a quiet entry on the exporter Profile screen?) or out (reachable only via
   links)? Recommendation: out, until asked.
3. **Saved-count badge** — live count on the saved entry: in or out?
4. **Brand palette + dark mode** — unchanged from M1; both block final visual design.
5. **Synonyms content + OpenAI key are owner-pending** (backend checkpoints) — until they land,
   synonym demos won't fire and AI search always falls back. Fine by design; brief demo
   accordingly.

---

## 11. Scope: boundaries respected, and the gaps

| Gap | Detail | Consequence |
|---|---|---|
| **Guest mode undefined in the app shell** | M3 sources say guests search on web + app; the M1 app has no guest navigation. | §10.1 — owner decision needed; screens here don't block either answer. |
| **Saved-list entry point is web-shaped in the source** | `Saved-items-ui.png` names header links and a dashboard widget — web furniture. The app placement is this brief's recommendation (§8), not a sourced fact. | Confirm placement with the owner alongside §10.3. |
| **Enquiry buttons dead until M4** | Screens 6–7 carry "Send enquiry" with no destination this milestone. | Ship visibly "coming soon" + ledger rows, per the strict non-operational-UI rule. |
| **No app equivalent of web SEO surfaces** | Category pages / slugs / canonical are web-only concerns; the app navigates internally. | None — recorded so nobody "ports" SEO screens into the app. |
| **Featured content on Search home** | Screen 1's featured strip reuses the web landing's curated content; no M3 source explicitly names it *for the app*. | Optional — cut it from screen 1 without loss if the owner prefers the app entry minimal. |
| **`web-design.md` stale tick line** | The always-relevant tick rule file still references `kycStatus`; every M3 source (and the shipped API) uses the `verified` boolean. | Brief follows `verified`; the rule file needs the correction pass (also flagged in the web brief §11). |
