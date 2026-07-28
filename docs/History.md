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
  web/                       web frontend (Vite+React+Tailwind); structure scaffolded (see changelog)
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
`payments-escrow.md`, `contracts-esign.md`, `mobile-app.md`, `web-frontend.md` (React web:
trust boundary, token storage, XSS, state mgmt, clean-code), `web-design.md` (design system,
responsive, a11y, SEO, trust signals), `web-ui-notes.md` (STRICT: log every non-operational
button/link/control to `docs/UiWebNotes.md`), `remind.md` (D-item / out-of-scope guard),
`scope-guard.md` (HIGH-PRIORITY: month-1 + out-of-scope 🔴 red-alert guard, backs
`docs/month1-not-doing.md`), `history-log.md` (this file's update rule),
`m3-public-projection.md` (M3 public whitelist projection + alert on widening the surface),
`m3-seo.md` (M3 discovery-page SEO: slugs, meta/canonical/JSON-LD, sitemap/robots).

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
- **2026-07-28** — **New deferral recorded: seller "request unblock" for a taken-down product.**
  Owner ne M2 takedown discussion ke baad kaha — jab admin product takedown kare, seller uske
  unblock ki **request** bhej sake; build **~2026-08-28 (1 month baad)**, month-1 me nahi.
  Recorded as `docs/Note.md` **D6** (⏸ ON HOLD, build-time constraints ke saath) +
  `docs/month1-not-doing.md` **A5** (Bucket A). Month-1 behaviour unchanged: seller apni listing
  pe sirf `takedown.reason` + date dekhta hai (§A9, `byUserId` kabhi nahi), koi appeal endpoint
  nahi. **Open gotcha jab build ho:** §A8 ka 180-din blocked-purge aur ek pending unblock request
  ka interaction undecided hai (purge ruke ya request lapse ho) — owner se poochna hai.
- **2026-07-28** — **M1 Phase 4a+4b (KYC upload) built.** Owner chose Cloudinary approach **(b)
  server multipart**; deps added: **`cloudinary`, `multer`, `file-type`**. Infra: `config/
  cloudinary.js`, `middleware/upload.js` (multer memory, single `document`, 10 MB), `services/
  kyc.storage.service.js` — `verifyKycFile` (magic-byte allowlist pdf/jpg/png/webp), `uploadKyc
  Document` (Cloudinary **`type: private`** + randomised public_id → stores only `storageKey`,
  never a public URL), `signedKycUrl` (expiring). Endpoint `POST /me/kyc/documents` (auth +
  generalLimiter + multer + zod): self-write, exporter uses signup `entityType` (mismatch 400),
  buyer supplies+sets it, docType checked vs `KYC_DOCS_BY_ENTITY`, `pending|rejected→submitted`,
  clears `kycRejectionReason`, `verified`→409, employee/admin→403; audit `kyc.submit` = docType+
  status only (no storageKey). +15 tests (5 magic-byte real, 10 endpoint w/ storage mocked) →
  **75/75 green, lint clean.** Gotcha: run `vitest --no-file-parallelism` (parallel connects flake
  on localhost DB). Next: 4c (verify-guard reconcile #3 + tick expose) → 4d (KYC signed-URL view).
- **2026-07-28** — **M1-F bug-check.** No functional bug found. One audit-integrity hardening:
  `setEmployeePermissions` now snapshots `before.permissions` as a **plain array copy**
  (`[...(user.permissions ?? [])]`) instead of the live MongooseArray, so the append-only audit
  record can never be touched by later mutation; +1 assertion locking the non-empty `before`.
  60/60 green, lint clean. **Test-run gotcha:** vitest runs files in parallel and the concurrent
  `mongoose.connect`s can time out against a flaky localhost DB → spurious "0 tests / import
  hang". Run `npx vitest run --no-file-parallelism` (sequential) for a reliable full-suite pass;
  DB was up the whole time (docker `mpx-mongo`/`mpx-redis`).
- **2026-07-28** — **M1 Phase 3 (M1-F · Employee permission assignment) built.**
  `PATCH /admin/employees/:id/permissions` — **hard `requireRole('superadmin')`** (never a
  grantable perm → no privilege escalation). Body validated against the `PERMISSIONS` catalogue
  (`z.enum(Object.values(PERMISSIONS))` → unknown/non-grantable e.g. `user:manage` = 400), max 50,
  de-duped; non-employee target = 404; audits `employee.permissions.update`. **Deliberate
  deviation from plan: no `tokenVersion` bump** — `authenticate` reads permissions from the DB
  each request, so a grant/revoke is live on the next call without forcing a re-login (A7 bumps on
  role-change/deactivation, not permission edits); a test proves it's live on the same token.
  +7 tests → **60/60 green, lint clean.** Phase 4–5 (KYC upload/view + real OTP) remain blocked on
  the Cloudinary-approach + OTP-provider decisions.
- **2026-07-28** — **Added `.claude/rules/m3-seo.md`** (auto-loads on slug/sitemap/robots/
  JSON-LD/SEO files + public product/seller/category/search pages + Product/Category/Organisation
  models). Codifies `m3-seo-rules.md`: slug-based readable URLs (unique/immutable/indexed, 301 on
  change, no raw ObjectIds), on-page meta/canonical/OG + JSON-LD (city-level address only),
  noindex+canonical on search/filtered URLs, active-only dynamic sitemap + robots, 404/410/301 on
  deactivate. Cross-refs `m3-public-projection.md` — never emit private fields in HTML/meta/
  JSON-LD/sitemap. SSR/prerender kept deferred (React SPA). Wired into CLAUDE.md + §8. Why:
  SEO for public discovery without leaking private data or indexing non-active entities.
- **2026-07-28** — **M1-E bug-check fix:** user-list pagination made stable — `$sort` now
  `{ createdAt: -1, _id: -1 }` (tiebreaker prevents rows repeating/skipping across pages when
  createdAt collides). +2 tests (role/kycStatus filter works; unknown role → 400). 53/53 green.
- **2026-07-28** — **Added `.claude/rules/m3-public-projection.md`** (auto-loads on
  search/public/projection/serializer files + Product/Category/Organisation models). Codifies
  the M3 `Rules.png` / m3.md §5b–5c data-exposure spec: public routes return a **whitelist**
  projection only (new fields default PRIVATE), private fields (KYC/contact/address/takedown/
  internal IDs) never serialised, query-level exclusion of non-active/deactivated-category rows,
  and B7 (kycStatus = tick only, never a filter). Includes a 🔴 STOP-and-alert list for any
  change that widens the public surface. Wired into CLAUDE.md §Detailed rules. Why: prevents
  accidental leak of moderation/ownership/KYC data to guests on public discovery routes.
- **2026-07-28** — **M1 Phase 2 (M1-E · User management) built.** New `GET /admin/users`
  (list+search: aggregation join to org for `kycStatus`, curated projection — no passwordHash/
  permissions, pageSize hard-capped ≤100, `q` regex-escaped anchored prefix → no ReDoS/injection)
  + `GET /admin/users/:id`; both `requirePermissions('user:read')`. `POST /admin/users/:id/
  activate|deactivate` — **hard `requireRole('admin','superadmin')`** (not grantable); deactivate
  flips `User.isActive` + bumps `tokenVersion` (kills sessions/login), audits `user.activate|
  deactivate`. Role guards: no self-change, superadmin untouchable, only superadmin acts on an
  admin. Uses `updateOne` (avoids required-`passwordHash` save trap). Files: `admin.routes.js`,
  `admin.controller.js`, `userManagement.service.js`, `admin.validators.js`; `USER_READ` added to
  `permissions.js`. +13 tests → **51/51 green, lint clean.** Tracker A6/A7. Phase 3 (M1-F
  permission-assign) next; Phase 4–5 await Cloudinary + OTP-provider decisions.
- **2026-07-28** — **Recorded a production-gate reminder** in `docs/Note.md` close checklist:
  KYC docs on Cloudinary must be uploaded `type: authenticated` (not default public `upload`)
  with a randomised `public_id`, else `storageKey` + signed URLs give only cosmetic protection
  and KYC files are world-readable. Surfaced from the M1 Phase-1 storageKey review; must be
  verified in M1-B and before production.
- **2026-07-27** — **M1 Phase 1 (M1-A · KYC data model) built.** `enums.js`: added
  `KYC_DOC_TYPE` + `KYC_DOCS_BY_ENTITY` (business→registration/gst/certificate; individual→
  pan/aadhaar/passport; +other). `Organisation.kycDocuments` sub-doc refactored `url`→
  **`storageKey`** (Cloudinary public_id, private — never a public URL) + `docType` (enum,
  required) + `format` + `uploadedAt` default; kept `select:false` (A7/E3). Added
  `kycSubmittedAt`. New `tests/organisation.model.test.js` (4). **38/38 green, lint clean.**
  fix #4 reconciled: `entityType` stays at signup (already shipped); M1-B upload will validate
  docTypes against it. Phases 2–3 (user-mgmt, permission-assign) unblocked next; 4–5 await the
  Cloudinary + OTP-provider decisions.
- **2026-07-27** — **Auth gaps closed vs M1 plan.** Added: signup audit (`auth.signup`) +
  refresh-reuse/theft audit (`auth.refresh.reuse`) [M1-H residual done]; `POST /auth/resend-otp`
  (resend via loginToken, no password); **exporter signup extra fields** — `entityType`
  (business/individual, **required**) + structured `address` now captured at signup and stored on
  `Organisation` (owner decision — overrides M1-A's "entityType at KYC-upload"; buyer signup
  unchanged). Login stays a single shared endpoint (role-detect after OTP); signup is per-role.
  Still open: real OTP delivery (M1-I, provider decision). +4 tests → **34/34 green**, lint+boot clean.
- **2026-07-27** — **Review + fix pass on `build-plans/m1/backend-plan.md`** (plan doc only, no
  code): found + fixed 10 plan issues — #1 user-mgmt mutations hard role-gated (dropped grantable
  `user:manage`, escalation risk); #2 deactivation acts on `User.isActive`+`tokenVersion` (org
  flag unenforced in auth); #3 review guard tightened to `submitted`; #4 `entityType` at KYC
  upload not signup; #5 mustChangePassword gate unbypassable; #6 search `q` regex-escaped;
  #7 public `/exporters/:id` constrains `type` + 404s deactivated; #8 resubmit clears rejection
  reason; #9 rate-limit KYC upload; #10 audit snapshot = docType+count. Reconciled plan with
  code already shipped by the bug-fix pass: **M1-G + M1-H marked DONE**; fix #5 satisfied
  (gate folded into `authorize`, unbypassable via boot route-guard — equivalent to plan's
  approach). **Only fix #3 left open** (verification shipped as `pending`|`submitted`; whether to
  tighten exporter verify to `submitted`-only once KYC upload lands = §3.6 owner decision).
