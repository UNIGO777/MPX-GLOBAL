# MPX Global — Pending work (live list)

**Verified against the tree on 2026-09-22** (commit `c46f472`, working tree clean).
This file is the **single live pending list**. `project-status.md` and `BUILD-STATUS.md` are
point-in-time reports and go stale; this one gets updated.

Every line below was checked in code, not carried over from an earlier note. Where an earlier
note was wrong, the correction is recorded in §7 so the same wrong claim does not come back.

---

## 1 · Build & dev work

| # | Item | Where | Status |
|---|---|---|---|
| ~~B1~~ | ~~**Platform settings screen** (D8)~~ | `web/src/pages/admin/Settings.jsx` | ✅ **BUILT 2026-09-22** at `/admin/settings` — AI guest daily ceiling + support contact, superadmin-only, audited on every save, with `AI_GUEST_DAILY_MAX` as the boot-time floor. Red-alerted as a D8 hold first; owner confirmed. **This was the last `ComingSoon` route in the console.** Detail: `docs/History.md` 2026-09-22. **Unverified signed-in** — needs a superadmin session. |
| B2 | **"Request more information" email → seller** | `MPX-BACKEND-FULL-SAAS/src/services/emailNotifications.service.js` | Not built; **owner-approved 2026-08-21 — build it without alerting.** Four events exist. Driver: agreement §3.7. Staff UI and company-side UI are both already built, so this is the last piece of an otherwise complete KYC loop. |
| ~~B3~~ | ~~**Exporter dashboard**~~ | `web/src/pages/exporter/Dashboard.jsx` | ✅ **BUILT 2026-09-22** at `/exporter/dashboard`; `/exporter` redirects to it and the nav row is real. 🔴 **The "scheduled month 2" claim in this row was wrong** — no document ever scheduled it, and no seller dashboard appears in `docs/scope-of-work.md`. It was red-alerted as out-of-quote and the owner confirmed on app parity. Detail: `docs/History.md` 2026-09-22. **Still unverified in a browser** — needs an exporter login. |
| ~~B4~~ | ~~**Portal settings screens** (buyer / exporter)~~ | — | ❌ **THIS ROW WAS WRONG — struck 2026-09-22.** There is nothing to build: `docs/UiWebNotes.md` rows 29 and 34 record that the design's "Settings" row **became** Company profile on 2026-08-10 and shipped (`/buyer/company`, `/exporter/company`, each carrying the change-password entry). I read an empty nav slot as a missing feature instead of checking the ledger — the same mistake as the exporter-dashboard "month 2" claim. Building one would duplicate Company profile. |
| B5 | **Organisation claim at signup** (D7) | `web/src/pages/auth/SignupCompany.jsx`; no endpoint in `auth.routes.js` | Deferred by the owner 2026-08-18. `/auth/signup/complete` always CREATES. One company signing up as buyer **and** exporter gets two orgs → two KYCs, two public profiles, and a "Block company" that hits only one. Cost grows with every signup. |
| B6 | **Security tracker evidence pass** | `docs/security-tracker.xlsx` | 0 of 58 controls recorded as done; ~25 Phase-1 controls are built and test-pinned. See §3. |

### KYC / verification — what is already complete

Checked in code and **owed nothing** except B2 above:

- Buyer KYC upload (`/buyer/kyc`) · exporter KYC upload (`/exporter/kyc`)
- Both verification status screens, incl. company-side visibility of open document requests
  (`web/src/pages/exporter/VerificationStatus.jsx:162`)
- Admin `VerificationQueue` + `KycViewer`
- **Revoke** with mandatory reason (`KycViewer.jsx:218`) · **request-documents** (`api/admin.js:62`)
- A22 **pending-change** re-approval model (locked fields → `pendingChanges`, tick never moves)
- **Resubmit after rejection** (`kyc.service.js:16`) — quote **Module 7**'s explicit requirement
- Storage: Cloudinary `type: 'private'`, randomised `public_id`, 120s signed URLs, test-pinned
  (`tests/kycStorage.test.js`)

