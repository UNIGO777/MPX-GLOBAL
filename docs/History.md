# MPX Global — Project History & Context (for any dev / Claude Code)

> **Rule:** update this file at **every meaningful step** (see `.claude/rules/history-log.md`).
> It exists so a new developer — or a fresh Claude Code session — has full context.
> Authoritative scope: `docs/scope-of-work.md`. Guards/deferrals: `docs/Note.md`.

---

## 1. What this is
B2B import/export **discovery marketplace** (IndiaMART-style), web + mobile on one backend.
Phase 1 = discovery + trust (no money movement). Escrow/payments/contracts = Phase 2.
Stack: **Node + Express + MongoDB (Mongoose)**, JWT+OTP auth, React/React-Native clients,
Cloudinary, Socket.io, OpenAI, Firebase. Backend lives in **`MPX-BACKEND-FULL-SAAS/`**.

Current milestone: **M1 = Authentication** (advance received). Auth is built + tested.

## 2. Repo layout
```
MPX-GLOBAL/
  CLAUDE.md                  project instructions (read first)
  .claude/rules/             auto-loaded rules (see §8)
  docs/                      scope-of-work.md, Note.md (guards), History.md (this), build/quote
  M1-01-backend-steps.md     step-by-step backend prompts
  MPX-BACKEND-FULL-SAAS/     the backend (src/, tests/, package.json, .env[gitignored])
```

## 3. How to run (local)
- Prereqs: Node ≥20. A MongoDB + Redis (either local Docker or a remote/Atlas URI).
  - Docker: `docker run -d -p 27017:27017 --name mpx-mongo mongo:7` and
    `docker run -d -p 6379:6379 --name mpx-redis redis:7`.
