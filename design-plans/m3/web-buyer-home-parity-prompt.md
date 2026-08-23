# Prompt C — MPX Global web · Home rebuilt to MATCH the app's buyer home

> **This supersedes Directions A and B** (`web-landing-redesign-prompt.md`,
> `web-landing-redesign-prompt-B-taxonomy.md`). Those explored what a web marketplace home
> *could* be. The owner's decision (2026-08-23) is simpler: **the web home should be the app's
> buyer home.** One product, one design. Keep A and B only as reference for the trade-offs
> they document.
>
> Copy everything below into your design tool (v0 / Lovable / Galileo / Figma AI / Claude /
> Stitch).
>
> **The reference implementation is real, shipped code — read it before designing:**
> `app/src/screens/BuyerHomeScreen.jsx` (1,136 lines, and its 100-line header comment records
> every decision and why). Supporting: `app/src/components/SearchPill.jsx` ·
> `ProductCard.jsx` · `VerificationSummaryCard.jsx`.
> Web sources of truth: `web/tailwind.config.js` · `web/src/pages/public/Landing.jsx` ·
> `.claude/rules/web-design.md` · `m3-seo.md` · `m3-public-projection.md`.

---

## ⛔ COLOUR — hard rules, checked by arithmetic

**Deep ROYAL BLUE / NAVY. Not purple, not violet, not indigo, not pastel.** Mis-produced before
as `#8069BF`, a lavender.

```
#1A2E8F   navy  — brand/heading accents, FLAT fill, no gradient
#2A4DE0   blue  — buttons, links, active/focus states
```

Both must hold: **hue 226–232°** (brand pair: 230°, 228°) and **saturation ≥ 65%** (69%, 75%).

```
primary-50   #EAEEFF     ink-50   #F7F8FB     success  #12B76A (verified tick ONLY)
primary-100  #DEE1FF     ink-100  #F2F4F7     warning  #F79009 (locked token)
primary-200  #C3CBFF     ink-200  #E2E4EC     danger   #D92D20
primary-600  #2A4DE0     ink-400  #98A2B3     danger-50 #FEECEA
primary-700  #2340C4     ink-600  #5A6B85 (= "muted")
primary-800  #1A2E8F     ink-900  #000517
                          surface  #FFFFFF · border #C5C6CF
```

Rejected: purple/violet at any opacity · pastel/desaturated blue · Tailwind `gray/slate/zinc`
(ours is the blue-cast `ink` scale) · plain `#000000` · gradients, glows, glassmorphism on brand
surfaces · retail reds/oranges/yellows from consumer marketplaces.

Two shadow levels, never more: `shadow-card` (resting), `shadow-lift` (active/hover).

**List every hex you used and confirm each is in here.**

---

## ⛔ CORNERS — soft and rounded, one scale

**Nothing has a sharp corner.** Use exactly these four:

```
rounded-2xl   16px   large surfaces — cards, panels, banners, image tiles, modals
rounded-xl    12px   controls — buttons, inputs, the search pill, dropdowns, tabs
rounded-lg     8px   small chips — badges, tags, price pills, category labels
rounded-full         circular only — category tiles, company logos, avatars, icon buttons, tick
```

Nested corners step **down**, never up. **Banned:** square corners on any card or control ·
arbitrary values like `rounded-[20px]`, `rounded-[2rem]`, `rounded-[8px]` (these already exist
in the codebase — this scale is what stops that drift) · two components of the same kind with
different radii.

**List every radius you used and confirm each is in this scale.**

---

## 1 · 🔴 The routing problem — read this first, it changes what you're designing

**Web has no buyer home at all.** There is no `/buyer` route. `web/src/auth/roleHome.js`
sends a signed-in buyer to **`/buyer/verification`** — the KYC status page. A buyer logs into
the web platform and lands on a document-upload screen.

That is worth stating plainly, because it is the actual gap being closed: **on the app a buyer
lands in a marketplace; on web they land in paperwork.** And a buyer is fully active from
signup — verification gates nothing for them — so the paperwork isn't even blocking anything.

The app screen you are copying is a **signed-in buyer screen**. The web page you are designing
has to serve **three audiences on one URL**:

