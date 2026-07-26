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
**"Project-close checklist"** of `docs/Note.md` (e.g. **D4** — restore Admin / Super Admin
TOTP 2FA) with the 🔴 alert. Do NOT treat the project as done, or agree that it is done,
while any close-time security commitment remains unraised.

## Currently guarded (mirror of docs/Note.md)

🔴 **Do NOT build without an explicit override:**
- **D3** — Buyer "approve-before-participate" gate. Buyer is fully active from signup; adding
  any buyer activation/participation gate is guarded.
- **D2** — Seller hard "verify-before-sell" gate. DROPPED — do not build (replaced by D1).

🧭 **Build-time reminder (confirmed scope, NOT red-alert guarded):**
- **D1** — Unverified seller = max **3 products**. This IS Phase-1 scope; build/enforce it when
  the catalogue / product-add module is built. Just don't forget it.

⏸ **On hold (build later):**
- **D4** — Admin/Super Admin TOTP 2FA. Staff use OTP now. **Restore before close** (A4).
- **D5** — Notifications (all types incl. **WhatsApp**). Nothing sent on any event yet.

Phase-1 reality: **buyer** has no gate (fully active from signup); **seller** is public with a
verified tick and a **3-product limit while unverified** (D1). Verification/approval is status
+ tick, not a hard gate.