- **2026-07-27** — **Fixed all actionable auth bugs** from `Bug.supporter.md` (BUG-1…9): durable
  OTP lock; `trust proxy` (env `TRUST_PROXY`); login by mobile digits; active-only
  reset/forgot; `mustChangePassword` enforced via authorize + new `POST /auth/change-password`;
  auth-event audit logging (login/employee-create/reset/change); refresh validates active user
  before issuing (no orphan token); `X-Request-Id` trusted only behind a proxy; verification
  accepts `pending`/`submitted`. BUG-10 (no tokenVersion bump on reuse) + BUG-11 (enumeration)
  left per decision/inherent. +6 regression tests → **30/30 green**, lint clean, boots.
- **2026-07-27** — Auth backend bug review → **`Bug.supporter.md`** (root). 11 findings, **0
  critical/high**; 2 medium (BUG-1 OTP attempt-lock resets on every new OTP request; BUG-2 no
  `trust proxy` → prod rate-limit/IP wrong), rest low/info. Several (mustChangePassword, auth
  audit, resubmit, OTP delivery) already planned in `build-plans/m1/backend-plan.md`. 24/24
  tests green. Not yet fixed.
- **2026-07-27** — Wrote **`build-plans/m1/backend-plan.md`** — full M1 (Identity & Access)
  backend build plan, broken into 9 sub-modules (A KYC model · B upload · C review-align +
  resubmit + tick · D KYC view · E user mgmt · F permission-assign · G mustChangePassword ·
  H auth audit · I OTP delivery). All confirmed Phase-1 scope (no red-alerts). Key decisions
  parked for owner: Cloudinary upload approach (signed-direct vs server multipart → new deps),
  OTP provider, user-mgmt permission granularity. Documented behaviour changes: verify/reject
  guard `pending`→`submitted`, `kycDocuments.url`→`storageKey`. No code written yet.
