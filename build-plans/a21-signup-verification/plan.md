# Signup verification — email + mobile, separate OTPs

**Status: PLAN ONLY — no code written.** Signup/OTP is auth, and CLAUDE.md requires the approach
to be agreed before implementation.

---

## 1 · The problem is real, and it is bigger than "we forgot email"

Confirmed by reading `auth.service.js`, `otp.service.js`, `OtpChallenge` and `User`:

| What was reported | What the code actually does |
|---|---|
| "saving a user before verifying" | ✅ **True.** `registerBuyer` / `registerExporter` call `createUserWithOrg()` **first** — the `User` **and** the `Organisation` are persisted with `isActive: true` — then audit, then send an OTP. Nothing is conditional on that OTP. |
| "we need to verify both" | ✅ **Email is never verified at all.** `issueSignupOtp()` sends `channel: 'mobile'` only. |
| — | `User.isEmailVerified` / `isMobileVerified` **already exist** on the model and are written by **nothing** except the superadmin seed. They are dead fields. |
| — | The signup OTP reuses `purpose: 'login'`. So "signup verification" is really just *first login* — abandon it and a fully live account remains. |

### Why this matters more than it looks

- **Identity squatting.** `(email, role)` and `(mobile.e164, role)` are **unique indexes**. Anyone
  can burn someone else's email or phone permanently, with no proof of control — and the real
  owner can then *never* register for that role. This is the most serious consequence.
- **A squatter gets a public page.** An exporter profile is public from signup by design (B7), so
  an unverified fake company is immediately live at `/supplier/:slug`.
- **Junk accumulates as real records.** Every abandoned signup leaves a real `Organisation` that
  shows up in the admin console and counts in the dashboard tiles.

### It also finishes something already half-done

**§A21 says signup is TWO steps** — step 1 (name, email, phone, password) → **OTP** → step 2
(Organisation *claim or create*). The code does none of that: one call creates User + Organisation
together, which is **exactly the design A21 says it supersedes**. CLAUDE.md already flags
"A21 is mid-build". So this work isn't a detour — it is the missing half of A21, plus email.

---

## 2 · 🔴 Guards I must surface before any code

**🧭 S1 — frontend auth screens.** `docs/Note.md` S1 requires a stop-and-alert before building any
M1 auth screen, so the forms match the backend contract. This request changes **web *and* app**
signup screens, so S1 applies. Consider it raised — the screens below are written against the
contract in §3.

**🔴 D3 — buyer "approve-before-participate" gate.** `remind.md` says to flag anything that even
tangentially touches the ledger, so I am flagging it.

> **My reading: this is NOT D3, and I recommend proceeding.** D3 guards a **staff approval** gate —
> an employee deciding whether a buyer may participate. This is **self-service proof that you own
> the email and phone you typed**. No staff member is involved and nothing waits on a queue.
> A buyer who verifies is still fully active the instant they finish, with no approval step —
> which is precisely what D3 protects.
>
> But it does mean a buyer is not active during the minutes between "submit" and "verified", so
> **please confirm explicitly.**

**Not a scope issue.** Auth is quote Module 1, and OTP delivery is explicitly carved OUT of the
deferred notification layer (`scope-guard.md`: Module 8 is deferred *"beyond OTP"*). Email **OTP**
is OTP, not an email notification. No red alert needed.

⚠️ **Dependency:** there is still **no real OTP delivery provider** (close checklist — client
side). `sendOtp()` is already channel-agnostic and prints to the terminal in dev, hard-gated off in
production. So email OTP is buildable and testable now, and goes live when the provider does —
**the same footing SMS is already on.** Nothing new is blocked; it is just now two channels
waiting on the client instead of one.

---

## 3 · The design decision I need from you

**Where does an unverified signup live?**

### Option A — a short-lived `PendingSignup` record *(recommended)*

Step 1 writes to a **separate collection** with a TTL (24h): name, email, mobile, `passwordHash`,
and the two verification flags. **No `User`, no `Organisation` exists yet.** Once *both* OTPs pass,
step 2 (org claim/create) creates the real records in one go.

- ✅ **Kills the squatting hole** — the unique indexes are never touched until ownership is proven
- ✅ Nothing unverified ever enters `users` / `organisations`; no junk orgs, no fake public pages
- ✅ Abandoned signups clean themselves up via the TTL
- ✅ Lands A21's two-step shape exactly as written
- ❌ One new model, and more moving parts than a flag

### Option B — create the `User` immediately but inactive

Keep today's flow; set `isActive: false` and refuse login until both flags are true.

