# MPX Global — M1 + M2 Human Testing Guide

**Scope:** M1 (accounts, roles, KYC/verification) + M2 (catalogue: public discovery, seller
listing management, admin catalogue moderation) — **web only**. The mobile app is not covered;
only one M2 app screen (category browse) is built there.

**Not covered on purpose:** anything from Phase 2 (escrow, payouts, contracts) or Bucket A
(quotation/negotiation, employee-only ticketing) — those aren't built and testing them isn't
meaningful. Also not covered: the ~5 disabled placeholder controls (Send Enquiry, Start
Conversation, Inquiry, Save/heart icon) — see §0.4, they're expected to do nothing right now.

---

## 0. Before you start

### 0.1 Environment
Run against your local dev environment (`web/` + `MPX-BACKEND-FULL-SAAS/`) unless told otherwise.
Confirm both are up before starting:
- Backend: `http://localhost:3000/health` → `{"status":"ok",...}`
- Web: `http://localhost:5173/` loads the landing page

### 0.2 Test accounts you'll need
Create these as you go (or ask for seeded ones) — you genuinely need **separate** accounts to
cover every state below, not one account reused:

| # | Role | State | Why you need it |
|---|---|---|---|
| 1 | Buyer | Fresh signup, no KYC submitted | Tests the "pending" verification state |
| 2 | Buyer | KYC submitted, awaiting review | Tests the "submitted" state |
| 3 | Exporter | Fresh signup, unverified, 0 products | Tests D1 caps (3 active / 10 draft) from empty |
| 4 | Exporter | Verified (approved by staff) | Tests the "no cap" state |
| 5 | Employee | Given a subset of admin permissions | Tests default-deny + per-permission UI |
| 6 | Superadmin | Full access | Tests employee management, everything else |

A phone number and email you can actually receive OTPs on (or check the dev OTP-print path if
one is enabled — never rely on it existing in a shared/staging environment).

### 0.3 How to log a result
For every numbered step below: do it, compare to **Expected**, mark:
- ✅ **Pass** — matched expected
- ❌ **Fail** — didn't match; write down what actually happened, screenshot if visual
- ⚠️ **Blocked** — couldn't test (missing data, earlier step failed)

Don't silently skip a step because "it's probably fine" — an unchecked box is worth more than a
guessed pass.

### 0.4 Known, already-flagged gaps — don't file these as new bugs
These are real, intentional, and already tracked in `docs/UiWebNotes.md`:
- **"Inquiry" / "Send Enquiry" / "Start Conversation" buttons** (category cards, product detail,
  supplier profile) — visibly greyed out, disabled, tooltip says "coming soon." The chat/enquiry
  backend exists but nothing on the web client creates a conversation yet.
- **Heart/save icon** on category product cards — same story, disabled.
- **Supplier cover image** — only one seeded supplier ("Tirupur Knitwear Exports") has a real
  cover photo; every other supplier shows a plain gradient banner. That's correct — no upload
  screen exists yet for a seller to set their own.
- **Privacy Policy / Terms of Service** footer links — plain text, not real pages. Flagged as
  needed before launch; not a testing gap.

---

## Part A — M1: Accounts, Roles & Verification

### A1. Buyer signup (`/signup/buyer` → `/signup/verify` → `/signup/company`)
Signup is genuinely **4 steps** — identity, verify email, verify phone, company — and **nothing
is created in the database until the last step succeeds**. Use a real email/phone you can receive
codes on.

1. Visit `/signup/buyer`. **Expected:** "Step 1 of 4," fields for full name, email, mobile
   (with country code), password, confirm password.
2. Try submitting with an obviously weak password (under 8 characters). **Expected:** blocked
   client-side before any request — "At least 8 characters."
3. Try submitting with mismatched password/confirm. **Expected:** blocked client-side.
4. Submit valid details. **Expected:** advances to "Step 2 of 4 — Verify your email," a 6-digit
   code sent to the email you entered, a visible countdown ("Code expires in MM:SS"), and a
   two-pill progress tracker ("1. Email" / "2. Phone").
5. Enter the **email** code. **Expected:** advances automatically to "Step 3 of 4 — Verify your
   phone" (progress pill "1. Email ✓" now filled), a **different** 6-digit code sent to your
   mobile, its own independent countdown restarted.
6. Enter the **phone** code. **Expected:** advances to "Step 4 of 4 — Your company" — company
   name and country only (no entity type, no address — those are exporter-only).
7. **Before completing step 4**, open a fresh private/incognito window and try to sign in with
   the email/password from step 1. **Expected:** fails — the account doesn't exist yet, because
   nothing is written until step 4 completes. (This is the actual security fix this flow exists
   for — confirm it holds.)
8. Complete step 4. **Expected:** a real session starts immediately (no further OTP needed — both
   channels were already proven) and a "You're in" confirmation screen appears with a link to
   your dashboard.
9. **Test the independence of the two OTP locks:** restart signup, get to step 2 (email code),
   and enter a **wrong** code 5 times in a row. **Expected:** the email step locks ("too many
   attempts"), but confirm you can *still* fail forward — the phone step (once you get an email
   code right, or on a fresh attempt) is **not** affected by the email lock.
