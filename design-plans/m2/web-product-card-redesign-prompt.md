# Prompt — MPX Global web · Product card redesign — 5+ PREMIUM directions to choose from (M2 · `ProductCard`)

> Copy everything below into your design tool (v0 / Lovable / Galileo / Figma AI / Claude /
> Stitch). This is a **card gallery, not a single redesign** — deliver **at least 5 genuinely
> different directions** for the same component, shown side by side with identical sample data,
> so the owner can pick one. **Every direction must independently clear the premium bar in §0.5 —
> "different from each other" is not enough; each one must be genuinely premium on its own.**
> Read §5 before proposing anything — this card was already redesigned once (2026-08-11) from a
> plainer version, and the reasoning behind that pass still applies.
> Sources of truth: live tokens `web/tailwind.config.js` · current implementation
> `web/src/components/catalogue/ProductCard.jsx` · `.claude/rules/web-design.md`.

---

## ⛔ COLOUR — hard rules, checked by arithmetic, before anything else

**The brand is a deep ROYAL BLUE / NAVY. Not purple, not violet, not indigo, not pastel.**
This has been mis-produced before (`#8069BF`, a lavender) — see the rejected table below.

```
#1A2E8F   navy  — heading/accent use, FLAT fill, no gradient
#2A4DE0   blue  — links, the verified tick's ring if you use one, primary actions
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
"light," never a washed-out mid-tone) · Tailwind default `gray/slate/zinc` (ours is the
blue-cast `ink` scale below) · a coloured/tinted "no image" placeholder (the standard is a quiet
neutral grey + icon — a coloured box reads as content, not as absence) · a star-rating or
review-score visual of any kind (§2 — this product has none, and inventing a rating widget
implies a feature that doesn't exist) · any colour used as the ONLY signal for the verified tick
— pair colour with the tick shape/icon itself, never a coloured dot or border alone.

**Full token set — use only hex values that appear verbatim in this document:**

```
primary-50   #EAEEFF     ink-50   #F7F8FB     success  #12B76A (verified tick ONLY)
primary-100  #DEE1FF     ink-100  #F2F4F7     warning  #F79009 (locked token — don't use here,
primary-200  #C3CBFF     ink-200  #E2E4EC               nothing on this card is "in review")
primary-600  #2A4DE0     ink-400  #98A2B3     danger   #D92D20 (don't use here — nothing on
primary-700  #2340C4     ink-600  #5A6B85 (= "muted")            this card is an error/danger state)
primary-800  #1A2E8F     ink-900  #000517
                          surface  #FFFFFF · border #C5C6CF
```

Two shadow levels exist, never more: `shadow-card` (resting) and `shadow-lift` (one step deeper —
hover/active only). Don't invent a third.

**Before delivering, list every hex you used and confirm each one is in here.**

---

## ⛔ PREMIUM — concrete criteria, not a vibe word

"Premium" is not decoration. **More badges, more colour, more shadow, more motion is the
OPPOSITE of premium** — it reads as trying hard, which is the tell of a template, not a
considered product. Every one of the 5+ directions must clear this bar **independently**; a
direction that's merely different from the others but not genuinely premium on its own doesn't
count as one of the 5.

**What premium actually means on a card like this:**

1. **Restraint over decoration.** The instinct to add is the wrong instinct. Before finalising
   each direction, run the edit test on every element: *"does removing this lose real
   information, or just decoration?"* If it's decoration, cut it. A card with fewer, better-placed
   elements reads as more expensive than one with more of them.
2. **One accent moment, not several.** Brand blue (`#2A4DE0`) should do ONE clear job per card —
   e.g. the price, or a hover state — not be scattered across chip backgrounds, borders, icons
   AND text all at once. If more than two elements on the card carry colour, it isn't restrained.
3. **A disciplined type scale.** No more than 3–4 distinct text treatments per card (e.g. name /
   price / metadata / label), with a REAL jump in size or weight between each — not six sizes
   that are all "roughly 13px, roughly medium." Confident hierarchy beats a wall of same-weight
   text.
4. **Room to breathe.** Premium is rarely dense. Generous internal padding, generous line-height,
   deliberate negative space around the price. Resist the instinct to fit more in — a card that
   feels tight to squeeze in one more chip has already lost the argument.
5. **Photography treated with care.** A considered, consistent crop — not a raw thumbnail jammed
   against the text with no relationship to it. Subtle, consistent treatment (a shared corner
   radius with the card, a hairline inset) rather than a photo that looks pasted on top.
