# MPX Global — Web Human Test Guide

**Scope: M1 (Auth, Signup & KYC Verification) + M2 (Catalogue) — every web panel: Public, Buyer, Exporter, Staff/Admin.**

> This document is for a human tester who is NOT a developer. Follow each numbered step in
> order, compare what you see against "Expected result," and write **PASS** or **FAIL** in the
> table. If something fails, copy the row into the **Bug report log** (§18) with a screenshot.

---

## 0. How to use this document

- Each numbered section (§1, §2, …) is one screen or flow, with the URL to open and a step
  table. **Do the sections in order** — later ones assume accounts/data created earlier.
- Where the "Expected result" column quotes text in `"double quotes"`, that is the **exact**
  wording the screen should show — check it word for word, not just "something like this."
- **Never write a real password, OTP code, or full mobile/bank number into this document, a bug
  report, or a screenshot filename.**
- A row marked 🔴 **KNOWN GAP** is a gap the team already knows about — please still do the step
  and report exactly what you see (the exact wording matters), but you don't need to file it as
  a "new" bug. Everything else that fails IS a bug — file it.
- Items with a **"Soon" badge** or that are visibly greyed-out/disabled in a sidebar are
  **intentionally unfinished** (later milestones) — do not test or report these as broken.

## 0.1 Before you start

Ask the project owner for:
1. The web address to test against (e.g. `https://<web-address>`). Every path below (like
   `/signin`) is relative to that address.
2. A **staff (employee) login** and, separately, a **superadmin login** if §12–§13 and §17 are
   in scope for you.
3. A spare real email address and a spare real mobile number you can receive OTP codes on, for
   each NEW account you create during testing (buyer + exporter, at minimum).

You will need **at least 3 accounts** to get through this guide: one buyer, one exporter, and
the staff/admin login the owner gives you. Use a simple naming convention so you can tell your
own test accounts apart later, e.g. `yourname+buyer1@...`.

## 0.2 The three separate portals — read this first

This is **not** one login for everyone. There are **three** completely separate sign-in pages,
and an account on one does not work on another:

| Portal | URL path | Notes |
|---|---|---|
| Buyer | `/signin` | Self-signup. Portal is chosen with a toggle **on** the sign-in screen. |
| Exporter | `/signin` | Same URL as buyer — the **portal toggle** on the screen decides which, not the address. |
| Staff (employee / superadmin) | `/signin/staff` | No self-signup — staff accounts are created by a superadmin only. No portal toggle exists here. |

The same email or mobile number **can** hold one buyer account **and** one exporter account —
but never two of the same role, and never a staff account that overlaps with either.

---

# Part A — M1: Authentication, Signup & KYC Verification

## 1. Buyer signup — step 1 (account)

Open `/signup/buyer` (or click **"Get Started"** / **"Start Buying"** from the landing page at `/`).

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the top of the form. | Eyebrow reads **"Step 1 of 4"**, heading **"Create your buyer account"**. |  |  |
| 2 | Leave every field empty, click **Continue**. | Each field shows its own inline error (e.g. "Enter your full name.", "Enter your work email.", "Enter your mobile number."). Nothing is submitted. |  |  |
| 3 | Type an email with no `@` sign. | A "valid email" error appears. |  |  |
| 4 | Type a password under 8 characters. | Error: **"At least 8 characters."** |  |  |
| 5 | Type a real password (8+ chars). | A strength meter appears and updates as you type. |  |  |
| 6 | Type a different value in "Confirm password." | Error: **"Passwords don't match."** |  |  |
| 7 | Fill in a real name, a real email you can check, a real mobile number, and matching passwords. Click **Continue**. | Moves to the verify screen (§2). No account exists yet — this is correct by design. |  |  |
| 8 | Sign up again using an email/mobile that **already** has a buyer account. | A clear "account already exists" message with a **"Sign in instead"** link — not a crash or blank page. |  |  |

## 2. Buyer signup — step 1b: verify email + mobile

