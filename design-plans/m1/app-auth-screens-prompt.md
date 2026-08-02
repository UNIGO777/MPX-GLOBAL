# Prompt — MPX Global mobile app · Launch & Auth screens (M1)

> Copy everything below the line into your design tool (v0 / Lovable / Figma AI / Claude).
> Source of truth: `design-plans/m1/app-screens-design.md` §4 · palette from `web/tailwind.config.js`.

---

You are designing the **launch and authentication flow for a B2B import/export marketplace mobile app** — MPX Global. Indian exporters sell to international buyers. React Native (Expo), iOS + Android.

Produce **4 distinct visual directions** of the same 8 screens so we can choose one. Make them genuinely different design languages, not colour swaps of one layout.

## Brand palette — use these exact values, do not substitute

This app must feel like the same product as our existing web app, which already ships these tokens.

| Token | Hex | Use |
|---|---|---|
| `primary-600` | `#2A4DE0` | **Primary actions, active states, links** (royal blue — the brand accent) |
| `primary-700` | `#2340C4` | Pressed / hover |
| `primary-800` | `#1A2E8F` | **Brand navy** — hero panels, immersive backgrounds |
| `primary-50` | `#EAEEFF` | Tinted canvas, selected states |
| `primary-100` | `#DEE1FF` | Subtle fills |
| `ink-900` | `#000517` | Primary text (near-black, blue-cast) |
| `ink-700` | `#344054` | Body text |
| `muted` | `#5A6B85` | Secondary / helper text |
| `surface` | `#FFFFFF` | Cards |
| `surface.subtle` | `#EAEEFF` | Page canvas |
| `surface.border` | `#C5C6CF` | Hairlines, input borders |
| `success` | `#12B76A` | Verified tick, confirmations |
| `warning` | `#F79009` | In review |
| `danger` | `#D92D20` | Errors, destructive (error field tint `#FEECEA`) |

**Type:** Inter (system fallback). **Card shadow:** `0px 4px 20px rgba(0, 5, 23, 0.05)` — soft, navy-tinted, the only elevation allowed.

**Light mode only.** Dark mode is explicitly out of scope for M1 (owner, 2026-07-30) — do not produce dark variants, do not design a theme toggle, and do not reserve layout space for one.

Aim for **modern, premium, trustworthy fintech-grade** — this app sits next to money and identity documents. Confident and clean, not playful, not startup-generic. No purple gradients, no glassmorphism clichés, no stock-illustration mascots.

## The 8 screens

**1 · Splash / session restore** — logo, brand mark, subtle loader. States: loading · offline (message + retry, never a hang).

**2 · Welcome / portal choice** — the entry point that picks the portal. Brand, one-line value proposition, and **two visually equal cards**:
- **Buyer** — "I want to buy from Indian suppliers"
- **Exporter** — "I want to sell to international buyers"

Plus a quiet line: *"You can have both a buyer and an exporter account."* Neither card is the primary; they're equal paths.

**3 · Login (portal-scoped)** — one design, rendered twice ("Buyer sign-in" / "Exporter sign-in"). Fields: **Email or mobile** (single combined field, helper: "Mobile must include country code, e.g. +91…") · **Password** (show/hide). Actions: Sign in (full width) · Forgot password? · Create account · a way back to switch portal. States: default · loading · **invalid credentials** · too many attempts · offline.

**4 · OTP verify** — one screen, three contexts (after signup step 1, after login, in password reset). **6 separate code boxes**, numeric keypad, auto-advance, paste-across. Masked destination ("sent to +91 ••••• 43210"), expiry countdown, **Resend** disabled through a ~60s cooldown. States: default · loading · wrong code · expired · locked out · resend cooldown · resend sent · offline.

**5 · Forgot password** — single "Email or mobile" field, "Send reset code". States include a **sent confirmation** and rate-limited.

**6 · Reset password** — email/mobile (prefilled) · 6-box reset code · new password (with strength meter) · confirm. States: invalid/expired code · mismatch · success. *Four fields plus a keyboard is tight on a small phone — split into two steps if it can't breathe.*

