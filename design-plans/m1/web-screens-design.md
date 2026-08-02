# M1 · Web Screens — Design Brief

> **16 screens** for the M1 (auth + KYC + verification + user management) milestone, web only.
> This is a **design** document: what each screen contains, every field on it, and the states that
> need artwork. No API or code detail.
> Product: **MPX Global** — B2B import/export marketplace. Indian exporters, international buyers.
>
> **Scope rule (owner, 2026-07-29):** this brief contains **only** the screens named in
> `modules-in-detailed/m1-max-1.5days/` — `m1.md` §7 plus `Screens-web.png`, `Flow-cart-full.png`,
> `Flow-chart-Backend.png`, `feilds-data.png`. Nothing inferred, nothing added. See §11 for what was
> removed and the two gaps that removal leaves.

---

## 1. Design foundations

**Tone.** A trade platform where strangers transact across borders. Restrained, professional,
confident — **not** a consumer app. Comfortable density, generous whitespace on forms, tighter
density in admin tables. The super-admin dashboard is the surface shown to stakeholders, so it
carries the most polish.

**Four audiences, one visual system:**

| Panel | Who | Feel |
|---|---|---|
| Buyer | international importers | welcoming, simple, low-friction |
| Exporter | Indian sellers, often mobile-first, mixed digital literacy | reassuring, guided, explicit about what's needed |
| Employee | internal reviewers | dense, fast, functional |
| Admin / Super Admin | platform owners | authoritative, data-forward |

**Type & spacing.** One type scale and one spacing scale across all four panels. Two buttons that
differ by accident are a bug.

**Responsive.** Every screen works at **1440 / 1024 / 768 / 375**. Design mobile-first, enhance up.
No horizontal page scroll — wide admin tables scroll inside their own container. Sidebar collapses
to a drawer under 1024.

**Accessibility is "done", not polish.** Real `<label>` on every input. Visible focus states on
everything. Touch targets ≥ 44px. Text contrast ≥ 4.5:1. **Never colour alone** to carry meaning —
the verified tick needs an icon + label, status needs a word, not just a dot. Respect
`prefers-reduced-motion`.

**Every screen needs four states drawn, not one:** loading (skeleton, not a spinner, for content),
empty, error, success. A blank screen where a state belongs is a defect.

### 1.1 The verified tick — the single most important convention

There is **one** badge: a **verified tick** shown only when an account is verified. There is **no
"not verified" badge, no red cross, no warning chip.** Absence of the tick means unverified — that's
it. An unverified exporter's profile looks normal, just without the tick.

Design it once: `success` check icon + the word "Verified" + optional "since Mar 2026". Used on the
exporter dashboard, the verification status screen, and admin tables.

### 1.2 Status vocabulary (used across KYC and verification screens)

Four states, one visual language everywhere they appear:

| Status | Colour | Label | Meaning to the user |
|---|---|---|---|
| Pending | `muted` | "Not submitted" | nothing uploaded yet |
| Submitted | `warning` | "In review" | documents are with the team |
| Verified | `success` | "Verified" ✓ | tick earned |
| Rejected | `danger` | "Needs attention" | reason shown + resubmit path |

---

## 2. Shared components to design once

Build these before any screen — they carry every layout.

**Forms:** text input · email input · password input (with show/hide + strength meter) · phone input
(**country-code select + number, side by side**) · country select (searchable, ~200 entries) ·
radio group · checkbox group · select · textarea (with character counter) · file upload row ·
inline field error · required/optional marker.

**Feedback:** button (primary / secondary / ghost / danger, each with loading + disabled) ·
toast · inline alert (info / warning / danger / success) · skeleton · empty state · error state
(shows a support reference code) · confirmation modal (destructive variant).

**Data:** admin table (sticky header, row actions, pagination footer) · status chip (§1.2) ·
verified tick (§1.1) · avatar · card · drawer · tabs · pagination.

**Special:** **OTP input** — 6 separate boxes, auto-advance, paste-across, visible countdown, resend
button that's disabled until cooldown ends. Appears on 2 screens; get it right once.

**Layout shell:** top bar (logo · user name · role · organisation · logout) + sidebar (collapsible)
+ content area. The employee and admin sidebars are **permission-driven** — an employee is granted
permissions individually, so the sidebar must look right with **zero, one, or several** items. An
employee with no permissions granted is a normal state, not an error: design a calm, explained empty
main area rather than a dead end.

