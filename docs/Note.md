# 🔴 SCOPE & DEFERRED-WORK LEDGER

Authoritative Phase-1 scope: **`docs/scope-of-work.md`**. This file tracks (a) confirmed
behaviour, (b) work that must NOT be built without an override, (c) build-time reminders,
(d) on-hold work. Enforcement rules: `.claude/rules/remind.md` + `.claude/rules/scope-guard.md`.

**Month-1 / first-draft deferrals** (Phase-1-but-later + Phase-2) live in a separate ledger:
**`docs/month1-not-doing.md`** — guarded by `.claude/rules/scope-guard.md`.

**If a task touches a 🔴-guarded item below, OR goes outside `docs/scope-of-work.md`, STOP,
show a loud 🔴 RED ALERT, and wait for explicit owner confirmation before writing code.**

---

## ✅ Confirmed Phase-1 behaviour (build to this)

- **Buyer** — self-registers, **fully active from signup**, no gate. Employee "approval" is a
  recorded status only (flips `kycStatus` → verified for the tick).
- **Exporter / seller** — self-registers, **profile public immediately**, `kycStatus: pending`.
  Verified = a **tick** (`kycStatus === 'verified'`; no "not verified" badge — absence = unverified).
- **Unverified seller product limit** — unverified seller may add **at most 3 products**; more
  only after an Employee verifies them (see **D1**).
- **Admin access** — **superadmin = all-access**; everyone else (incl. `admin`) needs the
  specific granted permission. Employee permissions are individually assignable.
- **Auth 2FA** — admin/superadmin currently log in via **OTP** (TOTP on hold — see **D4**).

---

## D1 · Unverified seller = max 3 products  🧭 BUILD-TIME REMINDER (confirmed scope)
- **Rule (owner-confirmed):** an unverified seller may add at most **3 products**; to add more,
  an Employee must **verify** them first.
- **Status:** this **IS** Phase-1 scope — build/enforce it when the **catalogue / product-add**
  module is built. No product endpoints exist yet, so nothing enforces it today. Not red-alert
  guarded (it's expected scope) — just don't forget it.
- _(Supersedes the earlier "Phase 1 = no limit" note.)_

## S1 · M1 frontend screens — 🧭 ALERT before building
Before building any M1 auth/KYC **frontend screen** (buyer, exporter, admin, employee), STOP and
alert the owner first, then align the forms to the **backend contract**
(`modules-in-detailed/m1-max-1.5days/feilds-data.png` + `m1.md §7`):
- **Signup is per-role** (separate buyer & exporter forms); **login is ONE shared page**
  (email/mobile + password → OTP verify → role-detect redirect).
- **Exporter signup REQUIRES `entityType` (business/individual)** + optional structured `address`;
  buyer signup does not.
- Wire these flows: login → `verify-otp` (loginToken + code) with **`resend-otp`**; forgot →
  `reset-password` (identifier + code + newPassword); **`change-password`** (must-change staff
  flow: currentPassword + newPassword, returns fresh tokens).
- Verified = a **tick** when `kycStatus === 'verified'` (no "not verified" badge).
- **Admin TOTP is on hold (D4)** — screens show login/OTP only for now.
Do not start the screens without surfacing this alert.

## D2 · Seller hard "verify-before-sell" gate  ❌ DROPPED
- A hard block stopping an unverified seller from selling/publishing at all. **Not built** —
  replaced by D1's 3-product soft limit. Do **not** build the hard gate.

## D3 · Buyer "approve-before-participate" gate  🔴 GUARDED — do not build
- Making a buyer inactive / unable to act until an Employee approves. **OFF in Phase 1** —
  buyer is fully active from signup. Do **not** add this gate without an explicit override
  (red-alert first).

## D4 · Admin / Super Admin TOTP 2FA  ⏸ ON HOLD (restore before close)
- **Committed control (auth-sessions A4):** TOTP required for Admin/Super Admin at login.
- **On hold (heavy):** TOTP enrollment endpoint, admin/superadmin seeding, backup-code login,
  and re-enabling TOTP-for-staff at login.
- **Interim (built + tested):** admin/superadmin log in via **OTP** (still two-factor). The
  `totp` branch + `twofactor.service` are ready, so restoring is wiring, not new logic.
- **⚠️ MUST be restored before project close / final handover.**

## D5 · Notifications (all types, incl. WhatsApp)  ⏸ ON HOLD
- Module 8 not wired: push (Firebase), email, **WhatsApp**, in-app centre. No notification is
  sent on any event yet (signup, approve/verify/reject, enquiry, message, quotation).
- **WhatsApp** additionally depends on external template approval (outside the build). Build later.
- **Interim (dev only):** since no SMS/email provider exists, OTP codes are **printed to the
  terminal in dev/test** (`otp.sender.js`), **hard-gated to non-production**. This is a
  temporary dev affordance — **remove/replace it when real OTP delivery is wired** (OTP must
  never be logged in production — auth-sessions A3).

> ⚠️ **Quotation note on record:** the quote (pages 2, 3, 9) implies a harder gate ("verified
> before they can sell", "only approved buyers participate fully"). Owner has replaced that with
> the softer model above (buyer open, seller 3-product limit). Divergence captured deliberately.

---

## 🔒 Project-close checklist (raise these BEFORE final handover)
- **D4** — restore Admin / Super Admin TOTP 2FA (currently OTP-only).
- **D5** — confirm the full notification set is delivered (or explicitly descoped).
- **Production superadmin — seed with a FRESH password** (not the dev/chat one). The current
  Atlas is a **test-only** environment (owner-confirmed), so the dev superadmin password is not
  a production risk. The real/production superadmin must use a new secret, with
  `SEED_SUPERADMIN_PASSWORD` removed from `.env` after seeding.
- **Remove the dev-only OTP terminal print** (`otp.sender.js`) and wire real OTP delivery.
- **KYC docs on Cloudinary MUST be `type: authenticated` (or `private`), never default public
  `upload`.** The whole KYC security model (A7 / tracker E3) hinges on this: we store only the
  Cloudinary `public_id` as `Organisation.kycDocuments[].storageKey` and serve docs via
  short-lived **signed** URLs. If a KYC file is uploaded as the default public `upload` type,
  anyone who knows `cloud_name` + `public_id` + `format` can fetch the raw document **without any
  signature** — the signed-URL endpoint (M1-D) becomes cosmetic and KYC data is world-readable.
  Before production, verify the M1-B upload path sets `type: 'authenticated'`, uses a
  **randomised `public_id`** (unguessable suffix), and that a raw public URL for a KYC asset
  returns 401/404. _(Recorded 2026-07-28 during M1 Phase-1 review.)_
- **Secret-scan** (gitleaks / trufflehog) over git history once the repo has commits (E6).

_(Append future close-time items here. Standing hygiene rules: `.claude/rules/secrets-and-hygiene.md`.)_

---

## How to add a new item
Behaviour change → update "Confirmed Phase-1 behaviour". Must-not-build → mark a `D<n>` 🔴
GUARDED. Remember-to-build → 🧭 BUILD-TIME REMINDER. On-hold → ⏸ ON HOLD.