10. Test **resend**: on either code step, confirm the resend button is disabled with a visible
    countdown immediately after a code is sent, and becomes tappable once the countdown reaches 0.
11. Let a code sit past its expiry window (or use `?` — check `config.otp.ttlSeconds` for the
    real duration) without submitting. **Expected:** submitting it fails with "Invalid or expired
    code"; resend still works.
12. Close the tab mid-flow (after step 1, before step 4) and reopen `/signup/verify` directly with
    no state. **Expected:** redirected to sign-in — this screen refuses to render without the
    signup token carried in navigation state; a bookmark or refresh can't resume it.

### A2. Exporter signup (`/signup/exporter`)
Same 4-step shape as A1, but **5 steps** (one extra) and an extended company step.

1. Repeat A1 steps 1–6 with `/signup/exporter`. **Expected:** identical identity → email → phone
   verification shape, labeled "Step 1 of 5" through "Step 3 of 5."
2. At the company step ("Step 5 of 5"): **Expected:** company name, country, **and** an
   **Entity type** choice (Business vs Individual, radio-card style, arrow-key navigable) that
   the buyer flow never shows. Also an optional, collapsed **Business address** section.
3. Try submitting with no entity type chosen. **Expected:** blocked — "Choose your entity type."
4. Confirm registration number / tax ID / year established are **nowhere on this form** — they
   are deliberately not captured at signup (collected later, at verification, if ever).
5. Complete signup. **Expected:** "You're in," profile is live immediately — no approval gate.

### A3. Login — buyer/exporter portal (`/signin`)
1. Visit `/signin`. **Expected:** a Buyer/Exporter portal toggle, identifier field ("Email or
   mobile"), password field, "Forgot password?" link, and separate "Sign up as Buyer" / "Sign up
   as Exporter" links. **No link to staff sign-in anywhere on this page** — confirm it's genuinely
   absent, not just hidden by CSS (view page source or inspect if unsure).
2. Sign in as a **buyer** with the **exporter** portal selected (or vice versa), using otherwise
   correct credentials. **Expected:** fails with a **generic** "Invalid credentials" — never a
   message revealing the account exists under the other portal.
3. Sign in with correct credentials and the correct portal. **Expected:** advances to `/otp`,
   "Step 2 of 2," a code sent to your **mobile** (note: always the mobile, even if you typed your
   email as the identifier — confirm the screen's copy doesn't say "check your email" in that
   case).
4. Enter the code. **Expected:** signed in, redirected to your role's home page (buyer →
   verification status; exporter → verification status).
5. Test the OTP lock (5 wrong codes) and resend cooldown here too, same behavior as A1.9-10.
6. On the OTP screen, click "← Back to sign in." **Expected:** returns to `/signin` cleanly.
7. Visit `/otp` directly with no prior navigation (paste the bare URL). **Expected:** redirected
   to `/signin` — this screen also refuses to render without carried state.

### A4. Login — staff (`/signin/staff`)
1. Visit `/signin/staff`. **Expected:** a visually distinct "Staff sign-in" page (shield icon,
   different headline), **no portal toggle** at all, and a footer link back to the buyer/exporter
   sign-in — but nothing pointing the other way from the party page (confirmed in A3.1).
2. Sign in with a valid employee or superadmin account. **Expected:** same OTP step as party
   login, then lands in `/admin/...`.
3. Confirm there is **no signup link** anywhere on this page — staff accounts can only be created
   by a superadmin (A14), never self-registered.

### A5. Forgot / reset password
Test once for a **buyer or exporter** account and once for a **staff** account
(`/forgot?staff=1`).

1. Visit `/forgot`. **Expected:** portal toggle (party) or a staff-specific line (staff variant),
   one identifier field.
2. Submit an identifier that **doesn't exist**. **Expected:** the exact same neutral "Check your
   messages" confirmation as a real account — this must never reveal whether the account exists.
3. Submit a real identifier. **Expected:** same neutral confirmation, a reset code texted to the
   **mobile** on the account (confirm the copy says mobile, not "email or mobile," regardless of
   which one you typed to identify yourself), and an "Enter reset code" button.
4. Click through to `/reset`. **Expected:** identifier field pre-filled and **disabled** (can't be
   edited), a note stating which account/portal this is resetting, an OTP code field, new
   password + confirm.
5. Visit `/reset` directly with no prior state (bare URL). **Expected:** redirected back to
   `/forgot` — same "no cold access" rule as A3.7.
6. Complete a reset with a valid code and new password. **Expected:** "Password changed," explicit
   confirmation that you're signed out **everywhere else**, redirected to sign in.
7. Confirm you can immediately sign in with the **new** password, and that any **other** device/
   session you were signed in on (if testable) has been signed out.

### A6. Change-password gate (`/change-password`)
This is a **blocking** screen — reachable by any signed-in user, but only actually *forced* on
staff with a temporary password (A14 creates these).