- **2026-07-27** — Added the **month-1 / first-draft scope boundary**: new ledger
  `docs/month1-not-doing.md` (Bucket A = Phase-1-but-after-month-1: Quotation/Module 4,
  employee-only pieces of Module 6, Notifications/Module 8; Bucket B = Phase 2 + the 12
  skeleton models to never touch) and a HIGH-PRIORITY STRICT rule `.claude/rules/scope-guard.md`
  (always loaded): before writing ANY code, if a task is out of `scope-of-work.md` OR hits
  Bucket A/B OR a `Note.md` D-item → STOP, 🔴 RED ALERT naming the exact item+bucket, explicit
  owner confirmation required. Works alongside `remind.md` (cross-referenced both ways).
  Ticket/query handling flagged **DECISION PENDING** (deferred until owner decides). No code
  changed — guard + ledger only.
- **2026-07-26** — Scaffolded the **web frontend** at `web/` (Vite 5 + React 18 + Tailwind 3,
  ESM). Structure only, no logic: `src/{api,components,layouts,pages/{auth,buyer,exporter,
  employee,admin},hooks,context,utils,config}`. Central axios `apiClient` (baseURL from
  `VITE_API_BASE_URL`, `withCredentials`, interceptors TODO), placeholder `endpoints.js`.
  Router = public/protected split with `ProtectedRoute` (UX-only gate, no auth logic yet) and
  one `Placeholder` route each side. **Colour tokens defined in `tailwind.config.js` theme**
  (primary/ink/surface + semantic success/warning/danger/muted — starter values, confirm brand
  with owner). Vite **dev proxy** `/api` → backend `:3000` with prefix-strip (backend mounts at
  root, no `/api` prefix). `.env.example` (VITE_API_BASE_URL only), own `.gitignore`
  (node_modules/.env/dist). No component library, no Redux (Context only) per instruction.
  `npm install` + `npm run build` both pass. Deps: react, react-dom, react-router-dom, axios,
  vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer.
