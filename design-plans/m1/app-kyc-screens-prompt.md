# Prompt — MPX Global mobile app · KYC prompt + verification screens (M1)

> Copy everything between the rules into your design tool (v0 / Lovable / Figma AI / Claude).
> Companion to `app-auth-screens-prompt.md`. **Direction B1 "Navy Canopy" is already chosen and
> shipped** — these screens must live inside it, not restart the exploration.
> Contract source: `MPX-BACKEND-FULL-SAAS` (`/me/kyc/documents`, `/me/verification`) — every field,
> state and limit below is what the API actually does today, not a wish list.

---

You are designing the **KYC (identity verification) flow for MPX Global**, a B2B import/export
marketplace mobile app — Indian exporters selling to international buyers. React Native (Expo),
iOS + Android. **Light mode only** — no dark variants, no theme toggle, no reserved space for one.

The app's visual direction is already decided and built: **"Navy Canopy"** — brand navy occupies the
top of the screen carrying the logo, title and context; a white sheet with a large corner radius
rises over it and holds the content. **The navy header is static and does not scroll**; only the
sheet scrolls. When the keyboard opens the navy header **compacts** (its eyebrow and subtitle drop
out, the title shrinks) so the form keeps the space. Design inside that system.

Produce **3 variations** of this flow. They must differ in **how verification is structured and
paced** — not in colour, type or button radius.

## Palette — exact values, no substitutions

| Token | Hex | Use |
|---|---|---|
| `primary-800` | `#1A2E8F` | **Brand navy** — the canopy |
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

---

## 🔴 The thing most designers get wrong here — read before drawing

**KYC is NOT a gate. Nobody is blocked, ever.**

- A **buyer is fully active from the moment they sign up.** Buyer KYC is genuinely **optional**.
  They can search, save, enquire and chat without ever opening this flow.
- An **exporter's public profile is live from signup too** — buyers can already find them.

So this flow is an **upsell to trust**, not an unlock. Any copy like "Complete KYC to continue",
"Your account is limited until verified", "Activate your account" or a progress bar implying an
incomplete account is **wrong and must not appear**. The user is not waiting for permission.

**What verification actually changes:**

| | Before verification | After |
|---|---|---|
| **Buyer** | Everything works | A verified tick on their company. That is all. |
| **Exporter** | Profile public, but **max 3 active listings + 10 drafts** | The tick, and both caps lifted |

The exporter's listing cap is the one real, concrete consequence — **lead with it for exporters**,
because it is true and useful. For buyers there is no consequence, so the honest pitch is trust:
sellers respond faster to a verified buyer. **Do not invent an urgency that does not exist.**

**One badge only: the verified tick.** There is no "unverified" badge, no red cross, no warning
chip, no "0% verified" meter. Absence of the tick is the entire signal.

---

## Screen 1 · The post-signup prompt

Appears **once, right after signup completes**, on both the buyer and the exporter side, when the
organisation is not yet verified. It also needs a home for later — the user must be able to reach
verification again after dismissing it.

**It must be dismissible without friction.** "Not now" is a first-class action, not a greyed-out
afterthought. A modal a buyer cannot escape is the single worst outcome of this whole flow.

Draw it for **both** audiences — the copy differs because the stakes differ:

- **Exporter** — lead with the listing cap: *"You can list 3 products now. Verify your business to
  list without limits and get the tick buyers filter for."*
- **Buyer** — lead with trust: *"Get the verified tick. Suppliers reply faster to verified buyers."*
  Nothing about limits, because a buyer has none.

Actions: **"Verify now"** (primary) · **"Not now"** (equal weight, not a whisper).

Also design **where it goes when dismissed** — a persistent, quiet entry point (a Profile row, a
dismissible card on the dashboard) so verification is never a dead end. Show that entry point too.

Show it as at least two structural options across your variations: a bottom sheet, a full-screen
takeover, and an inline dashboard card are all legitimate — that difference is part of what
distinguishes the three variations.

---