1. As a superadmin, create a new employee (A14) and note the temp password.
2. Sign in as that new employee at `/signin/staff` with the temp password.
3. **Expected:** immediately redirected to `/change-password`, **before** reaching any admin
   screen — confirm you cannot navigate around it by pasting another admin URL directly (it
   should bounce you back here every time, per RequireAuth's mustChangePassword check).
4. Try setting the new password to be **the same** as the temporary one. **Expected:** blocked —
   "must be different from the current one."
5. Set a valid new password. **Expected:** succeeds, three live requirement checkmarks (8+ chars /
   different from current / both entries match) turn green as you type rather than only failing
   at submit, and you land in the real admin console afterward with no further sign-in needed.
6. Separately, as a **regular buyer**, visit `/change-password` voluntarily (not forced).
   **Expected:** works the same way, and afterward "Sign out and start over" sends you to the
   **party** sign-in page, never the staff one (confirm this — the code specifically guards
   against dropping a non-staff user on the wrong portal).

### A7. Buyer verification status (`/buyer/verification`)
Needs a **buyer** account. Test across as many of the 4 states as you can arrange (pending →
submitted → verified, and rejected if a staff tester rejects one for you).

1. Fresh buyer, no documents sent. **Expected:** "You haven't sent any documents," explicit
   language that verification is **optional** and the account **already works in full**, an
   "Upload documents" button, and a 4-step visual journey (Company profile → Send documents →
   Team reviews → Tick goes live) with the first step's state reflecting whether your company
   profile is actually complete yet.
2. Submit documents (A8), return here. **Expected:** state flips to "Your documents are with our
   team," shows the actual submission date, journey step 2 now shows as done and step 3 as
   in-progress.
3. Have a staff tester reject it (A13) with a specific reason. **Expected:** the **exact reason
   text the reviewer typed** appears verbatim, plus the sent date. Never a generic "rejected"
   message that discards their explanation.
4. Have a staff tester approve it. **Expected:** "You're verified," approval date shown, verified
   tick appears next to the page's own "Welcome" heading, and every journey step shows done.
5. At every state, confirm the right-rail "Entirely optional" reassurance is present **except**
   once verified (it should disappear once there's nothing left to reassure about).

### A8. Buyer KYC upload (`/buyer/kyc`)
1. If your company profile is incomplete (missing name/country/address), visit this page first.
   **Expected:** the upload form doesn't render at all — instead "Complete your company profile
   first," with a button straight to `/buyer/company`.
2. Complete your profile (A11), return here. **Expected:** now shows an entity-type choice
   (Business vs Individual) and, once chosen, a fixed list of document upload slots for that
   entity type (no dropdown — one labeled slot per accepted document type).
3. Pick **Individual**, then try switching to **Business**. **Expected:** allowed pre-submission,
   and switching **clears any files you'd already attached** (they were chosen for a type that no
   longer applies) — confirm this happens, don't just assume it.
4. Try clicking Submit with zero files attached. **Expected:** the submit button stays disabled
   and a visible reason explains why ("Add at least one document to continue"), on both desktop
   and mobile.
5. Attach one valid file and submit. **Expected:** per-row upload progress, a "Documents sent"
   confirmation once done, entity type is now **locked** (confirm by returning to this page — it
   should now just display the type, no longer offer to change it).
6. Try uploading a file of the wrong type or over the size limit. **Expected:** a clear per-row
   error, and it does **not** block the other rows from uploading successfully.
7. Once verified (A7.4), revisit this page. **Expected:** "You're verified... nothing more to
   send" — the form doesn't render at all, confirming the server would 409 anyway.

### A9. Exporter verification status (`/exporter/verification`)
Same overall shape as A7, with exporter-specific differences — test these deltas specifically:

1. Confirm the header shows the **company name** (from the public profile), not just "Welcome,
   [personal name]" — and that if the profile fetch fails for any reason, it degrades gracefully
   to the personal greeting rather than erroring the whole page.
2. While **unverified**, confirm a highlighted callout states the **3-active-product limit**
   explicitly, with a link straight to `/exporter/products`. Confirm this callout **disappears
   entirely** once verified (D1: a limit, never framed as a gate).
3. Confirm a "Your public page" rail card links to your real `/supplier/:slug` page, and that the
   copy says the profile is "Live from signup — verification adds the tick, it never hides you."
4. Repeat the reject/approve/rejection-reason checks from A7.3-4 here.

### A10. Exporter KYC upload (`/exporter/kyc`)
Same document-upload mechanics as A8, but confirm these exporter-specific differences:

1. **Entity type is not choosable here at all** — it was fixed at signup (A2.2). Confirm the
   account-type card only **displays** it (with an icon), with no way to change it.
2. Reach the **profile-incomplete gate** the same way as A8.1 if applicable.
3. Get a document **rejected** by staff (A13), then revisit this page. **Expected:** heading
   changes to "Send new documents," the rejection reason renders verbatim in a red alert, and
   submitting again shows a **different** confirmation message ("Back in review") than a true
   first-time submission ("Documents sent") — confirm the wording actually differs.
4. While status is `submitted` (already sent, awaiting review): **Expected:** the upload form
   doesn't render at all — "Your documents are with our team... nothing more to send for now."

### A11. Company profile (`/buyer/company`, `/exporter/company`)
One shared screen; buyer sees a simple single column, exporter sees an editor + a **live public
preview** rail. This is the single most important lock/demotion behavior in M1 — test it
carefully.

1. As a **buyer**: confirm the screen shows only name/country/entity-type/address plus an
   "Account" section (change password link) — **no logo, no description, no public preview** (a
   buyer has no public page).
2. As an **exporter**: confirm an additional "Public storefront" card exists with **logo upload**
   (drag-and-drop or click, JPG/PNG/WEBP, 5MB cap — try exceeding the cap and using a disallowed
   file type, both should be rejected client-side with a clear message) and a **description**
   field (500 char cap, live counter).
3. Confirm the right rail's "How buyers see you" preview is populated from the **real public API
   response** (not a client-side mock) — change something, save, and confirm the preview actually
   updates rather than staying stale.
4. **Before verification**, edit your company name and save. **Expected:** saves cleanly, no
   warning modal (nothing to protect yet).
5. Get verified (coordinate with a staff tester, A13). Then edit your **company name, country, or
   address** again and try to save. **Expected:** a confirmation modal appears **before** saving,
   explicitly naming which field(s) you're changing and stating this will drop you back to
   "in review" and withhold the tick until re-approved. Cancel it — confirm nothing was saved.
   Confirm it, then check: (a) a success message explicitly says you've gone back to review, (b)
   your `VerificationStatus` page now shows "submitted" again, (c) the tick is gone from your
   public profile immediately.
6. As a verified exporter, edit **only** the description or logo (not a locked field) and save.
   **Expected:** saves silently, **no** demotion warning, **no** effect on verification status —
   confirm the lock only applies to the fields it's supposed to (name/country/address/entity
   type), not everything on the page.