**7 · Signup step 1 — your account** — shared by both portals, **nothing about the company here**. Fields: Full name · Email · **Mobile (country-code button + number)** · Password (strength meter) · Confirm password. Shows a **step indicator: 1 of 2**, with the OTP drawn as the bridge between steps.

**8 · Signup step 2 — your company** — reached only after OTP. Two paths:
- **Path A · Claim** — *"We found a company registered with this email"* card showing company name, country, and a verified tick if it has one. Actions: **"Yes, this is my company"** (primary) / "No, create a new company". The card must say *"This company is already verified — you'll get the tick straight away"* and, on the decline path, *"A new company starts unverified and gets reviewed separately."*
- **Path B · Create new** — Buyer: Company name + Country (searchable picker). Exporter: those plus **Entity type as two full-width radio cards (Business / Individual)** and optional address fields (line 1, line 2, city, state, postal code — **no country field here**, the one above is the only one).

## Non-negotiable rules — these are product/legal constraints, not preferences

1. **Wrong password, unknown email, and an email that exists only on the *other* portal all show the identical message: "Invalid credentials."** Never a "this looks like an exporter account — switch?" hint, never an auto-redirect. Put the error above the form, never on one field.
2. **No portal selector on the login screen.** The portal comes from screen 2 and is only shown back to the user as identity.
3. **Signup is step 1 → OTP → step 2.** Never one form. Company fields must sit *behind* OTP.
4. **No "attempts remaining" counter** anywhere in the OTP flow — design the locked-out state instead.
5. **One badge only: a verified tick.** There is no "unverified" badge, no red cross, no warning chip — absence of the tick is the signal.
6. **Entity type is the most consequential tap in signup** — it decides which documents get requested later and is publicly visible. Give it full-width cards with an explanation, never a dropdown.
7. Success copy: a **buyer is active immediately** (never "awaiting approval"), an **exporter's profile is public immediately**, just without a tick (never "hidden until verified").

## Mobile craft requirements

- **Safe areas** — notches, Dynamic Island, home indicators, Android nav bars.
- **Keyboard is a design problem, not a bug** — the focused input and its primary button stay reachable on every form. On the OTP screen the keypad appears instantly, so the code boxes must sit in the **upper half**.
- **Touch targets ≥ 44px.** No hover-dependent affordances.
- Correct keyboard per field: email, phone pad, numeric for codes.
- Show each screen at **375pt (small) and 430pt (large)**.
- Every screen needs **loading · error · offline** states drawn.
- Respect platform mechanics: iOS back-swipe and large titles, Android ripple and hardware back.

## The 4 directions to produce

Vary **layout structure, type scale, elevation, and how much brand colour is used** — not just accents.

**Direction A — "Clean Utility"**
White canvas, generous whitespace, large clear headings, minimal chrome. Inputs are simple bordered fields on white. Brand blue appears only on the primary button and links. Safest, most enterprise-credible.

**Direction B — "Brand Immersive"**
Full-bleed **navy `#1A2E8F`** panels on splash, welcome and the top third of auth screens; white forms sit on top as rounded sheets. Strong brand presence, high contrast, feels like a serious financial product.

**Direction C — "Soft Depth"**
Pale blue `#EAEEFF` canvas throughout with white elevated cards using the navy-tinted shadow. Rounded, calm, approachable. Portal cards on screen 2 become the hero moment.

**Direction D — "Bold Editorial"**
Oversized display typography in `ink-900`, hairline rules instead of boxes, near-invisible input borders, brand blue used sparingly but decisively. The most contemporary and design-forward of the four.

## Deliverable

For each direction:
1. All 8 screens at 375pt, plus screens 3, 4 and 8 at 430pt.
2. Key states drawn, not just the happy path — **invalid credentials**, OTP error, OTP locked out, claim-vs-create on screen 8, and one offline state.
3. A one-paragraph rationale: who this direction is for and what it trades away.

Then a short comparison: which direction you'd ship and why.

---

## ROUND 2 — Direction B selected, explore variations

