# Prompt — MPX Global web · Home / landing redesign into a MARKETPLACE home (`/`)

> Copy everything below into your design tool (v0 / Lovable / Galileo / Figma AI / Claude /
> Stitch). This is a **REDESIGN of an already-shipped, already-iterated page** — not a first
> design. Read §5 (current shipped baseline) and §6 (the real catalogue) before proposing
> anything, so you're departing from real decisions deliberately rather than rediscovering
> them by accident.
> Sources of truth: live tokens `web/tailwind.config.js` · the current implementation
> `web/src/pages/public/Landing.jsx` · `.claude/rules/web-design.md` (responsive/a11y/SEO
> standards every public page here is held to) · `.claude/rules/m3-seo.md` ·
> `.claude/rules/m3-public-projection.md` (what a public response may contain).

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

Also rejected: any purple/violet at any opacity · pastel/desaturated blue · Tailwind default
`gray/slate/zinc` (ours is the blue-cast `ink` scale) · plain `#000000` · gradients, glows or
glassmorphism on brand surfaces.

Two shadow levels exist, never more: `shadow-card` (resting) and `shadow-lift` (active/hover).

**Before delivering, list every hex you used and confirm each one is in here.**

---

## ⛔ CORNERS — soft and rounded, on a fixed scale

**Nothing on this page has a sharp corner.** The look is soft and rounded throughout — but
rounded on ONE scale, not a different radius per component. Use exactly these four:

```
rounded-2xl   16px   large surfaces — cards, panels, banners, image tiles, modals
rounded-xl    12px   controls — buttons, inputs, search bar, dropdowns, tabs
rounded-lg     8px   small chips — badges, tags, price pills, category labels
rounded-full         circular only — avatars, company logos, icon buttons, the verified tick
```

Nested corners step **down**, never up: a `rounded-2xl` card holds a `rounded-xl` button, which
may hold a `rounded-lg` chip. An image that fills a card edge-to-edge takes the card's radius,
not its own.

**Banned:** sharp/square corners on any card, panel or control (`rounded-none`) · arbitrary
values like `rounded-[20px]`, `rounded-[2rem]`, `rounded-[8px]` — these already exist in the
codebase and are exactly the drift this scale exists to stop · a different radius for two
components of the same kind · `rounded-3xl` or larger on anything but a full-bleed hero panel.

**Before delivering, list every radius you used and confirm each one is in this scale.**

⚠️ **Do not import Myntra's or Alibaba's palette along with their layout.** Those homes are
built on saturated retail reds, oranges and yellows tuned for impulse buying. Take the
*structure* from them — the *colour* stays the MPX royal blue above. A discount-red "SALE"
band on a B2B trade platform reads as a scam, not as energy.

---

## 1 · What you are designing

The **public home page at `/`** — the first screen a logged-out visitor sees, and the page
Google indexes. Today it is a **SaaS marketing landing page**. The owner wants it to feel like
a **marketplace home** — Myntra, Amazon, Alibaba, IndiaMART.

**The actual change being asked for** is an inversion of what the page leads with:

| | Today (marketing page) | Target (marketplace home) |
|---|---|---|
| Above the fold | A promise ("Find verified Indian exporters") | Search + real categories + real listings |
| Body | 9 sections explaining the platform | Merchandising rails of actual inventory |
| Product content | One strip, far down | The primary substance of the page |
| Reads as | A brochure about a marketplace | A marketplace |

The visitor should be able to **start shopping in the first screenful** rather than read about
shopping. Marketing sections don't disappear — they move **below** the merchandise and shrink.

**Audience:** international buyers (mostly outside India) sourcing from Indian exporters.
Not consumers. They arrive to source a product, not to browse for pleasure — so the design
borrows the *density and directness* of a marketplace home, not its impulse-retail theatrics.

---

## 2 · 🔴 THE CENTRAL DESIGN PROBLEM — read this before you draw anything

**The catalogue is nearly empty. This is the single most important constraint in this brief,
and it is the one a Myntra-style design will get wrong by default.**

Real production numbers (2026-08-23):

