# Prompt B — MPX Global web · Home redesign, **taxonomy-led** direction (`/`)

> **This is DIRECTION B — an alternative to `web-landing-redesign-prompt.md` (Direction A), not
> a revision of it.** Run both, compare, pick one. They differ in what the home page leads
> with, and that single choice changes everything else.
>
> - **Direction A — inventory-led.** Lead with products, the way Myntra and Amazon do. Rails of
>   real listings, self-sizing so 12 products don't render as holes.
> - **Direction B — taxonomy-led (this one).** Lead with the *category tree* and search, the way
>   IndiaMART, Alibaba's sourcing side and Thomasnet do. Products appear, but they are not what
>   holds the page up.
>
> Copy everything below into your design tool (v0 / Lovable / Galileo / Figma AI / Claude /
> Stitch). This is a **REDESIGN of an already-shipped page** — read §5 before proposing anything.
> Sources of truth: `web/tailwind.config.js` · `web/src/pages/public/Landing.jsx` ·
> `.claude/rules/web-design.md` · `.claude/rules/m3-seo.md` · `.claude/rules/m3-public-projection.md`.

---

## ⛔ COLOUR — hard rules, checked by arithmetic, before anything else

**The brand is a deep ROYAL BLUE / NAVY. Not purple, not violet, not indigo, not pastel.**
This has been mis-produced before (`#8069BF`, a lavender).

```
#1A2E8F   navy  — brand/heading accents, FLAT fill, no gradient
#2A4DE0   blue  — buttons, links, active/focus states
```

Every colour must satisfy both, arithmetically:

- **Hue 226–232°.** The brand pair sit at 230° and 228°.
- **Saturation ≥ 65%.** The brand pair are 69% and 75%.

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

Rejected: any purple/violet at any opacity · pastel/desaturated blue · Tailwind default
`gray/slate/zinc` (ours is the blue-cast `ink` scale) · plain `#000000` · gradients, glows or
glassmorphism on brand surfaces · retail reds/oranges/yellows borrowed from consumer
marketplaces — a discount-red band on a B2B trade platform reads as a scam, not as energy.

Two shadow levels exist, never more: `shadow-card` (resting) and `shadow-lift` (active/hover).

**Before delivering, list every hex you used and confirm each one is in here.**

---

## ⛔ CORNERS — soft and rounded, on a fixed scale

**Nothing on this page has a sharp corner.** Soft and rounded throughout — but on ONE scale,
not a different radius per component. Use exactly these four:

```
rounded-2xl   16px   large surfaces — cards, panels, banners, image tiles, modals
rounded-xl    12px   controls — buttons, inputs, search bar, dropdowns, tabs
rounded-lg     8px   small chips — badges, tags, price pills, category labels
rounded-full         circular only — avatars, company logos, icon buttons, the verified tick
```

This matters more in Direction B than in A: a taxonomy-led page is **mostly rectangles** —
a dense grid of category tiles. Rectangles are what make a page feel hard and administrative,
and the corner radius is most of what softens them. Get this wrong and the page reads as a
government directory.

Nested corners step **down**, never up: a `rounded-2xl` tile holds a `rounded-xl` button, which
may hold a `rounded-lg` chip.

**Banned:** sharp/square corners on any tile, card or control (`rounded-none`) · arbitrary
values like `rounded-[20px]`, `rounded-[2rem]`, `rounded-[8px]` — these already exist in the
codebase and are exactly the drift this scale exists to stop · two components of the same kind
with different radii.

**Before delivering, list every radius you used and confirm each one is in this scale.**

---

## 1 · The idea behind this direction

Read this before anything else — it is the whole reason Direction B exists.

**The real numbers (production, 2026-08-23):**

```
12    live products      ← scarce
8     categories contain any product at all
301   categories (261 leaf)   ← ABUNDANT
11    exporter companies · 3 verified · 3 with a logo
```

Direction A leads with the **scarce** asset and has to work hard to stop 12 products from
looking like an empty shop. **Direction B leads with the abundant one.**

The category tree is genuinely large, genuinely useful, and *already complete* — it describes
the whole space of what Indian exporters sell, whether or not a seller has listed in it yet. A
home built on it:

- **looks full on day one**, honestly, without a single invented number
- **is the correct B2B pattern anyway** — a sourcing buyer arrives knowing what they want
  ("cotton fabric, 120 GSM"), not browsing for inspiration. IndiaMART, Thomasnet and Alibaba's
  sourcing side are all taxonomy-led for this reason