> **Status: Direction B ("Brand Immersive") is the chosen base** (owner, 2026-07-30). Round 1's other
> three directions are parked. Copy everything between the rules below into your design tool — it is
> self-contained, so you do not need to paste round 1 as well.

---

You are designing the **launch and authentication flow for MPX Global**, a B2B import/export marketplace mobile app — Indian exporters selling to international buyers. React Native (Expo), iOS + Android. **Light mode only** — no dark variants, no theme toggle, no layout space reserved for one.

We have already chosen a direction: **brand-immersive, using deep navy as a full-bleed structural element with white forms layered on top.** It reads as a serious financial product, which is right for an app that handles identity documents and, later, escrowed funds.

Now produce **3 variations of that direction**. They must differ in **how and where the navy is deployed** — the structural idea — not in colour, type choice or button radius. All three use the identical palette below.

### Palette — exact values, no substitutions

| Token | Hex | Use |
|---|---|---|
| `primary-800` | `#1A2E8F` | **Brand navy** — the immersive surfaces |
| `primary-600` | `#2A4DE0` | Primary actions, links, active states |
| `primary-700` | `#2340C4` | Pressed |
| `primary-50` | `#EAEEFF` | Tinted canvas, selected states |
| `ink-900` | `#000517` | Primary text |
| `ink-700` | `#344054` | Body text |
| `muted` | `#5A6B85` | Secondary / helper text |
| `surface` | `#FFFFFF` | Cards, sheets |
| `surface.border` | `#C5C6CF` | Hairlines, input borders |
| `success` | `#12B76A` | Verified tick |
| `warning` | `#F79009` | In review |
| `danger` | `#D92D20` | Errors (field tint `#FEECEA`) |

**Type:** Inter. **Elevation:** one shadow only — `0px 4px 20px rgba(0, 5, 23, 0.05)`.

### The three variations

**B1 · Navy Canopy** — navy occupies the top third; a white sheet with a large corner radius rises over it and holds the form. The navy carries the logo, screen title and context (portal identity). The most conventional of the three and the most likely to survive contact with dense screens later. Make the sheet feel deliberate and architectural, not like a default bottom-sheet component.

**B2 · Full Immersion** — the entire screen is navy. Inputs are outlined or subtly translucent on navy with white text and light placeholder; the primary button is `#2A4DE0` or white. The most dramatic and the most premium when it works. **You must solve legibility properly**: input contrast, error states in `#D92D20` on navy (may need a lighter error tone — propose one), disabled states, and the OTP boxes.

**B3 · Navy Arc** — navy as a bold asymmetric geometric shape rather than a straight band: an arc, a diagonal, or an off-axis block. White content sits in the negative space. The most contemporary and editorial. Keep it disciplined — one strong shape per screen, reused consistently, not a different flourish on each.

### Apply each variation to all 8 screens

1. **Splash / session restore** — logo, brand mark, subtle loader. Also: offline + retry.
2. **Welcome / portal choice** — brand, one-line value proposition, **two visually equal cards**: Buyer ("I want to buy from Indian suppliers") and Exporter ("I want to sell to international buyers"), plus a quiet line *"You can have both a buyer and an exporter account."* Neither card is primary.
3. **Login (portal-scoped)** — one design rendered twice ("Buyer sign-in" / "Exporter sign-in"). Fields: **Email or mobile** (single combined field, helper "Mobile must include country code, e.g. +91…") and **Password** (show/hide). Sign in (full width) · Forgot password? · Create account · a way back to switch portal.
4. **OTP verify** — one screen, three contexts. **6 separate code boxes**, numeric keypad, auto-advance, paste-across. Masked destination ("sent to +91 ••••• 43210"), expiry countdown, Resend disabled through a ~60s cooldown.
5. **Forgot password** — single "Email or mobile" field, "Send reset code", and a neutral sent-confirmation.
6. **Reset password** — email/mobile (prefilled) · 6-box code · new password with strength meter · confirm. Split into two steps if it cannot breathe on a small phone.
7. **Signup step 1 — your account** — shared by both portals, **nothing about the company**. Full name · Email · **Mobile (country-code button + number)** · Password (strength meter) · Confirm. Shows a **step indicator: 1 of 2**, with the OTP drawn as the bridge.
8. **Signup step 2 — your company** — reached only after OTP. **Path A · Claim:** *"We found a company registered with this email"* card with company name, country, verified tick if present; actions "Yes, this is my company" (primary) / "No, create a new company"; the card must state *"This company is already verified — you'll get the tick straight away"* and, for decline, *"A new company starts unverified and gets reviewed separately."* **Path B · Create new:** Buyer = Company name + Country (searchable picker). Exporter = those plus **Entity type as two full-width radio cards (Business / Individual)** and optional address fields (line 1, line 2, city, state, postal code — **no country field here**).