7. Confirm **entity type is read-only for an exporter in every state** — even before verification,
   there should be no way to change it from this screen (it's fixed at signup).
8. Rename your company (as a verified exporter, accepting the demotion). **Expected:** an inline
   note confirms your public URL (`/supplier/your-slug`) does **not** change even though the name
   did. Visit that URL afterward and confirm it still resolves to your (renamed) profile.
9. Try leaving the page with unsaved changes, then use "Discard." **Expected:** reverts the form
   to the last saved state.

### A12. Admin — Users (`/admin/users`)
Log in as Employee or Superadmin.

1. Search using a name/email/mobile **substring that isn't at the start** (e.g. search "sharma"
   for a user named "Priya Sharma" — search the middle of a word, not the beginning). **Expected:**
   confirm the actual behavior against the label shown on screen — this search is a **prefix**
   match server-side ("Starts with…"), so a true mid-word substring should NOT match. If it does
   match, that's worth flagging as a real discrepancy between the label and the behavior.
2. Filter by role and by KYC status independently and together. **Expected:** result count and
   rows update correctly for each combination; "Clear filters" resets all three at once.
3. Open "View details" on a row. **Expected:** a drawer with email, mobile, role, **company name**
   (this is the *only* place in this list the company name appears — the table itself omits it),
   account status, join date, and verification chip if applicable.
4. As an **Employee** (not superadmin): confirm Activate/Deactivate actions are **completely
   absent** from the row menu — not just disabled, actually not rendered.
5. As a **Superadmin**: deactivate an active user. **Expected:** a confirmation modal states
   plainly this signs them out everywhere and blocks login, but explicitly says their profile and
   documents are **kept** and they can be reactivated any time — confirm that's literally true by
   reactivating them afterward and checking their data is intact.
6. Try to deactivate your **own** superadmin account, or another superadmin's account (if the UI
   somehow allows attempting it). **Expected:** refused — check whether the UI blocks it outright
   or the action fails with a clear server-side message; either is acceptable, a silent failure or
   a crash is not.

### A13. Admin — Verification Queue + KYC Viewer (`/admin/verification`, `/admin/verification/:orgId/kyc`)
1. Open the queue. **Expected:** two stat tiles that double as tabs ("Exporters to verify" /
   "Buyers to verify"), each with a live count; switching tabs is keyboard-navigable with arrow
   keys.
2. Confirm each row shows entity type, submission date, and document count — and that these
   populate **after** the row itself loads (a brief "Loading documents…" state is expected and
   fine, not a bug).
3. Click "View documents" on a row. **Expected:** navigates to the KYC Viewer for that
   organisation — a document list on the left, a preview pane on the right (images render inline,
   PDFs in an embedded viewer, anything else gets an "Open in new tab" link instead of a broken
   preview).
4. Leave a document preview open and idle for **over 2 minutes**. **Expected:** the preview flips
   to an expired state with a "Reload document" button — confirm reloading actually fetches a
   working preview again rather than repeating the expired state.
5. From either the queue or the viewer, click **Reject**. **Expected:** a reason field enforcing
   **3–500 characters** (try submitting under 3 chars — blocked), with copy stating this exact
   text is shown to the applicant.
6. Reject one, then check the applicant's own verification status page (A7 or A9). **Expected:**
   your typed reason appears there **verbatim**.
7. Approve a different one from the **queue list view** (not the viewer). **Expected:** it
   disappears from the queue immediately and the tile count decrements.
8. **Race condition check (if you can arrange two staff testers):** have both testers open the
   same pending organisation, and have both try to decide on it within moments of each other.
   **Expected:** whichever finishes second sees a clear "no longer awaiting review" message, not
   a crash or a silently duplicated decision.
9. Confirm an Employee who holds `kyc:view` but **not** `exporter:verify`/`buyer:approve` can see
   documents but the Approve/Reject buttons are absent for them (coordinate permission grants via
   A14).

