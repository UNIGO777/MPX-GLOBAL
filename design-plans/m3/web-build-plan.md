# M3 · Web Frontend — Build & Verification Plan

> **Scope:** build the four unbuilt M3 web screens (1 · 2 · 3 · 8) and **verify the four shipped
> ones (4–7) still deliver everything the brief promises**. Web only; the app has its own brief.
> **Written:** 2026-08-14. Owner asked for both halves in one plan.
>
> **Sources of truth (precedence):**
> 1. `.claude/rules/m3-public-projection.md` + `.claude/rules/m3-seo.md` — contractual.
> 2. `design-plans/m3/web-screens-design.md` — corrected to as-built 2026-08-14; screen sections
>    4–7 there ARE the verification spec.
> 3. `build-plans/m3/backend-plan.md` — every endpoint below is shipped (✅ 2026-07-31, 274/274).
> 4. `docs/History.md` 2026-08-11 → 2026-08-14 entries — the design decisions that postdate all
>    plan docs (masthead, drawer filters, SortMenu, full-bleed, shared cards…).
>
> **Scope status:** 100% confirmed Phase-1 / month-1 (M3 = quote Module 3, search half). No
> Bucket-A/B or D-item triggers anywhere in this plan. The one adjacency: screen 1's featured
> strips are **shared with FINALIZE F5b** — see Phase 4's boundary note.
>
> **Legend:** ✅ shipped · 🔨 build · 🔎 verify · 🧱 owner decision gates polish, not the build

---

## 0. Ground rules (unchanged, restated so nobody re-derives them)

- **Whitelist projection only.** A search result is never a richer object than a browse result.
  New fields are private by default; widening the public surface = red-alert first.
- **B7:** verification never filters or gates by default. The ONLY verification-shaped control is
  the opt-in "Verified sellers only" toggle (already shipped in `FilterSidebar`).
- **Availability copy:** "Currently unavailable" is the entire public explanation. Never why.
- **No dead controls** (`web-ui-notes.md`): anything rendered-but-unwired is `disabled` + a
  `docs/UiWebNotes.md` row, in the same commit. This plan FLIPS four existing Pending rows
  (hearts ×2, buyer-nav "Search suppliers" ledger) and must update the ledger as it does.
- **Design system:** tokens + shared primitives only. The shipped surfaces define the language —
  masthead device, flat toolbars, `SortMenu`, sheet/drawer filters, shared `ProductCard`.
  Full-bleed containers on public listing pages (standing owner preference — never cap).
