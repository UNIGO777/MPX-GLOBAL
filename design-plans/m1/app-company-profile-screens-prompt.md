# Prompt — MPX Global mobile app · Company profile screens (M1 · §A22) — v2

> Copy everything below the line into your design tool (v0 / Lovable / Figma AI / Claude).
> Sources of truth: `design-plans/m1/app-screens-design.md` screens **12 · 15 · 15.1** · live
> tokens `web/tailwind.config.js` = `app/src/theme/colors.js` · shipped direction **B1 "Navy
> Canopy"**. v2 (2026-08-05) replaces v1 after a UX rethink — the field lists are unchanged, the
> *model* of the screens is what this version explains.

---

## ⛔ COLOUR — hard rules, checked by arithmetic, before anything else

**The brand is a deep ROYAL BLUE / NAVY. Not purple, not violet, not indigo, not pastel.**

```
#1A2E8F   navy  — the coloured band at the top of every screen (FLAT fill, no gradient)
#2A4DE0   blue  — buttons, links, anything interactive
```

Every colour you output must satisfy both of these — they are numbers, not taste:

- **Hue between 226° and 232°.** The brand pair sit at 230° and 228°.
- **Saturation ≥ 65%.** The brand pair are 69% and 75%.

**Rejected colours that earlier runs actually produced:**

| Produced | Hue | Sat | Why it is wrong |
|---|---|---|---|
| `#8069BF` | 256° | 40% | lavender — 26° too violet AND half the saturation |
| `#4f46e5` | 243° | 75% | indigo (a stale draft once listed it; it never shipped) |
| `#6366f1` | 239° | 84% | indigo |

Also rejected: any purple/violet at any opacity · desaturated or pastel versions of our blue
(use `#EAEEFF` when you need something light, never a washed-out mid-tone) · Tailwind default
`gray/slate/zinc` (our neutrals are the blue-cast `ink` scale) · plain `#000000` (darkest text is
`#000517`) · green anywhere except the verified state · gradients, glows, glassmorphism.

**Use ONLY hex values that appear verbatim in this document.** Do not interpolate, do not build
your own tint ramp, do not let a default theme supply a "primary". **Before delivering, list every
hex you used and confirm each one appears in this prompt** — any that doesn't is a bug.

---

## 1 · What you are designing — and what each screen is *for*

Two screens for MPX Global, a B2B import/export marketplace app (React Native / Expo, iOS +
Android; Indian exporters, international buyers). They are the **last two unbuilt screens of
milestone M1** — everything around them ships already, so they must look inevitable, not new.
**Light mode only.**

They look like one form each. They are not the same kind of screen:

- **Screen A — Buyer company profile.** An *admin utility*: keep our records right. A buyer has
  **no public page** — no logo, no description, no preview. Deliberately small. Success = the user
  is in and out in under a minute and never wonders what a field is for.
- **Screen B — Exporter company profile.** A *storefront editor wearing a form's clothes*. The
  logo and description captured here are the **only** content the exporter's public page has beyond
  a name and a country — so this screen's real job is **motivation**: make the exporter *want* to
  fill it in, by keeping what buyers see visibly connected to what they type.

Both share one system — the **locked-field / change-anyway flow** — which is the actual design
work. Get that right once and both screens follow.

## 2 · Match the shipped app

**B1 "Navy Canopy"**, live on every auth screen:

- Navy `#1A2E8F` band at the top: back arrow, MPX wordmark, screen title, one-line subtitle.
- A **white sheet with a 28px top radius** rises over it and holds the content.
- Primary action **pinned at the bottom**, outside the scroll area, above the home indicator.
- When the keyboard opens the canopy **compacts** (subtitle drops, title shrinks) — it never
  scrolls away.

Reuse the shipped primitives rather than redrawing them: `Input`, `CountryPicker` (full-screen,
searchable — ~200 entries make a dropdown unusable), `RadioCard`, `Button`, `Badge`
(`VerifiedBadge`), `FormError`, `Toast`, bottom-sheet confirmation. New pieces this screen
introduces: the **locked-field row**, the **logo picker**, the **description textarea + counter**,
the **public-preview card**.

## 3 · The UX model — read this before drawing anything

### 3.1 One screen, two lives

Every account is **unverified first** and most stay that way for days. In that life the screen is
a completely ordinary form: plainly editable, no locks, no warnings, nothing to explain.
Verification adds the second life: four identity fields lock, and editing one becomes a
consequential act.

**Design for the ordinary life first.** Locks, warnings and consequence copy appear *only* on a
verified account. If an unverified user can feel the lock system existing, the design has failed
the majority case.

### 3.2 Three classes of field — make the rule spatial

| Class | Fields | Behaviour |
|---|---|---|
| **Storefront** (exporter only) | logo · description | Always editable, saves silently, never touches the tick |
| **Legal identity** | company name · country · address | Checked against KYC documents → **locks on verification** |
| **Immutable** | entity type (exporter) | Read-only in every state — it decides which documents are requested |