## Screen 2 · Verification overview (the hub)

The screen the prompt leads to, and the one reachable from Profile at any time. It has to render
**four distinct states** from a single API response — design all four:

| `kycStatus` | What the user sees |
|---|---|
| `pending` | Nothing submitted yet. Explain what's needed and start. |
| `submitted` | In review. Show what was sent and when. **No ETA — we don't have one.** |
| `verified` | The tick, and `verifiedAt`. Quiet and final. |
| `rejected` | The **reason text from the server**, shown plainly, plus a clear way to resubmit. |

The rejected state is the one that matters most. The server returns a human-written
`kycRejectionReason`; it is the owner's own data, so show it in full. This user has been told "no"
and must be able to see exactly why and fix it in one tap. **No blame, no red wall** — treat it as
"one more thing needed", not a failure screen.

The hub also lists **documents already uploaded** — the API gives `docType`, `uploadedAt` and
`verifiedAt` per document. **No thumbnails, no re-download**: the file itself is never returned to
the client (KYC assets are private on purpose). Design the row from metadata alone.

---

## Screen 3 · Entity type — **buyer only**

An **exporter already chose this at signup** and must NOT be asked again — for them, skip straight
to document choice and show the entity type as a fixed, non-editable fact.

A **buyer has never been asked**, and the API refuses their first upload without it. So the buyer
flow opens with this choice:

- **Business** — a registered company, firm or LLP
- **Individual** — a sole proprietor or individual trading in their own name

**Two full-width cards with explanation, never a dropdown.** It decides which documents get
requested and is publicly visible. Design a short line making clear it is not casually changeable.

---

## Screen 4 · Choose a document

The valid list is **driven by entity type** — this is enforced server-side, so the UI must match
exactly:

- **Business** → Registration certificate · GST certificate · Certificate of incorporation · Other
- **Individual** → PAN card · Aadhaar · Passport · Other

Design the list so the user understands **they can upload more than one** and that uploading one is
already enough to enter review. Show which types are already uploaded.

---

## Screen 5 · Capture / upload

The document itself. Both routes must exist:

- **Camera capture** — with an alignment frame, and a **retake / use-this** confirmation step.
  Most users photograph a physical card or certificate.
- **Choose a file** — PDFs live in Files/Drive, not the camera roll.

**Hard constraints from the API — design to them, not around them:**

- Accepted: **PDF, JPG, PNG, WEBP only**
- **Max 10 MB** — design the "too large" state, it will happen with phone photos
- **Max 20 documents** per company — design the "you've reached the limit" state
- File type is verified by its actual bytes, so a renamed file is rejected — the error must say
  something honest like *"That file isn't a PDF or an image"*, never *"wrong extension"*

Draw: pre-capture · preview + confirm · uploading (with progress) · success · each error above ·
offline.

---

## Screen 6 · Submitted confirmation

What happens the instant the first document lands: `kycStatus` flips to **submitted**, and the
account enters review.

**Say what is true and nothing more.** No ETA, no "usually 24 hours", no fake progress bar, no queue
position — we have none of those and inventing one is a promise the product cannot keep.

Reinforce that **nothing is blocked**: an exporter can carry on listing (up to 3), a buyer carries
on as normal.

---

## Screen 7 · Resubmit after rejection

Reached from the rejected state. Shows the reason again alongside the upload step, so the user does
not have to remember it while operating a camera. Uploading again returns the account to
**submitted**.

---

## Non-negotiable rules — product and legal constraints, not preferences

1. **Verification is never a gate.** No screen may block, lock, or imply an account is inactive,
   limited-until-verified, or awaiting approval. A buyer especially has **no** limitation.
2. **The prompt must be dismissible**, and "Not now" carries equal visual weight.
3. **One badge: the verified tick.** No unverified badge, no cross, no percentage, no meter.
4. **No ETA, ever** — for review time, queue position or progress.
5. **The rejection reason is shown in full** to the owner. It is their own data and they cannot fix
   what they cannot see.