- **is the strongest possible SEO surface** — hundreds of internal links to real, indexable
  category pages, which is exactly how B2B directories rank
- **stops being a redesign problem as the catalogue grows** — products get folded in as rails
  once there are enough of them, without the layout changing shape

### 🔴 The honest trade-off — do not design around it, design FOR it

**This direction does not remove the emptiness. It moves it one click away.**

A buyer clicks "Leather footwear", lands on the category page, and finds nothing there —
because 253 of 261 leaf categories are empty today. Direction A's emptiness is visible
immediately and looks bad; Direction B's is hidden until the click and feels worse: a broken
promise rather than a small shop.

**Handling this is the core design task of this brief.** Options you must consider and choose
between (or better):

1. **Show only categories that have listings** — honest, but collapses the page to 8 tiles and
   throws away the entire advantage of this direction
2. **Show the full tree, mark which have listings** — a count, a subtle state, or an ordering
   that floats stocked categories to the top. Needs a design that doesn't read as "mostly
   empty"
3. **Show the full tree, and make the empty destination useful** — the category page becomes
   "no listings yet, but here is the enquiry route / nearest stocked category / notify me".
   This turns a dead end into a lead, but the empty-state design then belongs to this brief
4. **Two zones** — a small "stocked now" zone above a full "browse everything" zone

State which you chose and why. **A design that shows 301 categories and quietly ignores that
253 go nowhere has failed this brief**, however good it looks.

---

## 2 · What you are designing

The **public home page at `/`** — the first screen a logged-out visitor sees, and the page
Google indexes. Today it is a SaaS marketing landing page (§5).

Target shape, top to bottom:

1. **A search-and-browse header zone.** Search is the primary action, sized and placed like it.
   Not a hero illustration with a search box tucked under it.
2. **The taxonomy** — the substance of the page, and most of its height. Top-level groups,
   each opening into leaves. This is where the design work is: 301 items must feel navigable,
   not like a sitemap.
3. **Proof that it's a live marketplace, not a directory** — real listings and real companies,
   in a modest amount. This is where the 12 products go: a supporting rail, not the main event.
   Design it so it grows into a bigger role later without the page being redrawn.
4. **What MPX is and why to trust it** — compressed hard from today's ~80% of the page.

**Audience:** international buyers (mostly outside India) sourcing from Indian exporters. Not
consumers. They arrive to source, not to browse for pleasure — density and directness serve
them better than lifestyle imagery.

---

## 3 · Content & data — the real shape, don't invent fields

Everything here comes from **public, unauthenticated, whitelist-projected API responses**. If a
field isn't listed, **it does not exist** and you may not design with it.

**A category gives you:** name · slug · parent · `type` (`goods` | `service`) · whether it is a
leaf · **and an `image`** (Cloudinary URL, public). ✅ **Corrected 2026-08-23 — an earlier draft
of this prompt said there was no category image. That was wrong.** The field exists, is in the
public projection, and is populated: **292 of 301 categories carry a real photo, including all
40 top-level ones.** So a photo-led category tile is fully supported by real data today. Still
design the fallback for the 9 without one (the app uses a neutral icon-in-circle, never a
tinted panel).

**A product gives you:** name · slug · image URLs (or none) · category (name + type) · price as
`{ mode, min, max, currency }` where mode may be `on_request` (no numbers at all) · MOQ (goods
only) · the selling company's name, slug, country, logo (often null) and its **`verified`
boolean + `verifiedAt`**.

**A company gives you:** name · slug · country · logo (often null) · description · `verified` +
`verifiedAt`. Nothing else.

**These do NOT exist. Do not design them, not even greyed out:**

- ⛔ **Ratings, stars, reviews, testimonials** — no review system, this phase or the next
- ⛔ **Order counts, transaction volume, "X sold", response rate, response time**
- ⛔ **Discounts, sale prices, strikethrough pricing, coupons, deal countdowns**
- ⛔ **Trending / popular / most-searched categories** — no analytics pipeline computes these,
  and a taxonomy-led design reaches for them constantly. Ordering must come from something
  real: alphabetical, curated, or listing count.