| Visitor | Today | What they need |
|---|---|---|
| Guest (not signed in) | Sees `/` — a marketing landing page | The marketplace, plus a reason to trust MPX |
| Signed-in buyer | Lands on `/buyer/verification` | Exactly the app's home |
| Signed-in exporter | Lands on `/exporter/verification` | Not to be sold "Register as a supplier" |

**Recommended answer** (state whether you agree): **`/` becomes this page for everyone**, with
sections switching on auth state — the verification card only for a signed-in buyer, the
"Register as Exporter" card only for a guest or buyer, marketing/trust content fuller for a
guest and trimmed for a signed-in buyer. Then `roleHome` sends a buyer to `/` instead of
`/buyer/verification`.

The alternative is a separate `/buyer` home, leaving `/` as marketing. That splits one design
into two pages and two maintenance paths. **Say which you chose and why.**

---

## 2 · The reference — what the app's buyer home actually is

Shipped 2026-08-21, rebuilt to the marketplace idiom ("like amazon myntra alibaba") against an
approved mockup. **Section order, top to bottom:**

1. **Brand-blue app bar** carrying a **search pill** and a profile shortcut. The bar scrolls
   away; a **sticky bar with the same pill** takes over. The pill carries a **✨ AI chip** —
   AI search is the one thing a buyer can't do on a rival marketplace, so it lives inside the
   control they already reach for.
2. **Categories** — a **4-across circular photo grid**, 7 tiles + an "All" tile, with an
   "All {n}+ ›" link. Labels are **one line with an ellipsis** (the owner's call after seeing a
   three-line version on device — even row heights beat complete names; the photo does most of
   the identifying).
3. **Promo carousel** — 3 slides, auto-advancing, swipeable, with dots.
4. **Verification summary card** — the buyer's only route to the KYC hub. Placed **below** the
   discovery surface deliberately: a buyer is fully active from signup and verification gates
   nothing for them, so it must not sit above the marketplace.
5. **Goods / Services split** — two cards of **equal weight**, both real filters.
6. **Verified suppliers** — a horizontal rail of company cards.
7. **Recently listed** — a **2-up grid**, not a rail (a rail hides most listings behind a
   swipe, and this is the surface a buyer browses), feeding an **endless scroll** that stops
   only when the catalogue runs out, ending on the honest line *"You've seen everything listed
   so far"*.
8. **"Want to sell on MPX Global?"** card with a *Register as Exporter* button.

**Visual system:** **grey page, white blocks** — sections are separated by the ground colour
rather than by a border on each one. **Exactly one coloured band** (the AI band, solid navy —
not a gradient, because a gradient would have meant adding a dependency for a visual, and
spending the effect twice would make neither read as special).

**Data it loads** — all public endpoints the web app already uses:

```
catalogueApi.tree()                                                    → categories
catalogueApi.search({ type:'product',  sort:'newest', pageSize:10 })   → recently listed (paged)
catalogueApi.search({ type:'supplier', sort:'newest', verifiedOnly:true, pageSize:8 })
organisationApi.mine()  +  kyc status                                  → the verification card
```

---

## 3 · 🔴 What must change on web — the app design does NOT port 1:1

Do not simply widen the phone layout. Six things genuinely differ:

**a · Widths.** A 4-across circular grid is right at 360px. On a 1440px desktop it is four
enormous circles. Decide the count per breakpoint (mobile / tablet / desktop) and whether the
"All" tile stays last in the grid or becomes a header link. Same for the 2-up product grid —
2-up on desktop wastes most of the screen.

**b · Endless scroll.** On the app it's a `FlatList` that virtualises. On web, infinite scroll
**hurts SEO and keyboard/screen-reader users**, and this page must be indexable (§5). Prefer a
**"Load more" button**, or infinite scroll *with* a real paginated fallback in the served HTML.
🔴 **Never a footer that recedes forever** — the page has a sell card and a real footer below
the feed.

**c · The horizontal supplier rail.** Touch-swipe is free on mobile; on desktop it needs
**visible arrows, keyboard operation and focus handling**. A rail that can only be reached by
dragging is inaccessible. Consider a grid on desktop and a rail only on mobile.

