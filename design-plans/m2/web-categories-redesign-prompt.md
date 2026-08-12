# Prompt — MPX Global web · Categories page redesign (M2 · screen 1 · `/categories`)

> Copy everything below into your design tool (v0 / Lovable / Galileo / Figma AI / Claude /
> Stitch). This is a **REDESIGN of an already-shipped, already-iterated page** — not a first
> design. Read §5 (current shipped baseline) before proposing anything, so you're evolving or
> deliberately departing from real decisions rather than rediscovering them by accident.
> Sources of truth: live tokens `web/tailwind.config.js` · the current implementation
> `web/src/pages/public/Categories.jsx` · `.claude/rules/web-design.md` (responsive/a11y/SEO
> standards this project holds every public page to).

---

## ⛔ COLOUR — hard rules, checked by arithmetic, before anything else

**The brand is a deep ROYAL BLUE / NAVY. Not purple, not violet, not indigo, not pastel.**
This has been mis-produced before (`#8069BF`, a lavender) — see the rejected table below.

```
#1A2E8F   navy  — brand/heading accents, FLAT fill, no gradient
#2A4DE0   blue  — buttons, links, active/focus states
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
blue-cast `ink` scale below) · plain `#000000` (darkest text is `#000517`) · gradients, glows or
glassmorphism on brand surfaces · a coloured/tinted "no image" placeholder (rejected on this
exact page 2026-08-11 — see §5).

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

The **public category browse page** — `/categories`. It is the entry point into the whole
catalogue: a visitor with no account, no login, arrives here (from the landing page, from a nav
link, from Google) and picks a category to start browsing suppliers. There are **40 top-level
categories**, each carrying some number of sub-categories.

This is a **redesign pass**, not greenfield. §5 below describes exactly what's shipped today so
you can evolve it deliberately. **You are not bound to the current card-grid paradigm** — genuinely
explore. If a different layout paradigm (e.g. a denser directory list, a mega-menu-style grouped
view, a magazine-style featured-plus-grid, something else entirely) serves the job better, propose
it. What you may **not** change is the content contract, the accessibility/SEO posture, and the
colour system above — all in §3–§4.

**Give me 2–3 genuinely different directions**, not three variations on one idea. For each,
briefly say what job it's optimising for (fastest scan for someone who knows what they want vs.
browsable discovery for someone who doesn't, information density vs. visual/editorial feel, etc.)
— that framing matters more than the visual polish.

---

## 2 · Content & data — the real shape, don't invent fields

Each category card has, and only has:
- **Name** (e.g. "Textiles & Fabrics")
- **Slug** (drives the link, `/category/:slug` — never shown as UI text)
- **Image** — a real photo, OR none. As of now **every one of the 40 has a real photo**
  (sourced/verified individually), but the "no image" state is a real, permanent code path (a
  newly added category starts with none) and must be designed, not assumed away.
- **Sub-categories** — a list of names (a top category has anywhere from a handful to a couple of
  dozen). No sub-category images at the top-browse level.
- **Order** — the platform decides display order (an admin-curated sequence, not alphabetical).
  **Never re-sort client-side, in any design.** The sequence is a deliberate content decision;
  presenting it as alphabetical or "smart-sorted" would silently override that.

Nothing else exists per category — no price range, no product count badge, no "trending" signal,
no seller count. Don't invent metrics to fill space.

---

## 3 · States to design (all of them, not just the happy path)