6. **Quiet materials, not loud ones.** Flat surfaces; the existing two-level shadow system used
   with intent (resting vs. lifted, nothing else). **No gradients, no glow, no neumorphism, no
   glassmorphism/blur panels, no skeuomorphic bevels.** These read as "premium" to a naive
   design model but are actually the tell of a template — genuine 2026 B2B/SaaS premium (Stripe,
   Linear, Vercel-calibre polish) is flat, precise and quiet, not glowing.
7. **Micro-interactions that feel engineered, not decorated.** Hover/focus transitions should be
   subtle and smooth (soft easing, a small scale or elevation shift) — never bouncy, never a
   flashy entrance animation. Motion should read as confidence, not as a flourish.
8. **Alignment precision.** Price, MOQ, chips and the seller row should all snap to a shared
   grid/baseline rhythm across every card in a row — nothing "roughly" aligned. This is often the
   single biggest tell between a card that reads as premium and one that reads as a template.
9. **Confidence in the trust signal.** The verified tick should read as quietly authoritative —
   not a loud badge, sticker or ribbon. Understate it; let its presence do the work rather than
   announcing itself.

**Reference calibre, not reference literally:** think of the restraint and typographic confidence
of a Stripe product page, a Linear UI, or a high-end real-estate/aviation-broker listing card —
not a flash-sale e-commerce card, not a gradient-heavy SaaS landing-page template. This is an
enterprise B2B sourcing tool a serious buyer trusts with real purchasing decisions between
verified companies — it should feel like it, the way a well-made physical catalogue or a
private bank's website feels considered rather than loud.

---

## 1 · What you are designing

**One card component**, reused as-is (same component, not a per-page variant) across three real
surfaces:

1. The category listing grid (`/category/:slug`) — the main place buyers see many at once, 2 to 4
   per row depending on screen width.
2. A "More in this category" row on the product detail page — 4 across, smaller context.
3. The supplier profile's product grid (`/supplier/:slug`) — here every card shares one seller,
   so the card drops the seller row and shows a plain category line instead (see §2).

It must work believably at **all** of those densities — don't design only the wide, isolated,
one-card-per-screen version and assume it'll scale down.

**Deliver at least 5 genuinely different directions, each independently premium (§0.5).** Not
five spacing/colour tweaks on one layout — five different *approaches* to the same information,
each one clearing the restraint/precision bar on its own. Vary things like: what's the visual
hero (photo vs. price vs. name)? How dense vs. airy? Does the seller row read as a footer strip, a
badge, an inline mention? Is the "buy signal" (price + MOQ) grouped tightly or given its own
zone? Give each direction a short name and one line on what buyer behaviour it's betting on (e.g.
"photo-led browsing," "price-first comparison shopping," "trust-led — seller identity leads") —
and one line on how it earns "premium" specifically (which of §0.5's 9 points it leans on
hardest).

---

## 2 · Content & data — the real shape, don't invent fields

Each product card has, and only ever has:

- **Cover photo** — or none (design the no-image state as real and common, not rare)
- **Name** — can run long; needs a real wrapping/clamping strategy, not an assumption it's short
- **Up to 2 spec/attribute values as short chips** (e.g. "100% cotton," "400 gsm") — real
  category-specific data. Can also be **zero** chips — don't design as if there are always two.
- **Price — one of three real, mutually exclusive shapes:**
  1. Fixed amount + a per-unit label (e.g. "₹450 / kg")
  2. A range (e.g. "₹380 – 520 / kg")
  3. **"Price on request"** — this is an intentional, common, informational state, not a
     missing-data placeholder. Don't grey it out or shrink it like an error.
