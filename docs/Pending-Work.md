# MPX Global — Pending work (live list)

**Verified against the tree on 2026-09-22** (commit `c46f472`); **refreshed 2026-09-25** (after `26a6375`, with today's staff-permission work uncommitted).
This file is the **single live pending list**. `project-status.md` and `BUILD-STATUS.md` are
point-in-time reports and go stale; this one gets updated.

Every line below was checked in code, not carried over from an earlier note. Where an earlier
note was wrong, the correction is recorded in §7 so the same wrong claim does not come back.

---

## 1 · Build & dev work

| # | Item | Where | Status |
|---|---|---|---|
| ~~B1~~ | ~~**Platform settings screen** (D8)~~ | `web/src/pages/admin/Settings.jsx` | ✅ **BUILT 2026-09-22** at `/admin/settings` — AI guest daily ceiling + support contact, superadmin-only, audited on every save, with `AI_GUEST_DAILY_MAX` as the boot-time floor. Red-alerted as a D8 hold first; owner confirmed. **This was the last `ComingSoon` route in the console.** Detail: `docs/History.md` 2026-09-22. **Unverified signed-in** — needs a superadmin session. |
| ~~B2~~ | ~~**"Request more information" email → seller**~~ | `emailNotifications.service.js` · `notifyDocumentsRequested` | ✅ **BUILT 2026-09-25** (owner: "build it with the note included"). When staff request documents, the company's account on that side gets an email that names each document and includes the staff note. No link; the employee is never named. Tests: `email-notifications.test.js` (+3) and a wiring check in `kyc-rounds-requests.test.js`. **The KYC loop is now complete.** |
| ~~B3~~ | ~~**Exporter dashboard**~~ | `web/src/pages/exporter/Dashboard.jsx` | ✅ **BUILT 2026-09-22** at `/exporter/dashboard`; `/exporter` redirects to it and the nav row is real. 🔴 **The "scheduled month 2" claim in this row was wrong** — no document ever scheduled it, and no seller dashboard appears in `docs/scope-of-work.md`. It was red-alerted as out-of-quote and the owner confirmed on app parity. Detail: `docs/History.md` 2026-09-22. **Still unverified in a browser** — needs an exporter login. |
| ~~B4~~ | ~~**Portal settings screens** (buyer / exporter)~~ | — | ❌ **THIS ROW WAS WRONG — struck 2026-09-22.** There is nothing to build: `docs/UiWebNotes.md` rows 29 and 34 record that the design's "Settings" row **became** Company profile on 2026-08-10 and shipped (`/buyer/company`, `/exporter/company`, each carrying the change-password entry). I read an empty nav slot as a missing feature instead of checking the ledger — the same mistake as the exporter-dashboard "month 2" claim. Building one would duplicate Company profile. |
| ~~B5~~ | ~~**Organisation claim at signup** (D7)~~ | `signup.service.js` · `POST /auth/signup/organisation` | ✅ **BUILT 2026-09-23** — red-alerted as a D7 hold, owner reaffirmed. One company is now one Organisation: a claim attaches the new account to the org already holding its verified identity. The tick does not travel over unreviewed details (an exporter claiming a buyer-verified org returns it to `submitted`). Rebuilt the same day to the owner's seven-rule model (build-prompt §A21): picker, company-email code, `claimChoice`, seat re-check, exporter controls the profile. 42 tests. Detail: `docs/History.md` 2026-09-23. **Unverified signed-in** — the claim card has not been seen in a browser. ✅ **The APP claim screen is built too** (commit `a6b4116`, 2026-09-24; UiWebNotes row 57). Not device-tested. |
| B7 | **App: chat attachments + emoji** (D9 images + D10 documents) | `app/src/components/chat/` · `ChatThreadScreen.jsx` | ✅ **BUILT 2026-09-24** — same composer as web (+ Photo/Document menu · message · emoji · send), photo bubbles with a full-screen viewer, document cards — a PDF OPENS on tap (inline `viewUrl`), a separate button downloads; Word/Excel download. Files can be sent with no text (2026-09-24). 🔴 **Not run on a device** — `app/` has no `node_modules` on this machine; checked by esbuild parse + an ESLint no-undef/unused pass only. ⚠️ A document downloads through the phone's browser under Cloudinary's generic name ("file.pdf") — naming it properly needs `expo-file-system` + `expo-sharing` (new dependencies, not added). |
| B8 | **In-app notifications — roadmap Step 2 (quote Module 8)** | `Notification.js` · `notification.service.js` · `components/notifications/*` | ✅ **WEB centre BUILT 2026-09-25** (owner override of the hold; web only). Bell + panel + page for buyers, exporters, staff; four event groups; live for companies (socket), 60 s poll for staff. **Still open (guarded):** the APP centre, admin per-type on/off, delivery tracking/retry, WhatsApp. B2 (request-more-info email) unchanged. |
| B9 | **Real support email + phone** | `/admin/settings` | Dev DB holds DUMMY values (`support@example.com`, `+91 98765 43210`, owner 2026-09-24). The client's real contact goes in through Settings before launch — no code change needed. |
| ~~B10~~ | ~~**"Ticket re-opened" email → company**~~ | `emailNotifications.service.js` | ✅ **BUILT 2026-09-25** — the 9th email event (red alert raised, owner confirmed). Sent to the account that raised the ticket, only on a STAFF re-open; no link, no message text. |
| B11 | **Device-test the app support screens** | `app/src/screens/support/*` | Ticket list, new ticket (+ follow-up), ticket thread, Mark as solved, closed bar, Find a supplier — parse + lint only so far. |
| ~~B12~~ | ~~**Staff permissions: own-queue vs whole-queue**~~ | `config/permissions.js` | ✅ **BUILT 2026-09-25.** `support:view_all` "See all tickets"; supplier requests split into `lead:manage` (own only) / `lead:view_all` / `lead:assign`; prerequisites added automatically (reviewers get "View organisations"); staff-name lists locked; reassigning clears the old holder's notice. Existing dev staff backfilled once (owner). Prod starts on a fresh DB, so no backfill there. 24 permissions. |
| B13 | **Mobile app leftovers** | `app/` | The organisation-claim screen is BUILT (`a6b4116`) but not device-tested. Biometric unlock (tracker G2) is not built. The logo, icon and splash are still the old blue artwork (§5). Chat attachments (B7) and support screens (B11) are not device-tested. |
| ~~B6~~ | ~~**Security tracker evidence pass**~~ | `docs/security-tracker.xlsx` | ✅ **DONE 2026-09-25**: all 58 rows filled, each with evidence (file + test). **20 Done · 23 N/A** (Phase 2, plus A4 2FA waived by the owner) **· 7 In progress · 8 Not started.** What's still open is deploy/handover work (TLS, DB roles, backups, staging, log retention, handover rotation), plus three real items: **E1** (the bank account number is stored unencrypted; **owner decided 2026-09-25 not to encrypt it**), **E6** (a dev-only `.env` is in git history; production has its own, so **no rotation needed** (owner, 2026-09-25); the history purge is prepared for the owner to force-push, and a secret scan is still due before handover) and **G2** (the app biometric unlock isn't built). Dependency highs fixed the same day. |