### A14. Admin — Employees (`/admin/employees`) — superadmin only
1. As an **Employee** (not superadmin), try to visit `/admin/employees` directly. **Expected:**
   redirected away — this route is gated to superadmin only, confirm an employee genuinely cannot
   reach it by URL.
2. As **Superadmin**: click "Add employee." **Expected:** a drawer with name, email, mobile, a
   temporary password field (with a "Generate" button producing a random one), and a permission
   checklist, all optional at creation time ("Grant now or later").
3. Create one with zero permissions checked. **Expected:** succeeds — "No access yet" is a valid,
   real state, not an error.
4. **Expected immediately after creation:** a one-time modal showing the email and temp password
   in plain text, an explicit statement this is the **only time** it's shown, and a "Copy details"
   button. Close it, then try to find that password anywhere else in the UI. **Expected:** you
   can't — it's genuinely not stored anywhere retrievable.
5. Sign in as that new employee. **Expected:** forced through the change-password gate (A6)
   before anything else.
6. Back as superadmin, open "Edit permissions" on an existing employee. **Expected:** the
   checklist opens **pre-ticked** exactly matching their current real grants (not blank, not
   guessed).
7. Untick everything and save. **Expected:** an explicit warning beforehand that saving
   **replaces the whole set**, not merges — confirm after saving that the employee now genuinely
   has zero access (try navigating as them, or check their row shows "No access yet").
8. Grant a specific permission (e.g. `exporter:verify`) and save. **Expected:** a success toast
   states it's effective **immediately, no re-sign-in needed** — confirm this is literally true:
   without that employee signing out and back in, they should now be able to use that permission.
9. Try creating an employee using an email that's already a **buyer or exporter** account.
   **Expected:** refused — a staff email must be exclusive, can't double as a party account.

### A15. Access control cross-checks
Do these explicitly, not just incidentally while testing the above:

1. **Signed out entirely:** paste a direct URL to `/buyer/verification`, `/exporter/products`,
   and `/admin/users` (one at a time, fresh tab). **Expected:** every one redirects you to the
   appropriate sign-in page (party or staff), and importantly carries you back to where you were
   trying to go **after** you sign in successfully — confirm the post-login redirect actually
   lands you back on the page you originally asked for, not just a generic dashboard.
2. **Signed in as a buyer:** paste a direct URL to `/exporter/products` or any `/admin/*` route.
   **Expected:** redirected to your own (buyer) home — never shown the page, never a 403 error
   page that would confirm the route exists.
3. **Signed in as an exporter:** same test against `/buyer/verification` and `/admin/*`.
   **Expected:** same treatment — bounced to your own home silently.
4. **Signed in as an Employee:** paste a direct URL to `/admin/employees`. **Expected:** bounced
   away, confirmed in A14.1.
5. **Already signed in** (any role), visit `/signin`, `/signup/buyer`, or `/forgot`. **Expected:**
   you never see the form — immediately redirected to your own role's home instead. This applies
   even if you manually type the URL while already logged in.
6. While signed in with `mustChangePassword` still true (A6), try visiting `/signin` directly.
   **Expected:** redirected to `/change-password`, not to sign-in and not to your role home — the
   forced gate wins over everything else.

---

## Part B — M2: Catalogue & Discovery

### B1. Public — Categories browse (`/categories`)
No login required.

1. Visit `/categories`. **Expected:** a directory of top-level categories, each with an image,
   name, and a few sub-category names as a teaser.
2. Click a top-level category. **Expected:** navigates to `/category/:slug` for that category.
3. Resize to a phone width (≤480px). **Expected:** no horizontal scroll; grid reflows to fewer
   columns; every tap target is comfortably sized.

### B2. Public — Category listing (`/category/:slug`)
No login required. Use a category with several real products (e.g. `cotton-fabric`) for most of
this, and one with only a single product in it (e.g. `denim`) for step 10.

1. Visit a category with products. **Expected:** breadcrumb (Categories → parent → this
   category), "N results | Category name" heading, a "Verified Indian exporters" pill, a
   sub-category rail on the left (desktop) with the current category checked/highlighted.
2. **Desktop only:** scroll the page. **Expected:** the left rail (sub-categories + filters)
   stays pinned near the top of the viewport as you scroll the product list, and does **not**
   overlap or get overlapped by anything else while pinned.
3. Toggle **Verified sellers**. **Expected:** the toggle's thumb slides fully inside the track in
   both states (never pokes outside the pill); the URL gains `?verified=1`; results update to
   verified-only sellers live, no page reload.
4. Set a **Price** range (min/max). **Expected:** results update to match; an "Applied Filters"
   chip appears for it; clicking the chip's × removes just that filter.
5. Select a category-specific attribute filter (e.g. Material, GSM). **Expected:** same
   live-update + chip behavior as price.
6. Click **Clear All** (in Applied Filters). **Expected:** every active filter clears at once,
   URL resets, full result set returns.
7. Change **Sort By**. **Expected:** result order changes accordingly (Newest first / Price
   low-high / Price high-low).