- `cd MPX-BACKEND-FULL-SAAS && npm install`
- A committed `.env` with **test-only** values is included (owner's call). **Do not put
  real/production secrets in it** — the moment it needs a real secret, untrack it
  (`git rm --cached`) and share via a secure channel. See `.claude/rules/secrets-and-hygiene.md`.
- Scripts: `npm run dev` (nodemon) · `npm start` · `npm test` (vitest) · `npm run lint`
  (eslint) · `npm run seed` (create superadmin from `SEED_SUPERADMIN_*` in `.env`).
- **Current `MONGODB_URI` points at a test-only Atlas cluster** (`mongodb+srv://…`). Tests
  ignore it — they use a local `mpx_global_test` DB (`tests/setup.js`).

## 4. What's built
**Express core** — `env.js` (zod-validated env, fail-fast), `logger.js` (pino + redaction),
`AppError` + central `errorHandler` (generic message + requestId, no internal leak), `app.js`
(helmet tight CSP/HSTS, CORS allowlist, JSON limit, request-id).

**Request hardening** — `rejectMongoOperators` (rejects any `$`-prefixed / dotted / prototype
key; query parser set to `extended` for nested filters) · `validate(schema)` middleware +
`zString`/`zObjectId` helpers (strip unknown keys, reject non-string → blocks `{$gt:''}`) ·
rate limiting (`express-rate-limit` + Redis store): `authLimiter`, `otpLimiter` (per
identifier), `generalLimiter`.

**MongoDB layer** — `database.js` (connect w/ retry, events, graceful close) · `baseSchema.js`
(shared options: timestamps, toJSON strips `__v` + `select:false`) · `scoping.js` (ownership
tiers: PARTIES / ORG / USER / SELF / PLATFORM; `ownershipFilter` throws if a model didn't
declare a scope — default-deny for data).

**Models (25)** — `User`, `Organisation`, `AuditLog` (append-only) + 21 skeletons + `Milestone`.
Key: `PayoutAccount` stores only provider token + masked last4 (no account number, C1);
`PayoutRequest` has unique idempotency indexes (C3); deal-spine docs scoped by a `parties`
array (B1).

**Auth (M1)** — `password.service` (argon2id) · `token.service` (access JWT 15m + `tokenVersion`
re-checked every request; opaque refresh 7d, rotate-on-use, store only HMAC hash, reuse of a
rotated token ⇒ **revoke whole family**) · `otp.service` (6-digit, hashed, 5-min expiry, 5
attempts→15-min lock) · `twofactor.service` (TOTP via otplib — built but **on hold**, see D4) ·
`authenticate` (server-authoritative `req.user` from DB, never from body/headers) · `authorize`
(default-deny `requireRole`/`requirePermissions`) · **startup route-guard** (`routeGuard.js`:
server refuses to boot if any route lacks a public/auth/permission declaration — A5).
Routes: `POST /auth/buyer/signup`, `/auth/exporter/signup`, `/auth/login` (→ OTP),
`/auth/verify-otp` (→ access+refresh), `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`,
`/auth/reset-password`, `GET /auth/me`, `POST /admin/employees` (admin/superadmin only).
`npm run seed` creates the superadmin.

**Employee verification/approval** — `POST /employee/buyers/:id/approve`, `/buyers/:id/reject`,
`/exporters/:id/verify`, `/exporters/:id/reject`. Each flips `Organisation.kycStatus`
(pending→verified/rejected) and writes an **append-only AuditLog** with the actor's userId
(C10). Permissions: `buyer:approve`, `exporter:verify` (`config/permissions.js`).

## 5. Decisions / deviations from the quote  (full list in `docs/scope-of-work.md`)
1. **Buyer** — fully active from signup, **no approval gate** (quote had one). Approval = status/tick only.
2. **Seller** — public from signup; hard "verify-before-sell" gate **dropped**; instead an
   **unverified seller may add max 3 products** (more after verify). Verified = a tick.
3. **Verified tick** — only a verified tick (no "not verified" badge); absence = unverified.
4. **Admin 2FA** — TOTP **on hold**; admin/superadmin log in via **OTP** for now.
5. **Notifications** (incl. WhatsApp) — **on hold**; nothing sent on any event yet.
6. **OTP delivery** — no provider yet; OTP **printed to terminal in dev only** (prod-safe gated).
7. **Admin access** — superadmin = all-access; `admin`/employees need explicit permissions.

## 6. Guards / deferred / on-hold  (`docs/Note.md` + `.claude/rules/remind.md`)
- 🔴 **D3** buyer activation gate — OFF; do not build without override.
- ❌ **D2** seller hard verify-before-sell gate — dropped.
- 🧭 **D1** unverified-seller 3-product limit — confirmed scope; enforce when catalogue module is built.
- ⏸ **D4** admin/superadmin TOTP 2FA — restore before close. **D5** notifications+WhatsApp.
- Project-close checklist + secrets hygiene: see `docs/Note.md` and `.claude/rules/secrets-and-hygiene.md`.

## 7. Technical gotchas (save future debugging)
- **Express 5**: `req.query` is a read-only getter → don't reassign it; `query parser` set to
  `extended`. `req.body`/`req.params` are writable.
- **Mongoose 9**: pre-hooks are **throw/async style**, not `next(err)` — a `next`-callback hook
  fails with "next is not a function" (bit us on AuditLog save + parties-sync).
- **otplib v13**: rewritten **functional** API (`generateSecret`/`generate`/`verify`/`generateURI`,
  named ESM exports, async). `verify()` returns `{valid,…}` — coerce `.valid` (else it accepts any code).
- **argon2**: native module; if a build issue arises, `@node-rs/argon2` is a drop-in (Rust, prebuilt).
- **Dev indexes**: with `bufferCommands:false` + models compiled before connect, autoIndex may
  not run on boot in dev — call `syncIndexes()` if needed (seed/tests do).
- **OTP terminal print** (`otp.sender.js`) is dev/test only, hard-gated to non-production.

## 8. Rules in `.claude/rules/` (auto-loaded)
`security-baseline.md`, `secrets-and-hygiene.md`, `auth-sessions.md`, `api-endpoints.md`,
`payments-escrow.md`, `contracts-esign.md`, `mobile-app.md`, `remind.md` (deferred/scope guard),
`history-log.md` (this file's update rule).

## 9. Tests
24 tests across `validate`, `auth`, `verification`, `routeGuard`. `npm test` (needs a reachable
Mongo + Redis). Tests use a local `mpx_global_test` DB and flush Redis between cases; they do
**not** touch the Atlas cluster.

## 10. Not done / gaps
Real OTP/email/WhatsApp delivery · TOTP enrollment + restore (D4) · `mustChangePassword`
enforcement · email/mobile verification endpoints · audit on auth events (login/signup) ·
notifications (D5) · resubmit-after-rejection (in-scope Module 7, build with verification) ·
DB-level append-only grant on audit collection · the catalogue/discovery/chat/quotation/admin
modules (Modules 2–8) beyond what's above.

---

## Change log (append newest at the top — one entry per meaningful step)
- **2026-07-26** — `.env` now **tracked** in git at owner's request (values are test-only:
  throwaway Atlas, dev JWT secrets, dev admin password). Standing rule added: **alert before
  every commit/push that includes `.env`**; untrack + rotate the moment it holds a real secret.
- **2026-07-26** — History.md created; git repo initialised at root; `history-log.md` rule
  added (update this file every step). Superadmin seeded on the test Atlas; OTP-terminal login
  verified for all roles incl. superadmin. Startup route-guard (A5) added. `.env` deliberately
  excluded from git (secrets).
