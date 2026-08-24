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
- **Unverified seller product limit** — unverified seller may hold **at most 3 ACTIVE products**
  (taken-down products **excluded** from the count — Part A §A10) **+ max 10 drafts** (§A15);
  the cap lifts after an Employee verifies them (see **D1**).
- **Roles = 4** — `buyer` · `exporter` · `employee` · `superadmin`. **No `admin` role exists**
  (removed 2026-07-28: nothing ever created one; the quote names only a Super admin dashboard
  and an Employee panel). Don't re-add it without an explicit owner decision.
- **Dual accounts / separate portals / two-step signup (build-prompt §A21, 2026-07-28)** —
  buyer & exporter are **separate accounts on separate login portals** (`/auth/login` + `portal`;
  staff on `/auth/staff/login`). Same email/mobile may hold **one buyer + one exporter** (never two
  same-role); credentials + OTP locks independent. Signup = shared step-1 → OTP → step-2 with
  **Organisation claim-or-create**. One company = one Organisation (claim carries the tick over);
  an Organisation may be buyer-side, exporter-side, or **both** → **`Organisation.type` can no
  longer be the single buyer/exporter discriminator**; an admin block takes both sides down.
  This **reverses** the old "one shared login for all four roles" decision.
- **Admin access** — **superadmin = all-access**; employees need the specific granted
  permission. Employee permissions are individually assignable. Governance actions
  (user activate/deactivate, employee create, permission assign) are **hard superadmin role
  gates**, never grantable permissions.
- **Auth 2FA** — the superadmin currently logs in via **OTP** (TOTP scheduled for month 2 — see **D4**).

---

## D1 · Unverified seller = max 3 ACTIVE products (+10 drafts)  🧭 BUILD-TIME REMINDER (confirmed scope)
- **Rule (owner-confirmed, refined by Part A §A10/§A15):** an unverified seller may hold at most
  **3 ACTIVE (published) products** — **taken-down products do NOT count** toward the cap
  (`takedown.isDown` excluded) — **plus max 10 drafts**; verification lifts the cap.
  Authoritative source: `docs/MPX-M2-M3-Build-Prompt.md` Part A (this ledger mirrors it).
- **Status:** ✅ **ENFORCED — M2 backend built 2026-07-31.** The 3-ACTIVE cap (taken-down
  excluded — §A10) fires on every publish (draft→active AND inactive→active) and the 10-draft
  cap (§A15) on create; both server-side with tests. Verification lifts both.
- _(Supersedes the earlier "Phase 1 = no limit" note.)_

## S1 · M1 frontend screens — 🧭 ALERT before building
Before building any M1 auth/KYC **frontend screen** (buyer, exporter, super admin, employee), STOP and
alert the owner first, then align the forms to the **backend contract**
(`modules-in-detailed/m1-max-1.5days/feilds-data.png` + `m1.md §7`):
- **⚠️ Updated by build-prompt Part A §A21 (reverses the old "one shared login"):**
  - **Separate buyer & exporter login portals**, each its own page — `POST /auth/login` takes a
    `portal`; **staff (employee/superadmin) use a separate `POST /auth/staff/login`** (no portal).
    There is **no** single shared login / role-detect redirect anymore.
  - **Signup is TWO steps:** shared **step-1** (name, email, phone, password) → **OTP** →
    **step-2** company step showing whether an Organisation already exists → **claim** or
    **create-new**. Create-new adds name, country (exporter also `entityType` + address). Signup
    no longer creates User + Organisation in one call.
  - **Same email/mobile may hold one buyer + one exporter account** (never two same-role);
    credentials + OTP locks independent. Wrong portal → generic "Invalid credentials".
- Wire these flows: login → `verify-otp` (loginToken + code) with **`resend-otp`**; forgot →
  `reset-password` (identifier + code + newPassword); **`change-password`** (must-change staff
  flow: currentPassword + newPassword, returns fresh tokens).