- ✅ Much smaller change
- ❌ **Does not fix the squatting hole at all** — the unique index is consumed the moment someone
  types your email. That is the single worst symptom, and it survives.
- ❌ Junk users and orgs still accumulate

**I recommend A.** B leaves the main harm in place.

---

## 4 · Separate OTPs — the mechanics, and the trap in the current code

⚠️ **`requestOtp()` deletes by `(userId, purpose)`:**
`deleteMany({ userId, purpose, consumedAt: null })` — *"only one live challenge per (user,
purpose)"*. So if the email and mobile codes share a purpose, **each new one silently destroys the
other** and the flow can never complete. This is the thing that would have quietly broken.

**Fix:** give them **distinct purposes** — `signup_email` and `signup_mobile` added to
`OTP_PURPOSE`. Chosen over "add `channel` to the dedupe key" because it leaves the login and
forgot-password paths completely untouched, and it gives each channel its **own A3 lock**
(5 attempts → 15 min), which is the behaviour we want anyway.

`OtpChallenge.userId` is `required` + `ref: 'User'`, and under Option A there is no User yet — so
it needs to reference the pending record instead. Cleanest is a nullable `pendingSignupId`
alongside `userId`, with exactly one of the two required.

Other rules that carry over unchanged: codes hashed (A3), never returned or logged, sent only to
the address **on the record** and never one supplied in the request, rate limited per email, per
mobile and per IP.

### Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /auth/signup/start` | name · email · mobile · password → creates the pending record, sends **both** OTPs, returns an opaque signup token |
| `POST /auth/signup/verify-email` | token + code → sets `emailVerifiedAt` |
| `POST /auth/signup/verify-mobile` | token + code → sets `mobileVerifiedAt` |
| `POST /auth/signup/resend` | token + `channel` → resends that channel only |
| `POST /auth/signup/complete` | token + org claim/create + role → **only now** creates User + Organisation, returns a session |

The existing `/auth/buyer/signup` and `/auth/exporter/signup` stay working during the change and
are retired at the end, so the current web build never breaks mid-flight.

---

## 5 · Screens (web + app)

Both platforms get the same shape, since the contract is shared:

1. **Step 1 — details.** name · email · phone · password (unchanged fields).
2. **Verify — one screen, two codes.** Email and phone side by side, each with its own input,
   its own resend timer and its own error/lock state. A channel that is already verified shows a
   tick and stops accepting input. **Continue is disabled until both are green.**
3. **Step 2 — company.** The A21 claim-or-create step. Only reachable once both are verified.

Existing pieces to reuse rather than duplicate: web already has `components/ui/OtpInput.jsx` and an
OTP screen that now takes `step`/`backLabel` (from the WEB commit that just landed), so it is close
to already parameterised for this.

**Open UX question:** both codes on **one screen** (recommended — fewer steps, and the user has
both apps open anyway) or **two sequential screens** (simpler state, more taps)?

---

## 6 · Tests

| Area | Must prove |
|---|---|
| No premature write | after step 1, `users` and `organisations` are **empty**; only after `complete` do they exist |
| Squatting closed | an abandoned signup on an email leaves that email **still registrable** by someone else |
| Both required | `complete` is refused when only email, or only mobile, is verified |
| Codes don't collide | verifying email does **not** invalidate the live mobile challenge, and vice versa |
| Wrong channel | an email code will not verify the mobile, and vice versa |
| A3 preserved | 5 attempts → 15-minute lock, **per channel**; expiry honoured; a code is single-use |
| No leaks | no OTP in any response, log or error, on either channel |
| Rate limits | per email, per mobile, per IP |
| Dual accounts | A21 still holds — the same email may hold one buyer **and** one exporter |
| TTL | an abandoned pending record disappears |
| Regression | the full 847-test suite stays green |

---

## 7 · Owner decisions — ANSWERED 2026-08-03

1. **Storage** → ✅ **Option A · `PendingSignup`.** Nothing unverified reaches `users` or
   `organisations`, so the squatting hole closes.
2. **🔴 D3** → ✅ **Confirmed not D3 — build it, both channels.** Self-service proof of ownership is
   not the guarded staff-approval gate; a verified buyer is fully active immediately, with no
   approval step.
3. **Verify UX** → **Two sequential screens** (email, then phone) — not one combined screen.
   ⚙️ *Backend consequence:* the two verify endpoints stay **independent and order-agnostic**
   anyway. The sequence is a screen decision, not a server rule — so the API cannot be made to
   depend on an order the app might later want to change.

Build order: backend contract + tests → web → app.