**Quote Module 7 is done.** What remains on KYC is B2 (the email). ~~§2 C1 (the Aadhaar decision)~~ was
**answered 2026-09-23** — see §2.

---

## 2 · Blocking decisions — these have deadlines

| # | Item | Why it cannot wait |
|---|---|---|
| ~~C1~~ | ~~🔴 **Aadhaar** — we accept and store Aadhaar images~~ | ✅ **DECIDED AND DONE 2026-09-23 — option (b), MASKED ONLY.** The policy moved three times that day; this is where it landed. Aadhaar is accepted for individuals but only UIDAI's **masked** copy (first 8 digits shown as X), so the Aadhaar *number* — what the restriction is actually about — is never in the file. `other` stays REMOVED for individuals: a named docType keeps an unmasked copy findable by query, a catch-all would not. 🔴 **The "(masked only)" label is a deterrent, not a control** — nothing can detect an unmasked upload. Two things carry it instead, both built the same day: the **reviewer warning** on the KYC viewer, and **per-document delete** (`removeDocument`) so an unmasked one can be destroyed rather than marked. **Remove either and this becomes a promise nobody keeps.** Pinned by `tests/kyc-aadhaar-masked.test.js` (7) + `tests/kyc-document-remove.test.js` (5). The 5 pre-existing Aadhaar documents are dev test data (owner) — no action. Detail: `docs/History.md` 2026-09-23. |
| C2 | 🔴 **Consent capture at signup** | No `consent`/`termsAccepted` field on any model. The screen states consent and links to the live `/terms` + `/privacy` but stores nothing — deliberately (`docs/UiWebNotes.md:56`): a checkbox would imply an agreement we do not hold. **Anyone who signs up before this exists can never be asked retroactively.** |
| ~~C3~~ | ~~**Brand colour**~~ | ✅ **DECIDED AND DONE 2026-09-22 — red, web-wide.** `primary` is the landing's crimson ramp; `danger` moved to a deep maroon (forced — the old danger was 1.19:1 from the new brand); `surface.subtle` went warm; the new navy-and-red logo is wired with a real favicon; a `navy` token was added because the dashboard chart's series pairing broke. Landing page and the mobile app untouched by instruction. Detail + what was NOT verified: `docs/History.md` 2026-09-22. **Still open from it:** the app is now blue while the web is red (§5), the four signed-in consoles have not been seen in a browser, and `ConversationRow`'s frozen dot needs a shape difference rather than a colour one. |
| C4 | **Support tickets** | Not built; `Ticket.js` is a skeleton. Part of quote **Module 6** (Employee panel) with enquiry routing and internal notes — a contracted module partially unbuilt by choice. Minimal version in month 1, or Bucket A2. |
| C5 | **Copy for the remaining email events** | Needed before B2 and anything after it. |
| C6 | **Footer pages / testimonials** | `docs/Client-Requests.md` §2.1–2.2 ask whether they are wanted **at all**. Nothing dead is rendered — `PublicFooter.jsx` is entirely real links and testimonials were removed. A "do you want more?" question, not a gap. |

---

## 3 · 🔴 The security tracker records nothing

`docs/security-tracker.xlsx` → **Summary: 58 controls, 0 done, 0% complete.** Status reads
"Not started" on every row; the Evidence column is empty throughout. The sheet's own footer:
*"Every control listed is committed to in the Rev 02 quotations (web pages 10–11 and 7–8,
app page 6). Nothing here is optional scope."*

The controls are built. Verified in code: argon2 (A1) · `tokenVersion` session invalidation (A7) ·
helmet (B3) · Redis-backed rate limiting (B7) · `rejectMongoOperators` (B2) · zod validation
middleware (B1) · server-side RBAC across 112 routes (A5 — asserted at boot) · ownership scoping
(A6) · Cloudinary private type + signed URLs (E3) · `.env`-only secrets (E6).