- **MOQ** (minimum order quantity) — present or absent independently of price
- **Seller identity** (only when `showSeller` is true — absent on the supplier-profile surface,
  §1's third bullet): a company name, a **verified
  tick** (present or fully absent — never a "not verified" badge or greyed alternative state),
  and a country. **Never** seller contact info, phone, email, or address.
- **When seller is hidden** (supplier profile context): a plain category name line instead.

**Explicitly does NOT exist — never design these onto the card:** a status word ("Live,"
"Available," "In stock"), a star rating or review count, a "trending"/"popular" badge, stock
count, delivery estimate, or any kind of countdown/urgency device. This is a discovery card for a
B2B catalogue, not an e-commerce impulse-buy card — don't import that visual language.

---

## 3 · States every direction must show

For each of your 5+ directions, render the SAME set of these (so they're comparable):

1. A normal card — photo, 2 spec chips, fixed price + unit, MOQ, verified seller with country.
2. **No photo.**
3. **Zero spec chips** (nothing to show — layout must not leave an awkward gap).
4. **"Price on request"** instead of a number.
5. **An unverified seller** (no tick — confirm its absence doesn't look like a broken/missing
   element).
6. **A long product name** (forces wrapping/clamping — show what happens at 2+ lines).
7. **`showSeller=false`** variant (category line instead of the seller row).
8. The card **inside a 2-column mobile grid** at ~390px, not just as a wide isolated card.

---

## 4 · Non-negotiable constraints

- **No status word, no rating/review UI, no urgency device** — repeating §2 because it's the
  constraint most likely to be tempting to add for "polish."
- **The verified tick is binary** — present (with the tick icon, `success` #12B76A) or fully
  absent. No "pending"/"unverified" visual state of any kind.
- **Accessibility, WCAG AA.** Colour contrast ≥ 4.5:1 for all text over any background used;
  meaningful `alt` text conventions for product photos (empty `alt=""` since the name is already
  adjacent text — that's the current convention, keep it unless you have a specific reason not
  to); the whole card is a single link target with a visible focus state.
- **Image performance** — explicit aspect-ratio on the photo area so nothing shifts on load.
- **No dead/fake data** — every field must come from the real shape in §2. If you need sample
  products, use realistic real-catalogue-style examples (e.g. actual categories like "Cotton
  fabric," "Leather bags & wallets"), not invented product types unrelated to this platform
  (electronics gadgets, generic stock-photo products, etc.).

---

## 5 · Current shipped baseline (2026-08-11) — read before proposing anything

The card was already redesigned once, from a plainer earlier version, on **explicit owner
feedback that the old one "was not a good way to present the product."** The direction taken:
a **B2B merchandising card** — the reasoning was that a professional buyer decides on specs,
price and MOQ, and seller trust, so those get real visual weight rather than being an
afterthought under a big photo.

What's live today, so you know what you're evolving or deliberately departing from:
- **Photo**: 4:3 crop, hover triggers a slide-up "View details" bar (desktop only — meaningless
  on touch).
- **Name**: 2-line clamp.
- **Spec chips**: up to 2, small rounded-pill style, muted background.
- **Price**: the visual hero of the lower half, unit alongside it; **MOQ directly beneath**, both
  anchored to the card's bottom via a flex `mt-auto` — so a 1-line and a 2-line name still leave
  price/MOQ aligned across a row of cards.
- **Seller row**: a hairline divider, then a small circular initials badge (no seller logos
  today), name, verified tick, country right-aligned.
- **No status chip of any kind** — this component is explicitly a public-only surface; a
  different, private variant exists for a seller viewing their own listings elsewhere, not this
  one.

---

## 6 · Deliverables

1. **At least 5 directions**, each named, each with the one-line "what behaviour it's betting on"
   note from §1 AND the one-line "how it earns premium" note.
2. Every direction rendered through **all 8 states from §3**, using the same sample data across
   directions so they're genuinely comparable side by side.
3. Each direction shown at both a **wide single-card view** and **inside a realistic 2/3/4-up
   grid**, phone width included.
4. **Self-check with delivery:**
   - Every hex used appears verbatim in §0.
   - No status word, rating, or urgency device anywhere in any direction.
   - The verified tick is binary in every direction; "Price on request" reads as informational,
     not broken.
   - **Run the §0.5 edit test on every element of every direction** — if something could be
     removed without losing real information, it was either removed or you can say why it stays.
   - No gradients, glow, neumorphism, glassmorphism, or skeuomorphic bevels anywhere.
   - No more than 2 colour-carrying elements and no more than 4 distinct text treatments per
     card, in every direction.

---

## Notes for whoever runs this prompt

- No backend/data changes needed — this is a pure front-end visual pass on data the component
  already receives; every field in §2 is real and already flowing into the card today.
- This component is shared across three pages (§1) — a direction that only reads well at one
  density (e.g. only as a single wide card) isn't a complete answer; show it holding up at the
  4-up desktop grid and the 2-up phone grid too.
- The owner will pick ONE of the 5+ directions to actually ship — so favour genuine variety over
  five safe near-duplicates. A direction that's clearly "wrong for us" is more useful than a sixth
  minor variant of the current card, because it sharpens what the right one actually is.