```
12    live products          (not 12,000 — twelve)
11    of those have an image
7     goods · 5 services     (~40% of the catalogue is services, not goods)
8     categories contain any product at all — out of 301 categories (261 leaf)
11    exporter companies · 3 verified · 3 have uploaded a logo
```

Currency spread across those 12: **6 INR · 3 USD · 1 ALL · 2 with no price at all.**

Myntra and Alibaba homes are **merchandising engines for millions of SKUs**. Every pattern
they use — 6-across rails, "Trending now", "Top picks", infinite category grids, "10,000+
sellers" — assumes abundance. Apply those patterns to 12 products and the page renders as a
row of two cards followed by four empty slots, a category grid of 253 dead tiles, and a
"Verified suppliers" rail containing three companies.

**A sparse marketplace home looks broken. A brochure looks deliberate. That is why the page
is a brochure today — this is not an oversight you are correcting, it is a trade-off you are
re-opening.**

So the real brief is: **design a marketplace home that looks intentional at 12 products and
still works at 12,000.** Concretely, that means:

- **Every rail is self-sizing.** A section with fewer than N items must render as a
  deliberately smaller layout — not as a fixed 6-slot grid with holes. Say what N is per
  section and what the layout does below it.
- **Every section can hide itself entirely.** Design what the page looks like with sections
  absent, and pick an order that survives that. The page must never bottom out into an
  awkward gap.
- **Categories are driven by categories that HAVE products**, never by the full 301-item tree.
  Design the tile for a category with a product image and for one with nothing yet.
- **No count-based bragging.** "500+ suppliers", "10,000 products", "trusted by 200 buyers" —
  every one of these is currently a lie, and they are the first thing marketplace homes reach
  for. See §4.
- Show your design **twice**: once with the real 12-product catalogue, once with a full one.
  A design that only looks good in the full state has not solved the brief.

---

## 3 · Content & data — the real shape, don't invent fields

Everything on this page comes from **public, unauthenticated API responses**, which are
whitelist-projected. If a field isn't listed here, **it does not exist** and you may not design
with it.

**A product gives you:** name · slug · one or more image URLs (or none) · category (name +
type: `goods` | `service`) · price as `{ mode, min, max, currency }` where mode may be
`on_request` (no numbers at all) · MOQ (goods only) · the selling company's name, slug, country,
logo (often null) and its **`verified` boolean + `verifiedAt`**.

**A company gives you:** name · slug · country · logo (often null) · description ·
`verified` + `verifiedAt`. Nothing else is public.

**These do NOT exist anywhere in the system. Do not design them, not even greyed out:**

- ⛔ **Ratings, stars, reviews, testimonials** — no review system exists, in this phase or the next
- ⛔ **Order counts, transaction volume, "X sold", response rate, response time**
- ⛔ **Discounts, sale prices, strikethrough pricing, coupons, deal countdowns, "limited stock"**
- ⛔ **Trending / bestselling / most-viewed** — no analytics pipeline exists to compute them
- ⛔ **Personalised or "recommended for you" rails** — no recommendation engine
- ⛔ **Quotations / RFQ / negotiation** — deferred to a later phase (Bucket A)
- ⛔ **Escrow, payments, trade assurance, shipment tracking, buyer protection** — Phase 2,
  and the current page's own header comment records that an earlier mockup claimed these and
  had to be rewritten. **Do not reintroduce them.**
- ⛔ **Seller "levels", gold/premium badges, sponsored placement** — no such concept

This list is most of what makes a marketplace home feel like a marketplace home, which is
exactly why it's stated so bluntly. **Your job is to produce marketplace density and
directness using only the fields above.** If that turns out to be impossible for a section
you want, say so in your deliverable instead of inventing the field.

**Ordering.** Rails must be ordered by something that actually exists — newest first,
category, or an admin-curated "featured" flag (a `FeaturedStrips` component already exists and
is admin-controlled). Never by a metric that isn't computed.

**Price rendering.** With INR, USD and ALL in one rail and two items with no price at all,
a naive "₹1,299" card breaks immediately. Design the price line to handle, without looking
broken: a range (`min`–`max`), a single value, **any of ~150 ISO currencies**, and
**"Price on request"** — which is a first-class case here, not an edge case.