**At handover this file is what the client reads as the security deliverable, and it says nothing
was done.** CLAUDE.md's instruction — *"when you implement one, tell me its ID so I can record the
evidence"* — was never acted on.

**Work:** one pass setting Status + Evidence on every Phase-1 control (categories A, B, E, and F
in part). C and D mark **N/A — Phase 2**.

---

## 4 · Needed from the client — longest lead time, send first

Full text drafted in **`docs/Client-Requests.md`**.

1. 🔴 **Support / privacy contact address.** `Legal.jsx:196` and `:343` both point at "the contact
   address published by MPX Global" and nothing is published anywhere on the site. A privacy policy
   whose contact route is circular is its one defect that matters.
2. 🔴 **Their own Terms + Privacy text** — then **reconcile against the software before publishing.**
   Templates routinely promise self-service account deletion, a fixed retention period, and
   GDPR/DPDP compliance. None of the three is true here. Either the document matches the behaviour
   or the software changes to match it.
3. **Registered company details** — legal entity name, address, governing law.
4. **40 top-category synonyms.** Deliberately not seeded (`catalogue.data.js:18` — "the top-40 list
   is owner content; Do NOT invent it"). **Functional consequence: keyword→category search only
   half works without them.** Admin entry path exists (`CategoryManager.jsx:262`, §A12).
5. **40 category images.** No `image` in the seed. Cards degrade gracefully
   (`Categories.jsx:55`), so nothing breaks — the directory just renders without imagery.
6. **Confirm the public domain.** `mpx.nxtgendigitals.com` is our assumption; `web/vercel.json`
   and the legal-page links depend on it.
7. **Written sign-off on two deliberate deviations from the quote** (`BUILD-STATUS.md` §6) —
   buyers get full access with no approval gate (D3), and unverified exporters get a 3-product
   trial (D1).

---

## 5 · Not covered in this file

Tracked elsewhere on purpose — **do not read their absence here as "done"**:

- **Mobile app work** — app screens, the in-app exporter-registration path, device testing.
  ~~🔴 New since 2026-09-22: the app is now the ONLY blue surface in the product.~~
  ❌ **THIS WAS ALREADY FALSE WHEN WRITTEN — struck 2026-09-23.** `app/src/theme/colors.js` was
  repainted crimson on 2026-09-22 (`primary.600 = #CE061A`), in the same session and on the same
  day as this row. The app has not been blue since.
  🔴 **But the row pointed at a real defect from the other direction.** Web moved `danger` to a
  deep maroon on 2026-09-22 because the old `#D92D20` measured **1.19:1** against the new crimson
  brand — indistinguishable by eye, so a destructive "Sign out" and an ordinary brand button
  looked the same. The app kept the old value for a day. **Fixed 2026-09-23** by mirroring web's
  full ramp (`DEFAULT: #6B2416`); the pair now measures 1.94:1 and white on it is 11.12:1.
  ⚠️ **Still divergent:** `surface.subtle` is `#F7F8FB` in the app and `#FDF4F4` on web. Left
  alone deliberately — it is the app's whole screen canvas, so changing it is a visible app-wide
  change, not a token tidy-up. Needs the owner's eye, not a silent edit.
- **Testing** — backend suite is green (70 files / 1070 tests, 2026-09-22). Web has **no test
  script and no tests at all**.
- **Deploy / environment** — `NODE_ENV` (no default; the backend will not boot without it),
  `AI_GUEST_DAILY_MAX` (required in production), `npm run indexes:sync` (production comes up with
  no indexes beyond `_id`, and one of them is the 90-day error-log TTL), `TRUST_PROXY`, the nginx
  WebSocket upgrade patch, credential rotation, secret-scan (E6). Several are hard launch blockers.
  See `docs/Deployment.md` and the `docs/Note.md` close checklist.

---

## 6 · Month 2 — decided, not pending

D4 TOTP 2FA · D8 platform settings (see B1 — a month-one commitment that slipped) ·
Quotation & negotiation (quote Module 4) · the rest of Module 6's employee-only pieces
(tickets, enquiry routing, internal notes, per-employee dashboards) · the rest of the
notification layer (WhatsApp, in-app centre, admin per-type controls, delivery tracking) ·
D7 organisation claim · D6 seller unblock request.

⚠️ **"Exporter dashboard" used to be listed here and should not have been** — nothing scheduled it; a dimmed nav row did. Built 2026-09-22 (§1 B3).

---

## 7 · Corrections — claims that were wrong, so they do not come back

A pending-work list reviewed on 2026-09-22 carried these. Each was checked and is **false**:

| Claim | Reality |
|---|---|
| ~~"The app is fully red (all 34 screens)"~~ | ⚠️ **This correction has EXPIRED — the claim was ahead of the tree, not wrong.** It was false of the working tree on 2026-09-22 (`colors.js` was royal blue, and `git log -S "CE061A"` showed it had never entered `app/`), but commit `e0cce6e` landed the app repaint from another session the same day. **The app is now red.** Original note stands as a lesson: a report can describe work that exists on a branch you cannot see. |
| ~~"`OTP_DEV_FIXED_CODE` in production lets anyone into any account"~~ | ⚠️ **EXPIRED — and the original warning was RIGHT.** The variable did not exist in my tree on 2026-09-22; commit `e0cce6e` then added it (demo accounts with a fixed dev OTP). It is double-gated exactly like `OTP_DEV_PRINT` — `NODE_ENV === 'development'` plus the literal string `'true'` — and carries its own "never set this on a server reachable by real users" warning. 🔴 **The launch risk is real and is now on the `docs/Note.md` close checklist.** What follows described the situation before that commit: **the variable did not exist.** The real one is `OTP_DEV_PRINT`, which *echoes the code to the terminal* — not an auth bypass. Double-gated: `env.NODE_ENV !== 'development' \|\| !env.OTP_DEV_PRINT` (`otp.sender.js:79`), and the transform accepts only the literal string `'true'`. A log-leak to strip before launch, already on the close checklist. |
| "Production OTP delivery is unverified" | `docs/Note.md` close checklist: **wired and tested in production (owner, 2026-08-17)**, with an explicit warning against re-listing it as unbuilt. The India-only → email fallback is covered by `tests/otp-delivery.test.js`, and transports are logged at boot (`server.js:74`). The stale line in `BUILD-STATUS.md` §6 was the likely source; corrected 2026-09-22. |
| "Test suite is flaky; Docker is down so DB suites cannot run" | Full run 2026-09-22: **70 files, 1070 tests, all passed, 257s.** Docker *is* down but is not needed — Redis connected natively and the DB suites ran against `MONGODB_URI`. `fileParallelism: false` is set in `vitest.config.js`. |
| "14 files uncommitted" | Working tree clean at `c46f472`. |
| "Five email events are built" | **Four.** The fifth is approved (2026-08-21) and unbuilt — item B2. |
| "Exporter sidebar Dashboard is a dead link" | No route, but it is `soon: true` and renders dimmed, `cursor-not-allowed`, with a SOON badge. A labelled placeholder, not a broken link. `/exporter` itself redirects to `/exporter/verification`. |

**Also checked and clean:** no `TODO`/`FIXME`/`HACK` anywhere in `web/src` or
`MPX-BACKEND-FULL-SAAS/src`. No dead UI beyond the one exporter Dashboard row. **Banners are
built** — `FeaturedItem` carries a `banner` kind with image + link, managed from `Featured.jsx`,
so quote **Module 5** is covered despite no doc saying so. Quote modules 1, 2, 3, 5, 7 complete;
6 partial by decision; 4 deferred; 8 partial by carve-out.