Two **separate** codes, one channel at a time — email first, then mobile.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the screen right after step 1. | Progress pills show **"1. Email"** / "2. Phone". Heading **"Verify your email"**. Body says a 6-digit code was sent to your email, address partly masked. |  |  |
| 2 | Enter a wrong 6-digit code on purpose. | Error: **"Invalid or expired code."** The boxes clear. |  |  |
| 3 | Check the resend control immediately after the screen loads. | Shows a cooldown countdown, e.g. `Didn't get it? Resend in {n}s` — not clickable yet. |  |  |
| 4 | Wait for the cooldown, click **Resend code**. | Confirmation "A new code has been sent." Timer resets. |  |  |
| 5 | Enter the correct EMAIL code. | Pill "1. Email" gets a ✓. Notice: "Email verified. Now the code we sent to your phone." Moves to **"Verify your phone"**, same 6-digit flow. |  |  |
| 6 | Enter a wrong code 5+ times on the EMAIL step only, on a fresh signup. | Eventually a lock note: "Too many attempts on the email code. Your phone code is unaffected — wait for the lock to clear, or start again." (Confirms the two codes are genuinely independent.) |  |  |
| 7 | Enter the correct MOBILE code. | Moves to the "your company" screen (§3). |  |  |
| 8 | Let the code timer expire (or note it), then check the copy. | `Code expires in {mm:ss}` counts down; once it hits zero: "That code has expired. Request a new one." |  |  |

## 3. Buyer signup — step 2: your company

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the top of the form. | Heading **"Your company"**, sub "Email and phone verified. This is the last thing we need." |  |  |
| 2 | Leave company name and country empty, click **Create my account**. | Errors: "Enter your company name.", "Choose your country." |  |  |
| 3 | Click the country field. | A **searchable** list opens (not a native tiny dropdown). Typing filters it. |  |  |
| 4 | 🔴 **KNOWN GAP — confirm and report exactly what you see.** Look for an "entity type" field or an "address" section on this buyer step. | **Neither should appear** — this is expected for a buyer (only exporters get entity type + address at signup). Confirm you see ONLY "Company name" + "Country." |  |  |
| 5 | Fill in company name + country, click **Create my account**. | Signed in immediately — no extra OTP step. Success screen: heading **"You're in."**, body mentions starting to browse suppliers. Button **"Go to your dashboard →"** lands on `/buyer/verification`. |  |  |

## 4. Exporter signup