### KYC / verification — what is already complete

Checked in code and **owed nothing** (B2 built 2026-09-25):

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
| ~~C2~~ | ~~**Consent capture at signup**~~ | ✅ **DECIDED 2026-09-25 (owner): keep the sentence, no checkbox.** A checkbox was built on web + app and reverted the same day at the owner's request ("we already showing By creating an account, you agree…"). Nothing to do unless the owner reopens it. Original note: no `consent`/`termsAccepted` field on any model. The screen states consent and links to the live `/terms` + `/privacy` but stores nothing — deliberately (`docs/UiWebNotes.md:56`): a checkbox would imply an agreement we do not hold. **Anyone who signs up before this exists can never be asked retroactively.** |
| ~~C3~~ | ~~**Brand colour**~~ | ✅ **DECIDED AND DONE 2026-09-22 — red, web-wide.** `primary` is the landing's crimson ramp; `danger` moved to a deep maroon (forced — the old danger was 1.19:1 from the new brand); `surface.subtle` went warm; the new navy-and-red logo is wired with a real favicon; a `navy` token was added because the dashboard chart's series pairing broke. Landing page and the mobile app untouched by instruction. Detail + what was NOT verified: `docs/History.md` 2026-09-22. **Still open from it:** the app is now blue while the web is red (§5), the four signed-in consoles have not been seen in a browser, and `ConversationRow`'s frozen dot needs a shape difference rather than a colour one. |
| ~~C4~~ | ~~**Support tickets**~~ | ✅ **BUILT 2026-09-24** (Step 1b — web, app, staff queue, dashboard section, ticket log, 2 emails). Was: not built; `Ticket.js` was a skeleton. Part of quote **Module 6** (Employee panel) with enquiry routing and internal notes — a contracted module partially unbuilt by choice. Minimal version in month 1, or Bucket A2. |
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