- ⛔ **Personalised or "recommended for you"** — no recommendation engine
- ⛔ **Quotations / RFQ / negotiation** — deferred to a later phase (Bucket A)
- ⛔ **Escrow, payments, trade assurance, shipment tracking, buyer protection** — Phase 2. The
  current page's own header comment records that an earlier mockup claimed these and the copy
  had to be rewritten. **Do not reintroduce them.**
- ⛔ **Seller levels, gold/premium badges, sponsored placement** — no such concept
- ⛔ **Supplier counts per category** ("1,240 suppliers") — the number would be 0 or 1 nearly
  everywhere, and inventing it on a trust platform is the worst thing this page could do

**Price rendering.** Across the 12 live products: **6 INR · 3 USD · 1 ALL · 2 with no price**.
Design the price line to survive a range (`min`–`max`), a single value, **any of ~150 ISO
currencies**, and **"Price on request"** — a first-class case here, not an edge case.

**Goods vs services.** 7 goods, 5 services — services are ~40% of the catalogue ("Cloud
Migration & DevOps Retainer", "Custom AI/ML Model Development"). The taxonomy carries a `type`
flag on every category, so this direction can handle it structurally — but decide whether goods
and services are **separate top-level zones** or **mixed**, and say why. A card built around a
photograph and a unit price does not fit a service.

---

## 4 · 🔴 Trust — the rules are contractual, not stylistic

This platform's value proposition is **trust** — it stands between international buyers and
Indian exporters they have never met. Fabricating any trust signal is the most damaging thing
this redesign could do.

- ✅ **The verified tick comes from the server's derived `verified` boolean.** Nothing else.
- 🔴 **There is NO "unverified" badge, ever.** The tick's absence is the only signal. Never a
  grey tick, never "Verification pending", never a dimmed or lower-ranked card.
- 🔴 **An unverified seller's listings are fully public and rank normally.** No verified-only
  zone that implies the rest are second-class. 3 of 11 companies are verified.
- 🔴 **Never show raw verification status** (`kycStatus`) or any rejection state publicly. Only
  `verified` + `verifiedAt`.
- ✅ **Colour is never the only signal** — the tick needs a label or accessible name too.

"Human-verified exporters" is true and is the genuinely strong story: a person reads real
documents; it is not an automated stamp. Lead with that instead of borrowing the vocabulary of
marketplaces that have data we don't.

---

## 5 · Current shipped baseline — what exists today

`web/src/pages/public/Landing.jsx` (843 lines), built from a "royal blue premium landing"
mockup. Sections: Hero → trust strip → **Categories (real, live)** → How it works → Platform
tabs → Trust cards → Why cards → CTA band → FAQ → App CTA. Plus `FeaturedStrips`
(admin-curated, real products) and `NoImagePanel`.

There is also an existing **`/categories` page** and a **navbar category mega-menu** — both
already designed (`design-plans/m2/`). **Direction B overlaps them heavily.** Decide and state:
does the home page's taxonomy zone *replace* `/categories`, *preview* it, or *duplicate* it?
Three surfaces browsing the same tree in three different visual languages is the main risk of
this direction.

**Decisions already made — don't silently reverse them:**

- 🔴 The hero search is a **link to `/search`**, not an inline input. The owner decided this on
  2026-08-16, superseding two earlier behaviours the same day; `/search` has its own entrance
  animation and autofocus. **Direction B makes search the primary action, so this decision is
  under real pressure here — if your design needs a working input in the hero, argue it
  explicitly rather than just drawing it.**
- The **no-image placeholder is neutral, never tinted** (a coloured one was rejected).
- Copy was deliberately rewritten away from the original mockup because it advertised features
  that don't exist. Read the file's header comment before writing new copy.
- Store badges are "Coming soon"; the footer directory is static text — both logged in
  `docs/UiWebNotes.md`.
- The **app's buyer home** was redesigned in the marketplace direction (Aug 2026) with
  `Categories` + `Verified suppliers` + an endless product feed. If web goes taxonomy-led and
  app stays inventory-led, **they stop reading as the same product** — call that out as a
  consequence, with what you'd change in the app to match.

---

## 6 · States to design — all of them

- **Default (guest)** — the main deliverable
- **Signed in as buyer** and **as exporter** — header and CTAs differ; an exporter landing on
  `/` should not be sold a "Register as a supplier" band (`roleHome` helper exists)
- **Category with listings** vs **category with none** — the crux of §1; design both tile states
- **Loading** — skeletons, never spinners, never a blank screen (contractual)
- **Empty / error** — a zone whose fetch failed, without wrecking the page
- **No image** — 1 in 12 products; the neutral panel, not a tinted one
- **Long content** — a 60-character category name, a 90-character product name, a long company
  name. Dense taxonomy grids break on these first
- **Mobile (360px), tablet, desktop** — mobile-first. 🔴 **A 301-item taxonomy is the hardest
  thing on this page to make work on a 360px screen. Solve mobile first, not last.** Touch
  targets ≥ 44px; no horizontal body scroll.

---

## 7 · Non-negotiable constraints

- **SEO is contractual, and is this direction's biggest single advantage.** `/` must be
  indexable and server-renderable: one `<h1>`, semantic sections, real heading hierarchy,
  meaningful `alt`, canonical URL, and **real crawlable `<a href>` links to category pages** —
  not JS-only accordions that hide every link from a crawler. If a mega-menu or accordion is
  used, the links must exist in the served HTML.
- **WCAG AA is "done", not polish.** Keyboard-navigable end to end, visible focus, ≥ 4.5:1
  contrast, `prefers-reduced-motion`. 🔴 A large taxonomy is an accessibility trap: hover-only
  flyouts, unreachable nested lists and unlabelled disclosure buttons are the usual failures.
  Every group must be operable by keyboard and announced correctly.
- **Design-system tokens only** — no magic hex, no arbitrary px, radius from the scale above.
- **Reuse existing primitives** (Button, Card, Badge, the product card, `NoImagePanel`,
  `FeaturedStrips`, `PublicHeader`, `PublicFooter`). If you need a genuinely new primitive —
  likely a category tile — name it and say why.
- **Performance.** 301 categories is a lot of DOM and potentially a lot of images. Say what
  ships in the initial HTML and what loads later. Lazy-load below the fold; explicit
  dimensions or aspect-ratio so nothing shifts.
- 🔴 **No dead controls.** Every button and link either works or is visibly "coming soon" AND
  logged in `docs/UiWebNotes.md`. **List every non-operational element in your deliverable.**

---

## 8 · Open questions — flag your answer, don't silently pick one

1. **How do empty categories behave?** (§1 — the central question.)
2. **Full tree, or a curated subset that expands?** 301 items shown at once is a wall; 12 is a
   nav bar. Where is the line, and what's behind "see all"?
3. **Does the home taxonomy replace, preview or duplicate `/categories` and the mega-menu?** (§5)
4. **Goods and services — separate zones or mixed?** (§3)
5. **Does the hero get a real search input?** A settled decision says no (§5), and this
   direction pushes hardest against it.
6. **Do category tiles get imagery?** There is no category image in the data (§3). Commissioning
   301 images is a real cost; an icon or type-led system is cheaper but plainer.

---

## 9 · Deliverables

1. **Desktop home**, full page.
2. **Mobile (360px)** of the same — solved properly, not a squeezed desktop.
3. **The taxonomy zone in detail**: collapsed, expanded, a stocked category, an empty category.
4. **Signed-in buyer** and **signed-in exporter** variants (annotated deltas are fine).
5. **Section inventory** — ordered, each with its data source, minimum item count, behaviour
   below that count, and whether it can hide entirely.
6. **The product card** at goods, service, on-request price, no image, and long name.
7. **Every hex used**, confirmed against §⛔ COLOUR.
8. **Every radius used**, confirmed against §⛔ CORNERS.
9. **Every non-operational control**, listed (§7).
10. **Your answers to §8**, with reasoning.
11. **Anything you had to leave out** because the data doesn't exist (§3) — a non-empty list is
    expected and is more useful than a design that quietly invents the fields.

---

## Notes for whoever runs this prompt

Two failure modes to watch for in what comes back:

**The sitemap.** A taxonomy-led page done badly is a wall of blue links — accurate, complete,
and repellent. The whole design problem is making 301 items feel like an invitation rather than
an index. If the result looks like a footer directory blown up to full page, it failed.

**The quiet dodge on §1.** Most tools will render a beautiful grid of category tiles and never
address that 253 of them go nowhere. Check for it explicitly — it is the question this
direction exists to answer, and it is the easiest one to skip.

Judge Direction B against Direction A on one thing above all: **which one is still the right
page when the catalogue has 5,000 products?** A is designed to grow into that; B is designed to
survive today. The best answer may be B now with an explicit path to A.