8. **Mobile (≤480px width):**
   a. **Expected:** you see a **"Filters" pill button** next to "Sort By" — NOT the full
      category-tile grid and filter panel inline on the page. The first product should be
      visible without scrolling past a wall of filters.
   b. Apply 1–2 filters (e.g. toggle Verified sellers). **Expected:** the Filters button shows a
      small numeric badge matching how many filter groups are active.
   c. Tap **Filters**. **Expected:** a full-screen sheet opens — header "Filters" + close (×),
      the category tiles + all filter controls scrollable in the middle, a sticky **"Show N
      results"** button at the bottom reflecting the live count.
   d. Toggle a filter *inside* the sheet. **Expected:** it takes effect immediately (check the
      result count in the "Show N results" button updates).
   e. Press **Escape**, or tap the **×**, or tap outside the sheet (backdrop). **Expected:** each
      one closes the sheet; page scroll (which was locked while the sheet was open) works again
      immediately after closing.
   f. **Expected:** products render as a clean **2-column grid** (compact cards: photo, name,
      price, MOQ, seller + verified tick) — not the wide horizontal card row you'd see on
      desktop.
9. Look at every product card (any viewport). **Expected:** no category or sub-category name is
   cut off mid-word with a trailing ellipsis — long names should wrap onto a second line instead
   and stay fully readable.
10. Visit a category with only ONE product in it and view its parent listing (or check via the
    product's own page — see B3 step 9 for the fuller version of this same behavior). Not
    directly testable from B2 alone; cross-reference B3.9.

### B3. Public — Product detail (`/product/:slug`)
No login required.

1. Visit a product with multiple photos. **Expected:** large image, thumbnail row below it,
   clicking a thumbnail swaps the large image and highlights the selected thumbnail.
2. Click the **expand icon** (bottom-right corner of the main photo). **Expected:** a full-screen
   lightbox opens showing the photo large, dark backdrop.
   a. If the product has multiple photos: prev/next arrows work, and an "X / N" counter shows
      at the bottom.
   b. Press **Escape**. **Expected:** lightbox closes; page scroll works again; keyboard focus
      returns to the expand-icon button (tab or check visually that the button shows a focus
      ring).
   c. Click the backdrop (away from the photo). **Expected:** closes the same way.
   d. Click the **×** in the top-right. **Expected:** closes the same way. **Important:** the
      close button must actually be clickable — click precisely on it, not near it.
3. Check the price block. **Expected:** clearly the most visually prominent number on the page;
   MOQ and (if present) supply ability shown beneath it.
4. Check the seller card. **Expected:** logo/monogram, company name, verified tick (only if that
   seller is actually verified), member-since/country/business-type with icons; clicking it
   navigates to that seller's `/supplier/:slug` page.
5. Check **Trade Specifications** (goods) or **Engagement Details** (services). **Expected:** a
   bordered card, each row has a small leading icon, only fields that actually have data show up
   (no row full of "—").
6. Check the **Send Enquiry** button. **Expected:** visibly greyed out / disabled — this is
   correct, see §0.4. Confirm it does NOT navigate anywhere or show a fake success message if
   clicked.
7. Scroll to **Description** and **Specifications**. **Expected:** both full-width, stacked;
   Specifications renders as a 2-column grid of label/value pairs on wider screens.
8. Scroll to **"More in {category}"**. **Expected:** up to 4 real products from the same
   category, excluding the one you're currently viewing; a "View Category →" link.
9. Find a product whose category has **no other products** in it (e.g. `selvedge-denim-14oz` in
   "Denim," if still the only one seeded). **Expected:** the "More in…" section still appears,
   but now says **"More in {the PARENT category}"** (e.g. "More in Textiles, Fabrics & Yarn")
   showing products from sibling categories instead — it should never just silently disappear
   AND it should never say "More in Denim" while showing non-Denim products.
10. **Mobile:** confirm the whole page reflows cleanly, no horizontal scroll, gallery/buy
    panel/facts all stack in a sensible single column.

### B4. Public — Supplier profile (`/supplier/:slug`)
No login required. Test with **"Tirupur Knitwear Exports"** (has a real cover photo + logo) AND
at least one other supplier (fallback gradient banner + monogram logo).

1. Visit the profile. **Expected:** a wide cover banner at the top (photo if set, otherwise a
   brand-blue gradient — never blank/broken), a logo overlapping its bottom edge **fully visible,
   not clipped or half-hidden by the banner**, company name, verified tick (if verified), and a
   **"Start Conversation"** button on the same row as the name.
2. Check "Start Conversation." **Expected:** visibly disabled — correct, see §0.4.
3. Check the fact pills below the name (country / business-individual / established year /
   member since). **Expected:** each has a small leading icon; only fields with real data show.
4. Check **About the Company**. **Expected:** if the seller wrote a description, it shows in a
   bordered card; if not, an italic placeholder line says so — never a blank gap.
5. Check **Product Catalogue**. **Expected:** heading + an honest "N Active Listings" count that
   matches the number of cards actually shown below it.
6. Check each catalogue card. **Expected:** photo, category label, product name, **Price** row,
   **Min. Order** row, and a **"View Specifications"** button.
   a. Click "View Specifications." **Expected:** navigates to that product's real detail page
      (`/product/:slug`), which does show full specifications — the label should feel honest,
      not misleading.
   b. **Mobile (narrow phone width, e.g. 375px):** confirm "View Specifications" stays on **one
      line** in every card — it should never wrap to "View" / "Specifications" on two lines.
7. **Mobile:** confirm the identity block restacks cleanly (Start Conversation button drops below
   the name row rather than squeezing beside it), fact pills wrap, no horizontal scroll.
8. Visit a supplier with **zero published products**. **Expected:** the identity block above
   still renders completely normally; only the catalogue area shows an explicit "No products
   listed yet" message — never an error, never implying something's wrong with the account.

### B5. Public — 404 / not-found handling
1. Visit a nonsense product slug, e.g. `/product/this-does-not-exist`. **Expected:** the shared
   "We couldn't find that page" screen — search icon, heading, subtext, "Go to the homepage"
   button. Never a blank white screen, never a raw error/stack trace.
2. Repeat for a nonsense category slug and a nonsense supplier slug. **Expected:** same shared
   page each time.
3. Visit a **draft or archived** product's URL directly (ask an exporter test account to create
   one, note its slug before publishing/archiving it). **Expected:** same 404 page — a draft or
   archived listing should be completely indistinguishable from a URL that never existed.

