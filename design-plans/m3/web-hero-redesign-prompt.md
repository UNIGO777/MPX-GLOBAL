# Prompt — MPX Global web · HERO SECTION redesign (`/`, above the fold)

> Copy everything below into your design tool (v0 / Lovable / Galileo / Figma AI / Claude /
> Stitch).
>
> **Scope: the hero panel only.** Not the header, not the category rail beside it, not the
> sections below. Everything else on the page stays exactly as it is — this is a redesign of one
> block, and a proposal that quietly restyles its neighbours cannot be used.
>
> Current implementation: `web/src/pages/public/Landing.jsx` (search for "Banner. One h1").
> Tokens: `web/tailwind.config.js`. Standards: `.claude/rules/web-design.md` · `m3-seo.md` ·
> `m3-public-projection.md`.

---

## 1 · 🔴 What the hero actually IS — read this before drawing

**It is not a full-bleed banner.** It is the middle column of a three-column zone:

```
┌──────────┬───────────────────────────────┬────────────┐
│ category │          THE HERO             │ contextual │
│   rail   │      ← you design this →      │   panel    │
│  240px   │              1fr              │   320px    │
└──────────┴───────────────────────────────┴────────────┘
      lg: rail + hero only          xl: all three
     below lg: hero full width, rail and panel drop below
```

Consequences you must design around, because they are what make this hero unusual:

- **Its width changes a lot.** At `xl` on a 1440px screen it is roughly 700–800px wide; below
  `lg` it is the full viewport. It is never a 1920px cinematic banner.
- **It sits inside page padding**, as a rounded panel on a light grey page — it has edges. It is
  a card, not a backdrop.
- **The right-hand contextual panel already carries the signup CTA** for a guest, the
  verification status for a signed-in buyer, and listing shortcuts for an exporter. **Do not
  duplicate any of that inside the hero.** It is right there, one column over.

---

## 2 · Colour — and one thing that will look wrong to you

```
Panel fill      ink-900    #000517   ← the hero is BLACK
Accent          crimson-600 #CE061A  ← the brand red under trial
                crimson-300 #FA808D  (accent text on black)
                crimson-700 #AE0416  (links on white, hover)
Text on black   white · ink-200 #E2E4EC (body) · ink-400 #98A2B3 (quiet)
Page behind it  ink-50     #F7F8FB
```

⚠️ **The wordmark above the hero is still ROYAL BLUE.** The site is mid-trial: the landing page
was switched from blue to crimson, and the logo, the mobile app, the admin console and every
other page are still blue. So a blue wordmark sits above a black-and-red hero. **This is known
and is not yours to fix** — do not restyle the logo, and do not propose a design that only works
once the logo is red.

