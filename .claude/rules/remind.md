# 🔴 Deferred-work reminder guard

Loaded in every session. This rule outranks convenience and momentum: it exists so that
work the owner has **parked for later** is never built silently or prematurely.

## The ledger

`docs/Note.md` lists items that are **intentionally deferred** out of the current phase.
Treat that file as authoritative and re-read it whenever a task might touch a listed item.

> **Companion guard:** month-1 / first-draft deferrals (Quotation · employee-only pieces ·
> Notifications · all of Phase 2) are tracked in **`docs/month1-not-doing.md`** and enforced by
> **`.claude/rules/scope-guard.md`**. That rule and this one work together — a Bucket-A/B item or
> an out-of-scope request triggers the same STOP + 🔴 RED ALERT + explicit-confirmation flow.

## Authoritative scope — red-alert if a request goes outside it

The Phase-1 scope of work is **`docs/scope-of-work.md`**. If a request asks for something
**outside** that scope — not among the quote's 8 modules, listed as Phase-2/deferred, or a new
feature not in the quote — STOP and 🔴 RED ALERT the owner before building, so they can decide
consciously (scope change / change-request per the quote's terms). Do not silently build
out-of-scope work.

## Hard rule — STOP and remind first

Before writing, editing, enabling, scaffolding, or otherwise moving toward **any** item in
`docs/Note.md`, you MUST:

1. **STOP. Do not write any code.** Not "just the model", not "just a flag", not a stub.
2. Show the owner a **loud, highly visible 🔴 RED ALERT** reminder that:
   - names the exact deferred item (e.g. "D1 · Seller product-add limit"),
   - states it is **deferred / not in the current phase**,
   - asks for **explicit confirmation** to proceed.
3. **Proceed only after the owner explicitly confirms.** No confirmation → do not build it.
   Under no circumstances continue past a deferred item without reminding.

This applies even if the owner's current request seems to ask for it — surface the reminder
**first**, then let them confirm.

## Proactive flagging

- Whenever the owner **adds a new reminder** (a new `D<n>` block in `docs/Note.md`, or asks
  to "remind me about X later"), acknowledge it and record it in `docs/Note.md`.
- Whenever the **current task relates to anything** in the ledger — even tangentially —
  say so up front with the 🔴 alert, before doing the work.

## At project close / final handover

Before the project is closed or handed over, proactively surface every item in the
**"Project-close checklist"** of `docs/Note.md` (e.g. **D4** — restore Super Admin
TOTP 2FA) with the 🔴 alert. Do NOT treat the project as done, or agree that it is done,
while any close-time security commitment remains unraised.

## Currently guarded (mirror of docs/Note.md)

🔴 **Do NOT build without an explicit override:**
- **D3** — Buyer "approve-before-participate" gate. Buyer is fully active from signup; adding
  any buyer activation/participation gate is guarded.
- **D2** — Seller hard "verify-before-sell" gate. DROPPED — do not build (replaced by D1).

🧭 **Build-time reminder (confirmed scope, NOT red-alert guarded):**
- **D1** — Unverified seller = max **3 ACTIVE products** (🔴 Part A §A10: **taken-down products do NOT count** toward the cap — the cap query must exclude `takedown.isDown: true`) **+ max 10 drafts** (§A15). ✅ **ENFORCED since 2026-07-31** — M2 backend built; both caps fire server-side with tests (publish + create paths). Verification lifts them.
- **S1** — Before building any M1 **frontend screen** (buyer/exporter/employee/superadmin auth/KYC),
  STOP and alert the owner first; align forms to the backend contract (**Part A §A21**:
  **separate buyer & exporter login portals** — `POST /auth/login` takes a `portal`, staff use a
  separate `POST /auth/staff/login`, NO single shared login; **signup is two-step** — shared
  step-1 → OTP → step-2 Organisation claim/create where exporter adds `entityType`; same
  email/mobile may hold one buyer + one exporter account; `resend-otp` + `change-password` flows
  exist; verified = tick from the derived `verified` boolean — the public API never returns raw
  `kycStatus`, see `web-design.md`). Details in `docs/Note.md` **S1** + build-prompt **A21**.
  ⚠️ **Contract CHANGED 2026-08-03 — re-read before touching any signup screen.** Signup now
  verifies **both the email and the mobile with SEPARATE codes**, and `/auth/buyer/signup` +
  `/auth/exporter/signup` **no longer exist**. The flow is `POST /auth/signup/start` (identity
  only — no company) → `/verify` per channel → `/complete` (company; the only call that creates
  the account, and the only one that returns a session). Screens shipped for web and app on
  2026-08-03; S1 was raised for them.
- **A22 · Company profile screens (M1, new — S1 covers them too)** — buyer **and** exporter can view
  and edit their own `Organisation` — ⚠️ **except (D7 rule 7, 2026-09-23): once the organisation has
  an active EXPORTER account, only the exporter edits the company profile and uploads KYC; the buyer
  there sees it read-only** (`canEdit` / `canManage`, server-enforced); Organisation data is **not write-once at signup** (A21 creates,
  A22 edits — keep the field sets identical). Exporter screen also carries **logo + description**
  (M3's public seller page has no other capture path for them) plus a public-page preview through
  the shared `toPublic()` projection. **Pending-change model (2026-08-19 — supersedes the old
  lock-and-demote):** name, country, address, `entityType` stay editable, but on a VERIFIED org the
  change goes to `pendingChanges` for re-approval with fresh documents — the live profile and tick
  never move until a reviewer approves. `entityType` is editable for BOTH sides now. Every
  transition writes an AuditLog entry.
  ✅ **No new model fields needed** — every A22 field already exists on `Organisation`; the work is
  the edit endpoint, the lock and the demotion, not schema. 🚫 **"Business type" + working categories
  are CANCELLED** (2026-07-30) — removed, not deferred. 🔒 **`website` is internal, never public.**
  Detail: build-prompt **§A22** + `m1.md` §5b.

✅ **Override granted — do NOT alert again:**
- **D9 — Chat attachments (IMAGES only).** Was explicitly out of scope (`m4.md` line 15 and
  **M4-14**, which parks document exchange with the Quotation module). The red alert was raised
  2026-09-23 and the owner confirmed. Stored PRIVATE (the KYC pattern), never the public
  product-image pattern. Detail: `docs/Note.md` **D9**.
- **D11 — Platform warnings in chat.** Red alert raised 2026-09-24, owner confirmed: staff with
  `conversation:block` pick one of the PRE-WRITTEN warnings (`src/utils/chatWarnings.js`); it posts
  as the platform, audited. 🔴 **Staff still never write free text into a thread** — any free-text
  or per-person staff message is a new decision and needs its own alert. Detail: `docs/Note.md` **D11**.
- **D10 — Chat attachments (DOCUMENTS: PDF, .docx, .xlsx ONLY).** Red alert raised 2026-09-24,
  owner confirmed ("make it"). Same private store, a forced-download URL (+ an inline `viewUrl`
  for PDFs only, opening on Cloudinary's origin) and an active-content screen (PDF scripts,
  Office macros). Never add an in-browser viewer for Word/Excel that ships the file to a third
  party without asking. 🔴 **Any other file type — zip, exe,
  legacy .doc/.xls, macro-enabled .docm/.xlsm, "any file" — is NOT covered and still needs its
  own alert.** App sends and shows both (2026-09-24, not yet device-tested). Detail: `docs/Note.md` **D10**.

⏸ **On hold (build later):**
- **D4** — Super Admin TOTP 2FA. Staff use OTP now (still two-factor). **Restore before close** (A4).
  ✅ **2026-08-23 — owner SCHEDULED IT FOR MONTH 2** ("ye chodna h isse after 1 month me dalo").
  It is now a **scheduled Bucket-A item**, not an open question: **do NOT alert or re-raise it
  during month 1**, including when touching auth.
  🔴 Unchanged: it is a **deferral, not a cancellation**, and it stays the committed control in
  `auth-sessions` **A4**. If month 2 ends without it, **raise it at project close** — the
  close-checklist guard below still applies. Detail (what is already built, and the two decisions
  it still needs): `docs/Note.md` D4.
- ✅ **D7 — Organisation claim at signup (A21 step 2). BUILT 2026-09-23. Do NOT alert on it again.**
  The hold (owner, 2026-08-18) was surfaced and the owner reaffirmed the instruction.
  **Revised the same day to the owner's seven-rule model — authoritative text: build-prompt §A21
  "Organisation claim"; build ALL of it on any client, the app included.** One active buyer + one
  active exporter per org (unique index); the offer is a list (email and phone can reach different
  companies — pick one); a claim proves the **existing member's email** (`claim_org_email` code,
  name withheld until then — the recycled-SIM fix); the exporter controls the company profile.
  🔴 **The security model is that the client cannot NAME a target** — it echoes an opaque
  `claimChoice` the server issued, and `complete` re-checks eligibility (the stored offer
  restricts, never grants). Never add an org id, or a typed company name, to any claim endpoint:
  that turns it into a company-membership oracle and then a way to join an arbitrary company.
  Seat changes (a colleague, a departed holder — F3/F4) are **support-mediated**, not a feature.
  Tests: `d7-organisation-claim.test.js`, `d7-profile-control.test.js`.
  🔴 **The APP claim screen is still a stub** — raise it when app signup work comes up.
- ✅ **D8 — Platform settings page (§3.5). BUILT 2026-09-22. Do NOT alert on it again.** The hold
  (owner, 2026-08-21) was surfaced as a red alert and the owner explicitly confirmed the override.
  Shipped at `/admin/settings`, **superadmin-only**, with the exact decided contents: the AI guest
  daily ceiling (§3.3 promises the Client may change it "at any time", which the env var alone
  could not deliver) + the support contact. Backend: single-document `Settings` model,
  `GET/PATCH /admin/settings`, an AuditLog entry on every change (§11.1), `aiQuota.service.js`
  reading the override with `AI_GUEST_DAILY_MAX` as the boot-time floor.
  🔴 **The exclusions are still live rules** — this page must NEVER gain the D1 caps (written into
  agreement §3.2), OTP knobs, any secret, or banner/featured content. The server schema is
  `.strict()`, so adding a field there without a server change is refused, not ignored. Detail:
  `docs/Note.md` **D8**.
- **D5** — Notifications (email, **WhatsApp**, in-app centre, admin controls, non-M4 events).
  ✅ **CARVE-OUT 2026-07-31 — FCM push is APPROVED into month 1** (owner-confirmed), built in M4:
  `firebase-admin` + `DeviceToken` + dead-token cleanup + **two events only** (new enquiry → seller,
  new message → counterparty). **Do not re-alert on that slice.** Everything else in D5 still is.
  ✅ **Email events approved so far: six** — the sixth is "someone joined your company" (D7 F6,
  owner 2026-09-23, built). A **seventh** email event needs a fresh alert.

Phase-1 reality: **buyer** has no gate (fully active from signup); **seller** is public with a
verified tick and a **3-active-listing limit while unverified** (taken-down excluded from the count — §A10; + 10-draft cap §A15) (D1). Verification/approval is status
+ tick, not a hard gate.