### Non-negotiable — product and legal constraints, not preferences

1. **Wrong password, unknown email, and an email that exists only on the *other* portal all show the identical message: "Invalid credentials."** No "switch portal?" hint, no auto-redirect, no field-level error — the message sits above the form.
2. **No portal selector on the login screen** — the portal is chosen on screen 2 and only shown back as identity.
3. **Signup is step 1 → OTP → step 2.** Company fields must sit behind the OTP.
4. **No "attempts remaining" counter** anywhere — design the locked-out state instead.
5. **One badge only: a verified tick.** No "unverified" badge, no red cross — absence of the tick is the signal.
6. **Entity type gets full-width cards, never a dropdown** — it decides which documents are requested later and is publicly visible.
7. Success copy: a **buyer is active immediately** (never "awaiting approval"); an **exporter's profile is public immediately**, just without a tick (never "hidden until verified").

### Mobile craft

- Safe areas: notches, Dynamic Island, home indicators, Android nav bars.
- **The keyboard covers up to half the screen.** Show what each variation does when it opens — the navy region must collapse or scroll so the focused input and its primary button stay reachable. On the OTP screen the keypad appears immediately, so the code boxes belong in the **upper half**.
- Touch targets ≥ 44px, no hover-dependent affordances.
- Correct keyboard per field: email, phone pad, numeric for codes.
- Show every screen at **375pt** and screens 3, 4 and 8 also at **430pt**.
- Draw **loading · error · offline** for every screen.

### Deliverable per variation

1. All 8 screens at 375pt; screens 3, 4, 8 also at 430pt.
2. States, not just the happy path: **invalid credentials**, OTP wrong code, OTP locked out, claim-vs-create on screen 8, one offline state, and **one screen with the keyboard open**.
3. **A stress test:** show your variation applied to one dense form screen — an exporter company profile with ~8 fields, a logo picker and a textarea. This is the test the winning variation has to pass; auth screens are short and flatter a bold treatment in a way that later screens will not.
4. One paragraph: what this variation is best at, and what it costs.

Finish with a recommendation of which of the three to ship, and why.

---

## Notes for whoever runs this prompt

- The palette above is the **shipped web theme** (`web/tailwind.config.js`). `app-screens-design.md` §1.1 still lists indigo `#4f46e5` as the primary — that is the older placeholder and is **wrong**; the royal blue `#2A4DE0` family is what web actually uses. Both files carry a "starter values, confirm brand before launch" caveat, so if the owner confirms a different brand palette, swap the hex values here and the token *names* stay the contract.
- **Dark mode: decided — light only** (owner, 2026-07-30). No longer an open item; `app-screens-design.md` §1.1 and §10 updated to match. This halves the artwork and removes the "half-done dark mode" risk the brief warned about.
- Screens 1 and 2 are **not named in `m1.md` §7** — they are carried as app-necessary shells. An app cannot function without them, but they are the two most likely to be challenged on scope.
- **Round 2 exists because Direction B was selected.** If a later round narrows again (say B1 wins), add a Round 3 block rather than editing Round 2 — the rejected options are the record of why the winner won.
- **The stress test in Round 2 is the important ask.** These 8 auth screens are short, and a bold navy treatment flatters short screens. The app's remaining 9 screens are dense forms (KYC capture, company profile with the locked-field rows). A variation that only works on auth is not a design system, and the cost of finding that out at screen 15 is a redraw of everything.