---

## 3. Screen inventory — 16

| # | Screen | Route | Panel | Named in |
|---|---|---|---|---|
| 1 | Landing / public entry | `/` | public | §7 shared shell · `Screens-web.png` |
| 2 | Login | `/login` | public — **all four roles** | §7 shared shell |
| 3 | OTP verification | `/login/otp` | public | §7 shared shell |
| 4 | Forgot password | `/forgot-password` | public | §7 shared shell |
| 5 | Reset password | `/reset-password` | public | §7 shared shell |
| 6 | Buyer signup | `/signup/buyer` | public | §7 buyer |
| 7 | Buyer KYC upload (optional) | `/buyer/kyc` | buyer | §7 buyer |
| 8 | Buyer verification status | `/buyer/verification` | buyer | §7 buyer |
| 9 | Exporter signup | `/signup/exporter` | public | §7 exporter |
| 10 | Exporter dashboard — verify status | `/exporter` | exporter | §7 exporter |
| 11 | Exporter KYC upload (business / ID) | `/exporter/kyc` | exporter | §7 exporter |
| 12 | Exporter resubmit after reject | `/exporter/kyc/resubmit` | exporter | §7 exporter |
| 13 | Admin — user management | `/admin/users` | admin | §7 admin · `Flow-chart-Backend.png` |
| 14 | Admin — verify / approve queue | `/admin/verification` | admin / employee | §7 admin |
| 15 | Admin — KYC viewer | `/admin/users/:id/kyc` | admin | §7 admin |
| 16 | Admin — permissions | `/admin/employees` | super admin | §7 admin · `Flow-chart-Backend.png` |

**Employee panel = authentication only.** §7 is explicit: *"Sirf auth (login/OTP) — Dashboard ke
andar kuch nahi (⏸ month-1-ke-baad)."* An employee signs in through screens 2–3 and reaches whichever
of screens 13–16 their granted permissions allow. There is **no employee dashboard screen** in M1.

### Do not design — confirmed by the owner, 2026-07-29

**No TOTP screens.** Not TOTP code entry, not 2FA setup / QR, not backup codes. Two-factor for staff
is on hold (D4) — admin and super admin log in with the same email/mobile + password + OTP as
everyone else, so the login and OTP screens have **no** extra step, no "use authenticator instead"
link, and no branch after OTP.

`m1.md` §7 lists admin login as "Login/OTP **(+TOTP)**" — that parenthesis is superseded by this
decision. D4 must be restored before project close, so the three screens will be needed eventually;
they are simply out of scope now.

---

## 4. Shared auth shell (screens 1–5)

### 1 · Landing / public entry — `/`

Public entry and the only marketing surface in M1. Needs to look like a serious trade platform on
first impression.

**Contains:** logo + nav (Login, Sign up) · hero headline + sub-line + primary CTA · a short "how it
works" or trust strip (verified exporters, secure platform) · footer (about, contact, privacy,
terms).

**Two distinct signup entries** — "Sign up as Buyer" and "Sign up as Exporter" — visually equal, not
one primary and one buried. They lead to different forms.

**Design notes:** this page is public and must read well when shared (social preview image). Product
search, categories and browse belong to a later milestone — if you show them, they must look
explicitly unavailable ("coming soon"), never like live controls.

---

### 2 · Login — `/login` — **one shared page for all four roles**

The single most-used screen. There is **no separate admin login**, no role selector, no four
variants. Buyer, exporter, employee and admin all sign in here; the system works out where to send
them (`Screens-web.png`: Login → OTP verify → Role redirect).

**Fields**

| Label | Type | Required | Helper / placeholder |
|---|---|---|---|
| Email or mobile | text, single input | ✔ | helper: "Mobile must include country code, e.g. +91…" |
| Password | password + show/hide | ✔ | — |

**Actions:** "Sign in" primary (full width, loading state) · "Forgot password?" link · "Don't have an
account? Sign up as Buyer / Exporter".

**States:** default · loading (button spinner, inputs locked) · **invalid credentials** · **too many
attempts** · rate-limited.

**Copy that must not vary:** a wrong password and an unknown email produce the **identical** message
— *"Invalid credentials."* Never "no account with that email". Design one error slot above the form;
don't attach the error to a specific field, because that would reveal which one was wrong.

