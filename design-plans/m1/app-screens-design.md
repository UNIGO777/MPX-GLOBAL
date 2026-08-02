# M1 · Mobile App Screens — Design Brief

> **17 screens** for the M1 (auth + KYC + verification + company profile) milestone, **mobile app
> only** (React Native / Expo, iOS + Android).
> This is a **design** document: what each screen contains, every field on it, and the states that
> need artwork. No API or code detail.
> Companion: `my-plans/m1/web-screens-design.md` — the two surfaces must feel like one product.

> ## 🔴 Realigned 2026-07-30 to `modules-in-detailed/m1-max-1.5days/m1.md`
> This brief was rewritten against the current M1 plan. Three things changed structurally, and they
> invalidate any artwork drawn from the previous version:
>
> 1. **§A21 — separate buyer and exporter portals.** There is no longer one shared login. Each
>    portal has its own login screen and the same email may hold **one buyer + one exporter**
>    account. (Was: "Login — one screen for both roles, no role selector".)
> 2. **§A21 — signup is two steps with OTP between them.** Step 1 is a shared account form; OTP;
>    step 2 is the company step, which either **claims** an existing Organisation or creates a new
>    one. (Was: two separate single-shot signup forms that created account + company together.)
> 3. **§A22 — company profile screens are M1 scope, and are new.** Buyer and exporter can both view
>    and edit their own company. Fields checked against KYC **lock after verification**; changing
>    one is allowed but costs the tick. (Was: absent entirely.)
>
> ⚠️ **`web-screens-design.md` has not been realigned** and still describes the old shared login and
> single-step signup. Screens 2, 3, 6 and 9 of that brief are stale against §A21, and it has no
> company-profile screens (§A22). Flagged, not changed — say the word and I'll do the same pass on it.

---

## 1. Before anything else — what the app is and isn't

**The app has two roles only: Buyer and Exporter.** There is no employee panel and no admin panel in
the app, ever. Those are web-only. So there is no staff login affordance and nothing in the UI that
hints at internal tooling.

**The app is not a smaller web app.** Same product, same tokens, native patterns: bottom tabs instead
of a sidebar, stack navigation with native back, bottom sheets instead of centred modals, native
pickers, pull-to-refresh, and the phone's camera as a first-class input.

**Where the app is genuinely better than web:** photographing identity documents. An exporter can
shoot their GST certificate with the camera instead of finding a scanner. Design the KYC flow around
that, not around a file browser.

### 1.1 Design foundations

**Match the web tokens** — same palette, same status colours, same type ramp adapted to mobile sizes.
A buyer who signs up on web and logs in on the app should not feel they changed products.

- `primary` (indigo `#4f46e5` — **starter value, brand not yet confirmed**) — actions, active tab
- `ink` (slate) — text
- `surface` / `surface.subtle` / `surface.border` — backgrounds, dividers
- `success` — verified tick, approvals · `warning` — in review · `danger` — rejections, destructive
- `muted` — secondary text

**Platform conventions.** Respect each platform rather than forcing one look: iOS back-swipe and
large titles; Android hardware back and ripple feedback. Shared layout, native mechanics.

**Safe areas.** Every screen accounts for notches, Dynamic Island, home indicators and Android
navigation bars. Nothing clipped, nothing sitting under a system bar.

**Keyboard handling is a design requirement, not a bug fix.** On mobile the keyboard covers up to
half the screen. Every form screen must keep the focused input and its primary button reachable —
scroll-on-focus, or a button pinned above the keyboard. Correct keyboard type per field: email,
phone pad, numeric for codes.

**Touch targets ≥ 44px.** No hover-only affordances — hover doesn't exist here.

**Two device sizes minimum:** a small phone (~375pt) and a large phone (~430pt). Nothing clipped,
nothing unreachable behind the keyboard.

**Dark mode: pick one and commit.** Either fully support it or lock the app to light. A half-done
dark mode is worse than none. Decide before visual design starts — it doubles the artwork.

**Offline is a state you must draw.** Mobile networks drop. Every screen that loads data needs an
offline message with a retry, never an endless spinner.

### 1.2 The verified tick — same rule as web

**One badge only: a verified tick, shown when an account is verified.** No "not verified" badge, no
red cross, no warning chip. Absence of the tick means unverified.

Design it once: `success` check + "Verified" (+ optional "since Mar 2026"). Appears on buyer home,
exporter home, profile, and both company-profile screens.

**Never show a raw status publicly.** The tick is driven by a server-derived `verified` flag; a
rejection is **private to the account owner** and never appears on any public-facing surface,
including the exporter's public-page preview (screen 15).

### 1.3 Status vocabulary — same four states as web

| Status | Colour | Label | Meaning |
|---|---|---|---|
| Pending | `muted` | "Not submitted" | nothing uploaded |
| Submitted | `warning` | "In review" | with the team |
| Verified | `success` | "Verified" ✓ | tick earned |
| Rejected | `danger` | "Needs attention" | reason + resubmit |