6. **Documents are never displayed back.** Metadata only (type, date). The files are private
   storage and are deliberately not retrievable by the client.
7. **Entity type is asked once** — buyer here, exporter at signup. Full-width cards, never a
   dropdown.
8. **Exporter copy leads with the listing cap** (3 active / 10 drafts, lifted on verification).
   **Buyer copy leads with trust** and mentions no limits, because there are none.
9. Nothing on these screens may show another company's data, a rejection reason to anyone but the
   owner, or a document image.

---

## Mobile craft

- **The navy canopy is static and compacts when the keyboard opens** — match the shipped behaviour;
  do not redesign the header into something that scrolls away.
- Safe areas: notches, Dynamic Island, home indicators, Android nav bars.
- **Camera is a full-screen, high-stakes moment** — design the permission-denied state, and a path
  to "choose a file" for users who refuse the camera.
- Touch targets ≥ 44px. No hover-dependent affordances.
- Show every screen at **375pt**; show screens 2, 5 and the prompt also at **430pt**.
- Draw **loading · error · offline** for every screen. Uploads fail on mobile networks — the
  half-uploaded state is a real state.

---

## The three variations

Vary **the structure and pacing of verification**, not the styling.

**V1 · Guided checklist**
The hub is a checklist the user works down: entity type → document → done. Deliberate,
enterprise-legible, hard to get lost in. Each step is its own screen. The prompt is a **bottom
sheet**. Best for users who want to be told exactly what to do; costs taps.

**V2 · Single-flow capture**
Verification is one continuous flow — pick a document and shoot it, entity type resolved inline as
the first question rather than its own screen. The hub is a thin status card, not a workspace. The
prompt is an **inline dashboard card** that never interrupts. Fastest path; risks feeling abrupt on
the rejected path, which you must solve.

**V3 · Document-first wallet**
The hub is a **document wallet** — a shelf of everything uploaded, with empty slots suggesting what
else would help. Uploading is adding to a collection rather than completing a task. The prompt is a
**full-screen takeover**, used exactly once. The most premium and the most encouraging of repeat
uploads; costs the clearest sense of "am I done?", which you must answer.

---

## Deliverable per variation

1. **All 7 screens at 375pt**; screens 2, 5 and the prompt also at 430pt.
2. **Both audiences drawn where they differ** — the prompt (buyer + exporter copy) and the entity
   type step (buyer only; show what the exporter sees instead).
3. **All four hub states**: pending · submitted · verified · **rejected with a real reason**.
4. **States, not just the happy path**: file too large · wrong file type · 20-document limit ·
   camera permission denied · upload failed mid-way · offline · already verified.
5. **A stress test** — the flow on a 375pt screen **with the keyboard open**, since the canopy
   compacts and the sheet shrinks. Auth screens are short and flatter this layout; verification is
   where it gets tested.
6. One paragraph: what this variation is best at, and what it costs.

Finish with a recommendation of which of the three to ship, and why.

---

## Notes for whoever runs this prompt

- **The API contract above is exact**, taken from `/me/kyc/documents` and `/me/verification` as
  built. If a design needs a field the API does not return — a review ETA, a document thumbnail, a
  percentage — that is a backend change and a scope conversation, not a design detail. Flag it
  rather than drawing it.
- **Buyer KYC being optional is a deliberate product decision** (`docs/Note.md` **D3** — adding any
  buyer gate is guarded and needs the owner's explicit override). A design that nags or blocks a
  buyer breaks it.
- The exporter's **3 active / 10 draft cap** is **D1** and is real and enforced today — it is the
  honest reason an exporter should verify.
- 🧭 **S1 applies to building these screens.** This prompt is design only; before any of it is
  coded, the owner gets the S1 alert and the forms are aligned to the contract above.
- Direction **B1 "Navy Canopy"** was chosen in round 2 of `app-auth-screens-prompt.md`. These
  variations explore *flow structure* within it — if one of them needs the canopy to behave
  differently, say so explicitly rather than quietly redrawing the shipped component.
