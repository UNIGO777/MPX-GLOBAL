# M6 · FINALIZE — Web Screens — Design Brief

> **M6 is not a screen module.** FINALIZE is a cross-cutting closeout register
> (`modules-in-detailed/m6-Finalization/MPX-FINALIZE-Module.md`), and most of what it holds is
> backend, ops, or content work with **no UI at all**. This brief exists to tell a designer
> exactly which **small** UI surfaces FINALIZE adds — two admin screens, one public landing-page
> data source, and two deltas on M5's admin screens — and to say plainly which items add none.
> Do not expect, and do not invent, a screen-per-F-item.
>
> **Sources:** the F-register above · `build-plans/m6-finalize/backend-plan.md` (owner decisions
> 2026-08-01 + build results — F-A and F5b are already built server-side) · `docs/Note.md`
> (D4 close checklist) · `docs/UiWebNotes.md` · `.claude/rules/web-design.md`. Same conventions
> as `design-plans/m1/web-screens-design.md` (§1 foundations, §1.2 status vocabulary, four states per
> screen); they are not repeated here.

---

## 1. What FINALIZE actually adds to the web UI

| # | Surface | Route | Panel | Named in | New screen? |
|---|---|---|---|---|---|
| 1 | Error log viewer — list | `/admin/errors` | admin (`errorlog:read`) | F5 / backend-plan F-A (built 2026-08-01) | ✅ new |
| 2 | Error log viewer — detail | `/admin/errors/:id` | admin (`errorlog:read`) | F5 / backend-plan F-A | ✅ new (or drawer off #1) |
| 3 | Featured content manager | `/admin/featured` | admin (`featured:manage`) | F5 / backend-plan F5b (built 2026-08-01) | ✅ new |
| 4 | Public landing — featured strips | `/` | public | F5b — `GET /public/featured` | ✳️ delta to the existing landing (M1 web step 7) |
| 5 | Org block cascade status + reason | M5 Organisation detail | admin | F1 open points 2 & 4 (both shipped) | ✳️ delta to an M5 screen |
| 6 | "Not captured" field labels | M5 Organisation detail | admin | F3 | ✳️ delta to an M5 screen — largely already honoured |

Everything else in the F-register — F2 (cancelled), F4 (moved into M4), F6 (closed), the entire
content + infrastructure table, and the whole F-C hygiene pass — adds **zero** web UI. See §5.

**A note on hosts for the deltas (#5, #6):** ✳️ *superseded 2026-08-14 —*
`design-plans/m5/web-screens-design.md` **now exists**; rows 5–6 belong inside its
Organisation-detail screen (verify it carries them — if not, this brief remains their record).
The backend for both already exists (`views/adminOrg.view.js`).

> ✳️ **Build status check (2026-08-14):** screens 1–3 remain **designed-here, not built** — no
> `/admin/errors` or `/admin/featured` route exists in `web/src/App.jsx`, and the landing does
> not yet call `GET /public/featured` (§4a). Only the backend halves (F-A, F5b server-side,
> 2026-08-01) are done. This brief is still forward-looking, not a record of shipped UI.

---

## 2. Screens 1–2 · Error log viewer — `/admin/errors` (+ detail)

**Why it exists (F5):** every user-facing error state in M1 shows a support reference code. That
code is the `requestId`, and this screen is where staff turn it into the server-side detail. It is
the debugging console, deliberately kept **separate from the audit log** — its `errorlog:read`
grant does not hand over the record of every KYC document staff have opened.

**Posture:** read-only. There is **no write verb on the backend at all** — design no delete, no
"clear log", no edit, no export. Retention is a 90-day automatic expiry; say so in the UI (a quiet
caption: *"Entries are kept for 90 days, then removed automatically"*) so nobody goes looking for
a purge button.

### List — `/admin/errors`

**Filters** (all optional, combinable):

| Control | Type | Notes |
|---|---|---|
| Request ID | text | the headline filter — a support reference pasted in verbatim |
| Date range | from / to date pair | |
| Route | text | prefix match on the route path |
| Method | select | GET / POST / PATCH / DELETE / All |
| Status code | select | **5xx only** — the log stores nothing else (4xx is never persisted). Do not offer 4xx options |
| User / Org | text | id lookup |
| Rows per page | select | page-size capped server-side |

**Table columns:** Occurred at · Status code · Method · Route · Request ID (copyable) · Message
(truncated, one line) · User · Org.

**Detail** (row click → own route or drawer): everything in the row **plus the stack trace** and
the recorded-at timestamp. Stack traces are long: monospace, its own scrollable block, a copy
affordance. The stack is only on the detail by design — don't try to preview it in the list.

**States:** loading (skeleton rows) · results · **empty** — two distinct variants: *no errors at
all* (the desired condition — calm, positive) and *no matches for these filters* (name the active
filters, offer clear) · error · detail loading / not found (an entry may have **expired between
list and click** — design a "this entry has expired or does not exist" state, not a broken page).

**Copy constraints:**
- 🔴 Content is internal — stack traces and internal messages. **Never** design any element that
  surfaces this data outside the admin panel (no share link, no public status page).
- The message/stack fields are already secret-redacted at the write site; the UI needs no
  redaction affordance and must not imply one exists.

**Sidebar:** an "Errors" item in the admin sidebar, visible only with `errorlog:read` (the admin
sidebar is permission-driven — same rule as M1 §2).

---

## 3. Screen 3 · Featured content manager — `/admin/featured`

**Why it exists (F5b, owner reversal 2026-08-01):** the landing page needs curated content now.
Backend is built: a `FeaturedItem` covers **four kinds** — banner · product · category · supplier
— with admin CRUD behind the grantable `featured:manage`.

**Structure suggestion:** one screen, four tabs or grouped sections (Banners / Products /
Categories / Suppliers), each an ordered list with drag-or-number reordering.

### Common fields (every kind)

| Label | Type | Required | Notes |
|---|---|---|---|
| Order | number (or drag handle) | ○ | ascending, 0 first; ties break newest-first |
| Active | toggle | ○ | the on/off switch, independent of the schedule |
| Starts at / Ends at | date-time pair | ○ | optional window; either side may be open. End before start is a validation error |

### Banner (the only kind with its own presentation)

| Label | Type | Required | Notes |
|---|---|---|---|
| Image | file upload | ✔ | required for a banner. ⚠️ **Dimensions/aspect ratio are undecided** — see §6 gaps |
| Title | text | ○ | max 120 chars, counter |
| Subtitle | text | ○ | max 240 chars, counter |
| Link URL | text | ○ | **relative path or http(s) URL only** — the backend rejects anything else (stored-XSS control). Show the constraint as helper text, surface the 400 inline |

Banner image has its own upload/replace action (a replaced image cleans up the old asset
server-side — no "orphaned images" UI needed).

### Product / Category / Supplier

| Label | Type | Required | Notes |
|---|---|---|---|
| Target | search-and-pick | ✔ | pick an existing product / category / supplier |

**🔑 The pointer rule shapes this screen.** A featured row stores a reference, never a copy. Two
design consequences:

1. **The list must resolve live.** Each row shows a live preview card of its target. A target
   that no longer resolves (taken down, blocked, deactivated) renders as a **"no longer shown on
   the landing page"** state on that row — greyed card, explanation, delete action. It has already
   left the public page on its own; the admin screen just needs to say so.
2. **Kind and target are not editable.** The backend refuses repointing a slot — design **no**
   "change target" control. The affordance is delete + add. Say why in a helper line if space
   allows (*"To feature something else, remove this slot and add a new one"*).

**Copy constraint — verification is not a gate:** curating an **unverified** supplier is allowed
and deliberate. No warning badge, no "are you sure, they're unverified" friction. The tick renders
if they have it; absence is the only other state (M1 §1.1).

**States:** loading · lists per kind · empty per kind ("nothing featured yet" + add CTA) · create
form (default / uploading / validation errors / success) · reorder saving · delete confirmation
(consequence copy: *"This removes it from the landing page immediately"*) · unresolved-target row
state (above) · error.

**Sidebar:** a "Featured" (or "Landing content") item, visible only with `featured:manage`.

---

## 4. Deltas to existing screens (no new routes)

### 4a · Public landing — featured strips (`/`)

✳️ *Baseline updated 2026-08-14:* the landing is **no longer** the static M1 version — a
2026-08-11 pass gave it real hero data, store brand logos, filled phone mockups, and a category
section using the same photo cards as `/categories` (8, linked). What it still does **not** have
is the F5b wiring: it makes no call to `GET /public/featured` yet, so the strips below remain
to-be-designed-and-wired. F5b gives it real data: `GET /public/featured` returns banners,
featured products, featured categories and highlighted suppliers **in one call**.

Design notes:

- **Four strips:** banner carousel/hero rotation · featured products · featured categories ·
  highlighted suppliers. Cards for the last three use the **exact same public card designs** as
  the rest of the public surface — as of 2026-08-14 that concretely means the shared
  `ProductCard` (chips · price/MOQ · seller row w/ tick; it is now the one product card on
  `/category`, the product page's related row, and the landing), the `/categories` photo tiles,
  and the supplier cards — the payload is the same public projection, nothing richer. Do not
  design a special "featured" card with extra fields; the only genuinely new visual is the banner
  (image + title + subtitle + link).
- **An empty group hides its section entirely.** Before the owner curates anything, all four may
  be empty — the landing must look complete, not gappy, in that state. No "nothing featured"
  placeholder on a public page.
- **Self-healing is silent.** A blocked company or taken-down product simply stops appearing.
  Never a "this item is unavailable" tile on the landing page.
- A supplier card carries `productCount` (live listings) — same as the public seller profile.
  ✳️ *2026-08-14:* the public seller projection also carries `coverImage` since 2026-08-13
  (`/supplier/:slug`'s banner; whitelisted in `m3-public-projection.md`). A featured-supplier
  card MAY use it, with the same fallback-gradient rule as the profile — **no upload endpoint
  exists yet**, so most sellers render the fallback.
- ⚠️ `docs/UiWebNotes.md` governs the wiring: strips added before wiring must be logged there.

### 4b · M5 Organisation detail — block reason + cascade status (F1)

F1 is fully built. The block/unblock **actions** are M5 admin-console territory (superadmin-only);
FINALIZE contributed two things the Organisation detail screen must show:

| Element | Detail |
|---|---|
| **Block modal — reason field** | required textarea; stored, audited, and reused as the takedown/freeze explanation everywhere. Helper: it becomes the recorded reason across the seller's products and chats |
| **Cascade status** | the cascade runs in the **background**. The screen shows `blockCascade`: status **running / done / failed** + direction (block/unblock) + product and conversation counts + completed-at. **`failed` must be loud** — a `danger` alert, not a chip: a failed cascade means a blocked company's catalogue may still be live. Offer "contact support / retry per ops" copy rather than pretending a retry button exists (none does) |
| **Unblock consequence copy** | unblock **restores prior state only** — a product taken down individually beforehand stays down, an individually blocked chat stays blocked. The confirm modal must say this, or an admin will report restored-but-still-down items as bugs |
| **Refusals to design as clear inline messages** | the platform org can never be blocked · double-block / double-unblock are conflicts ("already blocked") · activating a user of a blocked org is refused |

### 4c · M5 Organisation detail — the fields nobody can fill (F3)

`registrationNumber` · `website` · `taxId` · `establishedYear` · `authorisedSignatory` exist on
the model but **no form anywhere captures them** (capture is Phase 2). Until F3 closes, the admin
Organisation detail must **hide them or label them "Not captured"** — never render them as empty
inputs awaiting data, and never as blanks that look like missing data-entry. The backend-plan
notes M5's screen already labels them this way; this row exists so a redesign doesn't regress it.
🔒 Reminder: `website` is internal-only, never on any public surface.

---

## 5. Do not design — with sources

| Item | Why not | Source |
|---|---|---|
| **F6 threshold / auto-suspend UI** | **CLOSED by owner 2026-08-01 — no threshold exists.** The console shows `Organisation.takedownCount` and a human decides. No threshold config field, no "N takedowns until suspension" meter, no auto-suspend warning banner | F-register F6 |
| **Timed suspension** | decided 2026-08-01 — not built. Block is a manual on/off toggle; no "suspend until" date picker | F1 open point 3 |
| **Archived-product purge / evidence screens** | F2 **CANCELLED** — archived products keep row + images forever (§A7). No purge countdown, no purge settings | F-register F2 |
| **Self-enquiry guard UI** | F4 moved into M4 (guard at enquiry creation) — any surface it needs belongs to the M4 brief | F-register F4 |
| **Platform settings screen** | moved to month 2 — this is where a threshold would have lived, and it isn't being designed now | F6 narrative / month1-not-doing |
| **Two-tab "Logs" screen** | collapsed when the error log moved out of M5 — errors and audit are **separate screens with separate grants**, not tabs of one | F-register F5 |
| **Notification centre / email / WhatsApp settings** | D5 ON HOLD (FCM slice built in M4, headless) | `docs/Note.md` D5 |
| **Seller "request unblock" flow** | D6 ON HOLD, ~1 month out | `docs/Note.md` D6 |
| **Any Phase-2 surface** (escrow, payouts, contracts, orders…) | Bucket B | `docs/month1-not-doing.md` |

### 5a · Known FUTURE need — D4 TOTP screens (do NOT design now)

🔴 **D4 · Super Admin TOTP 2FA is ON HOLD** (`docs/Note.md` D4 — raised 2026-08-01 at the
FINALIZE plan, owner said **NOT NOW**; it is a deferral, not a cancellation, and **must be raised
again at project close**). The backend service layer exists; only the flow around it is missing.
**When** it is picked up, the web will need roughly:

- 2FA setup (secret + QR / `otpauth://` for an authenticator app)
- Enable confirmation with a live code + **backup codes shown exactly once** (M1 screen 16's
  temporary-password pattern is the precedent)
- A TOTP code step at staff login replacing OTP for enrolled accounts, with backup-code redemption
- Disable (requires a current code)

Two product decisions are still open (superadmin-only vs all staff; mandatory vs opt-in), so
designing these now would be designing against an unmade decision. **List only — no artwork.**

### 5b · FINALIZE items with no UI at all

For completeness, so nobody hunts for their screens: the entire **F-C hygiene pass** (index sync,
C10 append-only audit grant, Mongo auth + backups, key/password rotations, dev OTP print removal,
secret scan, KYC-private regression test — 🔴 **all still OPEN as of 2026-08-14**: rotations, the
OTP terminal-print removal and the D4 TOTP restore remain close-out items per `docs/Note.md` /
`secrets-and-hygiene.md`; nothing here is done) and the **content/dependency table** (40 category
synonyms, 40 category images — uploaded through the **existing** M5 category admin, no new
screen — OTP provider, OpenAI/Redis/Cloudinary keys, VPS setup, Girish's sign-off). Backend/ops/
content only.
✳️ *Content status 2026-08-14:* the **40 top-category images are DONE** (real verified photos,
2026-08-11), and **sub-category images stand at 252/261** (2026-08-14 pipeline; the remaining 9 —
two "Other …" catch-alls by design plus seven where free-image quality bottomed out — render the
neutral monogram and can be filled any time via the category admin). Synonyms remain owner
content, status unchanged here.

---

## 6. Gaps and open points for the designer

1. **Banner artwork spec is undecided.** The backend accepts an image; nothing anywhere fixes
   dimensions, aspect ratio, count shown at once, or rotation behaviour. Propose one (and how it
   degrades at 375px) and get owner sign-off before final artwork — this also becomes the upload
   helper text on screen 3.
2. ✳️ *Resolved 2026-08-14:* **the M5 web design brief now exists**
   (`design-plans/m5/web-screens-design.md`). The two F1/F3 deltas in §4b–4c belong in its
   Organisation-detail screen — confirm it folds them in; if it doesn't, this file remains their
   record.
3. ✳️ *Confirmed 2026-08-14:* the shared `ErrorState` component
   (`web/src/components/ui/ErrorState.jsx`) renders the server `requestId` as a support
   reference, and built screens pass it through (e.g. `CategoryListing`, `ProductMonitoring`).
   The loop the error viewer depends on is real.
4. **Brand palette** — still the same open item as M1 §10.