## 4b · 🔴 OTP delivery — SMS provider swap (decided, not started)

✅ **Interim relief built 2026-09-23:** buyers and sellers can already move a sign-in or reset code to their own email ("Don't have your phone?") — see `docs/History.md`. The swap below is still the real fix for the phone as a second factor.

**Owner's decision (2026-09-23): move off Fast2SMS to an international SMS provider.** Fast2SMS
delivers to Indian numbers only, and our **buyers are international with an OTP-gated login** — so
today every non-Indian buyer's code goes out over email, and the phone is not really a second
factor for them. The swap removes that root cause.

✅ **The email fallback it depends on is now real** (fixed 2026-09-23) — it had been dead code, so
a half-finished swap would have locked out **every** user, not just international ones.

**What the swap touches, in one pass:**
- `canDeliverTo` accepts only `+91` + 10 digits, and its tests **assert** the current UK/US
  rejections — those tests encode the limitation and must change with it.
- `sms.provider.js`, the `FAST2SMS_*` env vars, `.env.example`.
- 🔴 **Several docs reason *from* "Fast2SMS is India-only"** — `docs/Note.md` concludes "SMTP is
  load-bearing" *because* of it. Revise the rationales, not just the provider name, or the next
  session inherits a conclusion whose premise is gone.
- 💰 **Price it first:** international SMS is far dearer than Fast2SMS and a code goes out on
  **every login**, not just signup. This is a running-cost decision, not only a technical one.

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
  🔴 **Still outstanding: the app's LOGO and ICON assets are the old blue artwork.** All five
  (`ColoredLogo.jpg`, `LogoWhite.png`, `icon.png`, `favicon.png`, `splash-icon.png`) date from
  2026-08-03 and were not in that commit — so the app is red but ships a blue wordmark, a blue
  home-screen icon and a blue splash. The trimmed navy-and-red artwork already exists at
  `web/public/brand-logo.png` / `brand-logo-white.png`; these need generating from it at the
  Expo icon sizes. Visible to anyone who installs the APK.
- **Testing** — backend 1394 tests, which also pass with no `.env`. Web **79 tests / 16 files** (`npm test` in `web/`), covering: logic, the permission catalogue, KYC documents and the email's document names checked against the server, chat file rules, quotation amount-in-words, route guards, sign-in, buyer signup, ticket/request/product permission gating, D6 on both sides, notifications. App **16 tests** (`npm test` in `app/`, logic only): release builds refuse http (G5), log redaction (G3), money, masking, validation. **CI** runs all three plus lint, build and a high-severity audit. Still untested: the web product form, the KYC upload page, the chat thread and the quotation builder screens; app screens need a device.
- **Deploy / environment** — `NODE_ENV` (no default; the backend will not boot without it),
  `AI_GUEST_DAILY_MAX` (required in production), `npm run indexes:sync` (production comes up with
  no indexes beyond `_id`, and one of them is the 90-day error-log TTL), `TRUST_PROXY`, the nginx
  WebSocket upgrade patch, credential rotation, secret-scan (E6). Several are hard launch blockers.
  See `docs/Deployment.md` and the `docs/Note.md` close checklist.

---

## 6 · ~~Month 2~~ — the barrier is gone (owner, 2026-09-25)

Owner: *"no month 1 or 2 barrier, whole project is in wrapping state."* Everything that was "month 2"
is either built or due now:

- ✅ **Quotation & negotiation (quote Module 4)** — BUILT (web + app; teammate's work, commits
  `cab5d89` → `aca59e2`). The earlier "confirm the teammate's code is intended" question is closed.