### B6. Exporter — My Products (`/exporter/products`)
Log in as the **unverified exporter** test account first.

1. Land on the page fresh (0 products). **Expected:** "List your first product" empty state with
   an "Add product" button, and a note that while unverified you can publish up to a limited
   number of live products.
2. Check the 5 stat tiles (All / Live / Hidden / Drafts / Archived). **Expected:** each shows a
   count; clicking one filters the list below to just that status; the active tile is visually
   distinct (border/highlight).
3. Because this account is **unverified**: the Live and Drafts tiles should each show a thin cap
   bar underneath ("N of 3 slots" / "N of 10 slots"). **Expected:** the bar fills as you approach
   the limit and turns a warning color once full.
4. Create products until you hit the **3-active-listing cap** (publish 3, then try a 4th).
   **Expected:** the publish action is refused with a clear message referencing the limit, and a
   "Get verified" link — never a silent failure or a generic error.
5. Similarly, try exceeding the **10-draft cap**. **Expected:** same treatment — clear message,
   not a silent failure, at the point of trying to save an 11th draft.
6. Publish one product, then **Hide** it. **Expected:** status flips to "Hidden," the product
   disappears from public search/category pages immediately (spot-check in another tab).
7. On a **Draft** or **Hidden** product's row, confirm the row action is **"Publish"** — never
   "Save" or anything implying a status you haven't reached yet.
8. Confirm there is **no "revert to draft"** action anywhere, on any product in any state — once
   published, a product can only go Hidden or Archived, never back to Draft.
9. **Archive** a product (via the row menu). **Expected:** a confirmation modal appears, wording
   makes clear this is NOT reversible ("can't be edited or restored... create a new listing" —
   never says "permanently deleted," since the record itself is kept). Confirm it, then check the
   Archived tile count went up and the product no longer appears in "All."
10. Now log in as the **verified exporter** account. **Expected:** no cap bars anywhere on the
    stat tiles, no "Get verified" prompt, and publishing has no numeric ceiling.
11. **Mobile:** confirm the 5 stat tiles become a horizontally swipeable strip (not a cramped
    grid), and the product list becomes cards (not a sideways-scrolling table).
12. If a staff account has taken one of your products down (coordinate with an admin tester, see
    B10), check that product's row. **Expected:** it shows its normal status chip PLUS a "Taken
    down" chip, a reason and date inline — and Publish/Hide are both gone (frozen), but Edit and
    Delete still work. **Never** shows who (which staff member) took it down.

### B7. Exporter — Add / Edit product (`/exporter/products/new`, `/exporter/products/:id/edit`)
1. Click "Add product" fresh. **Expected:** a full-width visual category chooser — top categories
   as tiles, sub-categories as pills once you pick a top one. No plain dropdown.
2. Pick a category, confirm you're never asked to choose "goods vs service" yourself — that's
   decided by which leaf category you picked.
3. Fill the guided form. **Expected:** numbered sections, each section's number flips to a green
   checkmark once satisfied; a sticky preview rail on the side shows a live "buyer preview" of
   the card + a listing-strength checklist of what's still missing.
4. Try to **Save** with required specification fields empty. **Expected:** it saves fine as a
   **Draft** — required specs are only enforced when you try to **Publish**, not at save time.
5. Try to **Publish** with a required spec missing. **Expected:** refused with a specific message
   about what's missing (not the same message as a cap refusal — compare against B6.4/B6.5).
6. Edit an existing **published** product and change its name. **Expected:** a note appears
   confirming the product's URL/slug will NOT change even though the name did.
7. Change a published product's **category**. **Expected:** a warning appears before the switch,
   telling you this will clear the category-specific specification fields you'd already filled
   in.
8. Try to open the edit form for an **Archived** product directly (paste its edit URL).
   **Expected:** refused/redirected — archived products never open in the form at all.
9. Open the edit form for a product with an active **takedown**. **Expected:** every field is
   still editable (so the seller can fix the issue), but Publish/Hide controls are gone —
   consistent with B6.12.