Open `/signup/exporter`. Steps 1 and 1b are identical to the buyer flow (§1–§2, but "Step 1 of
**5**" and heading "Create your exporter account") — repeat those with a **new** email/mobile,
then focus on what differs below.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Reach the exporter's "Your company" screen (step 4 of 5). | Same base fields as buyer, **plus** an "Entity type" section. |  |  |
| 2 | Look at "Entity type." | Two full-width radio **cards**, not a dropdown: **"Business"** (sub-label "Registered company, firm or LLP") and **"Individual"** (sub-label "Sole proprietor or individual seller"). Helper text below: "This decides which documents we ask for when you apply for verification." |  |  |
| 3 | Look for an address section. | A collapsible **"Business address"** section, header note: "Optional — you can add or change this later from your company profile." (⚠️ there is in fact no such "later" screen on web today — see §11's known gap.) Fields inside: Address line 1, Address line 2, City, State, Postal code — all optional. |  |  |
| 4 | Fill in company name + country + entity type. Leave the address section **collapsed/empty**. Click **Create my account**. | Signed in immediately, lands on `/exporter` (the exporter dashboard). |  |  |
| 5 | Sign up again with an email/mobile that already has an EXPORTER account. | Clear "account already exists" message with **"Sign in instead"**, not a crash. |  |  |
| 6 | Using the SAME email/mobile you used for your buyer account in §1, sign up as an exporter. | Should succeed — one person can hold one buyer + one exporter account. |  |  |

## 5. Buyer / Exporter sign-in

Sign out if needed. Open `/signin`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the form. | Portal toggle: **"Buyer" / "Exporter"**. Field "Email or mobile" (helper: "Mobile must include country code, e.g. +91 98765 43210"). Link **"Forgot password?"**. |  |  |
| 2 | Pick the SAME portal you signed up on. Enter your real email and the WRONG password. | A red banner reads exactly **"Invalid credentials."** — above the form, no single field is marked wrong. |  |  |
| 3 | Try the account you just created, but select the **OTHER** portal (e.g. your buyer email on the Exporter toggle). | The **exact same** "Invalid credentials." message — must not hint that the account exists on the other portal. |  |  |
| 4 | Enter the correct email + password on the correct portal. | Moves to an OTP screen. |  |  |
| 5 | Check the message on the OTP screen. | Heading "Enter your code." Body: "We sent a 6-digit code to your registered mobile" + your masked mobile — **even if you signed in with your email.** |  |  |
| 6 | Enter the correct code. | Signed in, lands on your role's dashboard (`/buyer/verification` or `/exporter`). |  |  |
| 7 | Look anywhere on this page for a staff sign-in link. | There should be **none** — staff sign-in is deliberately not linked from here. |  |  |

## 6. Forgot / reset password

Sign out. On `/signin`, click **"Forgot password?"**.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the heading. | **"Reset your password."** Body explains a code goes to your registered mobile. |  |  |
| 2 | Enter an email that has **no** account, submit. | Still shows the SAME neutral confirmation screen (heading "Check your messages") — must **not** say "no account found." This is intentional (prevents account enumeration). |  |  |
| 3 | Enter your OWN real email, submit. | Same "Check your messages" confirmation, with a button **"Enter reset code"**. |  |  |
| 4 | Click through, enter a WRONG code with a new password. | Error: **"Invalid or expired code."** |  |  |
| 5 | Enter the correct code and a new valid password (8+ chars, confirmed). | Success screen: heading **"Password changed."** Body: "You've been signed out on all your other devices." |  |  |
| 6 | Try signing in with the OLD password. | Fails with "Invalid credentials." |  |  |
| 7 | Sign in with the NEW password. | Works normally. |  |  |

## 7. Staff sign-in (only if you were given staff/admin access)

Open `/signin/staff`. This page has **no** portal toggle — a staff email is exclusive to one account.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the heading. | Shield icon + **"Staff sign-in."** Sub "For MPX Global employees and administrators." Footer link "Not staff? Buyer & Exporter sign-in" → `/signin`. |  |  |
| 2 | Enter the wrong password for a real staff account. | "Invalid credentials." — same style/wording as the party portals. |  |  |
| 3 | Enter the correct staff email + password. | Either goes to OTP, or — for a freshly-seeded account — forces a **"Set a new password"** change-password screen first. Follow whichever appears. |  |  |
| 4 | If the "must change password" screen appears, set a new one. | Succeeds, continues into the admin console. Footer link "Sign out and start over" also works if you back out. |  |  |
| 5 | Once signed in, check where you land. | **Superadmin** → `/admin/users`. **Employee** → `/admin/users` if they can read users, else `/admin/verification`, else a calm **"no access"** page (`/admin/no-access`) — never a crash. |  |  |

## 8. Buyer dashboard (Verification status home)

Sign in as buyer. This is `/buyer/verification` — it doubles as the buyer's home/dashboard page (there is no separate "dashboard" screen).

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Land here right after signup (fresh account, no documents sent). | Heading `Welcome{, your first name}`. Title **"You haven't sent any documents."** Body explains verification is optional and the account already works in full. Button **"Upload documents."** |  |  |
| 2 | Look at the left sidebar. | Items: **Verification** (live, this page), **Search suppliers**, **Enquiries**, **Chat** — all three carry a **"Soon"** badge (do not test). **Settings** is visibly dimmed/disabled (no badge, just non-interactive). |  |  |
| 3 | Note there is no separate "company profile" or "edit company" link anywhere in this sidebar. | 🔴 **KNOWN GAP** — confirmed: there is currently no screen where a buyer can view or edit their company/organisation details (name, country, address) after signup. |  |  |

## 9. Exporter dashboard (Verification status home)

Sign in as exporter. This is `/exporter` — same idea, the exporter's home page.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Land here right after signup (fresh account, no documents sent). | Header shows your company name + `{country} · {Business/Individual} account`. Title **"Get verified to sell without limits."** Button **"Start verification."** |  |  |
| 2 | Look for the product-limit callout. | Box titled **"Your current limit: 3 active products."** Body explains the limit lifts once verified. Link **"Manage your products →"** goes to `/exporter/products`. |  |  |
| 3 | Look at the left sidebar. | Items: **Dashboard** ("Soon" badge — do not test), **Verification** (live, this page), **Products** (live), **Enquiries** / **Chat** ("Soon"), **Settings** (dimmed/disabled). |  |  |

## 10. KYC upload — Buyer

Sign in as buyer, open `/buyer/kyc` (via the "Upload documents" button on §8).

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the heading. | **"Upload your documents."** Sub "Optional — this earns you a verified tick." Info box: "Your account already works in full... You can do it now, later, or never." |  |  |
| 2 | Look for "What kind of account is this?" | Two radio cards: **"Business"** (desc "For registered companies") / **"Individual"** (desc "For independent traders"). Nothing pre-selected for a buyer (buyers set this on their first upload). |  |  |
| 3 | Try to add a file without choosing an account kind first. | Blocked with: "Choose what kind of account this is to continue." |  |  |
| 4 | Choose "Business," then try to submit with no document type chosen for an added file. | Blocked with: "Choose a document type for each file you have added." |  |  |
| 5 | Choose a document type, add a valid file (PDF/JPG/PNG/WEBP under the size limit), click **"Submit for review."** | 🔴 **KNOWN GAP — expected to fail on most buyer accounts. Report the EXACT text you see.** Because buyer signup never collects an address (§3), the server will very likely reject this with **"Complete your company profile before uploading documents."** shown against that document row — and there is **no button or link anywhere on web to fix it** (unlike the mobile app, which routes you straight to a fix). Please confirm this exact wording appears. |  |  |
| 6 | Try an unsupported file type or an oversized file. | Client-side error: "That file type or size isn't supported. Use a PDF, JPG, PNG or WEBP under {n} MB." |  |  |
| 7 | (If your account happens to already have a complete profile) Submit successfully. | Confirmation screen: heading **"Documents sent."** Body mentions "two to three working days." |  |  |
| 8 | Reload the page after a successful submit. | Status chip on the dashboard reads **"In review."** Form is replaced by "Your documents are with our team" (submitted state) — no re-upload possible while pending. |  |  |

## 11. KYC upload — Exporter

Sign in as an exporter who filled in an address at signup (§4 step 3 — do a second exporter signup with the address filled in if you skipped it before). Open `/exporter/kyc`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the heading. | **"Get verified."** Sub mentions sending "business" or "personal" documents depending on entity type. Info box: "Until you're verified you can keep three products live at a time..." |  |  |
| 2 | Look at "Your account type." | Read-only display of the entity type chosen at signup (Business/Individual) — **not editable here**, helper "Set when you signed up." |  |  |
| 3 | Choose a document type from the dropdown. | Options match your entity type (Business shows different choices than Individual — e.g. company registration/GST/certificate vs PAN/Aadhaar/passport). |  |  |
| 4 | Add a file without a chosen type, try to submit. | Blocked: "Choose a document type for each file you have added." |  |  |
| 5 | Add a valid file with a type chosen, submit. | If your profile IS complete (address filled at signup): succeeds, confirmation "Documents sent." If NOT complete: same 🔴 known-gap error as buyer's §10 step 5 — report the exact wording either way. |  |  |
| 6 | After a successful submit, reload. | Status becomes "In review" on the dashboard; form replaced by "Your documents are with our team" panel. |  |  |

## 12. Admin — Verification queue

Signed in as staff (§7), open `/admin/verification`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page. | Heading **"Verification queue."** Two tabs: **"Exporters to verify"** / **"Buyers to verify"**, each with a count chip. |  |  |
| 2 | Click into one pending organisation. | Row expands/links to show org name, country, entity type, submitted date, document count. Buttons: **"View documents"**, **"Reject"**, and **"Verify"** (exporter tab) / **"Approve"** (buyer tab). |  |  |
| 3 | Click **"View documents."** | Opens the KYC viewer (§13). |  |  |
| 4 | Reject one organisation: click **"Reject,"** type a reason under 3 characters. | Submit stays disabled — reason needs 3–500 characters. |  |  |
| 5 | Type a proper reason (e.g. "Address on the certificate doesn't match what you entered."), confirm. | Modal title was `Reject verification for {orgName}?`. Confirmation, and the org leaves the pending queue. |  |  |
| 6 | Approve a DIFFERENT organisation (Verify/Approve button). | Confirmation, org leaves the queue, `kycStatus` becomes verified. |  |  |
| 7 | Sign in as the REJECTED buyer/exporter (§8 or §9) and check their status page. | Shows the exact rejection reason you typed, privately, with a way to fix and resubmit. |  |  |
| 8 | As the now-VERIFIED account, check their status page. | Shows a verified tick / "You're verified" state. **No raw internal status word** anywhere (e.g. never the literal word "verified" as database text) — just the tick treatment. |  |  |
| 9 | Try to reject/approve the SAME organisation from two open tabs (simulate a race). | The second attempt shows a stale-notice: "This account is no longer awaiting review" with a **"Refresh"** button — not a crash or a double-action. |  |  |

## 13. Admin — KYC document viewer

Reached via §12 step 3, or directly at `/admin/verification/:orgId/kyc`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page. | Summary bar: Applicant, Entity, Country, Submitted date, file count, status chip. Privacy note: "These documents are private. Your access to them is recorded for auditing." |  |  |
| 2 | Click a document to preview it. | It must actually **render** — not a broken image icon or a blank frame. |  |  |
| 3 | Try both an image document AND a PDF document if both exist. | Both render correctly. Unpreviewable types show "This file can't be previewed here" + **"Open in a new tab."** |  |  |
| 4 | Leave the page open a few minutes, then try to preview again. | An expired-link overlay: "This preview has expired... Reload to fetch fresh ones — the access is recorded again." Button **"Reload document."** |  |  |
| 5 | Approve/reject from this screen directly (buttons at the bottom). | Same reject-modal behaviour as §12 step 4–5; decision confirms with a note like "Approved — the verified tick is now live." |  |  |

## 14. Admin — Users

Open `/admin/users` (staff with the right permission).

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page. | A list/table of buyer and exporter accounts. |  |  |
| 2 | Search or filter for one specific account. | Finds it correctly. |  |  |
| 3 | Open one user's detail. | Shows their info WITHOUT exposing anything that shouldn't be public — no plain password, no raw `kycStatus` string dumped, no internal-only fields. |  |  |

## 15. Admin — Employees (superadmin only)

Open `/admin/employees`. Skip this section if you were not given a superadmin login.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page as a non-superadmin staff account (if you have one to test with). | Access refused / page not reachable — only a superadmin manages employees. |  |  |
| 2 | As superadmin, create a new employee with a temporary password and a couple of permissions checked. | Employee is created; a temp/must-change-password flow is indicated. |  |  |
| 3 | Sign in as that new employee (`/signin/staff`) with the temp password. | Forced into "Set a new password" before anything else (see §7 step 3). |  |  |
| 4 | Re-open the employee's edit drawer afterward. | Permissions checkboxes reflect what was actually granted (not blank/reset). |  |  |

---

# Part B — M2: Catalogue

> Public catalogue screens (§16–§19) need **no login** — test these in a private/incognito
> window too, to be sure nothing is accidentally gated behind sign-in.

## 16. Public — Categories

Open `/categories` (also reachable from the landing page's **"Browse all categories"** button).

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page signed OUT. | Loads fully with no sign-in prompt. Heading **"Browse categories."** Sub "Find specialised suppliers across 40 industries." |  |  |
| 2 | Count the cards. | Should show all top-level categories (40 by design), each with a footer like `{n} sub-categories`. |  |  |
| 3 | Look at a category with no image uploaded yet. | Falls back to a clean two-letter monogram — never a broken image icon. |  |  |
| 4 | Click any category card. | Opens `/category/:slug` (§17). |  |  |
| 5 | Turn off your network / simulate a load failure if you can. | Error state: "We couldn't load the categories" — not a blank white page. |  |  |

## 17. Public — Category listing

Open `/category/:slug` for a category that has products, then one that doesn't.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open a sub-category WITH products. | Breadcrumb: Categories → parent top → this category. Product count line `{n} products`. Product grid renders. Sidebar heading **"Related categories."** |  |  |
| 2 | Open a TOP-level category directly. | Sidebar heading changes to **"Sub-categories"** instead. |  |  |
| 3 | Open a sub-category with **zero** products (most will have none in test data). | Title **"No products in this category yet."** Body "We're still sourcing suppliers here." Button **"Browse all categories."** This is a normal state, not a bug. |  |  |
| 4 | Look for any search box, filter sidebar, or sort dropdown on this page. | There should be **none** — search/filtering is a later milestone (M3), deliberately absent here. Products are newest-first only. |  |  |
| 5 | Click a product card. | Opens `/product/:slug` (§18). |  |  |

## 18. Public — Product detail

Open `/product/:slug` for a real published product (create one first via §20 if none exist).

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open a GOODS product. | Fact labels include: Minimum order, HS code, Country of origin, Supply ability, Lead time, Packaging, Payment terms (only the ones the seller filled in appear). Panels "Description" and "Specifications." |  |  |
| 2 | Open a SERVICE product. | Different fact labels: Engagement type, Delivery model, Team size, Pricing model, Timeline. |  |  |
| 3 | Look for a status word like "Live," "Available," "In stock," anywhere. | Should be **absent** — deliberately, this page never shows a status word. |  |  |
| 4 | Look for an "Enquire" / "Contact seller" / "Get quote" button. | Should be **absent** — enquiry/chat is a later milestone (M4), not built yet. |  |  |
| 5 | Check the seller's contact info on this page. | Should show **none** — no email, phone, address, or website anywhere on a product page. |  |  |
| 6 | Try a URL for a DRAFT or taken-down product's slug directly. | Renders the normal 404 "Not found" page — indistinguishable from a slug that never existed. |  |  |

## 19. Public — Supplier profile

Open `/supplier/:slug` for a verified exporter and an unverified one.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open a VERIFIED exporter's profile. | Header line: country · entity type · established/member-since year (only fields present). A **verified tick** shows next to the company name. |  |  |
| 2 | Open an UNVERIFIED exporter's profile. | Profile is still fully public and browsable — just **no tick**, and no "not verified" badge or sentence anywhere. |  |  |
| 3 | Open an exporter with zero published products. | Title **"No products listed yet."** Body "This supplier hasn't published any listings." — a normal state, not an error. |  |  |
| 4 | Check for contact info or a "website" link anywhere on the page. | Should be **absent** — never shown publicly. |  |  |

## 20. Exporter — My products (list + cap meter)

Sign in as an **unverified** exporter, open `/exporter/products`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page with zero products. | Title **"List your first product."** Body mentions adding photos/specs/pricing, "you can save a draft and finish later," and (since unverified) "While unverified you can publish up to 3 live products." Button **"Add product"** / **"+ Add product"**. |  |  |
| 2 | Look at the tabs. | Exactly five: **All, Live, Hidden, Drafts, Archived** — each with a count. No "Blocked" tab. |  |  |
| 3 | Look for a cap meter (once you have at least one product). | Two bars reading `{used} of 3 live listings` and `{used} of 10 drafts`, with the line **"Get verified to publish unlimited products."** underneath. |  |  |
| 4 | Publish products until you hit the 3-live cap, then try to publish a 4th. | A red banner shows the server's refusal message, with an inline **"Get verified"** link → `/exporter/kyc`. |  |  |
| 5 | Check a taken-down product's row (create/take one down via §23 first, or use seed data). | The row keeps its REAL status tab (e.g. still under "Live" if it was live) but shows an extra **"Taken down"** chip alongside — this disagreement between the cap meter and the Live tab count is correct, expected behaviour (a taken-down product doesn't occupy a cap slot). |  |  |
| 6 | Open the row menu on a normal draft. | Actions: **Publish, Edit, Delete.** |  |  |
| 7 | Open the row menu on a live product. | Actions: **Hide, Edit, Delete.** |  |  |
| 8 | Open the row menu on an archived product. | **No actions at all.** |  |  |
| 9 | Click **Delete** on any editable product. | Modal: **"Delete this product?"** Body explains this ARCHIVES it (can't be edited or restored; name/URL become reusable to list again). Confirm button **"Archive product."** |  |  |
| 10 | Verify the archived product still shows under the Archived tab. | Yes — archiving doesn't remove it from your list, just moves/locks it. |  |  |

## 21. Exporter — Add / Edit product

From §20, click **"+ Add product"** (`/exporter/products/new`).

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the form before choosing a category. | Only a "Category" section is visible. Prompt: "Choose a category to continue." — the rest of the form (Details, Pricing, etc.) is entirely absent, not just disabled. |  |  |
| 2 | Choose a GOODS-type leaf category. | Sections appear: Details, Pricing, **"Trade details"** (HS code, supply ability, lead time, packaging, payment terms — all optional), and Specifications (if the category has any fields defined). |  |  |
| 3 | Choose a SERVICE-type leaf category instead. | Section becomes **"Service details"** (engagement type, delivery model, team size, pricing model, timeline). |  |  |
| 4 | Look for a "goods vs service" toggle anywhere on the form. | There should be **none** — the category you pick decides this automatically. |  |  |
| 5 | Fill in a product name and category only, click **"Save draft."** | Saves successfully as a draft — required specification fields are NOT enforced yet (only checked when you later publish). |  |  |
| 6 | Try to publish a draft that's missing a REQUIRED specification field (if the category has one marked required). | Blocked with a message naming the missing field. |  |  |
| 7 | Edit an existing product's name. | A note appears: "Your product's web address stays the same." |  |  |
| 8 | Change an existing product's category after specs were filled in. | Confirm modal: "Change category?" Body: "Changing category clears the specifications you've filled in." |  |  |
| 9 | Open a TAKEN-DOWN product's edit form. | A blocked banner shows at the top (see §23), but **all fields remain editable** — only Publish/Hide are missing from the lifecycle strip. |  |  |
| 10 | Try to open an ARCHIVED product's edit URL directly. | Terminal state: "This product is archived." Body explains it can't be edited or restored. Button **"Create a new listing."** |  |  |
| 11 | Try to open another exporter's product-edit URL by guessing/editing the ID in the address bar. | "Not found." — "This product doesn't exist, or it isn't yours." (Never a 403 or someone else's data.) |  |  |
| 12 | Upload 6+ images to one product. | Blocked at 5 — matches the documented image cap. |  |  |

## 22. Exporter — image upload

Within the product form (§21), test the image manager directly.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Upload a valid JPG/PNG under 5MB. | Uploads and shows a thumbnail. |  |  |
| 2 | Upload a file over 5MB. | Rejected with a clear size-limit message. |  |  |
| 3 | Upload a non-image file renamed with a `.jpg` extension (if you can construct one). | Should still be rejected — the server checks real file content, not just the extension. |  |  |
| 4 | Remove an uploaded image, then re-add images in a different order. | 🔴 **Not a bug, but a real limitation** — there is no drag-to-reorder control. The first image you upload is always the cover photo; to change the cover you must remove and re-add in the order you want. Confirm this is what happens (no crash, no silent reorder). |  |  |

## 23. Exporter — taken-down product handling

Have staff take down one of your products first (§25), then view it as the exporter.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open `/exporter/products`, find the taken-down row. | Shows the extra "Taken down" chip next to its normal status chip. |  |  |
| 2 | Open the blocked banner (list row or edit form). | Heading `Removed by the MPX team on {date}`. Reason line shows the admin's reason verbatim, as they wrote it. Footer: "It can't be published or hidden until it's restored. You can still edit it." |  |  |
| 3 | Look for the name of WHICH staff member took it down. | Should be **absent** on the seller's side — sellers only ever see the reason + date, never the acting admin's name/identity. |  |  |
| 4 | Look for an "appeal" or "request review" button. | Should be **absent** — not built; the only path back is staff restoring it (§25) or the 180-day auto-purge. |  |  |
| 5 | Edit the product's fields (name, description, price) while it's blocked. | Saves normally — editing is allowed even while blocked. |  |  |

## 24. Admin — Category Manager

Signed in as staff with category permissions, open `/admin/categories`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page. | Left rail lists the 40 top categories; inactive ones show muted, never hidden from the admin. |  |  |
| 2 | Click a top category. | Right panel: Active toggle, image upload ("Add image"/"Replace," 1 image, 5MB max), fields Name / Display order / Synonyms (chip input, helper explains synonyms are "Never shown publicly"). |  |  |
| 3 | Try to add or delete a TOP-level category. | There should be **no** such control — tops are seeded and fixed; only toggle + name/order/synonyms + image can be edited. |  |  |
| 4 | Toggle a top category OFF. | Confirm modal: `Turn off {topName}?` Body warns this hides ALL its sub-categories and their products from public view too. Confirm with **"Turn off category."** |  |  |
| 5 | After turning the top off, toggle ONE of its subs individually. | The sub's row doesn't visually change (everything under an off top is already hidden) — but a notice explains the REAL effect: `{subName} will stay off even after {topName} is reactivated.` or the opposite, `will come back on`. |  |  |
| 6 | Turn the top back ON. | Subs you didn't touch come back automatically; the one you set to "stay off" in step 5 remains off — confirming the "restore intent" behaviour worked as explained. |  |  |
| 7 | Click **"+ Add sub-category"** under a top. | Drawer: "Add sub-category," fields Name, Type (Goods/Service — a select, only on create), Synonyms (optional), Order (optional). Save. |  |  |
| 8 | Edit that sub-category afterward. | "Web address" (slug) and "Type" are now **read-only** — helper explains type "Can't change once products use this category" and the web address is "Fixed once created, so existing links keep working." |  |  |
| 9 | Try to delete a sub-category that HAS products in it. | Refused with: "This can only be deleted while no products use it. If any do, deactivate it instead." |  |  |
| 10 | Delete a sub-category with NO products. | Confirm modal `Delete {subName}?`, succeeds. |  |  |

## 25. Admin — Attribute Manager

From a category's "Fields" link in §24, or directly at `/admin/categories/:id/attributes`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page. | Breadcrumb Categories → top → this category. Heading = category name + Goods/Service chip. Table columns: Name, Key, Type, Unit, Options, Required, Filterable. |  |  |
| 2 | Click **"+ Add field."** | Drawer "Add field": Display name, Key (editable + a **"Generate"** button), Type (select: Text/Number/Yes-No/Select), Options (only if Select), Unit (optional), checkboxes Required / Filterable, Order. |  |  |
| 3 | Save a new field, then open it to edit. | **Key and Type are now locked/read-only.** Helper on Type: "Type can't change later. To convert an existing field, delete it and create a new one with a different key." |  |  |
| 4 | Delete a field that existing products already use a value for. | Confirm modal warns: "Products that already have {fieldName} keep their saved value — it just stops being asked for on new listings." Confirm and it's removed from the form going forward. |  |  |
| 5 | Mark a field "Required," save, then try to publish a product in that category missing that field (§21 step 6). | Publish is blocked, naming the field. |  |  |

## 26. Admin — Product Monitoring (takedown / restore / purge)

Open `/admin/products`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Look at the Status filter. | Exactly **"All," "Active," "Inactive," "Blocked"** — no Draft, no Archived options, ever. |  |  |
| 2 | Search by product name, typing only a middle/partial word (not the start). | Still finds matches — this is a substring search, not "starts with." |  |  |
| 3 | Check the "Nearing purge" checkbox. | Filters to only products within ~30 days of permanent deletion. |  |  |
| 4 | Find a seller with 2+ past takedowns. | Their row/cell shows a `{n} takedowns` chip in a warning colour. |  |  |
| 5 | Take down a live product: row menu → **"Take down."** Try to confirm with a reason under 3 characters. | Submit stays disabled. |  |  |
| 6 | Type a real reason (3+ chars), confirm. | Modal explains: "The product disappears from the public catalogue immediately... If it stays blocked for 180 days it is permanently deleted." Product now shows "Blocked" in the list. |  |  |
| 7 | Open that product's detail drawer. | Shows the reason verbatim, plus `By {admin name} · {date}` — **this admin name is staff-only**, confirm it does NOT appear on the seller's own view (cross-check with §23 step 3). |  |  |
| 8 | Check the purge countdown text. | Reads `Purges in {n} days` (or `Purges in 1 day` for exactly one), turning amber/bold once under 30 days. |  |  |
| 9 | Restore the product: row menu → **"Restore."** | Confirm modal explains it returns to exactly the state the seller left it in, and "the seller's takedown count is not reduced." |  |  |
| 10 | Confirm the product's takedown count did NOT decrease after restoring. | Matches the modal's warning — count stays at whatever it was. |  |  |

## 27. Admin — Audit Log

Open `/admin/audit`.

| # | Step — what to do | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Open the page. | Heading "Audit log." Sub explicitly says "This record is append-only." |  |  |
| 2 | Count the interactive controls on the whole page. | Should be very few — filters + **"Clear filters"** only. **No edit, delete, or export button anywhere.** |  |  |
| 3 | Set a "From" date AFTER a "To" date. | Error: "The end date is before the start date — no window to search." |  |  |
| 4 | Filter by an exact action string, e.g. `product.takedown`. | Matches exactly (this filter is exact-match, not partial). |  |  |
| 5 | Look at a row for a takedown you did in §26. | Table shows When / Actor (`{name} · {role}`) / Action (readable label like "Product takedown") / Target / Reason. |  |  |
| 6 | Click a row to open its detail. | Read-only drawer: When, Actor, Target, Type, Reason, Reference. A "Recorded changes" section shows a labelled before → after list (never raw JSON). |  |  |
| 7 | Find a row referencing a product you've since permanently deleted/purged (may not be available in your test window — note if not testable). | Target renders as **"—"** (plain text, not a broken link) rather than crashing — the log is append-only so it can outlive the thing it describes. |  |  |
| 8 | Try any filter combination that matches nothing. | Empty state: "No activity in this period" / "Nothing was recorded with those filters." |  |  |

---

# Part C — Cross-cutting checks (every screen, both M1 and M2)

| # | Check | Pass/Fail | Notes |
|---|---|---|---|
| 1 | Resize the browser to a phone width (or use your phone) on at least: the landing page hero, one signup step, the product form, and one admin table. Nothing should overflow sideways or become unusable. |  |  |
| 2 | Try the browser's back button mid-flow (e.g. partway through signup, or after opening a modal). Should not leave you in a broken/confusing state. |  |  |
| 3 | Type a very long company name, product name, or description. Text should wrap, never break the page layout. |  |  |
| 4 | Watch for any raw technical error (a stack trace, "MongoServerError," a database message). You should only ever see a plain, human sentence. |  |  |
| 5 | Watch for a totally blank white page / crash. Always worth a bug report if you see one. |  |  |
| 6 | On any screen showing verification status, confirm you never see the raw word "verified"/"pending"/"submitted"/"rejected" as a bare database-looking value — always a designed chip or sentence. |  |  |
| 7 | On any public page (categories, product, supplier), confirm no email/phone/website/address ever appears, verified or not. |  |  |
| 8 | Try submitting any form by pressing Enter, not just clicking the button — should behave the same. |  |  |

---

# 18. Bug report log

Copy this table for each issue you find.

| Field | Your notes |
|---|---|
| Section / screen | |
| Browser + window size used | |
| What you did (steps) | |
| What you expected | |
| What actually happened | |
| Screenshot attached? (Y/N) | |
| Account used (portal + email, **NOT** password) | |
| Date & time | |

**Never write a password, OTP code, or full mobile/bank number into this log or a screenshot filename.**

---

# 19. Sign-off

| Panel | Sections | Tested by | Date | Result |
|---|---|---|---|---|
| Public (no login) | §16–§19 | | | |
| Buyer | §1–§3, §5–§6, §8, §10 | | | |
| Exporter | §4–§6, §9, §11, §20–§23 | | | |
| Staff / Admin | §7, §12–§15, §24–§27 | | | |
| Cross-cutting | Part C | | | |
