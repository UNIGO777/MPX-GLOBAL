# Secrets & operational hygiene

Loaded in every session. Practical rules for handling credentials and dev shortcuts on this
project. Complements (does not replace) `security-baseline.md`.

## Secrets live only in `.env`
- A secret — password, token, API key, connection string, OTP, private key — goes **only** in
  `.env`. **Never** in source, tests, comments, logs, or chat.
- `.env.example` holds variable **names** with blank values — no real values, ever.
- If the user pastes a secret in chat, use it but write it **only** to `.env`, never into code,
  and don't echo it back in output.

## 🔴 Before committing/pushing `.env` — ALWAYS alert first
`.env` is currently **tracked in git at the owner's request** — the present values are
**test-only** (a throwaway Atlas cluster used for DEV only — production is a **self-hosted
MongoDB on the VPS**, §A26 — plus dev JWT secrets and a dev superadmin password). Because
it is tracked:
- **Before any commit or push that includes `.env`, alert the owner** — list exactly what the
  file currently holds (especially connection strings / credentials) and proceed only on their OK.
- The moment `.env` gains a **real** secret (production DB, live API key, real password): **STOP**,
  untrack it (`git rm --cached`), re-ignore it, and rotate anything already committed.

## Exposure = compromise → rotate
- If any secret shows up somewhere non-secret — chat, a log, a screenshot, a commit, a ticket
  — treat it as **compromised** and **rotate it** before shared/production use.
- Standing item: the seeded superadmin password was typed in chat → rotate before this goes
  live or is shared (see `docs/Note.md` close checklist).

## Seeded / default credentials
- Seeded accounts (e.g. the superadmin) use a known password → **change it before any shared or
  production use**.
- Remove `SEED_SUPERADMIN_PASSWORD` from `.env` once seeding is done — the argon2 hash already
  lives in the DB; the plaintext is no longer needed.

## Dev shortcuts must be production-safe
- Any dev convenience that could leak a secret (e.g. the **OTP terminal print** in
  `otp.sender.js`) MUST be **hard-gated to non-production** and removed when the real path is
  wired. It must be impossible to run in production.

## Never log or return
- Tokens, OTPs, passwords/hashes, bank numbers, IFSC, PAN, Aadhaar, KYC, or a Mongo connection
  string — in any log, response, or error. Redaction is the safety net, not a licence to log.

## Least privilege
- Superadmin only for platform governance. Create employees with the **minimum** permissions
  they need — never blanket-grant.

## Before production / handover — hygiene pass
- Rotate every seeded/dev credential; remove dev affordances (OTP print); wire real OTP
  delivery; restore Super Admin TOTP (`docs/Note.md` D4); run a secret-scan (gitleaks /
  trufflehog) over git history (tracker E6) once the repo has history.