- **2026-07-26** — Added STRICT rule `.claude/rules/web-ui-notes.md` + seeded ledger
  `docs/UiWebNotes.md`: **every** rendered web button/link/form/control not yet wired to real
  behaviour must be logged (path, label, expected behaviour, status) in the same change, and
  shown as `disabled`/"coming soon" so nothing silently no-ops. Update Status→Done when wired.
- **2026-07-26** — Added two web rules: `.claude/rules/web-frontend.md` (React web coding
  standards — client-never-decides/A5, access token in memory + refresh in httpOnly cookie/A2,
  `dangerouslySetInnerHTML` banned + DOMPurify, no secrets/OpenAI key in bundle, central API
  client + TanStack Query, deliberate state mgmt with server-vs-client split, money never as
  float, Socket.io handshake auth, always-production-grade clean-code) and
  `.claude/rules/web-design.md` (Tailwind-token design system, shared primitives, responsive
  desktop/tablet/mobile, WCAG AA, SEO/SSR for public pages, verified-tick-not-badge, designed
  loading/empty/error states). No web frontend code exists yet — these guide it when built.
  New web-specific XSS control has no tracker ID yet (flag to owner to record).
- **2026-07-26** — `.env` now **tracked** in git at owner's request (values are test-only:
  throwaway Atlas, dev JWT secrets, dev admin password). Standing rule added: **alert before
  every commit/push that includes `.env`**; untrack + rotate the moment it holds a real secret.
- **2026-07-26** — History.md created; git repo initialised at root; `history-log.md` rule
  added (update this file every step). Superadmin seeded on the test Atlas; OTP-terminal login
  verified for all roles incl. superadmin. Startup route-guard (A5) added. `.env` deliberately
  excluded from git (secrets).