Group the exporter screen by these classes, in this order: **storefront first** (with the preview
directly beneath it — cause and effect adjacent), then **legal identity** under its own header with
one section-level explainer: *"These details match your verified documents."* The user should learn
the rule from the layout — free things live up here, guarded things live down there — instead of
reading it per-field.

On the buyer screen the entity type is a **choice** (two radio cards, Business / Individual) that
locks with the rest on verification; a buyer has no storefront class at all.

**Lock granularity:** name and country unlock individually. The five address fields unlock as
**one block** — one lock, one "Need to change this?", one confirmation. Five separately-locked
rows would repeat the same ceremony five times for what is, to the user, one fact.

### 3.3 The change-anyway flow is informed consent — three beats

A verified company **may** change a locked field; it costs the tick until re-review. Never block —
inform, confirm, then get out of the way:

1. **Locked** — the filled value, read-only, a lock icon, one quiet line: *"Locked because your
   company is verified."* and a **"Need to change this?"** text action. A locked row is calm — it
   uses the ordinary neutral palette. **A lock is not an error: never tint it amber or red.**
2. **Confirmation sheet** — bottom sheet, destructive-adjacent (danger-styled confirm), naming the
   field and stating the consequence *before* anything unlocks:
   *"Changing your company name removes your verified tick until our team reviews it again. Your
   account keeps working normally."*
   On the exporter's **name** sheet, one more line, verbatim: *"Your public web address stays the
   same."* (The public URL is minted from the name once, at creation, and never changes — if this
   line is missing it will be filed as a bug later.) Confirm / Cancel.
3. **Unlocked-with-warning** — the field is editable, a **persistent** inline warning sits above
   the form (it must survive scrolling), and the save button owns the outcome: **"Save and
   re-submit for review"** — never a bare "Save".

### 3.4 Unlocking is free — saving is what costs

Confirming the sheet unlocks the field; it does **not** demote the account. A user who unlocks,
reads their own company name, and backs out has lost nothing — leaving the screen quietly re-locks
the field, no scolding. Only **saving a changed locked field** triggers the demotion. This must be
legible in the design, or users will fear even looking.

### 3.5 The save button tells the truth

Its label follows what is actually dirty:

| Dirty state | Button |
|---|---|
| Nothing | disabled **"Save"** |
| Storefront fields only (exporter) | **"Save"** — silent, tick untouched |
| Any changed locked field (with or without storefront edits) | **"Save and re-submit for review"** |

One primary button per screen, `#2A4DE0`. If mixed edits are saved, everything saves together and
the review consequence applies — the label already said so.

### 3.6 Demotion feedback — immediately, in three places

After saving a locked-field change: the **tick disappears at once** (not on next launch), the
header status flips to **"In review"** (`warning`), and a confirmation states plainly:
*"Your updates are saved. We'll review them and restore your verified tick."* Draw the before and
after. The account must never look broken — it keeps working; only the tick is in question.

## 4 · Screen A — Buyer company profile

| Field | Type | Req | Locks on verification |
|---|---|---|---|
| Company name | text | ✔ | yes |
| Country | searchable full-screen picker | ✔ | yes |
| Address — line 1, line 2, city, state, postal code | text ×5 | ○ | yes (as one block) |
| Entity type | two radio cards: Business / Individual | ✔ | yes |

Header: company name + `VerifiedBadge` when verified (absence of the tick is the only other
signal — **no "not verified" badge exists in this product**).

**The verified-buyer corner:** every field on this screen locks, so the verified state reads as a
tidy read-only summary with per-item "Need to change this?" affordances — that is correct, design
it as such rather than fighting it.

## 5 · Screen B — Exporter company profile

**Section 1 · Your storefront** — logo picker (camera / gallery, square crop, replace, remove;
upload progress on the avatar itself; failed → retry/remove inline) · description textarea with
counter (exact limit supplied at build time — draw with ~600). Beneath them, the **live preview
card** (§6). Edits here reflect in the preview as they're typed — that adjacency *is* the
motivation mechanism.

**Section 2 · Legal identity** — company name · country · address block, the locked-field system
from §3. Section explainer: *"These details match your verified documents."*

**Entity type** — a read-only row (value + "set at signup"), in every state. Not part of the
change-anyway flow, ever.

🔴 **Logo and description never trigger re-review.** They are not checked against documents. On a
verified account they save silently — no sheet, no warning, no tick loss. If the design implies
otherwise, exporters will stop updating their storefront, which defeats the screen.

## 6 · The public preview (15.1)

A card showing the exporter's page as a buyer sees it: **logo · company name · country · entity
type (public, beside the tick) · description · established year if set · the verified tick when
verified** — and the public URL line (`/supplier/<slug>`).

Three rules that are product law, not suggestions:

1. **It mirrors the live public page exactly.** Never invent a field for the preview; drift will
   be found by a buyer before it's found by us.
2. **Street address is never public** — country only. **`website` is never public** and is not a
   field on this screen at all.
3. **No status, ever.** The tick or nothing. Never "in review", never "rejected", never a reason —
   those are private to the owner, and this previews the *public* page.