**Hard colour rules:** use only the hex values above · no gradients, glows or glassmorphism on
the panel · never pure `#000000` (the black is `#000517`) · `danger` red (#D92D20) is the error
colour and must never appear as decoration · no colour outside these tokens without saying why.

**Corners:** `rounded-2xl` (16px) the panel and any large surface · `rounded-xl` (12px) controls ·
`rounded-lg` (8px) chips · `rounded-full` circles only. Nested corners step **down**, never up.
No arbitrary radii.

---

## 3 · What has already been tried, and what happened

Do not re-propose these. Each was built and judged.

| Version | Outcome |
|---|---|
| Phone-idiom hero ported from the app (search pill, stacked blocks) | ❌ Rejected: *"it's looking like we are opening app in web"* |
| Royal-blue panel, single column, text capped at `max-w-xl` | ❌ Left roughly half the panel as empty colour on any wide screen |
| Black panel, same single column | ❌ Same emptiness, now in black |
| Black panel + flat 2×2 grid of product photos on the right | ❌ Read as wallpaper — decoration, not information |
| Black panel + staggered cluster (one tall card with real seller/price/tick + two squares) | ← **current**, the baseline you are improving on |

**The recurring failure is the right-hand half of the panel.** Every version so far has either
left it empty or filled it with something decorative. That is the problem to solve.

---

## 4 · Content — what exists, and what does not

**Currently in the hero, all of it real:**

- A badge: *"Every tick checked by a person"* (shield icon)
- `<h1>` — *"Source from verified Indian exporters"*
- A subhead about goods and services, enquiries and chat, free to browse
- Two buttons: **Browse categories** (white, solid) and **Describe what you need** (outline, → AI search)
- Right side: three real recent listings, the tall one showing its seller name, verified tick and price

**Data you may use** — all already fetched by the page, so it costs no extra request:

- **Recent listings**: name · slug · image URLs · category (+ goods/service) · price
  `{ mode, min, max, currency }` · MOQ (goods only) · seller name, slug, country, logo, and a
  **`verified` boolean**
- **Categories**: name · slug · **image** (a real photo — 292 of 301 have one)

**⛔ These do not exist anywhere in the system. Do not design them, not even greyed out:**
ratings, stars, reviews, testimonials · order counts, "X sold", transaction volume, response
rate or time · trending / bestselling / most-viewed · supplier or buyer counts ("500+ verified
suppliers") · years-in-business or awards · trust-seal logos · escrow, payments, buyer
protection, shipment tracking (all Phase 2) · press or "as seen in" logos · customer avatars.

🔴 **This is the single most likely way a proposal fails.** A B2B hero conventionally carries a
counter and a row of trust seals; here every one of those numbers would be invented. **Produce
authority without a single fabricated figure.** If a section you want needs one, say so instead
of inventing it.

**Two true things you may lean on, and they are the strongest cards in the deck:**

1. **Verification is done by a person reading real documents.** Not an algorithm, not a
   rubber stamp. Competitors cannot say this honestly.
2. **AI search understands plain language** — *"selvedge denim, 100 m, under $4"*. This is the
   one thing a buyer cannot do on a rival marketplace.

**Price rendering, if you show a price:** print the **ISO currency code exactly as the seller
set it** — `INR 220`, `USD 3.40`, `ALL 2,000`. **Never a ₹ symbol, never converted, never
guessed**: there is no currency conversion in this phase. **"Price on request"** is a first-class
case (2 of 12 listings), rendered as ordinary information, never as an absence or an error.

---

## 5 · Trust rules — contractual, not stylistic

- ✅ The verified tick is rendered **only** from the server's `verified` boolean.
- 🔴 **There is NO "unverified" badge, ever.** The tick's absence is the only signal. No grey
  tick, no "pending", no dimmed card.
- 🔴 An unverified seller's listings are **fully public and rank normally** — 9 of 12 live
  listings are from unverified sellers, so a hero that shows only verified ones is not
  representative.
- 🔴 Never show raw verification status or any rejection state.
- ✅ Colour is never the only signal — the tick needs a label or accessible name.

---

## 6 · The catalogue is small — design for that, not around it

```
12   live products   ·  11 have a photo  ·  7 goods / 5 services
3    verified companies out of 11
301  categories, but only 8 contain any product
```

Anything you put in the hero must **still look deliberate with three photographed listings**,
and must **hide itself entirely** rather than render a layout with holes when there are fewer.
That is how every other block on this page behaves.

Show your design **twice**: once with the real 12-product catalogue, once with a full one.

---

## 7 · Non-negotiable constraints

- **One `<h1>` on the page and it lives in this hero.** Keep it a real heading, not an image.
- **Server-rendered and indexable.** Content that only appears after a client-side fetch does
  not get indexed, so the headline, subhead and buttons must be in the served HTML. Real
  listings may load in.
- **WCAG AA.** Text on the black panel must clear 4.5:1 — white and `ink-200` do. Keyboard
  navigable, visible focus on the dark panel (a default focus ring disappears on black —
  specify one), `prefers-reduced-motion` respected. Any carousel must be pausable and
  keyboard-operable.
- **No new dependency for a visual effect.** The app deliberately used a solid navy band rather
  than add a gradient library; hold the same line.
- **Images through Cloudinary**, lazy below the fold but the hero's own are above it, explicit
  width/height or aspect-ratio so nothing shifts. Layout shift is the characteristic way a
  hero fails.
- 🔴 **No dead controls.** Everything either works or is visibly "coming soon" AND logged in
  `docs/UiWebNotes.md`. List any non-operational element in your deliverable.

---

## 8 · States to design

- **Guest** (the main case) · **signed-in buyer** · **signed-in exporter** — say what changes.
  Remember the contextual panel next door already handles account state; the hero may not need
  to change at all, and "it stays the same" is a valid, defensible answer.
- **Loading** — what occupies the right side before the listings arrive. Skeleton, never a
  spinner, never a blank hole, never a layout jump when they land.
- **Too few listings** — the hero with nothing to show on the right.
- **Long content** — a 90-character product name, a long company name.
- **Mobile 360px · tablet · desktop 1440 · wide 1920.** Mobile is where the hero is full width
  and the side content currently disappears entirely — decide whether that is right.

---

## 9 · Deliverables

1. The hero at **1440** and at **1920**, in place (show the rail and panel beside it as grey
   boxes so the proportions are honest).
2. **Mobile 360px** and **tablet**.
3. **Loading** and **too-few-listings** states.
4. **Every hex used**, confirmed against §2.
5. **Every radius used**, confirmed against §2.
6. Any **non-operational control**, listed.
7. **What you would put on the right-hand side and why** — this is the actual brief (§3).
8. **Anything you had to leave out** because the data does not exist (§4). A non-empty list is
   expected and is more useful than a design that quietly invents the fields.

---

## Notes for whoever runs this prompt

Judge every candidate on three questions, in this order:

1. **Does the right-hand half earn its space?** Every rejected version failed here.
2. **Is there a single invented number, rating or seal?** If yes, it fails §4 outright — the
   trust story is the product, and faking it is worse than a plain hero.
3. **Render it with three listings.** If it looks broken, it fails, however good the
   full-catalogue version looks.

Expect the first result to come back with "10,000+ Verified Suppliers", five gold stars and a
row of certification badges. That is what a B2B hero looks like in every training set. None of
it is true here.