- **Every list screen ships five drawn states:** skeleton (matching the card shape) · empty ·
  error (with requestId + retry) · success · **zero-results** (with the server's "did you mean").
- **Verification method for everything in this plan:** the Playwright pass used all week —
  screenshots at 390 / 768 / 1024 / 1440, zero page overflow, zero elements past card edges,
  real interactions (tap, swipe, keyboard) on a touch context. No claim without a screenshot.

**Shipped endpoints this plan consumes (paths verified against `src/routes/` 2026-08-14):**

| Endpoint | Auth | Used by |
|---|---|---|
| `GET /public/search` (q · type=product\|supplier · category · verifiedOnly · priceMin/Max · attr[…] · sort · page) | public, rate-limited | screens 2, 5 ✅ |
| `GET /public/facets` (same filter context, live counts) | public | screens 2, 5 ✅ |
| `POST /search/ai` | public, rate-limited + org quota, fallback-on-any-failure | screen 3 |
| `GET /saved` · `POST /saved` · `DELETE /saved/:…` | buyer only | screen 8 + hearts |
| `GET /public/featured` | public | screen 1 (F5b boundary) |

---

## Phase 1 · 🔎 Verification pass — shipped screens 4–7 (do this FIRST)

One journey, four screens, in the order a buyer walks them. Each checklist row is a promise from
the corrected brief; tick it only against the running page (dev server + Playwright), not the
code. File anything failing as a fix in this phase — do not carry known gaps into Phase 2.

### 1a — `/categories` (screen 4)

- [ ] Desktop card grid: photo thumb · name · ≤6 real sub-links · "Explore category · +N more".
- [ ] Phone: grouped chip directory renders and every chip is a real link (committed state — the
      2026-08-14 mobile redesigns were reverted; do NOT "improve" this view in passing).
- [ ] Quick-find filters by top AND sub names, preserves server order, shows "N of 40 match".
- [ ] Both markups in the DOM at every width (SEO parity); one `h1`; per-page `<title>`.
- [ ] States: skeletons (both shapes) · error+retry · empty · zero-match.

### 1b — `/category/:slug` (screen 5) — top AND leaf variants

- [ ] Masthead: name (2xl/3xl/4xl step) · promise line · real-data chips only ("Part of {top}" on
      leaf; specialisation count on top; listing count once loaded) · photo mask fades from right,
      hidden <sm. Gradient-only when the category has no photo.
- [ ] Rail (lg+): Specialisations only, sticky under the 64px header, "All {top}" row on leaf
      pages, current row tinted + check. <lg: selector card ("Change ⌄") → searchable photo sheet;
      picking navigates; search matches names only.
- [ ] Filters: button (badge = active count) at EVERY width → sheet on phones / right drawer lg+.
      Verified toggle · price min/max with real bounds as placeholders · attribute pills
      (aria-pressed, count on the accessible name) and number ranges · Applied chips + Clear All.
      Counts render exactly as the API sends them (own-group exclusion is server-side).
- [ ] Toolbar: flat — "{N} products · | Filters" left, "Sort: {label} ⌄" (`SortMenu`) right.
      Sort options exactly: Newest first · Price low→high · Price high→low. URL carries all state;
      back/forward and share-links restore it; any filter change resets `page`.
- [ ] Cards: <md compact 2-up `ProductCard`; md+ horizontal `ProductListCard` (image column
      320/300/360/400 by breakpoint, spec block beside price with truncation, no clipped elements).
- [ ] SEO: canonical → clean URL always; `noindex,follow` when any filter/sort active; flat slug
      for both levels; unknown/inactive slug → shared NotFound (no oracle).
- [ ] Copy constraints: no status words, no "not verified" anything, price-on-request quiet.
- [ ] States: matched skeletons per breakpoint · error+requestId · both empty variants
      (no-products vs no-filter-match with Clear filters).

### 1c — `/product/:slug` (screen 6)

- [ ] Gallery: seller images only; thumbs + "+N" overflow tile; working lightbox (Esc/backdrop/X,
      focus restore); `NoImagePanel` when imageless — never stock filler.
- [ ] Buy panel: eyebrow category link · name · listed date · chips · tinted price block
      (all three price modes render; MOQ + supply ability row) · supplier card (logo/monogram,
      name, tick-or-nothing, member-since YEAR, country, entityType — never contact/website)
      → links to `/supplier/:slug` · trade facts card (goods vs service field sets).
- [ ] "Send Enquiry": present, disabled, "coming soon" affordance (M4 wires THIS button — owner
      ruling 2026-08-14). Heart: disabled until Phase 5 flips it.
- [ ] Description | Specifications side-by-side lg+ (lone panel = full width); `SpecTable`
      single-column inside half-width panels; long description folds behind Read more.
- [ ] "More in {category}": shared `ProductCard` 2/4-up, parent-category fallback labelled
      honestly, "View Category →".
- [ ] SEO: per-page title; unavailable anything → NotFound, indistinguishable from never-existed.
- [ ] States incl. related-row absence (section simply absent, no empty shell).

### 1d — `/supplier/:slug` (screen 7)

- [ ] Cover band (coverImage when seeded → gradient fallback) · ring-4 logo/monogram · name +
      tick-or-nothing · stat chips (member-since year, country, entityType, product count).
- [ ] "Start Conversation": present, DISABLED, stays that way (owner ruling 2026-08-14 — deferred
      decision; do not wire, do not remove).
- [ ] Catalogue: toolbar matching /category + 2/3/4-up shared `ProductCard` grid; active listings
      only; pagination.
- [ ] Copy: no contact, no website, no address beyond city/country, no status words, no
      enquiry-CTA beyond the disabled button, absence-of-tick is the only unverified signal.
- [ ] SEO: title `"{companyName} — Supplier | MPX Global"` (cancelled-data template is NOT used).

**Exit criteria for Phase 1:** every box ticked or converted into a fixed-and-re-verified item;
History.md entry summarising any fixes.

---

## Phase 2 · 🔨 Screen 2 — Search results (`/search`)

The biggest build. It is deliberately **`/category/:slug` with the category constraint removed** —
same toolbar, same drawer filters, same cards, same URL-state pattern. Reuse, don't re-derive.

**Layout (journey order):**
1. Header search bar (shared `PublicHeader` gains the search input — see Phase 4 note; on this
   page it's pre-filled with `q` and resubmittable).
2. Type toggle: **Products | Suppliers** segmented control (`type` param; products default).
3. Flat toolbar: "{N} results for “{q}” · | Filters" — Sort right (products only; suppliers sort
   fixed server-side).
4. Results: products → the same 2-up/`ProductListCard` split as /category; suppliers → supplier
   row-cards (logo/monogram · name · tick · country · entityType · product count → profile link).
   **🧱 owner call: "category match" tag on product cards — in or out (my lean: in, it's real
   server data).**
5. Pagination (same compact component).

**Filters (drawer/sheet, reusing `FilterSidebar`):** everything /category has PLUS the two
facet groups the API already returns that /category deliberately omits:
- [ ] **Category facet** (top-level list w/ counts → narrows the search; picking one does NOT
      navigate to /category — it filters this page).
- [ ] **Country facet** (from `sellerCountry` denorm).
- [ ] Price stays single-currency-scoped (§A27) — render the currency the API declares.
- [ ] Suppliers type: only the Verified toggle + country apply; hide inapplicable groups.

**Zero results is THE state to design:** whole-word matching means it's common. Server
"did you mean" → "Did you mean **{suggestion}**?" as a link that re-runs the search; plus the
honest explainer + Clear filters when filters contributed. (Confirm the response field name at
build time against `search.service.js` — the brief promises it; pin the shape before styling.)

**SEO:** `noindex,follow` ALWAYS (not just when filtered); no canonical games; title
`"Search: {q} — MPX Global"`. Never in the sitemap.

**States:** skeletons per card type · error+retry · zero-results (above) · success.
**Verify:** URL round-trip (paste a filtered URL cold → identical state), both types, all widths,
keyboard through toggle → filters → cards.

---

## Phase 3 · 🔨 Screen 3 — AI search modal

An overlay reachable from the search bar (screens 1 + 2): "Ask in your own words".

- [ ] Trigger: quiet "AI search" affordance inside/beside the search bar — NOT a separate nav item.
- [ ] Modal: textarea (multi-line natural language) · submit · Esc/backdrop close · focus trap —
      reuse the Lightbox/sheet mechanics conventions (third occurrence → consider extracting the
      shared modal hook now, per the duplicate-twice rule).
- [ ] Submit → `POST /search/ai` → navigate to `/search` with the structured result applied
      (the endpoint returns interpreted filters/results — pin the exact response shape from
      `aiSearch.service.js` before building; the design treats AI results as NORMAL results).
- [ ] **Honesty rules:** no "thinking…" theatre beyond a real pending state; when the server took
      the fallback path the results render as plain keyword results with NO fake "AI picked
      these" framing. Rate-limit / quota errors get a designed, non-technical message.
- [ ] 🧱 **OpenAI key is owner-pending** — until it lands, every request falls back. Build and
      demo anyway (fallback is by design invisible); tell stakeholders before demos.

---

## Phase 4 · 🔨 Screen 1 — Landing discovery wiring (`/`)

Smallest phase, two halves — one is a boundary:

- [ ] **Search entry (this plan):** hero search input wired → `/search?q=…` (Enter + button),
      plus the AI-search trigger. Flip the UiWebNotes "hero search pending" row. The header
      search input (if the shared `PublicHeader` gains one, used by Phase 2) lands here too —
      one implementation, both places.
- [ ] **Featured strips = FINALIZE F5b territory** (`GET /public/featured`, banner + curated
      pointers). m6-finalize's brief owns their design; building them here would double-spec.
      **This plan stops at the search entry** unless the owner explicitly pulls F5b forward.
      🧱 flag, don't assume.

---

## Phase 5 · 🔨 Screen 8 — Saved items (`/saved`, buyer-only) + heart wiring

- [ ] **Route guard:** buyer-only (`ProtectedRoute` convention); guests hitting `/saved` → sign-in;
      exporters NEVER see the route or any save affordance (§A13 — affordance absent, not disabled).
- [ ] **Hearts go live** on `ProductListCard` + product-page gallery (the two logged placeholders,
      flip their UiWebNotes rows): filled/unfilled from saved state, optimistic toggle w/ rollback.
      `ProductCard` (compact) gains the heart ONLY if the brief's shipped-shape note allows —
      check §2 before adding; don't grow the card silently.
- [ ] **Non-buyer save attempt → popup (owner ruling 2026-08-14, verbatim spec):** the heart is
      visible to everyone; tapping it as anyone but a buyer opens a modal saying
      **"Log in with a buyer account to save this product."**
      · **Guest (not signed in):** modal carries a **Login button** → redirects to the sign-in
        page (return to this product after login).
      · **Signed in as any non-buyer account (exporter/staff):** modal carries a **simple OK
        button** only — dismiss, nothing else.
      ⚠️ This supersedes the brief's earlier "save affordance absent for exporters" (§A13 line):
      the AFFORDANCE now shows for all; the CAPABILITY stays buyer-only, and the server keeps
      rejecting non-buyer saves regardless (§A13 enforcement is unchanged — the popup is UX, not
      the control).
- [ ] **List page:** journey order — header w/ count · card grid of saved products (shared card +
      saved-at) · **"Currently unavailable"** treatment (muted badge + greyed card, still linked,
      NEVER a reason) · remove action per card · pagination if the API pages.
- [ ] Gone items simply don't appear (backend removes archived/purged) — no tombstones.
- [ ] **Buyer shell nav:** add "Search" + "Saved" entries, flip the "Search suppliers" ledger row.
      🧱 owner call: live saved-count badge on the nav entry (my lean: in). No exporter nav entry
      without an owner nod.
- [ ] States: skeleton grid · empty ("Nothing saved yet" + browse CTA) · error+retry · success
      incl. mixed available/unavailable.

---

## Phase 6 · Close-out

- [ ] Full Playwright sweep of ALL eight screens (widths, overflow, clipped-element scan, touch).
- [ ] UiWebNotes ledger reconciled — every flipped row marked Done; anything still inert
      (Send Enquiry, Start Conversation, category-card Inquiry) stays Pending with today's owner
      rulings referenced.
- [ ] SEO spot-check: search noindexed; category/product/supplier titles + canonicals unchanged;
      `/saved` noindexed (auth'd anyway). JSON-LD stays deferred to the SEO pass — do NOT bolt it
      on here piecemeal (owner ruling on titles applies in spirit).
- [ ] History.md entries per phase; tell the owner what was NOT covered.

## Open items this plan does not decide

| Item | Status |
|---|---|
| Match tags on result cards | 🧱 owner in/out (build works either way) |
| Saved-count badge in buyer nav | 🧱 owner in/out |
| Exporter nav entry for search | 🧱 owner nod required; default OUT |
| Featured strips (F5b) | boundary — finalize milestone unless pulled forward |
| Top-40 synonym list content | owner data entry; search works on literal names meanwhile |
| OpenAI key | owner; AI search falls back until it lands |
| JSON-LD + title-template alignment | SEO pass, per owner ruling 2026-08-14 |