Collapsed by default (compact strip: logo thumb, name, tick); expands to the full page mock.

**The empty preview is the most important frame in this whole prompt.** Every new exporter starts
with no logo and no description — this is the majority first-run. Treat it as a first-class state:
show the gap (their bare page beside a small filled example), one inviting line — *"Buyers see
this. Add a logo and a few lines about what you export."* — and a direct action into the storefront
fields. A grey placeholder box here is a failed screen.

## 7 · Micro-interactions and edge cases

- **Dirty-state guard:** leaving with unsaved edits → bottom sheet: *"Discard changes?"* Leaving
  with only an *unlocked but unchanged* field → leave freely, silently re-lock (§3.4).
- **Keyboard:** it covers half the screen. Focused input and the pinned save must both stay
  reachable; canopy compacts as shipped. Postal code = numeric keypad.
- **Long content:** a 60-character company name and a maximum-length description must not break
  the header, the preview card, or the locked row — show wrap/truncation.
- **Country picker** returns to the form with the new value highlighted; changing country is a
  locked-field change like any other once verified.
- **Offline / error / saving:** designed states, not blanks — inline banner + retry, never a
  dead spinner. Save in flight = button loading + disabled, fields uneditable.
- **Sensitive-surface rule (§1.5 of the brief):** app-switcher snapshot of these screens is
  blurred/covered — design the covered frame deliberately.
- **Accessibility:** lock state is icon + label, never colour alone; chips carry text; touch
  targets ≥ 44px; contrast on navy uses white / `#C3CBFF` only.

## 8 · Palette usage (the allowlist)

| Token | Hex | Use |
|---|---|---|
| `primary-800` | `#1A2E8F` | canopy band (flat) |
| `primary-600` | `#2A4DE0` | primary button, links, focused border, active states |
| `primary-700` | `#2340C4` | pressed primary, secondary-button label |
| `primary-200` | `#C3CBFF` | eyebrow/subtitle text on navy |
| `primary-50` | `#EAEEFF` | tinted fills, selected radio card, canvas |
| `ink-900` | `#000517` | headings |
| `ink-700` | `#344054` | body, field labels |
| `muted` | `#5A6B85` | helper/caption text |
| `ink-400` | `#98A2B3` | placeholders, decorative icons |
| `ink-100` | `#F2F4F7` | disabled input fill |
| `surface` | `#FFFFFF` | sheet, cards |
| `surface.border` | `#C5C6CF` | every hairline and input border |
| verified | fill `#E7F7EF` · text `#05603A` · base `#12B76A` | tick + chip |
| in review | fill `#FEF0DC` · text `#93370D` · base `#F79009` | chip + change-anyway warning only |
| needs attention | fill `#FEECEA` · text `#912018` · base `#D92D20` | errors, destructive confirm |
| not submitted | fill `#F2F4F7` · text `#344054` | chip |

**Type:** Inter (system fallback) — regular/medium/semibold/bold. **Shadow:** exactly one —
`0px 4px 20px rgba(0, 5, 23, 0.05)`. **Radius:** 12 cards · 8 inputs/buttons · 28 sheet top ·
999 pills. Green only for verified; amber only for review states.

## 9 · States to draw

**Both screens:** loading · unverified (plain, no locks) · in review · verified + locked ·
confirmation sheet · unlocked-with-warning · saving · saved (status unchanged) · **saved +
demoted to in-review (before/after of the tick)** · validation errors · discard-changes sheet ·
offline · error.

**Exporter adds:** logo uploading / failed / removed · **empty storefront + empty preview** ·
preview collapsed / expanded.

## 10 · Deliverables

1. Both screens at **375pt**; exporter screen + preview also at **430pt**.
2. The three beats of the change-anyway flow as a sequence, ending in the demotion before/after.
3. The **locked-field row** in its three variants (locked · unlocked-with-warning · plain
   editable) plus the **address block** as a single locked unit.
4. The **empty storefront + preview** treated as a first-class first-run frame.
5. One paragraph: how the verified/unverified split was kept from making the ordinary case heavy.
6. **Self-check, included with delivery:** every hex used appears verbatim in this prompt; the
   four copy strings from §3.3/§3.6 appear verbatim; no field appears in the preview that isn't
   listed in §6.

---

## Notes for whoever runs this prompt

- **"Business type" + working categories are CANCELLED** (owner, 2026-07-30) — removed, not
  deferred. `entityType` is what the public page shows instead. Do not resurrect them.
- **`website` is internal-only** — no field, no preview, no exceptions.
- **No new model fields** — every field above exists on `Organisation`; this is UI/UX only.
- The **claim-an-existing-company** path (signup step 2) is a separate unresolved question — not
  part of these screens.
- Backend contract these screens must match: build-prompt **§A22** ·
  `modules-in-detailed/m1-max-1.5days/m1.md` §5b. Demotion behaviour: editing a verified locked
  field drops `kycStatus` → `submitted` server-side; the UI's job is the consent and the feedback,
  never the enforcement.
