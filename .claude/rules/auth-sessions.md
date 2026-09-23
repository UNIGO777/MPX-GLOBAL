---
paths:
  - "**/*[Aa]uth*.{js,jsx,ts,tsx}"
  - "**/*[Ss]ession*.{js,jsx,ts,tsx}"
  - "**/*[Oo][Tt][Pp]*.{js,jsx,ts,tsx}"
  - "**/*[Rr][Bb][Aa][Cc]*.{js,jsx,ts,tsx}"
  - "**/*[Pp]ermission*.{js,jsx,ts,tsx}"
  - "**/*[Tt]oken*.{js,jsx,ts,tsx}"
  - "**/[Mm]iddleware*/**/*.{js,jsx,ts,tsx}"
  - "**/[Aa]uth*/**/*.{js,jsx,ts,tsx}"
---

# Authentication, sessions and access control

## Passwords (A1)

argon2id preferred, bcrypt cost 12+ acceptable. Hashing only — never encryption, never a
plain digest like SHA-256. The hash never leaves the server in any response or log.

## Tokens (A2)

- Access token 15 minutes, refresh token 7 days
- Rotate the refresh token on every use; store only its hash
- Reuse of an already-rotated refresh token means theft — revoke the entire token family
- Include `tokenVersion` in the JWT and compare it on every request

**Transport is DUAL, and must stay dual (2026-08-03).** The same endpoints serve the web app and
the Expo app, and React Native cannot use httpOnly cookies:

- **Browser** — identifies itself with `X-Client: web` + an allow-listed Origin. It gets the
  refresh token as an **httpOnly, SameSite=Lax, `Path=/auth` cookie** (Secure in production only —
  a Secure cookie is dropped over plain http and breaks local dev), and **no `refreshToken` in the
  response body**. That omission is the point: a cookie achieves nothing while a copy still ships
  where a script can read it.
- **Every other client** — unchanged: `refreshToken` in the body, no cookie.

`src/utils/refreshCookie.js` owns all of it (`setRefreshCookie`, `clearRefreshCookie`,
`readRefreshToken` — cookie first, body second — and `refreshTokenForBody`). Refresh and logout
accept either transport; logout clears the cookie unconditionally.

🔴 **Never "simplify" this to cookie-only.** It passes a naive test suite and silently breaks the
mobile app. `tests/a2-refresh-cookie.test.js` asserts the native path explicitly for that reason.

## Sessions (A7)

`tokenVersion` on the user document, incremented on password change, role change,
deactivation and logout. This is how existing sessions die — there is no other mechanism.

## OTP (A3)

Six digits, five-minute expiry, five attempts then a fifteen-minute lock. Store the OTP
hashed. Rate limit per mobile, per email and per IP. Never return an OTP in a response,
never log one, never send one to an address supplied in the request rather than the one on
the account.

**"Don't have your phone?" — the email channel (owner, 2026-09-23).** Buyers and sellers may
move a sign-in code (`POST /auth/resend-otp`) or a reset code (`POST /auth/forgot-password`) to
email with `channel: 'email'`. It selects the account's OWN stored email — the request never
carries an address. **Staff stay phone-only** (resend refuses; the staff forgot route has no
channel). The A3 lock is checked before the switch, so switching never resets it. Forgot-password
stays generic. `auth.login` audit records `otpChannel`. Tests: `otp-email-channel.test.js`.
Accepted trade-off: control of the email inbox alone can reset a password.

**The one third-party recipient — `claim_org_email` (D7 rule 6, 2026-09-23).** Joining an
existing organisation proves the inbox of the member ALREADY in it, so this code goes to that
member's stored address — resolved from the database, never from the request. `requestOtp`
accepts a `recipient` only for this purpose, only on the email channel, only for a pending
signup; keep that pin. Its own purpose for the same reason as the signup split (one live
challenge per subject+purpose), budgeted per signup token (`claimCodeLimiter`), and every send is
audited (`organisation.claim_attempt`).

**Signup verifies BOTH channels (2026-08-03).** `POST /auth/signup/start` sends one code to the
email and another to the mobile, and no account exists until both pass. Two rules make that work
and must not be "simplified":

- **They are separate OTP purposes** — `signup_email` and `signup_mobile`. `requestOtp()` keeps
  only one live challenge per `(subject, purpose)`, so a single shared `signup` purpose would make
  each new code silently delete the other and the flow could never complete. Separate purposes
  also give each channel its own A3 lock — failing the email code must not lock the phone.
- **The subject filter is built explicitly, never from an optional field.** Mongoose strips
  `undefined` from a query, so `{ userId: undefined, purpose }` collapses to `{ purpose }` — which
  matches every subject's challenge and would let one person's code verify another's account.
  `otp.service.js` throws when neither a user nor a pendingSignup is supplied; keep it that way.

## Super Admin 2FA (A4)

TOTP required for the Super Admin at login. Backup codes stored hashed, single use.
(There is no separate "Admin" role — see the role list in `CLAUDE.md`.)

## RBAC (A5)

One permission middleware at router level, default deny. Every route declares its required
permission. A route without a declaration must fail to start the server rather than run
unprotected. UI-level hiding is presentation, never enforcement.

## Ownership (A6)

Every query scopes by owner. Never `findById` alone. Not found returns 404, never 403.

## Accounts

Named accounts only, no shared or generic logins. Every audit entry records a user ID, never a
role.

**Dual accounts (build-prompt A21).** Email is **not** globally unique across roles: the same
email and the same mobile may hold **one buyer account and one exporter account** — but never two
of the same role. Their credentials are **independent** — no password syncing, and each keeps its
own OTP lock (deliberate; do not "fix" it later). A **staff** email (employee/superadmin) is
exclusive and may not also be a buyer or exporter. Login is per-portal: `POST /auth/login` takes a
`portal` (buyer/exporter); staff use `POST /auth/staff/login` (no portal). A wrong portal returns
the **same generic "Invalid credentials"** as a wrong password — never reveal that the account
exists under another portal.

## Organisation claim (D7)

Signup's organisation step can JOIN an existing company. The full rule set is build-prompt
**§A21 "Organisation claim"** — implement all of it, on every client, rather than re-deriving
it. The load-bearing parts: the client never names a target (opaque `claimChoice`, never an org
id); the stored offer restricts and never grants (`complete` re-checks); the company name is
withheld until rule 6 is satisfied; one ACTIVE account per role per org, enforced by a unique
partial index; seat changes are support-mediated.

## Never

- A `skipAuth`, `isDev` or `bypass` branch, even temporarily
- A permission check that reads a role from the request body or a client-supplied header
- Returning a different error for "user not found" and "wrong password"
- Logging a token, OTP or password at any level