**d · Two "coming soon" controls become REAL on web.** The app had to fake both; web doesn't:

- **Search pill →** `/search` already exists, with its own entrance animation and autofocus.
  This also matches the settled web decision (2026-08-16) that the home search is a **link to
  `/search`, not an inline input** — the app's pill is a button that navigates, so the two
  designs already agree. **Do not turn it into a working input** without arguing the case.
- **✨ AI chip →** `/ai-search` exists.
- **"Register as Exporter" →** `/signup/exporter` exists. On the app this button shows a
  "coming soon" message because there's no in-app path from a signed-in buyer to exporter
  signup. **On web it is a real link.** Design it as a live control.

**e · The carousel needs accessibility work.** Auto-advance must pause on hover and focus, be
stoppable, respect `prefers-reduced-motion`, and its slides must be keyboard-reachable. The
app version auto-advances and pauses when the tab loses focus — carry the intent, not the
implementation.

**f · Guest state.** The app screen has no guest — you're always signed in. On web, most
visitors are guests, and this is the page Google indexes. Decide what a guest sees in place of
the verification card and the profile shortcut, and how much of today's trust/marketing content
survives below the marketplace (§5).

---

## 4 · 🔴 Copy and data — the app already made these calls honestly. Keep them.

The app screen's header comment records two copy changes made because the mockup's text wasn't
true of this product. **Both apply on web:**

- ⛔ **"Top-rated global partners" → "Verified by our team."** *No rating or review system
  exists* — there is nothing to rate suppliers on.
- ⛔ **"Join thousands of verified exporters" → "Join verified exporters."** The platform
  hasn't shipped long enough to honestly claim "thousands" of anything.

**These do not exist anywhere in the system. Do not design them, not even greyed out:**
ratings/stars/reviews · order counts, "X sold", response rate/time · discounts, sale prices,
strikethrough pricing, deal countdowns · trending/bestselling/most-viewed (no analytics
pipeline computes them) · "recommended for you" (no recommendation engine) · quotations/RFQ
(deferred) · escrow, payments, trade assurance, shipment tracking, buyer protection (Phase 2 —
and `Landing.jsx`'s own header records that an earlier mockup claimed these and the copy had to
be rewritten) · seller levels, gold/premium badges, sponsored placement · **user avatars**
(checked: `User` and `Organisation` have no avatar field — the app uses an icon in a circle).

**The real catalogue (production, 2026-08-23) — design against these numbers:**

```
12    live products    ·  11 have an image  ·  7 goods / 5 services
8     categories contain any product        ·  301 categories exist (261 leaf)
11    exporter companies  ·  3 verified  ·  3 with a logo
prices: 6 INR · 3 USD · 1 ALL · 2 with no price at all
```

**Goods and services get equal weight** — that is why the app's split card is 50/50. The live
catalogue is currently *mostly services* (web development, DevOps retainers, marketing)
alongside the fabric. A layout that assumes goods misrepresents the platform to its first
buyers, and a product card built around a photo and a unit price does not fit "Cloud Migration
& DevOps Retainer".

**Price line must survive**: a range (`min`–`max`), a single value, **any of ~150 ISO
currencies**, and **"Price on request"** — a first-class case here, not an edge case.

**Sparse-catalogue rule:** every rail and grid must be **self-sizing** and able to **hide
itself entirely** — the app screen already does this (each section renders only when its array
is non-empty). At 12 products a fixed 6-slot desktop rail renders four holes.

---

## 5 · 🔴 Trust — contractual, not stylistic

- ✅ The verified tick comes from the server's derived **`verified` boolean**. Nothing else.
- 🔴 **There is NO "unverified" badge, ever.** The tick's absence is the only signal. Never a
  grey tick, never "Verification pending", never a dimmed or lower-ranked card.
- 🔴 An unverified seller's listings are **fully public and rank normally**.
- 🔴 **Never show raw `kycStatus`** or any rejection state on a public page. The one legitimate
  exception is the signed-in buyer's **own** verification card — that is a self-scoped read of
  your own organisation, and it renders every status including rejected.
- ✅ Colour is never the only signal — the tick needs a label or accessible name.

---

