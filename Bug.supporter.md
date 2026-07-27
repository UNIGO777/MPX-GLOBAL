# 🐞 Auth Backend — Bug & Hardening Report

Scope: full review of the M1 auth backend (`MPX-BACKEND-FULL-SAAS/src/**` auth path) —
services, middleware, routes, models. Method: code read + `npm test` (24/24 pass) + `npm run
lint` (clean). Reviewed on 2026-07-27.

**Verdict:** no **critical/high** exploitable holes found — auth core (argon2id, JWT +
tokenVersion, refresh rotation + family-revoke, default-deny RBAC, startup route-guard) is
sound. Findings below are **medium and lower** (hardening, edge cases, production config).

## ✅ Fixes applied — 2026-07-27 (all verified, 30/30 tests green, lint clean, boots)
- **BUG-1 FIXED** — `otp.service.requestOtp` refuses to replace a currently-locked challenge, so
  the 5-attempt/15-min lock persists across re-login. *(regression test)*
- **BUG-2 FIXED** — `app.js` sets `trust proxy` from `env.TRUST_PROXY` (configure in prod).
- **BUG-3 FIXED** — `identifierQuery` also matches an e164 derived from the input's digits, so
  login by `91…`/`+91…` works. *(regression test)*
- **BUG-4 FIXED** — `resetPassword` + `forgotPassword` scope to `isActive: true`. *(regression test)*
- **BUG-5 FIXED** — `authenticate` loads `mustChangePassword`; `authorize` blocks privileged
  actions until changed; new `POST /auth/change-password` clears it + rotates the session.
  *(regression test)*
- **BUG-6 FIXED** — `recordAudit` now written on login, employee-create, password-reset,
  password-change.
- **BUG-7 FIXED** — `rotateRefreshToken` validates the user is active BEFORE issuing and revokes
  the family if gone (no orphan token). *(regression test)*
- **BUG-8 FIXED** — inbound `X-Request-Id` honoured only behind a trusted proxy + format-checked;
  otherwise generated. *(regression test)*
- **BUG-9 PARTIAL** — review now accepts `pending`/`submitted`; full resubmit (rejected→pending)
  is Module C (planned), not built.
- **BUG-10 (unchanged)** — reuse→family-revoke without a `tokenVersion` bump is the owner's
  explicit decision (residual ≤15-min access-token window).
- **BUG-11 (unchanged)** — 2FA-flow credential enumeration is inherent / accepted.

Original findings (for the record) follow below.

| ID | Severity | Title |
|---|---|---|
| BUG-1 | 🟠 Medium | OTP attempt-lock is bypassable — resets on every new OTP request |
| BUG-2 | 🟠 Medium | No `trust proxy` → rate-limit & client IP wrong behind a proxy (prod) |
| BUG-3 | 🟡 Low-Med | Login/reset by a local mobile number fails (only full E.164 matches) |
| BUG-4 | 🟡 Low | `resetPassword` works on a deactivated account |
| BUG-5 | 🟡 Low | `mustChangePassword` is set but never enforced |
| BUG-6 | 🟡 Low | No audit log written for auth events (login / signup / employee-create / reset) |
| BUG-7 | 🟡 Low | Refresh rotates *before* the active-user check → orphan rotated tokens |
| BUG-8 | 🟡 Low | Inbound `X-Request-Id` trusted from any client |
| BUG-9 | 🟡 Low | Verification only accepts `kycStatus: 'pending'` (no submitted/resubmit path) |
| BUG-10 | ⚪ Info | Reuse-detection doesn't bump `tokenVersion` (stolen access token valid ≤15 min) |
| BUG-11 | ⚪ Info | Login enumerates valid credentials via 200-vs-401 (inherent to 2FA flow) |

---

## 🟠 BUG-1 — OTP attempt-lock is bypassable (lock resets on every new OTP request)
**Files:** `src/services/otp.service.js:22` (requestOtp `deleteMany`) + `:56-60` (lock) ·
`src/services/auth.service.js:135` (login calls requestOtp every time).