**Goods vs services.** ~40% of the catalogue is services ("Cloud Migration & DevOps Retainer",
"Custom AI/ML Model Development"). A card built around a photograph and a unit price does not
fit a service. Either the card handles both convincingly, or you design two card variants and
say when each is used. **Do not design a goods-only home and leave services to fall through it.**

---

## 4 · 🔴 Trust, and the trap in "make it like a marketplace"

This platform's entire value proposition is **trust** — it sits between international buyers
and Indian exporters they have never met. Marketplace homes are dense with **trust theatre**:
star ratings, "verified by X", buyer-protection badges, transaction counts, "join 50,000
businesses". None of it exists here (§3), and **fabricating any of it on a trust marketplace
is the most damaging thing this redesign could do.**

The rules, which are contractual and not stylistic:

- ✅ **The verified tick is shown from the server's derived `verified` boolean.** Nothing else.
- 🔴 **There is NO "unverified" badge, ever.** The absence of the tick is the only signal.
  Never a grey tick, never "Verification pending", never a dimmed or lower-ranked card for an
  unverified seller.
- 🔴 **An unverified seller's listings are fully public and rank normally.** Do not design
  verified-only rails that imply the rest are second-class. With 3 verified of 11 companies,
  a "Verified suppliers" rail is both thin and lopsided — decide whether it earns its place.
- 🔴 **Never show raw verification status** (`kycStatus`) or any rejection state on a public
  page. Only `verified` + `verifiedAt`.
- ✅ **Colour is never the only signal.** The tick needs a label or accessible name too.

**Every trust claim on this page must be one a lawyer could defend.** "Human-verified
exporters" is true and is the genuinely strong story — verification here is a person reading
real documents, not an automated stamp. Lead with what's true rather than borrowing the
vocabulary of a marketplace that has data we don't.

---

## 5 · Current shipped baseline — what exists today

`web/src/pages/public/Landing.jsx` (843 lines), built from a "royal blue premium landing"
mockup. Section order today:

1. **Hero** (`primary-50`) — headline, subhead, a search box that is a **link to `/search`**,
   a "Browse 40 categories →" link, and a match panel showing **real listings**
2. Trust strip (thin, white)
3. **Categories** (`#categories`) — real, live category cards
4. How it works (`#how-it-works`) — buyer/seller journeys, 4 steps each
5. Platform tabs (`#platform`) — AI Search · Verified Sellers · Real-Time Chat · Catalogue
6. Trust cards (3)
7. Why cards
8. CTA band (navy)
9. FAQ (`#faq`)
10. App CTA

Plus `FeaturedStrips` (admin-curated, real products) and `NoImagePanel`.

**Decisions already made here — don't silently reverse them:**

- 🔴 The hero search is a **link to `/search`**, not an inline search box. The owner decided
  this on 2026-08-16, superseding two earlier behaviours the same day. `/search` has its own
  entrance animation and autofocus. **If your design puts a working search input in the hero,
  you are re-opening a settled decision — call it out explicitly rather than just drawing it.**
- The **no-image placeholder is neutral, never tinted** (a coloured one was rejected).
- Copy was deliberately rewritten away from the original mockup because it advertised features
  that don't exist. Read the file's header comment before writing new copy.
- Store badges are "Coming soon"; the footer directory is static text. Both are logged in
  `docs/UiWebNotes.md`.
- The **app's buyer home was redesigned in this same marketplace direction** (Aug 2026) and
  ships sections `Categories` and `Verified suppliers` plus an endless product feed. **Web and
  app should read as the same product.** Look at `app/src/screens/BuyerHomeScreen.jsx` before
  designing — deliberate divergence is fine, accidental divergence is not.

---

## 6 · States to design — all of them, not just the happy path

- **Default (guest)** — the main deliverable, at both catalogue sizes (§2)
- **Signed in as a buyer** and **as an exporter** — the header and CTAs differ; an exporter
  landing on `/` should not be sold a "Register as a supplier" band. There is a `roleHome`
  helper; say what changes and what stays