- ✅ Module 6 employee pieces, D7 org claim (web + app), D8 settings, the WEB notification centre — built.
- ❌ **D4 Super Admin TOTP 2FA** — **dropped by the owner 2026-09-25** ("no need of 2fa"). Password + OTP stays. Tracker A4 → waived.
- ✅ **D6 seller unblock request** — BUILT 2026-09-25 (web + app; app not device-tested).
- 🔴 Still guarded by the owner's own decisions (not by month): app notification centre, new
  notification event types, admin per-type controls, delivery tracking/retry, WhatsApp, a 10th email.

## 7 · Corrections — claims that were wrong, so they do not come back

A pending-work list reviewed on 2026-09-22 carried these. Each was checked and is **false**:

| Claim | Reality |
|---|---|
| ~~"The app is fully red (all 34 screens)"~~ | ⚠️ **This correction has EXPIRED — the claim was ahead of the tree, not wrong.** It was false of the working tree on 2026-09-22 (`colors.js` was royal blue, and `git log -S "CE061A"` showed it had never entered `app/`), but commit `e0cce6e` landed the app repaint from another session the same day. **The app is now red.** Original note stands as a lesson: a report can describe work that exists on a branch you cannot see. |
| ~~"`OTP_DEV_FIXED_CODE` in production lets anyone into any account"~~ | ⚠️ **EXPIRED — and the original warning was RIGHT.** The variable did not exist in my tree on 2026-09-22; commit `e0cce6e` then added it (demo accounts with a fixed dev OTP). It is double-gated exactly like `OTP_DEV_PRINT` — `NODE_ENV === 'development'` plus the literal string `'true'` — and carries its own "never set this on a server reachable by real users" warning. 🔴 **The launch risk is real and is now on the `docs/Note.md` close checklist.** What follows described the situation before that commit: **the variable did not exist.** The real one is `OTP_DEV_PRINT`, which *echoes the code to the terminal* — not an auth bypass. Double-gated: `env.NODE_ENV !== 'development' \|\| !env.OTP_DEV_PRINT` (`otp.sender.js:79`), and the transform accepts only the literal string `'true'`. A log-leak to strip before launch, already on the close checklist. |
| "Production OTP delivery is unverified" | `docs/Note.md` close checklist: **wired and tested in production (owner, 2026-08-17)**, with an explicit warning against re-listing it as unbuilt. ⚠️ **CORRECTED 2026-09-23 — the sentence that stood here was WRONG and is worth keeping as a lesson.** It read "the India-only → email fallback is covered by `tests/otp-delivery.test.js`". The fallback was **not implemented** (`otp.sender.js` passed `null` for the address) and the test **did not cover it** (it asserted only that SMS was *not* called, never that email *was*), so a broken safety net read as a tested one — in a doc whose job is to say what is done. Both fixed 2026-09-23; see `docs/History.md`. Transports are logged at boot (`server.js:74`). The stale line in `BUILD-STATUS.md` §6 was the likely source; corrected 2026-09-22. |
| "Test suite is flaky; Docker is down so DB suites cannot run" | Full run 2026-09-22: **70 files, 1070 tests, all passed, 257s.** Docker *is* down but is not needed — Redis connected natively and the DB suites ran against `MONGODB_URI`. `fileParallelism: false` is set in `vitest.config.js`. |
| "14 files uncommitted" | Working tree clean at `c46f472`. |
| "Five email events are built" | **Four.** The fifth is approved (2026-08-21) and unbuilt — item B2. |
| "Exporter sidebar Dashboard is a dead link" | No route, but it is `soon: true` and renders dimmed, `cursor-not-allowed`, with a SOON badge. A labelled placeholder, not a broken link. `/exporter` itself redirects to `/exporter/verification`. |

**Also checked and clean:** no `TODO`/`FIXME`/`HACK` anywhere in `web/src` or
`MPX-BACKEND-FULL-SAAS/src`. No dead UI beyond the one exporter Dashboard row. **Banners are
built** — `FeaturedItem` carries a `banner` kind with image + link, managed from `Featured.jsx`,
so quote **Module 5** is covered despite no doc saying so. Quote modules 1, 2, 3, 5, 7 complete;
6 partial by decision; 4 deferred; 8 partial by carve-out.