**What:** `requestOtp` does `OtpChallenge.deleteMany({ userId, purpose, consumedAt: null })`
before creating a fresh challenge (`attempts: 0`, no lock). The 5-attempt / 15-min lock
(auth-sessions **A3**) lives **on that ephemeral challenge**. Any new `/auth/login` (or
`/auth/forgot-password`) deletes the locked challenge and issues a clean one — so the lock
**never persists**.

**Scenario:** attacker who already has the password wants to defeat the OTP 2nd factor:
login → OTP sent → 5 wrong guesses → challenge locks → login again (new OTP) → lock gone → 5
more guesses. The intended "15-min lockout" is defeated.

**Residual protection (why it's Medium, not High):** `otpLimiter` (5/10 min per identifier)
on login and `authLimiter` (10/15 min per IP) on verify-otp still bound total guesses; 6-digit
space keeps brute impractical. But the **A3 lock guarantee is not honored**, and the per-IP
verify limiter is bypassable via IP rotation.

**Fix:** track failed-attempt count / lockout **durably per (userId, purpose)** (e.g. on the
User doc or a small counter), independent of the ephemeral challenge — so a new OTP request
does not reset it. Or: don't delete/replace a challenge that is currently locked.

## 🟠 BUG-2 — No `trust proxy`; rate-limiting & client IP break behind a reverse proxy
**File:** `src/app.js` (never calls `app.set('trust proxy', …)`).

**What:** In production behind nginx / ELB / Cloud Run, `req.ip` becomes the **proxy's** IP.
`authLimiter` and `otpLimiter` are IP-keyed, so **all users share one bucket** → either a
trivial global lockout (DoS) or the IP limiter becomes meaningless. `X-Forwarded-For` and
`req.protocol`/secure detection are also affected.

**Fix:** `app.set('trust proxy', 1)` (or the exact hop count for your infra) — ideally driven
by env so local dev stays untrusted. Verify `req.ip` shows the real client IP after deploy.

## 🟡 BUG-3 — Login / reset by a local mobile number silently fails
**File:** `src/services/auth.service.js:25-27` (`identifierQuery`).

**What:** the query matches `email` (lowercased) or `mobile.e164` **exactly**. A user who
types `9999999999` (without `+91`) won't match the stored `+919999999999`, so login /
forgot-password / reset by plain mobile returns "Invalid credentials" even with the right
password. Only email or the full E.164 string works.

**Fix:** normalize a phone-looking identifier to E.164 before querying (apply a default country
code), or accept a structured `{ countryCode, number }` on these endpoints.

## 🟡 BUG-4 — `resetPassword` works on a deactivated account
**File:** `src/services/auth.service.js:180-192`.

**What:** `resetPassword` looks the user up via `identifierQuery` **without** `isActive: true`.
A disabled account (with a valid OTP) can still have its password reset. It can't then log in
(login checks `isActive`), so impact is low — but a disabled account shouldn't be mutable
through the public OTP flow.

**Fix:** scope the lookup to `{ ...identifierQuery(identifier), isActive: true }` and keep the
same generic "Invalid or expired code." error on miss.

## 🟡 BUG-5 — `mustChangePassword` is set but never enforced
**Files:** `src/services/auth.service.js:110` (createEmployee sets it) · `:139-157`
(completeLogin never checks it).

**What:** admin-created staff get `mustChangePassword: true`, but `completeLogin` issues full
access + refresh tokens regardless. A generated-password staff account is never forced to
change its password → the generated secret can live forever.

**Fix:** in `completeLogin`, if `user.mustChangePassword`, either issue a **restricted**
token (only a change-password endpoint) or return a flag the client must act on, backed by a
`POST /auth/change-password` that clears the flag + bumps `tokenVersion`.

## 🟡 BUG-6 — No audit log for auth events
**File:** `src/services/auth.service.js` (no `recordAudit` calls anywhere).

**What:** verification actions write an append-only `AuditLog`, but **login, logout, signup,
employee creation, and password reset write none**. There's no trail for "who logged in / who
created this employee / whose password was reset" — weak for a payments-adjacent platform, and
`admin/employees` creation especially should be audited.

**Fix:** call `recordAudit` on login success, `createEmployee`, and `resetPassword` (and
optionally signup), with a safe action name + actor id (never log the password/OTP).

## 🟡 BUG-7 — Refresh rotates before the active-user check (orphan rotated tokens)
**File:** `src/services/auth.service.js:161-165`.

**What:** `refresh()` calls `rotateRefreshToken` first (marks RT1 `rotated`, creates a live
RT2) and only **then** loads `{ _id, isActive: true }`. For a deactivated/deleted user, RT1 is
consumed and a live-looking RT2 is created before the 401. No access token is issued (safe),
but it leaves a dangling `active` RT2 (which will again rotate-then-fail).

**Fix:** load and validate the user (active) **before** rotating; if the user is gone/inactive,
`revokeFamily` instead of issuing a new token.

## 🟡 BUG-8 — Inbound `X-Request-Id` trusted from any client
**File:** `src/app.js:29-34`.

**What:** the request-id middleware uses a client-supplied `X-Request-Id` verbatim (comment
says "from a trusted proxy", but there is no trust boundary). A client can set an arbitrary
correlation id — spoofing/confusing tracing, and collisions across clients. (pino
JSON-escapes it, so no log-injection, but it's untrustworthy.)

**Fix:** only honor an inbound id when behind a trusted proxy; otherwise always generate.
Optionally cap length / charset.

## 🟡 BUG-9 — Verification only accepts `kycStatus: 'pending'`
**File:** `src/services/verification.service.js` (`reviewOrg` requires `kycStatus === 'pending'`).

**What:** the enum includes `submitted`, and a `rejected` org can't be re-verified. There's no
path to move a rejected org back to `pending` (resubmit) — so once rejected, approve/verify
409s forever. This is the **resubmit-after-rejection** flow, which is in-scope (Module 7) but
not built yet — flagging so it isn't forgotten.

**Fix:** build the resubmit transition (rejected → pending on document re-submit) with the
verification/catalogue module; optionally allow verify from `submitted` too.

---

## ⚪ Info / accepted (not defects)
- **BUG-10 — reuse-detection doesn't bump `tokenVersion`.** On refresh-token theft, the family
  is revoked but already-issued **access** tokens stay valid until their ≤15-min expiry. This
  was a conscious decision (family-revoke only). Residual risk; bump `tokenVersion` on
  reuse-detection if you want instant kill.
- **BUG-11 — credential enumeration via 200-vs-401 on login.** A correct password returns 200 +
  loginToken (OTP sent); wrong returns 401. Inherent to the password→OTP flow. Accepted.

## ✅ Checked and correct (no bug)
- Password hashing argon2id; hash never returned (`select:false` + toJSON strip).
- Same generic error + timing (`verifyDummy`) for unknown-user vs wrong-password.
- Access vs login-pending tokens separated by `typ` (a login token can't act as an access token).
- Refresh: opaque, HMAC-hashed, only hash stored; rotate-on-use; reuse → family revoke.
- `authenticate` sources `req.user` from the DB (never body/headers); `tokenVersion` re-checked.
- Default-deny RBAC + startup route-guard (server refuses to boot on an undeclared route).
- NoSQL-operator rejection (`$`/dotted/proto keys) + `zString`/`zObjectId` at the boundary.
- Duplicate signup handled (pre-check + compensating org delete on the race).
- OTP codes hashed, never logged/returned (dev terminal print is hard-gated to non-production).

## Test status
`npm test` → **24/24 pass**; `npm run lint` → clean. None of the above are caught by the
current tests (they're edge/config cases) — worth adding regression tests when fixed
(esp. BUG-1 lock-persistence and BUG-4 deactivated-reset).