These four also drive the company-profile screens: a profile edit that touches a locked field moves
the account **from Verified back to In review** (§A22.2), so that transition needs artwork too.

### 1.4 Two portals, one app — the §A21 model

This is the structural change most likely to be got wrong, so it is stated once, here, and every
auth screen refers back to it.

- **Buyer and exporter are separate accounts on separate portals.** The user chooses the portal on
  the welcome screen (screen 2), and that choice scopes both sign-in and sign-up.
- **The same email or mobile may hold one buyer account and one exporter account** — never two of
  the same role. Passwords are independent; OTP locks are independent. Signing out of one does not
  sign out the other.
- **Signing in to the wrong portal returns the generic "Invalid credentials."** The UI must never
  say "this account exists as an exporter" or offer to switch. That disclosure is the exact thing
  the generic message exists to prevent.
- **There is no in-app account switcher in M1.** A person with both accounts signs out and signs in
  on the other portal. Design the portal identity so it is obvious which one they are in — a
  persistent label on the login screen and in the profile identity block.
- **No staff login in the app at all** — employee and superadmin are web-only.

### 1.5 Sensitive screens

The KYC screens display identity documents (PAN, Aadhaar, passport, GST certificates). Treat them as
sensitive surfaces: **content hidden when the app is backgrounded** (blur or overlay in the app
switcher), and no document thumbnails leaking into any other screen. Design the blurred/covered state
as a deliberate frame, not an accident.

---

## 2. Shared components to design once

**Forms:** text input · email input · password input (show/hide + strength meter) · **phone input**
(country-code button opening a searchable sheet + number field) · **country picker** (full-screen or
large sheet, searchable, ~200 entries — a native dropdown is unusable at this length) · radio cards ·
checkbox · textarea with character counter (company description) · inline field error ·
required/optional marker · **locked-field row** (see below).

**Locked-field row — new for §A22.** A field that is filled, read-only, and carries a lock icon plus
a one-line reason. It needs three variants: **locked** (verified account), **editable-with-warning**
(the user tapped "change anyway"), and **plain editable** (unverified account). Used on both
company-profile screens.

**Feedback:** button (primary / secondary / ghost / danger, each with loading + disabled) · toast /
snackbar · inline alert (info / warning / danger / success) · skeleton · empty state · error state ·
**bottom sheet** confirmation (destructive variant) · pull-to-refresh · full-screen loader (session
restore only).

**Special:**
- **OTP input** — 6 boxes, auto-advance, paste-across, numeric keypad, visible countdown, resend
  disabled until cooldown. Used in **three** contexts now: signup step-1→step-2, login, and password
  reset. One component, three headings.
- **Document capture row** — the mobile centrepiece: choose **Camera** or **Gallery** (or Files for
  PDFs), thumbnail preview, retake, remove, per-file progress.
- **Logo picker** — square crop, camera or gallery, replace and remove. Exporter only.
- **Step indicator** — signup is two steps with an OTP between; the user must always know where they
  are and that step 2 is short.
- **ScreenContainer** — the wrapper every screen inherits: safe areas + keyboard avoidance + scroll.
  Get this right first and every form screen benefits.

**Navigation shells:** stack header (title, back, optional action) · **bottom tab bar** (two
variants, buyer and exporter) · splash.

---

## 3. Screen inventory — 17

| # | Screen | Role | Group |
|---|---|---|---|
| 1 | Splash / session restore | — | launch |
| 2 | Welcome / portal choice | public | auth |
| 3 | Login — portal-scoped | public | auth |
| 4 | OTP verify (signup · login · reset) | public | auth |
| 5 | Forgot password | public | auth |
| 6 | Reset password | public | auth |
| 7 | **Signup step 1 — your account** (shared) | public | auth |
| 8 | **Signup step 2 — your company** (claim or create) | public | auth |
| 9 | Buyer home | buyer | buyer tabs |
| 10 | Buyer KYC upload | buyer | buyer |
| 11 | Buyer verification status | buyer | buyer |
| 12 | **Buyer company profile** | buyer | buyer |
| 13 | Exporter home | exporter | exporter tabs |
| 14 | Exporter KYC upload + resubmit | exporter | exporter |
| 15 | **Exporter company profile + public preview** | exporter | exporter |
| 16 | Profile | both | tabs |
| 17 | Biometric unlock | both | re-entry |

Plus navigation shells: two bottom tab bars, and the "coming soon" placeholder pattern for tabs whose
modules arrive later.

**Changed from the previous draft:** the two separate signup screens (buyer / exporter) are gone,
replaced by shared screens 7 and 8. Screens 12 and 15 are new (§A22).

