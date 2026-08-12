# Prompt — MPX Global web · Category listing page redesign (M2 · screen 2 · `/category/:slug`)

> Copy everything below into your design tool (v0 / Lovable / Galileo / Figma AI / Claude /
> Stitch). This is a **REDESIGN of an already-shipped, already-heavily-iterated page** — read §5
> in full before proposing anything. This exact page has already been rebuilt **twice** through
> real owner feedback (a sidebar rail → a circular "story strip" navigation → back to a refined
> sidebar rail, which is what's live today). Proposing the circular strip again isn't wrong, but
> do it as a deliberate, named recommendation — not as if it's a fresh idea nobody tried.
> Sources of truth: live tokens `web/tailwind.config.js` · current implementation
> `web/src/pages/public/CategoryListing.jsx` + `web/src/components/catalogue/ProductCard.jsx` ·
> `.claude/rules/web-design.md` + `.claude/rules/m3-seo.md` (this page must stay indexable).

---

## ⛔ COLOUR — hard rules, checked by arithmetic, before anything else

**The brand is a deep ROYAL BLUE / NAVY. Not purple, not violet, not indigo, not pastel.**
This has been mis-produced before (`#8069BF`, a lavender) — see the rejected table below.

```
#1A2E8F   navy  — brand/heading accents, FLAT fill, no gradient
#2A4DE0   blue  — buttons, links, active/selected states
```

Every colour must satisfy both, arithmetically:

- **Hue 226–232°.** The brand pair sit at 230° and 228°.
- **Saturation ≥ 65%.** The brand pair are 69% and 75%.

| Rejected | Hue | Sat | Why |
|---|---|---|---|
| `#8069BF` | 256° | 40% | lavender — actually produced once, 26° too violet, half the saturation |
| `#4f46e5` | 243° | 75% | indigo — a stale draft once listed it; never shipped |
| `#6366f1` | 239° | 84% | indigo |

Also rejected: any purple/violet at any opacity · desaturated/pastel blue (use `#EAEEFF` for
"light", never a washed-out mid-tone) · Tailwind default `gray/slate/zinc` (ours is the
blue-cast `ink` scale below) · plain `#000000` (darkest text is `#000517`) · a coloured/tinted
"no image" placeholder (rejected 2026-08-11 — a quiet neutral grey + icon is the standard, it
reads as absence, a coloured box reads as content) · **colour alone to mark the selected
sub-category** — the live version pairs its tint with a left accent bar AND a check icon
specifically because colour alone fails accessibility (web-design.md: "never use colour alone to
convey meaning").

**Full token set — use only hex values that appear verbatim in this document:**

```
primary-50   #EAEEFF     ink-50   #F7F8FB     success  #12B76A (verified tick ONLY)
primary-100  #DEE1FF     ink-100  #F2F4F7     warning  #F79009 (locked token)
primary-200  #C3CBFF     ink-200  #E2E4EC     danger   #D92D20
primary-600  #2A4DE0     ink-400  #98A2B3     danger-50 #FEECEA
primary-700  #2340C4     ink-600  #5A6B85 (= "muted")
primary-800  #1A2E8F     ink-900  #000517
                          surface  #FFFFFF · border #C5C6CF
```

Two shadow levels exist, never more: `shadow-card` (resting, soft navy-tinted) and `shadow-lift`
(one step deeper — active/hovered surfaces only). Don't invent a third.

**Before delivering, list every hex you used and confirm each one is in here.**

---

## 1 · What you are designing

The page a visitor lands on after picking a category — **one category's products**: header
identity, a way to move sideways into sibling/child categories, and the product grid itself,
which is the page's actual job. This single template serves **two cases from one URL shape**,
`/category/:slug`:

- **A TOP category** (e.g. "Agriculture") — the slug has no parent. The server aggregates every
  product across all of its active sub-categories onto this one page.
- **A SUB category** (e.g. "Seeds & plants") — the slug has a parent. Only that sub's own
  products show.

The redesign should treat this as ONE flexible template, not two pages — the current build
already does (the same component renders both, with the sub-navigation column adapting: "All
{top name}" appears as an extra option only when standing on a sub page).

**You are not bound to the current layout paradigm.** Genuinely explore. What you may not change:
the content contract (§2), the accessibility/SEO posture (§4), and the colour system (§0) — and
the top/sub duality above must keep working from the one URL shape.

**Give me 2–3 genuinely different directions**, not three variations on one idea. For each,
name what job it optimises for — e.g. "get to a product fast" vs. "feel like browsing a curated
shopfront," or "sub-category navigation is the star" vs. "the product grid is the star and
navigation gets out of the way."

---

## 2 · Content & data — the real shape, don't invent fields

**The category itself** has: name · slug (drives the URL, never shown as text) · an image, or
none (every top category has a real photo today; most sub-categories don't yet — design the
no-image state as a real, common path, not an edge case) · its parent (if it's a sub) · its list
of sub-categories (if it's a top) — each with their own name/slug/image.

**Each product card** has, and only has:
- Name · cover photo (or none) · **up to 2 short spec/attribute values** as chips (e.g. "100%
  cotton," "400 gsm" — real category-specific data, never invented specs)
- **Price** — one of three real shapes: a fixed amount + unit, a min–max range, or "Price on
  request" (never absence — it's an intentional, informational state)
- **MOQ** (minimum order quantity), when the seller set one
- **Seller identity** — company initials/logo, name, **verified tick** (present or absent, never
  a "not verified" badge), country. Never seller contact info of any kind.

**Nothing else exists per product** — no stock/status word, no "trending," no rating/review
score (this platform doesn't have product reviews). Don't invent metrics to fill space.

**Ordering:** newest-first, server-decided. No sort control exists or should be implied by the
design (see §4).

---

## 3 · States to design (all of them, not just the happy path)

- **Loading** — skeletons for the header card, the sub-navigation, and the product grid
  independently (they can resolve at different times).
- **Populated** — the normal case, some number of products (1 up to many, needs pagination).
- **Empty category, zero products** — **this is a COMMON state at launch, not rare.** Most
  sub-categories have no listings yet. Needs a calm, on-brand "nothing here yet" with a way back
  out (not a dead end) — never look broken or like an error.
- **A category/product with no image** — the standard neutral fallback (grey panel + icon, never
  a coloured or monogram box for a PRODUCT; a coloured monogram is the accepted convention only
  for a company/seller logo gap, never for a category or product photo).
- **Error** (the category or the product list failed to load) — plain-language message + retry,
  never a raw technical error.
- **Not found** — an unknown, deactivated, or invalid slug. This must be **visually
  indistinguishable** from "this category never existed" — no hint that something *used* to be
  there (see §4).
- **Pagination** — more products than fit one page.

---

## 4 · Non-negotiable constraints

- **🔴 No search box, no filter facets, no sort control anywhere on this page.** That's a
  separate, later module (server-side discovery search lives elsewhere in the product). The
  sub-category navigation on this page is for **moving between categories**, not filtering
  products within one — don't let it visually imply it's a filter panel. If your direction adds
  any filter-shaped UI, name it clearly as "for a future module" rather than building it live.
- **Public and must be indexable.** Every sub-category link and every product card must be a
  real, crawlable `<a>` — never content that only appears after a client interaction. Exactly
  **one `<h1>`** (the category name).
- **An unavailable category (deactivated, unknown slug) renders as a plain 404** — indistinguishable
  from a slug that never existed. Never a "this category was removed" message — that confirms to
  a visitor that something specific used to be there, which is information the page must not
  leak.
- **Accessibility, WCAG AA, not polish.** Keyboard-navigable sub-category list, visible focus
  states, colour contrast ≥ 4.5:1, and — repeating from §0 — **never colour alone** to show which
  sub-category is currently selected; pair it with an icon, weight, or position cue.
- **Mobile-first, no horizontal body scroll.** The current build's sidebar column becomes a
  grid ABOVE the products on small screens, not a squeezed sidebar — whatever you propose, show
  the phone layout as its own considered arrangement, not a shrunk desktop one.
- **Image performance.** Explicit width/height (or aspect-ratio) on every image so nothing shifts
  as it loads; lazy-load below the fold.
- **No dead links, no fake data.** Every sub-category and product shown must be real. If you need
  example content for the mockup, use real category/product names from the live site rather than
  inventing new ones.

---

## 5 · Current shipped baseline (2026-08-11) — read before proposing anything

This exact page has been through real, multi-round owner iteration. Here's where it landed, and
the one thing it explicitly moved away from:

**Layout (≥1024px):** a 280px **sticky left rail** titled "SPECIALISATIONS" with a count badge,
tinted header band, listing every sub-category as a photo-thumbnail row; the currently-open one
gets a soft background tint + a left accent bar + a check icon (never colour alone — see §0/§4).
On a sub-category's own page, an extra "All {top name}" row leads the list. To the right: a
**banner header card** — category name in large type, a muted eyebrow, three stat pills ("N
products," "N specialisations," "Verified Indian exporters"), with the category's own photo
bleeding in from the right edge of the card, fading into white (no scrim, no overlay text) — the
photo hides below `sm`. Below that: a slim "Products · N · Sorted by newest" toolbar bar, then
the product grid (2/3/4-up responsive), then pagination.

**Layout (<1024px):** the sidebar rail is replaced by the SAME sub-category list rendered as a
2–3 column photo-card grid, sitting above the product grid instead of beside it.

**⚠️ Explicitly tried and moved away from:** an earlier pass replaced the sidebar with a
"story-style" horizontal strip of circular thumbnails (Instagram-stories-like: current category
ringed + checked, siblings scrollable alongside). The owner moved back to a refined sidebar/grid
rail. This isn't a ban on circular navigation — it's context: if you propose it, say explicitly
why it's right this time, since it was tried and specifically not kept.

**⚠️ One inconsistency worth knowing about:** the sibling page `/categories` was JUST changed
(2026-08-11, same day) to a plain **white background** and **full-width content** (no
`max-w-7xl` cap). This page still uses the pale blue-tinted canvas (`#EAEEFF`) and a
1280px-capped, centred content column — so right now the two pages don't visually match. Whether
this page should follow that same white/full-width treatment is an open call; note your
recommendation either way rather than silently picking one.

**Product card** (shared across this page, the category-detail related-products row, and the
supplier profile — do not redesign it here in isolation, but you may propose changes to it as
part of a direction): photo with 4:3 crop and a hover-triggered "View details" slide-up, 2-line
clamped name, up to 2 spec chips, price as the visual hero with unit + MOQ beneath, then a
hairline-separated seller row (initials badge, name, verified tick, country).

---

## 6 · Open questions — flag your answer, don't silently pick one

1. **White/full-width vs the current blue-tinted, capped layout** (§5's inconsistency note) —
   pick one for each direction you propose and say why.
2. **Sidebar rail vs. an alternative navigation pattern** for moving between sibling/child
   categories — the brief doesn't mandate keeping the current rail; just don't propose the
   already-tried circular strip without saying explicitly why it's the right call this time.
3. Is the **banner header photo** (dissolving in from the right) worth keeping, dropping, or
   rethinking now that most sub-categories don't have their own photo yet (only tops are fully
   imaged today)?

---

## 7 · Deliverables

1. **2–3 distinct directions**, each with: desktop (≥1280px) and phone (~390px) layouts, the
   populated state, the empty-category state, and the no-sub-category-image case. One line per
   direction naming the job it optimises for.
2. Your answers to §6's three open questions, for each direction.
3. **Self-check with delivery:** every hex used appears verbatim in §0; no search/filter/sort
   control anywhere; the selected sub-category is never marked by colour alone; sub-category and
   product links are real `<a>`s, not click-to-reveal; exactly one `<h1>`; the empty state and
   the not-found state read as clearly different from each other (one is "nothing here yet," the
   other must give away nothing).

---

## Notes for whoever runs this prompt

- No backend/data changes needed for any direction — this is a pure front-end visual/UX pass over
  data the page already receives.
- Don't touch `PublicHeader`/`PublicFooter` (shared across every public page) or the `ProductCard`
  component's actual DATA contract — visual changes to the card are fair game as part of a
  direction, but its content fields (§2) are fixed.
- If a direction needs a new shared primitive, name it as new rather than quietly duplicating
  something that may already exist in the design system — flag it so it doesn't ship as a
  one-off.
- This page shares its product-card and empty/error-state components with the supplier profile
  page and the product detail page's "More in this category" row — a change proposed here that
  also touches those shared pieces should say so explicitly, since it isn't scoped to this page
  alone.