**Design notes:** centred single-column card, logo above, max ~400px wide. One combined identifier
input, not separate email/phone tabs. A bare local mobile number won't work — hence the country-code
helper text; make it visible, not a tooltip.

---

### 3 · OTP verification — `/login/otp`

Second step of every login, for every role.

**Fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Verification code | **6 separate boxes**, numeric, auto-advance, paste-across | ✔ | "Enter the 6-digit code we sent you" |

**Contains:** heading · masked destination ("sent to +91 ••••• 43210") · the 6 boxes · countdown
("expires in 4:58") · **Resend code** (disabled until a ~60s cooldown ends, then enabled with its own
countdown) · "Back to sign in".

**States:** default · loading · **wrong code** · **code expired** · **too many attempts (locked)** ·
**session expired** (the login step timed out → back to login) · resend cooldown · resend sent
confirmation.

**⚠️ Do not design an attempts counter.** No "2 attempts remaining" — the system deliberately gives
one generic message for every failed code, so that number doesn't exist. After too many tries the
account is temporarily locked; design *that* message instead.

**Design notes:** boxes large enough for touch (≥44px), tabular numerals, clear focus ring on the
active box. Auto-submit on the 6th digit is fine but keep a visible button for accessibility.

---

### 4 · Forgot password — `/forgot-password`

**Fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Email or mobile | text | ✔ | "Mobile must include country code" |

**Actions:** "Send reset code" primary · "Back to sign in".

**States:** default · loading · **sent confirmation** · rate-limited.

**Copy:** the confirmation is always the same neutral line — *"If an account exists, a reset code has
been sent."* Design it as a calm confirmation panel, not a success celebration, because it says
nothing about whether the account is real.

---

### 5 · Reset password — `/reset-password`

**Fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Email or mobile | text, prefilled from previous screen, editable | ✔ | — |
| Reset code | 6 boxes (same component as screen 3) | ✔ | "Check your messages for the 6-digit code" |
| New password | password + strength meter | ✔ | "At least 8 characters" |
| Confirm new password | password | ✔ | must match — inline error on mismatch |

**Actions:** "Reset password" primary · "Back to sign in".

**States:** default · loading · invalid/expired code · mismatch · **success**.

**Success copy matters:** *"Password changed. You've been signed out on all your other devices."*
That's literally true, so tell them — it prevents a confused "why am I logged out on my phone".

---

## 5. Buyer panel (screens 6–8)

### 6 · Buyer signup — `/signup/buyer`

Deliberately short. A buyer is **fully active the moment they sign up** — no approval wait
(`Flow-chart-Backend.png`: "Buyer — full access · no gate").

**Fields** *(per `feilds-data.png`: name · email · mobile (code+no.) · password · company · country)*

| Label | Type | Required | Helper |
|---|---|---|---|
| Full name | text | ✔ | — |
| Email | email | ✔ | — |
| Mobile | country-code select + number | ✔ | side-by-side pair, one label |
| Password | password + strength meter | ✔ | "At least 8 characters" |
| Confirm password | password | ✔ | must match |
| Company name | text | ✔ | — |
| Country | searchable select | ✔ | — |

**Actions:** "Create account" primary · "Already have an account? Sign in".