10. As the **unverified** exporter, hit the 10-draft cap (B6.5) — confirm it's actually enforced
    **before the form even renders** when you click "Add product" again (not just at save time).

### B8. Admin — Category Manager (`/admin/categories`)
Log in as **Employee** or **Superadmin** with the relevant permission.

1. Select a top-level category. **Expected:** right side shows a detail view (not a form+table) —
   header with the category's image (click/drag to replace it) and a master toggle whose label
   states the real consequence ("Live in the catalogue" / "Hidden, and every sub-category with
   it").
2. Turn the master toggle **off**. **Expected:** an amber banner appears explaining that the
   sub-category switches below now set "restore intent" rather than immediately toggling live
   state.
3. With the parent off, toggle a sub-category's switch, then turn the parent back **on**.
   **Expected:** only the sub-categories whose switches you left "on" while the parent was off
   come back active — the restore-intent behavior actually restores correctly.
4. Edit the category's name / order / synonyms. **Expected:** saves correctly; synonyms are
   never shown anywhere on the public site (search-only, confirm by searching one on the public
   category browse if AI/keyword search is testable).
5. Use a sub-category row's ⋮ menu: Edit, Manage fields, Delete. **Expected:** all three work;
   "Manage fields" navigates to Attribute Manager (B9) for that sub-category.

### B9. Admin — Attribute Manager (`/admin/categories/:id/attributes`)
1. Open an existing attribute (one already used by real products, e.g. Material on Cotton
   fabric). **Expected:** its **key** and **input type** are shown but **not editable** — greyed
   out or read-only, each with a stated reason (renaming/retyping would corrupt existing product
   data).
2. Try to create a new attribute of type **Select** with no options entered. **Expected:**
   blocked/validated — a select attribute needs real options, never silently saved empty.
3. Confirm the explanatory copy about changing a field's type (delete + recreate under a new key)
   is actually visible on the page, not missing — this is called out as easy to mistake for a bug
   if absent.

### B10. Admin — Product Monitoring (`/admin/products`)
1. Check the **status filter**. **Expected:** exactly three options — Active, Inactive, Blocked.
   Never "Draft" or "Archived" as filter options (they're excluded from this list entirely,
   server-side).
2. Search for a product using a **substring** in the middle of its name (e.g. "cotton" should
   find "Premium Cotton Fabric," not just names *starting* with "cotton"). **Expected:** matches.
3. Take a live product down (provide a reason). **Expected:** succeeds; open the row's detail
   drawer and confirm **who** took it down (staff name) is visible **only here**, on the
   staff-facing screen.
4. Now check that SAME product from the seller's own side (B6.12, as the exporter who owns it).
   **Expected:** the seller sees the reason and date, but never the staff member's name.
5. Confirm a **draft** or **archived** product never appears in this list under any filter
   combination.

### B11. Admin — Audit Log (`/admin/audit`)
1. Perform a few real actions elsewhere first (verify a seller, take a product down, edit a
   category) so there's something to see.
2. Open the audit log. **Expected:** entries for each of those actions, newest first.
3. Confirm there is **no edit, delete, "clean up," archive, or export control anywhere** on this
   screen — it must be strictly read-only, with zero exceptions.
4. Find an entry whose target has since been deleted/purged (if any exist). **Expected:** renders
   as plain text (not a broken link to a page that 404s), showing whatever snapshot data was
   captured at the time (e.g. product name + seller company), with no dead link.
5. Find an entry where `target.name` is genuinely absent. **Expected:** renders as "—", never a
   fabricated or guessed name.

---

## Part C — Cross-cutting

### C1. Mobile pass (repeat across the whole app, not just once)
Test at a genuinely narrow width (375–390px), not just a resized desktop browser:
- No horizontal scroll on ANY page in this document.
- Every tappable control is comfortably sized (roughly a fingertip, not a precise tap).
- No text is clipped mid-word by an unexpected ellipsis.
- Modals/sheets (product lightbox, mobile Filters sheet) lock background scroll while open and
  restore it on close.

### C2. Ownership / security spot-checks a non-technical tester can still do
- While logged in as Exporter A, try editing Exporter B's product by guessing/pasting its edit
  URL (`/exporter/products/:id/edit` with someone else's id). **Expected:** blocked (404, not a
  page that loads someone else's data).
- Log in as a **Buyer**, try visiting an **Exporter-only** URL directly (e.g.
  `/exporter/products`). **Expected:** redirected away, never shown exporter data.
- Log out completely, try visiting any `/admin/*`, `/exporter/*`, or `/buyer/*` URL directly.
  **Expected:** redirected to the appropriate sign-in page, never shown the real screen even
  briefly.
- Anywhere a seller shows as verified: confirm the page never displays the word "rejected," a raw
  status code, or any text explaining *why* an unverified seller isn't verified — absence of the
  tick should be the only signal, everywhere, with no exception you can find.
- Open the browser console (F12) on any page in this document. **Expected:** no token, OTP,
  password, or raw API key ever printed to it.

### C3. What "done" looks like for this pass
Every numbered step above has a ✅/❌/⚠️ next to it, and every ❌ has enough written detail
(what you expected vs. what happened, plus a screenshot for anything visual) that it can be
turned into a bug report without re-testing from scratch.