## 6 · SEO and accessibility — both contractual

- `/` must stay **indexable and server-renderable**: one `<h1>`, semantic sections, real
  heading hierarchy, meaningful `alt` on every image, canonical URL. Content that only appears
  after a client-side fetch doesn't get indexed — say what ships in the served HTML.
- **WCAG AA is "done", not polish**: keyboard-navigable end to end, visible focus states,
  ≥ 4.5:1 contrast, `prefers-reduced-motion` respected. The carousel, the supplier rail and
  the infinite feed are the three places this page will fail — solve all three.
- Touch targets ≥ 44px; no horizontal body scroll; wide rails scroll inside their own container.
- Images through **Cloudinary**, sized correctly, lazy-loaded below the fold, with explicit
  dimensions or aspect-ratio so nothing shifts.

---

## 7 · States to design

- **Guest**, **signed-in buyer**, **signed-in exporter** (§1)
- **Loading** — skeletons, never spinners, never a blank screen (contractual)
- **Empty** — per section, and the near-empty whole-page case
- **Error** — a section whose fetch failed, without wrecking the page
- **No image** — 1 in 12 products; the neutral placeholder, **never tinted** (a coloured one
  was explicitly rejected on `/categories`)
- **Feed end** — the honest "You've seen everything listed so far" line
- **Long content** — 90-character product name, long company name, long category label
- **Mobile 360px · tablet · desktop** — mobile-first

---

## 8 · Constraints

- **Design-system tokens only** — no magic hex, no arbitrary px, radius from §⛔ CORNERS.
- **Reuse existing web primitives**: Button, Card, Badge, the product card, `NoImagePanel`,
  `FeaturedStrips`, `PublicHeader`, `PublicFooter`. If you need a genuinely new primitive
  (category circle, supplier mini-card), name it and say why.
- **No new dependency** for a visual effect. The app deliberately used a solid navy band rather
  than add a gradient library — hold the same line.
- 🔴 **No dead controls.** Every button and link either works or is visibly "coming soon" AND
  logged in `docs/UiWebNotes.md`. **List every non-operational element in your deliverable.**
- **Web and app must read as the same product.** Where you deviate, deviate deliberately and
  say so — accidental divergence is the thing this brief exists to remove.

---

## 9 · Open questions — answer them, don't silently pick

1. **`/` for everyone, or a separate `/buyer` home?** (§1 — recommendation given.)
2. **Does `roleHome` change** so a buyer lands here instead of on the KYC page?
3. **How much of today's marketing content survives**, and does a signed-in buyer see less of
   it than a guest?
4. **Grid counts per breakpoint** for the category circles and the product grid.
5. **Infinite scroll or "Load more"?** (§3b — "Load more" is recommended for SEO and a11y.)
6. **Supplier rail on desktop — rail with arrows, or grid?**

---

## 10 · Deliverables

1. **Desktop** home, full page — guest and signed-in buyer.
2. **Mobile (360px)** and **tablet** of the same.
3. **Signed-in exporter** variant (annotated delta is fine).
4. **Section inventory** — ordered, each with data source, minimum item count, behaviour below
   that count, whether it can hide, and how it differs from the app.
5. **The product card** at goods, service, on-request price, no image, long name.
6. **The category circle** and **supplier card** at all breakpoints.
7. **Every hex**, confirmed against §⛔ COLOUR.
8. **Every radius**, confirmed against §⛔ CORNERS.
9. **Every non-operational control**, listed.
10. **Answers to §9**, with reasoning.
11. **A diff list against the app** — every place web deviates, and why.

---

## Notes for whoever runs this prompt

The app screen is **shipped, iterated code with a written record of why each decision was
made** — it has already survived the owner's review on a real device, twice. Treat it as the
specification, not as inspiration. When a tool "improves" something, check the app file's
header comment first: several of the obvious improvements (three-line category labels, a
"Top-rated suppliers" rail, putting verification at the top, a gradient AI band) were
considered and rejected there for stated reasons.

The two places a tool will most likely go wrong: **porting the phone layout to desktop
unchanged**, and **quietly reintroducing ratings** — the words "top-rated" and star glyphs are
so standard in marketplace design that they come back on their own.