- Verified = a **tick** when `kycStatus === 'verified'` (no "not verified" badge).
- **Admin TOTP is scheduled for month 2 (D4)** — screens show login/OTP only for now.
- **⚠️ New — build-prompt §A22 adds TWO M1 screens that were never in the plan:** the **company
  profile** (Organisation view/edit) for **exporter** (name/country/address/`entityType` + logo,
  description + public-page preview) and for **buyer**
  (name/country/address/`entityType` only). Organisation data is **not write-once at signup**.
  Verify hone ke baad the KYC-checked fields (**name, country, address, `entityType`**) are
  **read-only on the screen**; changing one is allowed but drops `kycStatus` → `submitted` and
  withholds the tick — the form must say so before submitting. **A22 needs no new model fields** —
  `logo`/`description` already exist; the work is the endpoint + lock + demotion. 🚫 **"Business
  type" and working categories are CANCELLED** (2026-07-30) — removed, not deferred; `entityType`
  covers it. 🔒 `website` is **internal, never public**. Detail: `m1.md` §5b + build-prompt §A22.
Do not start the screens without surfacing this alert.

## D2 · Seller hard "verify-before-sell" gate  ❌ DROPPED
- A hard block stopping an unverified seller from selling/publishing at all. **Not built** —
  replaced by D1's 3-product soft limit. Do **not** build the hard gate.

## D3 · Buyer "approve-before-participate" gate  🔴 GUARDED — do not build
- Making a buyer inactive / unable to act until an Employee approves. **OFF in Phase 1** —
  buyer is fully active from signup. Do **not** add this gate without an explicit override
  (red-alert first).

## D4 · Super Admin TOTP 2FA  ⏸ SCHEDULED FOR MONTH 2 (still a close-time commitment)
- **Committed control (auth-sessions A4):** TOTP required for the Super Admin at login.
- **On hold (heavy):** TOTP enrollment endpoint, superadmin seeding, backup-code login,
  and re-enabling TOTP-for-staff at login.
- **Interim (built + tested):** the superadmin logs in via **OTP** (still two-factor). The
  `totp` branch + `twofactor.service` are ready, so restoring is wiring, not new logic.