**States:** default · loading · field errors · **duplicate account** ("An account with this email or
mobile already exists" + link to sign in) · success.

**🔴 Copy constraint:** the success state must **not** say "awaiting approval", "pending activation"
or anything implying a gate. The buyer can use the platform straight away. Verification is optional
and only earns a tick later.

**Design notes:** single column, 7 fields — comfortable on one screen at desktop, scrolls on mobile.
No multi-step wizard needed at this length.

---

### 7 · Buyer KYC upload — `/buyer/kyc` — **optional**

A buyer never has to do this. §7 marks it "(optional)" and `Flow-chart-Backend.png` labels the buyer
path "optional" — submitting documents only earns a trust tick. The design must make that obvious so
nobody feels blocked.

**Fields** *(per `feilds-data.png`: entity type · business → reg no / GST / docs · individual → ID
type / no / ID doc)*

| Label | Type | Required | Notes |
|---|---|---|---|
| Entity type | radio: Business / Individual | ✔ | buyers choose it here |
| Document type *(per row)* | select | ✔ | **options change with entity type** — see below |
| File *(per row)* | file upload | ✔ | PDF / JPG / PNG, size cap shown |

**Document type options:**
- **Business** → Company registration · GST / tax document · Certificate · Other
- **Individual** → PAN · Aadhaar · Passport · Other

**Contains:** intro explaining this is optional and what the tick gives them · entity-type choice ·
a repeatable upload row (add / remove) · per-file progress and per-file error · submit.

**States:** empty (nothing added) · file selected · uploading (per-row progress) · per-file error
(wrong type, too large, failed) · submitted confirmation · already-verified variant (no form, just
the tick).

**Design notes:** the document-type list **switches** with entity type — never show PAN to a
business. Multi-row uploader with drag-and-drop plus a browse fallback. Show accepted formats and the
size limit before a user picks a file, not after a rejection.

---

### 8 · Buyer verification status — `/buyer/verification`

Read-only view of where the buyer's verification stands.

**Contains:** current status chip (§1.2) · a submitted-documents list showing **document type and
upload date only** (never a preview or link — those documents are private) · submission date ·
verified date if applicable · rejection reason if rejected, plus a resubmit CTA.

**States:** **not submitted** (empty state with an explanation and an upload CTA) · **in review** ·
**verified** (tick + date) · **needs attention** (reason in a `danger` alert + resubmit button) ·
loading · error.

**Design note:** the rejection reason is written by a reviewer and shown verbatim to the buyer. Give
it room — a full sentence or two, not a one-line chip.

---

## 6. Exporter panel (screens 9–12)

### 9 · Exporter signup — `/signup/exporter`

Longer than the buyer form and the more important of the two, since exporters are the supply side.
Group it into sections so it doesn't read as a wall of inputs.

**Section A — Your account**

| Label | Type | Required |
|---|---|---|
| Full name | text | ✔ |
| Email | email | ✔ |
| Mobile | country-code select + number | ✔ |
| Password | password + strength meter | ✔ |
| Confirm password | password | ✔ |

**Section B — Your business** *(per `feilds-data.png`: business name · entity type · country ·
address)*

| Label | Type | Required | Helper |
|---|---|---|---|
| Business name | text | ✔ | — |
| **Entity type** | radio: **Business** / **Individual** | ✔ | "This decides which documents we'll ask for later" |
| Country | searchable select | ✔ | — |

**Section C — Address** *(all optional)*

| Label | Type | Required |
|---|---|---|
| Address line 1 | text | ○ |
| Address line 2 | text | ○ |
| City | text | ○ |
| State / province | text | ○ |
| Postal code | text | ○ |

⚠️ **No country field inside the address block** — the country in Section B is the only one. Two
country inputs on one form is a bug, not a detail.

**Section D — Business details** *(all optional)*

| Label | Type | Required | Helper |
|---|---|---|---|
| Registration number | text | ○ | "Company registration / CIN" |
| Tax ID | text | ○ | "GST or equivalent" |
| Year established | number | ○ | 4 digits |

**Actions:** "Create account" primary · "Already have an account? Sign in".

**States:** default · loading · field errors · duplicate account · success.

**Entity type deserves real estate.** It's two radio cards, not a dropdown — it changes which
documents the exporter uploads later (a Business submits registration/GST/certificates; an Individual
submits PAN/Aadhaar/passport). Explain that inline at the point of choice.

**🔴 Success copy constraint:** the exporter's profile is **public immediately**, just without a tick
(§7: "Profile signup se hi public dikhta hai"). So the success state says something like *"You're in.
Set up your catalogue now — submit your documents whenever you're ready to get verified."* It must
**never** say the profile is hidden, inactive, or pending review before it goes live.

**Design notes:** clear section headers, optional fields visibly marked, "Optional" labels rather
than asterisks-on-required (fewer marks overall since most fields here are optional). Sticky submit on
mobile.

---

### 10 · Exporter dashboard — verify status — `/exporter`

The exporter's home. Verification is the headline here, because it unlocks their ability to sell.

**Contains:** business name, country · **verified tick if verified** · a prominent **verification
state card** (§1.2, with the action for each state) · a **product allowance notice** · placeholder
tiles for catalogue/enquiries.

**Product allowance notice** — while unverified: *"You can publish up to 3 active products. Get
verified to publish more."* Once verified, it disappears. `Flow-chart-Backend.png` states the rule
("Exporter — 3 products, trial, then must verify"), so this is a real, noticeable element — it's the
main reason an exporter will bother getting verified. Informational text only in M1; the catalogue
itself comes later.

**States:** loading · four verification variants (each changing the card's CTA) · error.

**Design note:** placeholder tiles must look explicitly unavailable — greyed with a "Coming soon"
label. A live-looking tile that does nothing is worse than an honest gap.

---

### 11 · Exporter KYC upload (business / ID) — `/exporter/kyc`

Same uploader as screen 7, with two differences:

1. **Entity type is read-only** — it was set at signup. Display it as a labelled value with a note
   ("Set at signup — contact support to change"), **not** an editable control. The document-type
   options follow it.
2. **This is mandatory**, not optional. Verification unlocks selling beyond 3 products. Tone:
   guiding, not scolding.

**Fields**

| Label | Type | Required | Notes |
|---|---|---|---|
| Entity type | **read-only value** | — | Business or Individual, from signup |
| Document type *(per row)* | select | ✔ | Business → registration / GST / certificate / other · Individual → PAN / Aadhaar / passport / other |
| File *(per row)* | file upload | ✔ | PDF / JPG / PNG, size cap shown |

**States:** first submission (empty) · uploading · per-file errors · in review (form replaced by a
status panel) · **verified** (no form; tick + confirmation).

---

### 12 · Exporter resubmit after reject — `/exporter/kyc/resubmit`

§7 names this as its own screen. Reached when verification was rejected
(`Flow-chart-Backend.png`: "Rejected with reason ↺ resubmit → wapas review").

**Contains:** a `danger` alert at the very top carrying **the reviewer's rejection reason, verbatim**
· what to fix · the same upload fields as screen 11 (entity type read-only, document type per row,
file per row) · submit, which returns the account to "In review".

**Fields** — identical to screen 11.

**States:** rejected (reason + form) · uploading · resubmitted confirmation ("Back in review") ·
per-file errors.

**Design note:** an exporter arriving here is frustrated. The reason must be the first thing they
read, followed immediately by the fix. Don't bury it under the upload widget. Visually this screen is
screen 11 plus a reason banner — keep them consistent so the flow feels like one place, but they are
separate routes.

---

## 7. Role redirect after login

`Screens-web.png`: OTP verify → **Role redirect** → Buyer (account · KYC) · Exporter (dashboard ·
KYC) · Employee (auth only) · Admin (users · verify).

`buyer → /buyer/verification` · `exporter → /exporter` · `employee → first permitted admin screen` ·
`admin | superadmin → /admin/users`

A user reaching another role's route is redirected to their own landing screen — never shown a 403
page that leaks structure. An unauthenticated user hitting a protected URL signs in and lands where
they were going.

---

## 8. Admin / Super Admin panel (screens 13–16)

### 13 · User management — `/admin/users`

The directory of everyone on the platform: buyers, exporters, employees, admins. §7: "Buyers /
sellers / employees — list + search · Activate / deactivate".

**Filters / controls**

| Control | Type | Notes |
|---|---|---|
| Search | text input | **prefix match** — label it "Starts with…" |
| Role | select | Buyer · Exporter · Employee · Admin · Super Admin · All |
| Verification status | select | Not submitted · In review · Verified · Needs attention · All |
| Rows per page | select | 20 / 50 / 100 (100 is the ceiling) |
| Pagination | pager | page numbers + total count |

**Table columns:** Name · Email · Mobile · Role · Verification (status chip + tick) · Active
(yes/no) · Joined date · row actions.

**Row actions:** View details · **Deactivate** (or **Activate**) · View KYC documents · Review
verification.

⚠️ **Search is a prefix match** — typing "smith" will not find "John Smith". Label the input
"Starts with…" so the behaviour reads as intentional rather than broken.

**Detail view** (drawer or its own page): name · email · mobile · role · active state · joined date ·
organisation name and type · verification status + verified date · links to the KYC viewer and the
verification actions.

**States:** loading (skeleton rows) · results · **no matches** (empty state that names the active
filters and offers to clear them) · error (with a support reference code) · row-level loading during
an action.

**Deactivate is destructive** — confirmation modal, `danger` styling, stating the consequence:
*"This signs them out everywhere and blocks them from logging in."* Reversible via Activate, so say
that too.

**Permission-sensitive design:** an employee granted read-only access sees this table **without** the
activate/deactivate actions. Design the row both with and without action buttons.

**Also design these refusals** as clear inline messages, not generic failures: you can't change your
own status · a super admin can't be deactivated · an admin can't deactivate another admin.

---

### 14 · Verify / approve queue — `/admin/verification`

Where an employee or admin reviews accounts and grants or refuses the tick. §7: "Buyer approve/reject
· Exporter verify/reject-with-reason". The most operationally important admin screen in M1.

**Structure:** two tabs — **Exporters to verify** and **Buyers to approve** — each a queue of
accounts awaiting review, oldest first.

**Row / card contains:** business or buyer name · country · entity type · date submitted · document
count · status chip · actions.

**Actions per row:** **View documents** (→ screen 15) · **Verify** / **Approve** (primary) ·
**Reject** (danger).

**Reject modal — the one field-bearing part of this screen**

| Label | Type | Required | Notes |
|---|---|---|---|
| Reason for rejection | textarea with character counter | ✔ | 3–500 characters; helper: "This is shown to the applicant — explain what they should fix" |

That helper text matters: the reason is displayed verbatim on screen 12, so the UI should push the
reviewer toward a useful sentence rather than "no".

**States:** loading · queue with items · **empty queue** (a genuinely pleasant "nothing to review"
state — this is the desired condition, not a failure) · row processing · success confirmation (row
leaves the queue) · **already decided by someone else** (*"This account is no longer awaiting
review"* + refresh) · error.

**Design notes:** reviewers work through these in sequence, so keep the decision two clicks deep at
most, and make it easy to view documents and decide without losing queue position. Approve and Reject
must be visually distinct enough that a fast-moving reviewer can't confuse them.

**Manual review is the model** — §7: *"verification abhi human employee karta hai"*. Nothing
automated, so the screen is built for a person reading documents.

---

### 15 · KYC viewer — `/admin/users/:id/kyc`

Where a reviewer actually looks at the uploaded identity documents. §7: "KYC docs view (permissioned,
signed URL)". Handles sensitive personal data — design accordingly.

**Contains:** account header (name, entity type, country, submission date, status) · list of
documents with **document type + upload date** · an inline preview pane (PDF and image) · the Verify
/ Reject actions from screen 14 so the reviewer decides in place.

**States:** loading · document list + preview · **preview expired** (the secure link is short-lived —
offer "Reload document", never a broken frame) · unsupported file type (offer open-in-new-tab) · no
documents · error.

**Design notes:** no "download all". No document thumbnails in any list outside this screen. Treat the
preview as ephemeral — a reviewer leaving and returning re-requests it. A discreet note that document
access is recorded is appropriate; it sets the right expectation for staff.

---

### 16 · Permissions — `/admin/employees` — super admin only

§7: "Employee create + permission assignment → **hard superadmin-gate**", with the explicit warning
that this must never be a grantable permission itself. Two jobs on one screen: create staff accounts,
and control what each one can do.

**Employee list:** name · email · mobile · granted permissions (as chips) · active state · actions
(edit permissions, activate/deactivate).

**Create employee — form (modal or side panel)** *(per `feilds-data.png`: name · email · mobile ·
permissions (checkboxes) · temp password)*

| Label | Type | Required | Helper |
|---|---|---|---|
| Full name | text | ✔ | — |
| Email | email | ✔ | — |
| Mobile | country-code select + number | ✔ | — |
| Temporary password | password + generate button | ✔ | "At least 8 characters. They'll be asked to change it on first sign-in." |
| Permissions | checkbox group | ○ | can be granted now or later |

**Create success state** — design this carefully. The temporary password is shown **once** for the
admin to hand over: a copyable value, a "copy" affordance, and a warning that it won't be shown
again.

⚠️ See §11 — the screen where the employee actually changes that password is **not** in this brief.

**Edit permissions — panel**

| Label | Type | Notes |
|---|---|---|
| Permissions | checkbox group | **replaces** the whole set — unchecking removes access. Empty = no access at all. |

Current grantable permissions (server-driven, so design for a growing list):
- **Approve buyers** — decide on buyer verification (screen 14)
- **Verify exporters** — decide on exporter verification (screen 14)
- **View user directory** — read-only access to screen 13

**States:** loading · list · empty ("no employees yet") · create form (default / loading / duplicate
email / success-with-password) · edit panel (default / saving / saved) · error.

**Copy note:** a permission change takes effect immediately, without the employee signing out again.
Say so in the saved confirmation — it stops an admin from wondering whether it worked.

**Design notes:** make it visible that permissions **replace** rather than add. Group the checkboxes
by area so the list stays readable as it grows. Only a super admin sees this screen at all.

---

## 9. Cross-screen checklist before handing designs over

- [ ] Every screen has loading, empty, error and success drawn
- [ ] Verified tick used only as a tick — no "unverified" badge anywhere
- [ ] Status vocabulary (§1.2) identical on every screen it appears
- [ ] Login shows no role selector and **no TOTP step**
- [ ] No "attempts remaining" counter on either OTP screen
- [ ] Buyer signup success implies **no** approval wait
- [ ] Exporter signup success implies the profile is **already public**
- [ ] Exporter KYC (11, 12) shows entity type read-only; buyer KYC (7) lets them choose it
- [ ] Document-type options switch with entity type (no PAN for a business)
- [ ] Screens 11 and 12 are visually consistent — 12 is 11 plus a reason banner
- [ ] Admin search labelled as a prefix ("Starts with…")
- [ ] Admin/employee sidebar drawn with zero, one and several items
- [ ] Destructive actions (deactivate, reject) have confirmation + consequence copy
- [ ] Every panel checked at 1440 / 1024 / 768 / 375
- [ ] Focus states, labels and 44px targets on every interactive element
- [ ] Any control shown but not yet functional is visibly "coming soon"

---

## 10. Decisions

### ✅ Decided — design all 16 now, wire later (owner, 2026-07-28)

Six screens touch plumbing that isn't finished (**7, 8, 10, 11, 12, 15** — everything involving KYC
documents or verification status). **All of them get designed now**; wiring follows once the
document-storage approach is settled. Design is not blocked by build order.

What that means in practice:

- **Design every state, including ones we can't populate yet** — a document list, an in-review panel,
  a rejection with a reason, an expired preview. Use realistic placeholder content and note the
  assumptions, so nothing has to be re-drawn when real data arrives.
- **These screens will be built as static UI first.** When that happens, every control that doesn't
  yet do anything must be visibly **`disabled` / "coming soon"** *and* logged in
  `docs/UiWebNotes.md` in the same change — that ledger is a strict project rule. A live-looking
  button that silently does nothing is the one outcome to avoid.
- **Don't design around the gap.** No "temporarily unavailable" placeholder screens standing in for
  the real ones — design the finished screen, and let the build stage the wiring.

### Still open

1. **Brand palette.** Confirm the real brand colours before final visual design, or the whole set
   gets re-skinned later. Decide once for web and app together.

---

## 11. Scope: what was removed, and the gaps it leaves

Per the owner's instruction (2026-07-29), this brief keeps **only** screens named in
`modules-in-detailed/m1-max-1.5days/`. Three screens from the earlier draft were removed:

| Removed | Why it was there | Consequence of removing it |
|---|---|---|
| **Change password** | Employees created by an admin get a temporary password and are **blocked from every action until they change it** — the backend enforces this. | 🔴 **A staff account cannot be used.** An employee created via screen 16 signs in, is blocked, and has no screen to unblock themselves. Screen 16's create-flow tells them they'll be asked to change it — and then nothing asks. |
| **Buyer home / account** | `Screens-web.png` labels the buyer box "account · KYC", but §7's screen table doesn't list it. | A buyer has no landing screen after login. Role redirect must send them straight to screen 8 (verification status), which then acts as their home. |
| **Employee shell** | §7 says employees get "auth only", but login still has to land somewhere. | An employee with **no permissions granted** signs in and arrives nowhere. Needs either a redirect target or an accepted dead end. |

**My recommendation stands on the first one:** Change password is not a nice-to-have — without it the
employee panel is unusable and screen 16 makes a promise the product can't keep. It's a single, simple
form (current password · new password · confirm). Ask if you'd like it added back.

The other two are defensible as-is, as long as the role redirect in §7 is set deliberately rather
than by accident.
