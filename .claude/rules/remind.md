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
  exist; verified = tick from `kycStatus`). Details in `docs/Note.md` **S1** + build-prompt **A21**.
- **A22 · Company profile screens (M1, new — S1 covers them too)** — buyer **and** exporter can view
  and edit their own `Organisation`; Organisation data is **not write-once at signup** (A21 creates,
  A22 edits — keep the field sets identical). Exporter screen also carries **logo + description**
  (M3's public seller page has no other capture path for them) plus a public-page preview through
  the shared `toPublic()` projection. **Lock after verification:** name, country, address,
  `entityType` become read-only; changing one is allowed but drops `kycStatus` → `submitted`
  (existing resubmit path) so the tick is withheld until re-approval, and writes an AuditLog entry.
  ✅ **No new model fields needed** — every A22 field already exists on `Organisation`; the work is
  the edit endpoint, the lock and the demotion, not schema. 🚫 **"Business type" + working categories
  are CANCELLED** (2026-07-30) — removed, not deferred. 🔒 **`website` is internal, never public.**
  Detail: build-prompt **§A22** + `m1.md` §5b.

⏸ **On hold (build later):**
- **D4** — Super Admin TOTP 2FA. Staff use OTP now. **Restore before close** (A4).
- **D5** — Notifications (all types incl. **WhatsApp**). Nothing sent on any event yet.

Phase-1 reality: **buyer** has no gate (fully active from signup); **seller** is public with a
verified tick and a **3-active-listing limit while unverified** (taken-down excluded from the count — §A10; + 10-draft cap §A15) (D1). Verification/approval is status
+ tick, not a hard gate.
