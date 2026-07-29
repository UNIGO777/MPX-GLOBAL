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

## Sessions (A7)

`tokenVersion` on the user document, incremented on password change, role change,
deactivation and logout. This is how existing sessions die — there is no other mechanism.

## OTP (A3)

Six digits, five-minute expiry, five attempts then a fifteen-minute lock. Store the OTP
hashed. Rate limit per mobile, per email and per IP. Never return an OTP in a response,
never log one, never send one to an address supplied in the request rather than the one on
the account.

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

## Never

- A `skipAuth`, `isDev` or `bypass` branch, even temporarily
- A permission check that reads a role from the request body or a client-supplied header
- Returning a different error for "user not found" and "wrong password"
- Logging a token, OTP or password at any level