**Never design, in any milestone:** payment release, payout approval, or escrow approval screens.
Those are web-only by contract. **Not in M1:** employee or admin screens (web-only), and any
two-factor authenticator setup (D4, on hold — staff aren't in the app anyway).

**Not named in `m1.md` §7 — carried as app-necessary shells, flag if you disagree:** 1 (splash),
2 (welcome/portal choice), 16 (profile), 17 (biometric unlock). The web brief was cut to only
plan-named screens on 2026-07-29; these four have no web equivalent to cut against, and an app
cannot function without at least 1, 2 and 16. **17 (biometric) is the one genuinely discretionary
screen here** — see §10.

---

## 4. Launch & auth

### 1 · Splash / session restore

Shown for a moment on every cold start while the app works out whether someone is already signed in.

**Contains:** logo, brand mark, optional tagline, a subtle loading indicator.

**States:** loading · **failed to reach the server** (offline message + retry, not a hang).

**The one rule:** never flash the login screen at a user who is already signed in. Hold the splash
until the session is resolved, then go straight to their tabs. Design it to sit comfortably for a
second or two, not as a flicker.

---

### 2 · Welcome / portal choice

First screen for a new or signed-out user, and the **entry point that picks the portal** (§1.4).
This screen now does more work than the old "role choice" version: the choice made here scopes
sign-in as well as sign-up.

**Contains:** brand · one-line value proposition · **two equal portal cards**:

| Card | Line |
|---|---|
| **Buyer** | "I want to buy from Indian suppliers" |
| **Exporter** | "I want to sell to international buyers" |

Each card leads into that portal, where the user can **Sign in** or **Create account**.

**Design notes:**
- The two paths are visually equal — not one primary and one afterthought.
- A person may legitimately hold **both** accounts, so the choice must not read as permanent or
  exclusive ("Which are you?" is the wrong framing; "What do you want to do?" is right). A quiet
  line — *"You can have both a buyer and an exporter account"* — belongs here, and it is the only
  place in the app where that fact is stated to a signed-out user.
- Optionally one or two onboarding slides; keep it short, nobody reads four.

---

### 3 · Login — portal-scoped, **one design, two instances**

The portal comes from screen 2, not from a control on this screen. There is **no role selector and
no portal dropdown** — the portal is context the user already chose, shown back to them.

**Fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Email or mobile | text, single field, email keyboard | ✔ | "Mobile must include country code, e.g. +91…" |
| Password | password + show/hide | ✔ | — |

**Contains:** logo · **a clear portal identity** ("Buyer sign-in" / "Exporter sign-in", with a way
back to screen 2 to switch) · the two fields · "Sign in" (full width) · "Forgot password?" ·
"Create account".

**States:** default · loading · **invalid credentials** · **too many attempts** · offline.

**🔴 Copy that must not vary:** a wrong password, an unknown email, **and an email that exists only
on the other portal** all give the **identical** message — *"Invalid credentials."* Put the error
above the form, never on one field.

**🔴 Never design a recovery affordance for the wrong-portal case.** No "this looks like an exporter
account — switch?", no auto-redirect, no hint. It is the same failure as a wrong password, and the
UI must be unable to tell them apart. The only thing available to a confused user is the ordinary
"switch portal" link back to screen 2, which is present regardless of what they typed.

**Design notes:** one combined identifier field, not email/phone tabs. The country-code hint must be
visible text — a bare local number won't sign in. Keyboard must not cover the sign-in button.

---

### 4 · OTP verify — one screen, three contexts

Used after **signup step 1** (before the company step), after **login**, and in **password reset**.
Same component, different heading and different destination.

**Fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Verification code | **6 boxes**, numeric keypad, auto-advance, paste-across | ✔ | "Enter the 6-digit code we sent you" |

**Contains:** context heading · masked destination ("sent to +91 ••••• 43210") · the boxes · expiry
countdown · **Resend code** (disabled through a ~60s cooldown) · a context-appropriate escape
("Back to sign in" / "Back to step 1").

**Signup context — design the continuation clearly.** On success the user does **not** land in the
app; they go to **screen 8 (company step)**. The copy must set that up — *"Verified. One more step:
your company."* — so a two-step signup doesn't feel like a failure to log in.

**States:** default · loading · wrong code · code expired · **too many attempts (locked)** · signup
or login session expired (back to the start of that flow) · resend cooldown · resend sent · offline.

**⚠️ No "attempts remaining" counter.** The system gives one generic message for every failed code,
so that number doesn't exist. Design the locked-out message instead.

**⚠️ OTP locks are per account, per portal** (§1.4). A user locked out on their exporter account is
not locked out as a buyer. No screen states this — it just must not be designed as one global lock.

**Design notes:** the numeric keypad appears immediately, so the boxes must sit in the upper half of
the screen. Auto-submit on the sixth digit is good; keep a visible button too. If the platform
supports SMS autofill, design for the code arriving pre-filled.

---

### 5 · Forgot password

**Fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Email or mobile | text | ✔ | "Mobile must include country code" |

**Contains:** short explanation · the field · "Send reset code" · back to sign in. The portal
identity from screen 3 carries through — a reset is scoped to one account, and someone with both
accounts resets them separately.

**States:** default · loading · **sent confirmation** · rate-limited · offline.

**Copy:** always the same neutral line — *"If an account exists, a reset code has been sent."* A calm
confirmation, not a celebration; it says nothing about whether the account is real.

---

### 6 · Reset password

**Fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Email or mobile | text, prefilled, editable | ✔ | — |
| Reset code | 6 boxes (same component as screen 4) | ✔ | "Check your messages for the 6-digit code" |
| New password | password + strength meter | ✔ | "At least 8 characters" |
| Confirm new password | password | ✔ | must match — inline error |

**States:** default · loading · invalid/expired code · mismatch · **success** · offline.

**Success copy:** *"Password changed. You've been signed out on all your other devices."* True, so say
it — otherwise they wonder why the tablet logged out. It signs out **this account's** sessions only,
so avoid wording that implies both portals.

**Design note:** four fields plus a keyboard on a small phone is tight. Consider two steps (code,
then password) if it can't breathe in one.

---

### 7 · Signup step 1 — your account

**Shared by both portals.** Nothing about the company appears here. This replaces the two separate
signup forms in the previous draft.

**Fields**

| Label | Type | Required | Notes |
|---|---|---|---|
| Full name | text | ✔ | — |
| Email | email keyboard | ✔ | — |
| Mobile | country-code button + number (phone pad) | ✔ | one labelled pair |
| Password | password + strength meter | ✔ | "At least 8 characters" |
| Confirm password | password | ✔ | must match |

**Contains:** step indicator (**1 of 2**, with the OTP shown as the bridge) · portal identity ·
the form · "Continue" · "Already have an account? Sign in" · terms/privacy line.

**States:** default · loading · field errors · **duplicate account** · success (→ OTP) · offline.

**🔴 The duplicate-account state is the subtle one.** Because the same email may hold one buyer and
one exporter account, "already registered" means *already registered **on this portal***. Someone
with a buyer account signing up as an exporter with the same email is a **normal, supported path** —
it must sail straight through, not hit an error. Only a same-portal collision blocks, and its copy
is *"You already have a buyer account with this email"* + a link to sign in.

**Design notes:** five fields fits one screen on most phones — keep it that way. Do not add company
fields here "to save a step"; the company step must sit behind OTP, because screen 8 shows an
existing company's name and that is only safe once the identity is proven.

---

### 8 · Signup step 2 — your company

Reached only after OTP. The screen first asks a question the previous design never asked: **is this
company already on the platform?**

It has **two paths**, and the design must make the choice feel low-stakes but considered.

#### Path A — Claim an existing organisation

Shown when a company is matched to the user's email or mobile.

**Contains:** *"We found a company registered with this email"* · the **company name** (safe to show
— the user is past OTP) · country · **verified tick if that company is verified** · two actions:
**"Yes, this is my company"** (primary) and **"No, create a new company"** (secondary).

**🔴 Claiming carries the verification over.** If the matched company is verified, the user joins a
company that already has the tick — no second KYC, no waiting. Say so plainly on the card, because
it is the single strongest reason to claim rather than create: *"This company is already verified —
you'll get the tick straight away."*

**🔴 Declining creates a separate company that verifies on its own.** Also say this, in the same
weight of type — *"A new company starts unverified and gets reviewed separately."* A user who
declines by reflex and then waits weeks for a second KYC is a support ticket the copy can prevent.

#### Path B — Create a new organisation

Shown when there is no match, or after the user declines a claim.

**Buyer fields**

| Label | Type | Required | Notes |
|---|---|---|---|
| Company name | text | ✔ | — |
| Country | searchable picker (sheet) | ✔ | — |

**Exporter fields** — the buyer set, plus:

| Label | Type | Required | Helper |
|---|---|---|---|
| **Entity type** | two radio **cards**: Business / Individual | ✔ | "This decides which documents we'll ask for later" |
| Address line 1 | text | ○ | |
| Address line 2 | text | ○ | |
| City | text | ○ | |
| State / province | text | ○ | |
| Postal code | text | ○ | |

⚠️ **No country field in the address block** — the country above is the only one. Two country inputs
on one form is a bug, not a detail.

**Entity type gets full-width cards, not a dropdown.** It decides which documents they upload later
(Business → registration / GST / certificates · Individual → PAN / Aadhaar / passport) and, for an
exporter, **it is fixed here and can never be edited afterwards, at any status** (§A22.1). It is also
**publicly visible** on the seller's page next to the verified tick. Explain both at the point of
choice — this is the most consequential single tap in the whole signup.

**States:** claim offered · claim confirmed · create-new (per-portal field sets) · loading · field
errors · success · offline (don't lose a half-filled form) · back to step 1 without losing input.

**🔴 Success copy constraints:**
- **Buyer** — must **not** suggest "awaiting approval" or "pending activation". The buyer is active
  immediately; verification is optional and only earns a tick later.
- **Exporter** — the profile is **public immediately**, just without a tick. Say something like
  *"You're in. Submit your documents whenever you're ready to get verified."* It must **never** say
  the profile is hidden or inactive until verified.

**Design notes:** step 2 must feel short — it is two fields for a buyer. Mark optional address fields
as skippable so an exporter isn't blocked by details they don't have to hand. Preserve entered data
if the app is backgrounded mid-form.

**⚠️ Not designed here — open decision.** `registrationNumber`, `taxId`, `establishedYear` and
`authorisedSignatory` exist on the model but are in **neither** the signup nor the profile field set
and have no capture path (`m1.md` §10 item 6). The previous draft had them as a fourth signup step;
that step is **removed**, not deferred quietly — see §10. Do not re-add them without a decision.

---

## 5. Buyer

### 9 · Buyer home — first tab

**Contains:** greeting with name · company and country · **verified tick if verified** (nothing
otherwise) · a **verification card** (status per §1.3 + action) · placeholder cards for the modules
arriving later.

**States:** loading (skeleton) · four verification variants · offline · error. Pull-to-refresh.

**Design note:** placeholder cards must read as unavailable — muted with a "Coming soon" label. A
live-looking card that does nothing is worse than an honest gap.

---

### 10 · Buyer KYC upload — **optional**

A buyer never has to do this; documents only earn a trust tick. Make that obvious so nobody feels
blocked.

**Fields**

| Label | Type | Required | Notes |
|---|---|---|---|
| Entity type | two radio cards: Business / Individual | ✔ | buyers choose here (exporters chose at signup) |
| Document type *(per document)* | select / sheet | ✔ | **options change with entity type** |
| Document file *(per document)* | **Camera / Gallery / Files** | ✔ | thumbnail, retake, remove |

**Document type options:**
- **Business** → Company registration · GST / tax document · Certificate · Other
- **Individual** → PAN · Aadhaar · Passport · Other

**Contains:** intro stating this is optional and what the tick gives them · entity-type choice ·
add-document rows · per-file progress · submit.

**States:** empty · capture in progress · uploading (per-file progress) · per-file error (too large,
wrong format, upload failed — with retry) · submitted confirmation · already-verified variant (no
form) · offline (queue or block clearly, don't fail silently).

**⚠️ Entity type is shared with screen 12.** A buyer choosing Business here is setting the same field
the company-profile screen shows, and it **locks on verification**. The two screens must show the
same value and never disagree — if the buyer already set it on screen 12, this screen shows it
pre-selected, not blank.

**Design notes:** **Camera first** in the source choice — it's the reason to do this on a phone.
Show accepted formats and the size cap *before* they shoot, and let them retake a blurry photo
without starting over. Document-type options switch with entity type — never offer PAN to a business.
Sensitive screen: cover content when backgrounded (§1.5).

---

### 11 · Buyer verification status

Read-only view of where verification stands.

**Contains:** status chip (§1.3) · submitted documents as **type + upload date only** (no previews —
those documents aren't shown back to the user) · submission date · verified date if applicable ·
rejection reason plus a resubmit action if rejected.

**States:** **not submitted** (empty state + upload CTA) · **in review** · **verified** (tick + date)
· **needs attention** (reason in a `danger` alert + resubmit) · **back in review after a profile
edit** (§A22.2 — see below) · loading · offline · error.

**⚠️ New state: re-review triggered by a company edit.** If a verified buyer changes a locked field
on screen 12, the account returns to "In review" **without any rejection**. The copy must not read as
a rejection or an error — it is the expected cost of the change: *"Your company details changed, so
we're checking them again. Your tick will return once that's done."*

**Design note:** the rejection reason is written by a reviewer and shown verbatim — give it room for
a sentence or two, not a one-line chip.

---

### 12 · Buyer company profile — 🆕 §A22

The buyer's company details, viewable and editable. Deliberately small: **a buyer has no public
page**, so there is no logo, no description and no preview.

**Fields**

| Label | Type | Required | Lock behaviour |
|---|---|---|---|
| Company name | text | ✔ | **locks on verification** |
| Country | searchable picker | ✔ | **locks on verification** |
| Address (line 1, line 2, city, state, postal code) | text fields | ○ | **locks on verification** |
| Entity type | two radio cards: Business / Individual | ✔ | editable until verified, then **locked** |

**Contains:** section header · the fields · **verified tick if verified** · save · and, on a verified
account, the **lock treatment** (§2) on all four locked fields.

**🔴 The change-anyway flow is the core of this screen.** A verified buyer *can* change a locked
field — it just costs the tick until re-review. Design it as three beats:

1. **Locked state** — read-only value, lock icon, one line: *"Locked because your company is
   verified."* plus a quiet **"Need to change this?"** action.
2. **Confirmation sheet** — destructive-adjacent styling, and it must state the consequence in plain
   words before the field unlocks: *"Changing your company name removes your verified tick until our
   team reviews it again. Your account keeps working normally."* Confirm / Cancel.
3. **Unlocked-with-warning state** — the field becomes editable, with a persistent inline warning
   above the form so a user who scrolls away doesn't lose the context, and a save button whose label
   owns the outcome (e.g. **"Save and re-submit for review"**, not a bare "Save").

**After saving a locked-field change:** a confirmation that the account is back in review, and the
tick disappears **immediately** — not on next launch. Draw the before/after.

**States:** loading · unverified (everything plainly editable, no locks, no warnings) · in review ·
verified + locked · confirmation sheet · unlocked-with-warning · saving · saved (unchanged status) ·
**saved + demoted to in-review** · validation errors · offline · error.

**Design notes:** on an unverified account this screen must feel completely ordinary — locks and
warnings appear **only** once verified, and drawing them prematurely will confuse the majority case.
Editing a non-locked field on a verified account (there are none for a buyer beyond the four above,
so in practice: nothing) must never trigger the warning path.

---

## 6. Exporter

### 13 · Exporter home — first tab

Verification is the headline: it's what unlocks selling.

**Contains:** business name and country · **verified tick if verified** · a prominent **verification
card** (§1.3, action per state) · a **product allowance notice** · placeholder cards for catalogue
and enquiries.

**Product allowance notice** — while unverified: *"You can publish up to 3 active products. Get
verified to publish more."* Disappears once verified. Informational in M1 (the catalogue comes
later), but design it as a real, noticeable element — it's the main reason an exporter bothers to
verify.

Two details from the catalogue rules the notice must not contradict when M2 lands: the cap counts
**active** products only — **taken-down products don't count against it** (§A10) — and there is a
separate **10-draft cap** (§A15). Don't design copy that implies a single flat "3 products" limit on
everything.

**States:** loading · four verification variants · offline · error. Pull-to-refresh.

---

### 14 · Exporter KYC upload + resubmit

Same capture flow as screen 10, with three differences that change the design:

1. **Entity type is read-only** — set at signup step 2 and **never editable on any screen, at any
   status** (§A22.1). Show it as a labelled value with a note ("Set at signup — contact support to
   change"), not an editable control. Document-type options follow it.
2. **This is mandatory**, not optional — verification unlocks selling beyond 3 products. Guiding
   tone, not scolding.
3. **This screen is also the resubmit screen.** After a rejection, a `danger` alert with the
   reviewer's reason sits at the top and the capture flow below invites replacement documents. There
   is no separate resubmit screen.

**Fields**

| Label | Type | Required | Notes |
|---|---|---|---|
| Entity type | **read-only value** | — | Business or Individual, from signup |
| Document type *(per document)* | select / sheet | ✔ | Business → registration / GST / certificate / other · Individual → PAN / Aadhaar / passport / other |
| Document file *(per document)* | **Camera / Gallery / Files** | ✔ | thumbnail, retake, remove |

**States:** first submission (empty) · capture · uploading · in review (status panel replaces the
form) · **rejected → resubmit** (reason banner + form) · **verified** (no form, tick + confirmation) ·
**back in review after a company-profile edit** (§A22.2 — an informational panel, *not* a rejection
banner; no reviewer reason exists in this case) · per-file errors · offline.

**Design notes:** an exporter arriving after rejection is frustrated — the reason is the first thing
they read, the fix immediately below. Don't bury it under the uploader. The edit-triggered re-review
state must be visually distinct from the rejection state, or a user who renamed their company will
think they were rejected. Sensitive screen (§1.5).

---

### 15 · Exporter company profile + public preview — 🆕 §A22

The bigger of the two company screens, and the **only capture path for the exporter's logo and
description** — without it the public seller page renders with nothing but a company name and a
country.

**Fields**

| Label | Type | Required | Lock behaviour |
|---|---|---|---|
| Company name | text | ✔ | **locks on verification** |
| Country | searchable picker | ✔ | **locks on verification** |
| Address (line 1, line 2, city, state, postal code) | text fields | ○ | **locks on verification** |
| Entity type | **read-only value** | — | never editable, any status (§A22.1) |
| **Logo** | logo picker — camera / gallery, square crop, replace, remove | ○ | **always editable** |
| **Description** | textarea + character counter | ○ | **always editable** |

**Lock and change-anyway behaviour:** identical to screen 12 — same three beats (locked →
confirmation sheet → unlocked-with-warning), same consequence copy, same "Save and re-submit for
review" outcome. **Design it once, use it twice.** The only difference is that entity type is never
part of it here.

**🔴 Logo and description never trigger re-review.** They aren't checked against KYC documents, so
they save silently on a verified account with no warning and no loss of tick. If the design implies
otherwise, exporters will avoid updating them — which is the opposite of what this screen is for.

### 15.1 The public-page preview

A preview of how the exporter's public seller page will look to buyers.

**Contains:** company name · country · **entity type** (Business / Individual — **public** as of
2026-07-30, sitting next to the tick) · logo · description · **verified tick if verified**.

**🔴 Three rules for the preview:**

1. **It renders through the same projection as the live public page.** It does not build its own
   field list. If a designer adds a field to the preview that isn't on the real public page, the
   preview becomes a lie — and the drift will be found by a buyer, not by us.
2. **Website is never shown.** `website` is held for our internal verification only and appears on
   no public surface. It is also not an editable field on this screen.
3. **No status, ever.** The preview shows the tick or shows nothing. Never "in review", never
   "rejected", never a rejection reason — that is private to the account owner and the preview is a
   view of the *public* page.

**⚠️ The slug does not follow a rename.** The public URL (`/supplier/<slug>`) is generated from the
company name **once, at creation, and is immutable** — a rename does not change it, deliberately, so
indexed links don't break. **Show this on the rename confirmation sheet**, e.g. *"Your public web
address stays the same."* If it isn't shown, it will be reported as a bug later.

**States:** loading · unverified (plain editable, no locks) · in review · verified + locked ·
confirmation sheet · unlocked-with-warning · saving · saved · **saved + demoted to in-review** ·
logo uploading / upload failed / removed · empty logo and empty description (the default for every
new exporter — this is the **most common** state and needs a real, inviting empty treatment, not a
grey box) · preview collapsed/expanded · offline · error.

**Design notes:** the empty-preview state is the one that decides whether exporters fill this in.
Show them the gap — a page with no logo and no description next to a filled example — rather than
just labelling the fields optional.

---

## 7. Shared

### 16 · Profile — last tab, both roles

The app's settings surface and the only place several M1 controls live.

**Contains:**
- **Identity block** — name, email, mobile, **which portal this account is** (§1.4), company/business
  name, **verified tick if verified**
- **Company profile** — entry point to screen 12 (buyer) or 15 (exporter)
- **Verification** — status chip + link to screens 10/11 (buyer) or 14 (exporter)
- **Security** — **Biometric unlock** toggle · **Change password**
- **Notifications** — placeholder only, visibly unavailable (that whole layer arrives later)
- **About** — app version, terms, privacy
- **Sign out** — with a confirmation sheet

**Change password — sub-screen fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Current password | password | ✔ | — |
| New password | password + strength meter | ✔ | "At least 8 characters" |
| Confirm new password | password | ✔ | must match |

**States:** loading · loaded · biometric toggle on/off · biometric unavailable on this device (toggle
disabled + explanation) · change-password (default / loading / wrong current password / mismatch /
success) · sign-out confirmation · offline.

**Design notes:** the portal label in the identity block matters more than it looks — a user with
both accounts needs to know at a glance which one they're in. The notifications placeholder must look
explicitly unavailable, not like a working switch. Sign-out needs a confirmation sheet — accidental
taps on a phone are common — and its copy should not imply it signs out both accounts, because it
doesn't.

---

### 17 · Biometric unlock

Shown when the user returns to an app that's already signed in, if they enabled biometrics. It gates
**re-entry only** — it is not a login, and it never creates a session on its own.

**Contains:** brand mark · Face ID / Touch ID / fingerprint prompt (native) · "Use passcode instead"
fallback · "Sign out" escape hatch.

**States:** prompting · **failed / cancelled** (retry + passcode fallback) · **no biometrics enrolled
on the device** (skip straight through, never trap the user) · locked out after repeated failures
(fall back to full sign-in).

**Design notes:** the native prompt does the heavy lifting — design the screen behind it, which is
visible while the prompt sits on top and after a cancel. Never leave a user stranded with no way
forward: passcode and sign-out are always available.

⚠️ **Not named in `m1.md`** — see §3 and §10.

---

## 8. Navigation shells

**Two bottom tab bars.** In M1 only Home and Profile are functional; the rest are placeholders for
later modules. Decide with the owner whether to **show them disabled** or **hide them until they
work** — my recommendation is to hide them, because a tab bar of dead tabs makes the app feel empty,
whereas two solid tabs feel finished.

| Buyer tabs | Exporter tabs |
|---|---|
| **Home** ✔ · Search ⏳ · Enquiries ⏳ · Messages ⏳ · **Profile** ✔ | **Home** ✔ · Catalogue ⏳ · Enquiries ⏳ · **Profile** ✔ |

**Company profile is reached through Profile**, not through its own tab — it's a settings-shaped
screen, not a destination.

**Placeholder tab pattern** (if shown): icon, module name, one line — *"Coming soon"* — and nothing
tappable.

**Stack headers:** title + back for every pushed screen (KYC, verification status, company profile,
change password). Native back gestures must work.

---

## 9. Cross-screen checklist before handing designs over

**Auth (§A21)**
- [ ] Portal is chosen on screen 2 and shown on every auth screen — no portal dropdown on login
- [ ] Wrong-portal sign-in gives the generic "Invalid credentials" with **no** switch hint or redirect
- [ ] Signup is drawn as **step 1 → OTP → step 2**, with a step indicator throughout
- [ ] Same-email signup on the *other* portal succeeds; only a same-portal collision errors
- [ ] Screen 8 shows both claim and create-new paths, each with its consequence stated
- [ ] Claim path states that verification carries over; decline path states it doesn't
- [ ] No "attempts remaining" counter in any OTP context

**Verification & tick**
- [ ] Verified tick used only as a tick — no "unverified" badge anywhere
- [ ] Status vocabulary (§1.3) identical to web
- [ ] Buyer signup success implies **no** approval wait
- [ ] Exporter signup success implies the profile is **already public**
- [ ] Exporter KYC shows entity type read-only; buyer KYC lets them choose
- [ ] Document-type options switch with entity type (no PAN for a business)
- [ ] **Camera is the first document source**, gallery and files after
- [ ] KYC screens covered/blurred when the app is backgrounded

**Company profile (§A22)**
- [ ] Lock treatment drawn in all three variants (locked · unlocked-with-warning · plain editable)
- [ ] Change-anyway confirmation states the consequence **before** the field unlocks
- [ ] Save button on an unlocked field owns the outcome ("Save and re-submit for review")
- [ ] Tick disappears immediately on a demoting save — before/after both drawn
- [ ] Edit-triggered "in review" is visually distinct from a **rejection** on screens 11 and 14
- [ ] Logo and description save silently — no warning, no tick loss
- [ ] Public preview shows **entity type**, never `website`, never any status or rejection reason
- [ ] Rename confirmation states the public web address does **not** change
- [ ] Empty logo + empty description drawn as a real, inviting state (it's the default)

**App-wide**
- [ ] Every screen has loading, empty, error **and offline** states drawn
- [ ] Splash holds until the session resolves — login never flashes at a signed-in user
- [ ] No employee/admin surface in the app at all
- [ ] Biometric unlock has passcode + sign-out escapes, and handles no-biometrics-enrolled
- [ ] Keyboard never covers a focused field or its primary button
- [ ] Safe areas correct on notched devices, both platforms
- [ ] Checked on a small (~375pt) and a large (~430pt) phone
- [ ] Dark mode fully done or explicitly out of scope — not half
- [ ] Touch targets ≥ 44px; no hover-dependent affordances
- [ ] Any control shown but not functional is visibly "coming soon"

---

## 10. Decisions

### ✅ Decided — design everything now, wire later (owner, 2026-07-28)

Screens touching plumbing that isn't finished (**9, 10, 11, 12, 13, 14, 15** — everything involving
KYC documents, verification status or the company-profile endpoints) **all get designed now**; wiring
follows. Design is not blocked by build order. *(The backend currently has **no** Organisation
endpoints at all — only `auth`, `employee` and `admin` routers are mounted — so screens 12 and 15 are
entirely ahead of their plumbing. That is expected and does not change the decision.)*

- **Design every state, including ones we can't populate yet** — a document list, an in-review panel,
  a rejection with a reason, an upload mid-progress, a locked field. Use realistic placeholder content
  and note the assumptions, so nothing gets re-drawn when real data arrives.
- **These screens will be built as static UI first.** Every control that doesn't yet do anything must
  be visibly **disabled / "coming soon"** and logged in the project's non-operational-UI ledger in
  the same change. A live-looking button that silently does nothing is the outcome to avoid.
- **Don't design around the gap** — design the finished screen; let the build stage the wiring.
- The capture flow (10, 14) is the part most exposed to the storage decision, and only mechanically:
  how a photo is handed off changes, but the camera-first choice, retake, per-file progress and error
  states hold either way.

### 🔻 Removed in this realignment — flagging, not deciding

| Removed | Was | Why removed |
|---|---|---|
| **Exporter signup "Business details" step** (registration number · tax ID · year established) | Step 4 of the old exporter signup | **The backend already dropped it.** Owner decision 2026-07-30 (`docs/History.md`): `businessProfile` was **removed from exporter signup** — captured at verification, not signup — and the API now silently strips it. The old step 4 was drawing a form the server discards. It is also absent from §A21's step-2 and §A22's profile field lists; `m1.md` §10 item 6 keeps it — plus `authorisedSignatory` — as an open decision with no capture path anywhere. |
| **Two separate signup screens** (buyer / exporter) | Screens 7 and 8 of the old brief | Superseded by the shared step-1 + role-differentiated step-2 (§A21). |

If you want the business-details fields captured, they belong on the **company-profile screens**
(12 / 15), not in signup — signup stays lean by design (§A22.4). Say so and I'll add them.

### Still open

1. **Brand palette** — the tokens are professional placeholders. Confirm real brand colours before
   final visual design, on both surfaces at once.
2. **Dark mode — in or out for M1?** This roughly doubles the artwork if in. Needs answering before
   design starts, not after.
3. **Placeholder tabs — show disabled, or hide until built?** (Recommendation: hide.)
4. **Biometric unlock (screen 17) — in or out?** It isn't named in `m1.md` §7. It's a real
   improvement on a phone and cheap to design, but it is scope nobody has asked for.
   (Recommendation: keep — it's one screen and it makes daily re-entry bearable.)
5. **`businessProfile` / `authorisedSignatory` on the company-profile screens** — see the removal
   table above. Same open item as `m1.md` §10 item 6.
6. **Demotion detail** (`m1.md` §10 item 7) — whether the verified date survives a demotion affects
   copy on screens 11, 12, 14 and 15: after re-approval, does the tick say "Verified since Mar 2026"
   or "since today"? Design both until it's decided.