- **Loading** — skeleton placeholders matching whatever card shape you land on.
- **Loaded, populated** — the normal case, all 40.
- **A card with no image** — the real fallback state (§2). Today's answer: a quiet **neutral**
  panel (grey surface + a plain photo-glyph icon) — explicitly **not** a coloured/tinted box or a
  coloured monogram (that was tried and rejected 2026-08-11 for "reading as content instead of as
  an absence"). You can propose a different neutral treatment, but it must still read as *absence*,
  not as a second visual category of card.
- **Empty** — zero categories exist at all (a real if rare ops state, e.g. between a data reset and
  reseeding). Calm, on-brand "nothing here yet" — never a broken-looking blank page.
- **A local find/filter with no matches** — see §6 for whether you keep this control at all; if you
  do, it needs a "nothing matches" state too.
- **Error** — the data failed to load. Plain-language message, a retry action, never a raw
  technical error.

---

## 4 · Non-negotiable constraints

- **Public and must be indexable.** Every category must be a real, crawlable `<a>`/link — never
  content that only appears after a client-side interaction (no "load more to reveal," no
  JS-only accordions hiding categories from a crawler). Exactly **one `<h1>`** on the page.
- **Accessibility, WCAG AA, not polish.** Real `<label>`s on any input, meaningful `alt` text
  (empty `alt=""` only for decorative images), visible keyboard focus states (never
  `outline: none` without a replacement), colour contrast ≥ 4.5:1 for text, touch targets ≥ 44px.
- **Mobile-first, no horizontal body scroll.** Design phone first, enhance up to tablet/desktop.
  This project's last public-page redesign shipped a mobile 2-up grid — whatever you propose,
  show me the phone layout, not just desktop with things reflowing.
- **Image performance.** Every image needs explicit width/height (or aspect-ratio) so nothing
  shifts as it loads (CLS), and should lazy-load below the fold.
- **No dead links, no fake data.** Every category shown is a real, live link to `/category/:slug`.
  Never mock up categories, counts, or sub-category names that don't exist in the real taxonomy —
  ask if you need real example names; don't invent "Electronics Components" if that's not a real
  category.

---

## 5 · Current shipped baseline (2026-08-11) — what exists today

So you know what you're evolving or deliberately replacing:

- **Photo-forward cards** in a responsive grid (2-up phone → 3-up tablet → 4-up desktop). Each
  card: 16:9 photo (or the neutral fallback), category name, up to 3 sub-category name **chips**
  as a teaser ("+N more" if there are more), sub-category count line at the bottom.
- **Hover**: subtle image zoom + border/shadow lift (desktop only, meaningless on touch).
- **A "quick find" search box** in the page header — client-side only, filters the 40 already-
  loaded cards by name/sub-category-name match. It is explicitly **not** the platform's real
  search (that's a separate, server-side product/supplier search living elsewhere) — if you keep
  a filter control, don't let it imply it searches products.
- **Header**: page title "Browse categories," one-line subhead stating the category count.
- Sits inside the shared `PublicHeader`/`PublicFooter` chrome used by every public page (nav,
  logo, sign-in/get-started CTAs, footer links) — that chrome is out of scope here; design the
  content area between them.

This shape itself followed real owner iteration on the sibling page (`/category/:slug` was
redesigned twice before landing) — so if you're proposing something close to this, make sure
it's an intentional refinement, not a rediscovery of what was already tried.

---

## 6 · Open question — flag your answer, don't silently pick one

Should the "quick find" filter box stay, change, or go? It predates the platform's real
server-side search shipping elsewhere; keeping local client-side filtering here alongside a real
search feature elsewhere in the product might now be redundant, or might still earn its place as
fast in-page navigation over exactly 40 items. Pick a position and say why, for each direction
you propose — don't just carry it forward by default.

---

## 7 · Deliverables

1. **2–3 distinct directions**, each with: desktop (≥1280px) and phone (~390px) layouts, the
   no-image fallback card, the loading/empty/error states, and one line naming what job that
   direction optimises for.
2. Your answer to §6 (filter: keep / redesign / remove), for each direction.
3. **Self-check with delivery:** every hex used appears verbatim in §0; no coloured/tinted
   "no image" placeholder; categories are real `<a>` links, not click-to-reveal; one `<h1>`;
   sub-category order is preserved as-given, not re-sorted.

---

## Notes for whoever runs this prompt

- No backend/data changes needed for any direction — the page already reads real category/
  sub-category/image data from a shipped API; this is a pure front-end visual/UX pass.
- Don't touch `PublicHeader`/`PublicFooter` — they're shared across every public page and are
  out of scope for this prompt.
- If a direction needs a new shared primitive (a chip style, a card shell, etc.), name it as new
  rather than quietly duplicating something that might already exist in the design system —
  flag it so it doesn't ship as a one-off.
