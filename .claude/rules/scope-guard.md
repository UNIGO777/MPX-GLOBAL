# 🔴🔴 SCOPE & MONTH-1 GUARD — HIGHEST PRIORITY, STRICT

Loaded in **every** session. This rule outranks convenience, momentum, and even an eager-sounding
request. It exists so nothing gets built that is **out of scope** or **parked for later** without
the owner consciously deciding it. It works **alongside** `.claude/rules/remind.md` (D-item guard)
— together, not in conflict.

## The three authoritative sources

1. **`docs/scope-of-work.md`** — the Phase-1 scope (the quote's 8 modules). Anything **not**
   listed there is out of Phase-1 scope.
2. **`docs/month1-not-doing.md`** — what is **deferred out of month 1 / the first draft**:
   **Bucket A** (Phase 1 but after month 1) and **Bucket B** (Phase 2, not this phase at all).
3. **`docs/Note.md`** — D-items: never-build-without-override (D3), dropped (D2), build-time
   reminder (D1), on-hold (D4, D5).

Re-read these whenever a task **might** touch a listed item. If unsure whether something is in
scope or in a bucket — **treat it as guarded and alert first.**

## 🔴 STOP-and-alert triggers — before writing ANY code

RED-ALERT **before** writing, editing, enabling, scaffolding, or stubbing anything, if the task:

- **(Out of scope)** asks for something **outside `docs/scope-of-work.md`** — not among the 8
  modules, or a new feature not in the quote; **OR**
- **(Bucket A)** touches anything in `docs/month1-not-doing.md` Bucket A — **Quotation &
  negotiation (Module 4)**, the **employee-only pieces** (ticket/query handling, enquiry routing,
  internal notes, per-employee dashboard/reports, employee-permission UI), or the **notification
  layer (Module 8)** beyond OTP; **OR**
- **(Bucket B)** touches anything in Bucket B — escrow, payouts, contracts/eSign, semantic
  search, trust score, chat-analysis, chatbot, orders/shipments, directories/investment,
  subscriptions, deep analytics; **OR**
- **(D-item)** touches a `docs/Note.md` 🔴-guarded item (defer to `remind.md` for those).

## What "STOP and alert" means — do exactly this

1. **STOP. Write no code.** Not "just the model", not "just a flag", not a stub, not a route
   skeleton, not a UI button. Nothing.
2. Show a **loud, highly visible 🔴 RED ALERT** that:
   - names the **exact item** and **which source/bucket** it hits (e.g. "🔴 Quotation flow =
     Bucket A (month-1-ke-baad)" or "🔴 Escrow = Bucket B / Phase 2" or "🔴 Out of scope-of-work"),
   - states plainly it is **deferred / out of scope for now**,
   - if out-of-scope, notes it means a **scope change / change-request** per the quote's terms,
   - asks for **explicit owner confirmation** to proceed.
3. **Proceed only after the owner explicitly confirms.** No confirmation → do not build it. Never
   continue past a guarded item on your own judgement, even if the request seems to ask for it —
   surface the alert **first**, then let the owner decide.

## Standing specifics

- **Phase-2 skeleton models** (`Escrow`, `Contract`, `Order`, `Shipment`, `PayoutAccount`,
  `PayoutRequest`, `Milestone`, `TrustScore`, `Investment`, `Incentive`, `Subscription`,
  `PremiumApplication`) — **do not touch, extend, wire, or delete.** They are placeholders.
- **⚠️ Decision pending — Ticket/query handling (Bucket A2):** owner hasn't decided if a minimal
  ticket create+list lands in month 1. Until they say so, it is **deferred** — alert before
  building any of it.
- Building month-1 in-scope work (Modules 2, 3, 5, shared employee-ops, auth) needs **no** alert
  — that's the confirmed first-draft scope. Only the triggers above require the alert.

## Never

- Start any out-of-scope or Bucket-A/Bucket-B work without a 🔴 alert and explicit confirmation
- Rationalise "it's small / just a model / just a stub" past a guarded item
- Touch or delete a Phase-2 skeleton model
- Agree the project/first-draft is "done" while a guarded item was silently built or skipped