- **Loading** — skeletons, never spinners, never a blank screen (contractual)
- **Empty** — per section, and the whole-page case where almost nothing is available
- **Error** — a rail whose fetch failed, without wrecking the page
- **No image** — 1 in 12 products today; the neutral panel, not a tinted one
- **Long content** — a 90-character product name, a long company name, a category with a
  very long label. These break marketplace grids first
- **Mobile (360px), tablet, desktop** — mobile-first; touch targets ≥ 44px; no horizontal
  body scroll; wide rails scroll inside their own container

---

## 7 · Non-negotiable constraints

- **SEO is contractual.** `/` must be indexable and server-renderable: one `<h1>`, semantic
  `<section>`s, real heading hierarchy, meaningful `alt` on every image, canonical URL, and
  no content that only appears after a client-side fetch. **A personalised, JS-assembled
  Myntra home fights indexability** — where you need a trade-off, name it.
- **WCAG AA is "done", not polish.** Keyboard-navigable end to end, visible focus states,
  ≥ 4.5:1 contrast, `prefers-reduced-motion` respected. Carousels are the usual failure
  point: if you use one, it must be keyboard-operable, pausable, and not the only route to
  its content.
- **Design-system tokens only** — no magic hex or arbitrary px. A new colour goes into
  `tailwind.config.js` once, and needs a reason.
- **Reuse the existing primitives** (Button, Card, Badge, the product card, `NoImagePanel`,
  `FeaturedStrips`, `PublicHeader`, `PublicFooter`). Two buttons that differ by accident is a
  bug. If you need a genuinely new primitive, name it and say why.
- **Images via Cloudinary**, correctly sized, lazy-loaded below the fold, with explicit
  dimensions or aspect-ratio so nothing shifts. A marketplace home is image-heavy — layout
  shift is the characteristic way these pages fail.
- **Performance.** The home page is the first impression and often on a slow international
  connection. Don't add a carousel library, an icon set or an animation framework for one
  effect.
- 🔴 **No dead controls.** Every button and link either works or is visibly "coming soon" AND
  logged in `docs/UiWebNotes.md`. A live-looking control that silently does nothing is
  forbidden. **List every non-operational element in your deliverable.**

---

## 8 · Open questions — flag your answer, don't silently pick one

1. **Does the marketing content stay on `/`, move to an `/about`, or shrink to a strip?**
   Today it is ~80% of the page. A marketplace home would cut it hard — but this platform still
   has to *explain itself* to a first-time international buyer who has never heard of MPX.
   That tension is the crux of this redesign. State your position and your reasoning.
2. **Does the hero become a real search input?** §5 says a settled decision says no. If your
   design needs one, argue it — don't just draw it.
3. **Does a "Verified suppliers" rail earn its place at 3 of 11 companies?** And what does it
   become at 300 of 1,100?
4. **How much density is right?** Alibaba's home is extremely dense; Myntra's is image-led.
   For a B2B buyer sourcing cotton fabric, which serves better — and why?

---

## 9 · Deliverables

1. **Desktop home**, full page, at **both** catalogue sizes (real 12-product state and a
   populated state). Both are required.
2. **Mobile (360px)** of the same.
3. **Signed-in buyer** and **signed-in exporter** variants (may be annotated deltas).
4. **Section inventory** — ordered list of sections, each with: its data source, its minimum
   item count, what it does below that count, and whether it can hide entirely.
5. **The product card** at goods, service, on-request price, no image, and long name.
6. **Every hex used**, confirmed against §⛔.
7. **Every non-operational control**, listed (§7).
8. **Your answers to §8**, with reasoning.
9. **Anything you had to leave out** because the data doesn't exist (§3) — this list is
   expected to be non-empty and is more useful than a design that quietly invents the fields.

---

## Notes for whoever runs this prompt

The hard part of this brief is **§2**, not the visual styling. Most tools will return a
polished Alibaba clone with rating stars, "Trending Now", "Top Ranking Products" and a
"50,000+ Suppliers" counter — every one of which is either a fabricated metric or a feature
that doesn't exist. When that comes back, don't patch it section by section: the tool has
designed for a catalogue that isn't there, and the layout won't survive being emptied out.

Judge any candidate design by one test first: **render it with 12 products and 8 non-empty
categories. If it looks broken, it failed the brief**, however good the full-catalogue version
looks.