- **⚠️ MUST be restored before project close / final handover.**
- **🆕 2026-08-23 — owner MOVED IT OUT OF MONTH 1 into month 2** ("ye chodna h isse after 1 month
  me dalo"), raised while reviewing what is still pending in month 1. So D4 is now a **scheduled
  Bucket-A item** (`docs/month1-not-doing.md` **A4 · Cross-cutting**) rather than an open on-hold
  question, and it
  needs **no further alert during month 1** — do not re-raise it every time auth is touched.
  🔴 **What did NOT change:** it is still a **deferral, not a cancellation**, and still the
  committed control in `auth-sessions` **A4**. If month 2 ends without it, it must be raised
  again at project close — `remind.md`'s close checklist keeps that guard. Staff remain on OTP
  (still two-factor) in the meantime, so this is a weaker control, not an absent one.
- **2026-08-01 — RAISED at the FINALIZE build plan, owner said NOT NOW.** D4 stayed ON HOLD;
  staff continue on OTP. This was a deferral, **not** a cancellation, and
  `auth.service.js`'s `// ON HOLD (docs/Note.md D4)` comment stays accurate.
  Confirmed while planning: what is missing is only **enrolment + the login switch + backup-code
  redemption + disable**. `twofactor.service.js` (secret, key URI, verify, hashed single-use
  backup codes) and `completeLogin`'s `method === 'totp'` branch already exist and are tested.
  **Two decisions still open when it is picked up:** superadmin-only or all staff, and mandatory
  or opt-in. *(Mandatory locks a superadmin out permanently if they lose both the authenticator
  and the backup codes — opt-in until the owner has enrolled is the safer first step.)*

## D5 · Notifications (all types, incl. WhatsApp)  ⏸ ON HOLD — **except FCM push + EMAIL (carved out)**
> ✅ **2026-07-31 — owner explicitly approved FCM push into month 1**, built inside M4. Schedule
> change only (Module 8 is already Phase 1), **not** a scope change. Approved slice: `firebase-admin`,
> `DeviceToken` register/unregister, dead-token cleanup, and sends on **two M4 events only** —
> new enquiry → seller, new message → counterparty.
>
> ✅ **2026-08-04 — owner explicitly approved EMAIL out of D5.** Alert was raised (email
> notifications are a named D5/Bucket-A3 item) and the owner chose "OTP by email + general email
> notifications", which is the override. **Built so far:** SMTP transport (`email.provider.js`,
> `nodemailer`) and **OTP delivery by email**. ⚠️ **The non-OTP notification EVENTS are approved but
> NOT yet built** — which events, and their copy, still need the owner's list (see
> `docs/History.md` 2026-08-04). Do not invent them.
>
> ✅ **2026-08-21 — owner approved a FIFTH email event: "request more information" → seller.**
> Alert was raised (`emailNotifications.service.js` carries an explicit "do not add a fifth without
> a new alert" guard) and the owner approved it. **Do not re-alert on this one.** Driver: agreement
> §3.7 requires "the seller sees … what is needed if more information is requested", and email is
> what makes a resubmission prompt rather than dependent on the seller happening to open the portal.
> The event belongs to the request-more-info / `in_review` work — build it there, not on its own.
> **The guard itself stays**: a SIXTH event still needs a fresh alert.
>
> 🔴 **Still ON HOLD and still needing an alert:** **WhatsApp**, the `Notification` model / in-app
> centre, admin per-type enable-disable, and delivery tracking + retry.
- **WhatsApp** additionally depends on external template approval (outside the build). Build later.
- ✅ **REAL OTP DELIVERY IS WIRED (2026-08-04)** — Fast2SMS for SMS, SMTP for email.
  🔴 **Fast2SMS is INDIA-ONLY**, so any non-`+91` number falls back to email. Buyer login is
  OTP-gated and buyers are international, which makes SMTP **load-bearing, not optional**.
- **Interim (dev only):** the terminal OTP print in `otp.sender.js` now fires **only when no real
  transport could deliver**, and remains hard-gated to non-production. It is still a temporary dev
  affordance — **remove it once delivery is proven in staging** (OTP must never be logged in
  production — auth-sessions A3).

## D6 · Seller "request unblock" for a taken-down product  ⏸ ON HOLD (build ~1 month later)
- **What the owner asked for (recorded 2026-07-28):** jab admin ek product **takedown** kar de,
  seller us product ke **unblock ki request** bhej sake — abhi seller sirf `takedown.reason` +
  date dekh sakta hai (Part A §A9), koi appeal/reinstatement path nahi hai.
- **Deferred:** build **around 2026-08-28** (owner ne "1 month baad" kaha). Month-1 / first draft
  me **NAHI** — see `docs/month1-not-doing.md` **A5**.
- **Build-time constraints (jab banega, ye mat todna):**
  - Ownership-scoped: `findOne({ _id, exporterOrgId: req.user.orgId })`; not-found = **404**.
  - Request sirf tab valid jab `takedown.isDown === true`; ek product pe ek hi pending request
    (duplicate spam rokna) + rate-limit.
  - Seller ko **`takedown.byUserId` kabhi na dikhe** (§A9) — request/response me acting admin ka
    koi trace nahi.
  - Unblock **admin decide karega** — approve = existing `POST /admin/products/:id/restore` path;
    seller khud kabhi restore na kar paaye.
  - Request raise / approve / reject — teeno **AuditLog** me (actor + target + timestamp +
    reason), append-only (§A19).
  - 🔴 **§A8 interaction:** 180-din-blocked purge se pehle ek pending unblock request ka kya hoga
    — purge rok de ya request lapse ho jaaye — **owner se poochna hai jab build ho** (abhi undecided).
- **Open (owner decide kare jab build ho):** naya `UnblockRequest` model banega ya `takedown`
  object ke andar hi sub-fields; seller ko decision ka pata kaise chalega (D5 notifications
  on-hold hain, to abhi sirf in-panel status dikhega).

> ⚠️ **Quotation note on record:** the quote (pages 2, 3, 9) implies a harder gate ("verified
> before they can sell", "only approved buyers participate fully"). Owner has replaced that with
> the softer model above (buyer open, seller 3-product limit). Divergence captured deliberately.

---

## D7 · Organisation **claim** at signup (A21 step 2)  ⏸ ON HOLD (owner, 2026-08-18)

- **What it is:** A21's step-2 branch — after both OTPs pass, show whether an Organisation already
  exists for that verified email/mobile and offer **claim** or **create-new**. A claimed org
  *"carries its verification over — no second KYC, one tick, one public profile"*; declining creates
  a fresh org that verifies separately (build-prompt **§A21**, lines 246–252).
- **Owner decision 2026-08-18: build it LATER.** Not month-1 / not now. Do not start it without an
  explicit go-ahead.
- **Status today:** `signup.service.js` `completeSignup` **always creates** — the 🚧 comment at
  the top of that function says so. `createUserWithOrg` → `Organisation.create` + `User.create`.
- **🔴 The consequence while it is deferred — bigger than "a colleague cannot join".**
  `Organisation.name` is intentionally NOT unique and complete always creates, so one company
  signing up twice (buyer, then exporter — which `assertIdentityAvailable` explicitly allows on one
  email) ends up with **two Organisations**, the second carrying a random slug suffix. That means
  **two KYC submissions, two ticks to earn, two public profiles**, and an admin **"Block company"
  hits only one of them while the twin keeps trading**. "One company = one Organisation" is a stated
  intention, not an enforced invariant, until claim ships.
- **What it needs when built (no schema work is expected):**
  1. A lookup keyed on the **verified identity held in `PendingSignup`** — find Users with that
     email/mobile and take their `orgId`. There is no other route: an `Organisation` carries no
     contact fields of its own (the email/mobile on it belong to `authorisedSignatory`, captured for
     Phase-2 contracts).
  2. A branch in `completeSignup` that attaches to that `orgId` and sets the missing side flag
     (`buyerSide` / `exporterSide`) instead of creating.
  3. Carry `kycStatus` over — no second KYC.
- **Owner decision (2026-08-19): a claiming exporter's product-add unlocks at profile-FILLED** —
  once `entityType`/address are captured (pending review), not once they are verified. The
  existing unverified caps (D1: 3 active / 10 drafts) bound the risk meanwhile.
- **⚠️ Owner-raised design point (2026-08-19) — the two sides' profiles DIFFER, so carry-over is
  not symmetric.** A buyer-created org holds only name+country; the exporter side needs
  `entityType` + address (both KYC-LOCKED fields) plus logo/description (not locked). So an
  exporter claiming a buyer-verified org must NOT inherit the tick over uncaptured, unreviewed
  registered details. Direction of the fix (aligned with A22's existing machinery, owner-discussed):
  the claim path collects the missing exporter delta (`entityType`, address) at claim time; adding
  those locked fields drops `kycStatus` → `submitted` (existing demotion path), so the tick is
  withheld until an employee approves the exporter-side details. Instant carry-over applies only
  when nothing is missing — e.g. a buyer claiming a verified exporter org (superset, clean).
  Logo/description stay non-blocking. `reviewedSides` keeps recording which side was examined.
- **✅ Security question ANSWERED — do not re-open it as a blocker.** `docs/UiWebNotes.md` recorded
  claim as blocked partly on account enumeration ("it confirms to an anonymous caller that a company
  is registered to a given email"). That is overstated: **§A21 line 248** — *"Because step 2 is
  behind OTP, the existing company's name may be shown on the claim screen. That is safe here and
  better UX."* The caller has already proved they own both channels, so they learn nothing about a
  stranger. The one rule that keeps it true: the lookup must key **only** on the verified identity,
  **never** on a company name the user types. The remaining blocker is the missing endpoint, nothing
  more.

## D8 · Platform settings page (§3.5)  ⏸ ON HOLD — build next month (owner, 2026-08-21)

**Why it is on this list at all:** every other outstanding Clause-3 item is scheduled by agreement
**§4.2** (quotation, employee-panel query handling, the notification layer, app-store submission).
**Platform settings is the one exception** — §4.1 puts the super admin dashboard in month one and
§3.5 lists "Platform settings" inside it, but §4.2 never mentions it. So it is a month-one item
still sitting as `<ComingSoon title="Settings" />` (`web/src/App.jsx`). Owner has consciously moved
it to next month — it is **deferred, not descoped**.

**Contents already decided (2026-08-21) — do not re-derive them:**
- ✅ **AI guest daily ceiling.** The strongest reason this page exists at all: §3.3 says the ceiling
  "may be changed by the Client **at any time**", but it currently lives in `AI_GUEST_DAILY_MAX`,
  which needs a `.env` edit and a restart. A settings page is what makes that clause literally true.
  The env var stays as the boot-time floor (`env.js` requires it in production); the setting
  overrides it at runtime.
- ✅ **Support contact email / phone** shown in emails and on the site.
- 🚫 **NOT the D1 caps (3 active / 10 drafts).** Those numbers are now written into **agreement
  §3.2**. Making them editable invites someone to set 5 and silently put the platform out of step
  with the contract. They stay as constants in `product.service.js`.
- 🚫 **NOT OTP knobs** (TTL, attempts, lock) — security controls, `security-baseline.md`'s area,
  env-only.
- 🚫 **Never a secret** (API keys, SMTP password).
- 🚫 Featured/banner content is already `/admin/featured` — do not duplicate it here.

**Shape:** one single-document `Settings` model, read at request time. Every change **must write an
AuditLog entry** — agreement §11.1 covers it under "administrative actions, recording the actor and
the time". Keep the page small: §3.11.1 fixes scope to Clause 3, and "Platform settings" is
undefined there, so anything elaborate is scope creep rather than delivery.

---

## 🔒 Project-close checklist (raise these BEFORE final handover)
- **D4** — restore Super Admin TOTP 2FA (currently OTP-only). Owner scheduled it for **month 2** on 2026-08-23; if month 2 ends without it, this checklist is what catches it.
- 🔴 **ROTATE THE FIREBASE SERVICE ACCOUNT before production (2026-08-01).** The key currently in
  `.env` (`mpx-global`, `firebase-adminsdk-fbsvc@mpx-global.iam.gserviceaccount.com`) was
  downloaded into the repo directory and its contents passed through a chat transcript, so by
  `secrets-and-hygiene.md` it counts as **compromised**. Fine for testing; before launch generate a
  new private key in Firebase Console → Project settings → Service accounts, replace
  `FIREBASE_SERVICE_ACCOUNT_JSON`, and **delete the old key** from the same screen so the leaked one
  stops working. *(The repo now gitignores `*firebase-adminsdk*.json` and friends, so the file
  itself can no longer be committed by accident.)*
- **D5** — confirm the full notification set is delivered (or explicitly descoped).
- **Production superadmin — seed with a FRESH password** (not the dev/chat one). The current
  Atlas is a **test-only** environment (owner-confirmed), so the dev superadmin password is not
  a production risk. The real/production superadmin must use a new secret, with
  `SEED_SUPERADMIN_PASSWORD` removed from `.env` after seeding.
- **Remove the dev-only OTP terminal print** (`otp.sender.js`). ✅ **Real OTP delivery is
  WIRED AND TESTED IN PRODUCTION (owner, 2026-08-17)** — only the dev print remains to strip;
  do not describe OTP delivery as unbuilt (it was wrongly listed as a pre-launch task in a
  client status report). Local `.env` has the Fast2SMS keys commented out, which is why the
  dev print and the credential-gated tests exist here — that is a LOCAL config state, not the
  production one.
- **KYC docs on Cloudinary MUST be `type: authenticated` (or `private`), never default public
  `upload`.** The whole KYC security model (A7 / tracker E3) hinges on this: we store only the
  Cloudinary `public_id` as `Organisation.kycDocuments[].storageKey` and serve docs via
  short-lived **signed** URLs. If a KYC file is uploaded as the default public `upload` type,
  anyone who knows `cloud_name` + `public_id` + `format` can fetch the raw document **without any
  signature** — the signed-URL endpoint (M1-D) becomes cosmetic and KYC data is world-readable.
  Before production, verify the M1-B upload path sets `type: 'authenticated'`, uses a
  **randomised `public_id`** (unguessable suffix), and that a raw public URL for a KYC asset
  returns 401/404. _(Recorded 2026-07-28 during M1 Phase-1 review.)_
  ✅ **VERIFIED IN CODE 2026-08-01 — this one already passes.** `kyc.storage.service.js` uploads
  with `type: 'private'` (equivalent to `authenticated` for this purpose — no publicly-reachable
  URL) and a `randomBytes(12)` suffix, returns only the `storageKey` and never a URL, and signs
  with a 120-second TTL. **Now pinned by tests** (`tests/kycStorage.test.js`) so a future change
  cannot silently make KYC world-readable. What remains is the live check against production
  Cloudinary: fetch a raw public URL for a KYC asset and confirm 401/404.
- 🔴 **Run `npm run indexes:sync` against the production database before traffic (2026-08-01).**
  `database.js` sets `autoIndex: false` in production **by design** (startup must not block on a
  large index build) and nothing runs `syncIndexes()` at boot — so a fresh production deploy comes
  up with **no indexes at all** beyond `_id`. That is not only slow: `ErrorLog`'s 90-day retention
  (A19) IS a TTL index, so without this step nothing ever expires, and the uniqueness guarantees
  are indexes too. Use `npm run indexes:check` first — it is a true dry run and prints the drop
  list, which matters because `syncIndexes()` also drops indexes a schema no longer declares.
- 🔒 **DECIDE THE AADHAAR QUESTION BEFORE GO-LIVE (raised 2026-08-03).** `aadhaar` is an accepted
  `KYC_DOC_TYPE` for individuals, and we store the uploaded image. **Technically** it is handled
  correctly — Cloudinary `type: 'private'`, randomised public_id, short-lived signed URLs, never a
  public URL. **Legally is a separate question:** in India, storing Aadhaar copies is restricted —
  UIDAI expects masked Aadhaar and limits storage by unlicensed entities. Three ways out, owner's
  call: (a) **drop `aadhaar` from the doc list** — PAN / passport already satisfy individual KYC and
  this is the cheapest fix; (b) accept **masked** Aadhaar only; (c) go through **DigiLocker /
  offline eKYC** and never hold an image. ⚠️ Do **not** roll this into `month1-not-doing.md` **A6**
  (automated document verification) — that is a deferred *feature*; this is a compliance decision
  and it must be answered before real users upload anything.
- **Secret-scan** (gitleaks / trufflehog) over git history once the repo has commits (E6).

_(Append future close-time items here. Standing hygiene rules: `.claude/rules/secrets-and-hygiene.md`.)_

---

## How to add a new item
Behaviour change → update "Confirmed Phase-1 behaviour". Must-not-build → mark a `D<n>` 🔴
GUARDED. Remember-to-build → 🧭 BUILD-TIME REMINDER. On-hold → ⏸ ON HOLD.
