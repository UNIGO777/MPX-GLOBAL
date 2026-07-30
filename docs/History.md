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
4. **Super Admin 2FA** — TOTP **on hold**; the superadmin logs in via **OTP** for now.
5. **Notifications** (incl. WhatsApp) — **on hold**; nothing sent on any event yet.
6. **OTP delivery** — no provider yet; OTP **printed to terminal in dev only** (prod-safe gated).
7. **Admin access** — superadmin = all-access; employees need explicit permissions.
8. **Roles = 4** (`buyer · exporter · employee · superadmin`) — **no `admin` role**; removed
   2026-07-28 as unreachable. Governance = hard superadmin gate, never a grantable permission.

## 6. Guards / deferred / on-hold  (`docs/Note.md` + `.claude/rules/remind.md`)
- 🔴 **D3** buyer activation gate — OFF; do not build without override.
- ❌ **D2** seller hard verify-before-sell gate — dropped.
- 🧭 **D1** unverified-seller 3-product limit — confirmed scope; enforce when catalogue module is built.
- ⏸ **D4** superadmin TOTP 2FA — restore before close. **D5** notifications+WhatsApp.
- ⏸ **D6** seller "request unblock" for a taken-down product — build ~2026-08-28, not month 1.
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
- **2026-07-30** — **`memberSince` → year only; `entityType` made public (closes the business-type
  cancellation properly).** *(1)* `memberSince` moved from `PUBLIC_FIELDS` (raw `createdAt` → full
  ISO timestamp) to `PUBLIC_DERIVED` as **`createdAt.getFullYear()`** — the UI shows "member since
  2024", so a public field should carry the minimum the interface needs and not the exact signup
  second. Test now asserts the year **and** that the full ISO string is not recoverable from the
  response. *(2)* **`entityType` (`business` | `individual`) added to the public surface.** The
  business-type cancellation rested on "`entityType` covers the purpose" — but `entityType` was not
  in the public key set, so the public seller page said **nothing** about whether a seller was a
  registered business or an individual: the gap had **moved, not closed**. It is a trust signal that
  sits next to the verified tick and reveals nothing about *which* KYC documents were filed.
  Whitelisted in `m3.md` §5b.1 + §7 and `.claude/rules/m3-public-projection.md` **in the same pass**
  as the code (the `establishedYear` lesson), + a new test covering both `business` and `individual`
  and re-asserting no `kycStatus`/`kycDocuments` leak. **§A22.5 + m1.md §5b.5 now record that
  `entityType` is what closed the cancellation**, so a later reader cannot mistake the cancellation
  for having left a hole. **Noted consequence:** `entityType` is now both publicly visible **and**
  locked after verification (A22.1) — a stronger rule, not a coincidence: a public trust signal
  checked against the KYC documents must not change quietly afterwards. Public key set is now
  `country, description, entityType, establishedYear, id, logo, memberSince, name, slug, verified,
  verifiedAt`. **112/112 green, lint clean.**
- **2026-07-30** — **§A22 trimmed to 2 fields + the public seller projection moved to the A3
  pattern (first real code on the public surface).** *(1) Cancelled:* **"business type" and seller
  "working/main categories" are DROPPED** — removed, not deferred; `entityType` covers the purpose.
  Cut from 11 files (build-prompt §A22 + Part C + Part E, m1.md §1/§5b/§7/§8/§9/§10, m3.md §5b.1
  table + §7, m3-public-projection.md, Note.md S1, remind.md, M3 memo P2/U2, BRAIN, **m5.md +
  m5-features.md** — the m5 superadmin seller-detail screens listed "working categories" too).
  m1.md §10's open items #4/#5 are now struck through as **CLOSED by removal, not definition**.
  ⇒ **A22 needs NO new model fields**: `name`/`country`/`address`/`entityType`/`logo`/`description`
  all already exist on `Organisation`; the remaining work is the **edit endpoint + lock enforcement
  + verified→submitted demotion**, none of it schema. *(2) `website` is NOT public* — it is for our
  own verification use; removed from the response and recorded as **internal** in m3.md §5b.2 +
  the projection rule (with "do not add it back because it looks harmless"). *(3) `establishedYear`
  IS public* — it was already being returned but had **never** been whitelisted; now whitelisted.
  *(4) `memberSince` added* — derived from `createdAt` (timestamps), **no schema field**; a real B2B
  trust signal. Whitelisted in m3.md + the rule **in the same pass** as the code, deliberately not
  repeating the `establishedYear` mistake. **CODE (A3):** `publicView()`'s hand-rolled object
  literal is gone. New `src/utils/toPublic.js` = the **one** shared whitelist serialiser (supports
  dotted source paths + renamed output keys + derived values, Mongoose-doc or lean);
  `Organisation.js` now exports **`PUBLIC_FIELDS` + `PUBLIC_DERIVED`** (the surface declared on the
  model, per A3); `exporters.controller.js` just calls `toPublic()`. `verified` stays a computed
  boolean and `verifiedAt` stays nulled unless verified — **raw `kycStatus` still never exposed**
  (B7). Public key set is now `country, description, establishedYear, id, logo, memberSince, name,
  slug, verified, verifiedAt`. **Tests: 111/111 green** (108 → +3: exact-whitelist assertion
  updated, plus new tests that `website` never ships and that `memberSince` matches `createdAt`),
  **lint clean.** *(5) Product count — deliberately NOT built:* whitelisted but blocked on M2
  (`Product` is a 2-field stub with generic `orgId`, no `exporterOrgId` per §A2 and no `status`, so
  "active only" isn't expressible). Drift marker kept in m3.md §5b.1 + the rule, and a new
  **`M2.md` §9b** records the exact unblock condition and the count query to use — with an explicit
  "no placeholder second query on the profile read". **Gotcha:** A21 owns `exporters.service.js`
  (its Step 4b/5 may return to it), so this change stayed in the **controller + model + a new
  util** and left that service untouched — deliberate, to avoid a two-writer collision.
- **2026-07-30** — **A21 CODE — Step 3 patch + Step 4a (OTP on signup).** *Patch:* +6 tests
  locking the HAS-a-side behaviour (both-sides org found by both reviews; wrong-side → 404; public
  `/exporters/:id` side-based 200/404; public response never leaks buyerSide/exporterSide/kycStatus;
  migration logic tested — `migrate-a21-org-sides.mjs` refactored to export `migrateOrgSides(db)`,
  CLI-guarded). *4a:* self-signup now **issues an OTP by reusing the login mechanism** (`requestOtp`
  + `signLoginToken`, purpose `login` — no second OTP system) and returns `{user, loginToken,
  method}` — **no access/refresh session**; the caller exchanges it at `/auth/verify-otp`
  (token-identified, no portal). `verify-otp`/`resend-otp` unchanged; signup keeps `authLimiter`
  (no `otpLimiter` touch). No split, no claim, no KYC/Phase-2/M2-M3 change. **otpLimiter finding
  (reported, NOT changed):** `/auth/login` + `/auth/forgot-password` key on the identifier without
  the portal, so a buyer + exporter on the SAME email **share** one 5/10-min OTP-request budget;
  the per-userId OTP *challenge* lock is already separate. Proposed (awaiting owner) to add the
  portal to that key. **108/108 green, lint clean.** Step 4b (split + claim) NOT started.
- **2026-07-30** — **A21 CODE — Step 3 done (Organisation side flags + `type` cleanup).**
  `ORG_TYPE=['business','platform']` (buyer/exporter removed from `type`); added
  `buyerSide`/`exporterSide` (Boolean, `default:false`, indexed) as the discriminators, + compound
  index `{exporterSide:1, isActive:1}` for the M3 public-seller read (C2). Signup writes
  `type:'business'`+side; verification.service reviews by **HAS-a-side** (`{_id,[sideFlag]:true}`);
  public exporter read → `{_id, exporterSide:true, isActive:true}` (isActive unchanged; response
  still only `verified`+`verifiedAt`, never raw `kycStatus` — B7). **DECISION 2 (accepted, NOT a
  bug):** both sides share ONE `kycStatus` — first review verifies the whole company; a later
  claimed side inherits the tick with no separate review. One company = one Organisation, one
  tick; do **not** add per-side verification/second kycStatus/per-side flag (comment placed at
  the verification.service.js site). **API-contract break:** verification-review, `/admin/users`,
  and `/employee/orgs/:id/kyc/documents` responses dropped `type` → now return
  `buyerSide`+`exporterSide` (logged in `docs/UiWebNotes.md`). **C1:** `mobile.e164` is
  `required:true` and set on every path (signup/employee/seed) → no null-collision, no
  partialFilterExpression needed. **C3:** `.trim()` added to `assertIdentityAvailable`;
  `identifierQuery` already trimmed. **MIGRATIONS run against Atlas** (test cluster, 2 users):
  `migrate-a21-org-sides.mjs` (0 modified — only the platform org exists) then
  `migrate-a21-user-indexes.mjs` (dropped `email_1`+`mobile.e164_1`, created the compound pair;
  Atlas users now show only compound uniques). **Both scripts (`scripts/migrate-a21-*.mjs`) MUST
  be re-run per environment before deploy — `autoIndex` never drops indexes and the app runs no
  `syncIndexes` at startup.** Test ripple: all org-creating test helpers → `type:'business'`+side.
  **101/101 green, lint clean.** Tracker A1/A5/A6/A7. Step 4 (two-step signup+claim) NOT started.
- **2026-07-30** — **CLAUDE.md: added an "Auth shape" section + a standing "When a decision
  changes" note.** Auth shape (index-depth only, pointing at §A21/§A22): 4 roles, no `admin` —
  **`/admin/*` is a route namespace, not a role** (verified: those routes are guarded per-endpoint,
  some `requireRole('superadmin')`, some by a granted employee permission, so employees do reach
  some of them); buyer/exporter = separate accounts on separate portals; `/auth/login` carries
  `portal`, staff on `/auth/staff/login`; signup = two steps with OTP between, then claim-or-create
  Organisation; one company = one Organisation, a claimed one carries its verification over;
  both sides can edit their own company profile (§A22) and KYC-checked fields lock once verified.
  **Why now, not later:** A21 is mid-build (steps 1–2 shipped) — CLAUDE.md's generic signup
  description was merely *silent* today and becomes *actively wrong* the moment step 4 lands.
  **Standing note added** (CLAUDE.md "When a decision changes", mirrored into
  `.claude/rules/history-log.md`): a decision change is not done when the plan doc is updated —
  it is done when CLAUDE.md and `.claude/rules/` have been checked in the **same pass**, because
  they are read first and outrank plan docs. Recorded because it has now cost us twice (the raw
  `kycStatus` line; buyer approval described as a D3-guarded gate).
- **2026-07-30** — **CLAUDE.md corrected — it contradicted the current decision set in four
  places, and it is read FIRST by every session, so it outranked the files we had just fixed.**
  (1) 🔴 **The tick:** "expose kycStatus instead so the frontend can show the tick" → **never expose
  raw `kycStatus`; return a derived `verified` boolean + `verifiedAt`**, never `rejected`, never a
  rejection reason; no "not verified" badge (absence of tick = unverified). This one was live-fire —
  the always-first instruction told every session to leak the exact field B7 / `m3-public-projection.md`
  / m1.md §5 forbid. (2) **Buyer gate:** "A buyer's account is then approved by an Employee" read as
  a gate → buyer is **fully active from signup**, approval is a recorded status only, and any
  activation gate is **D3-guarded**. (3) **Ownership rule 1:** the literal `orgId: req.user.orgId`
  pattern contradicted §A2 (`Product.exporterOrgId`, `SavedItem.buyerOrgId`) and missed that
  `Organisation` is the tenant root (`findOne({ _id: req.user.orgId })`) — field name is per-model,
  scoping is never optional, org always from the token. (4) **Framing:** "sits in the path of
  escrowed importer funds" with no phase qualifier → escrow/payouts/contracts are **Phase 2, not
  being built**; Phase 1 = discovery + trust, no money moves. Also fixed the rules index, which
  claimed all rules load "when you work on matching files" and omitted five: `scope-guard.md`,
  `remind.md`, `secrets-and-hygiene.md`, `history-log.md` (all always-loaded) and the three
  `web-*` rules. **Gotcha worth keeping:** correcting a plan doc is not enough — CLAUDE.md and
  `.claude/rules/` outrank plan docs at read time, so a decision change has to be chased into them
  or the stale instruction wins.
- **2026-07-30** — **§A22 added (docs only, no code): company profile = Organisation view/edit.**
  A gap that was never planned anywhere — neither buyer nor exporter had any way to see or edit
  their own `Organisation` after signup, and **four fields M3's public seller page depends on had no
  capture path at all**: `logo` + `description` (on the model, no endpoint sets them) and **business
  type** + **working categories** (don't exist). Built as-is the public seller page would render
  with just a name and a country. A22 scopes it as **M1 work**: exporter page (full set + a
  public-page preview through the shared `toPublic()` projection) and a smaller buyer one
  (name/country/address/`entityType` — buyer has no public page, but buyer KYC is optional and the
  company details must live somewhere). **Field lock is the point:** once verified, the KYC-checked
  fields (name, country, address, `entityType`) lock — otherwise a seller verifies as "TextileHub
  Exports", gets the tick, renames, and the tick sits on an unchecked company (liability). Renaming
  is still **allowed**, it just drops `kycStatus` → `submitted` via the **existing resubmit path**
  (no new mechanism; `verified` is derived, so the tick withholds itself) + AuditLog. Recorded too:
  a **buyer's company name is not private** (M4 seller-side chat titles = "product × buyer company",
  composed at read time → a rename retitles old threads), so the lock applies to buyers as well; and
  `Organisation.slug` is immutable (A6) so a rename does **not** change `/supplier/:slug`.
  Propagated: build-prompt (A22 + A21 cross-ref + Part C "prerequisite gap" flipped from *not
  scoped, do not design* → scoped, + Part E), `m1.md` (§1 four areas → **five**, new **§5b**, §7
  screen table rows for buyer + exporter, §8, §9, §10 open items), `m3.md` / M3 memo (U2) / BRAIN
  (their "PENDING — do NOT design" blocks were now actively wrong), `Note.md` S1 + `remind.md`
  (two new M1 screens to alert on), `m3-public-projection.md` (capture-path warning).
  🔴 **Left open on purpose — "business type" has never been defined and is NOT `entityType`**;
  also open: working categories' shape, whether `website`/`businessProfile`/`authorisedSignatory`
  appear on the screen, `verifiedAt`/`verifiedBy`/`kycSubmittedAt` handling on demotion, the
  `registrationNumber + country` unique index vs a country change, and staff-side org editing.
- **2026-07-30** — **A21 CODE build — Steps 1 & 2 done (of 6); FIRST and ALONE (no M2/M3).**
  **Step 1 (Uniqueness):** User email/mobile are now **compound-unique with role** —
  `(email, role)` + `(mobile.e164, role)` indexes (global-unique dropped); `assertIdentityAvailable`
  in `auth.service` lets one email/mobile hold a buyer **and** an exporter (never two same-role) and
  keeps **staff exclusive both ways**, enforced at signup + employee-create. **Step 2 (Login):**
  `/auth/login` now takes a required `portal` (buyer/exporter, role-scoped lookup); new
  `/auth/staff/login` (role-detect, own `staffOtpLimiter`); same split for forgot/reset
  (`/auth/staff/forgot-password`, `/auth/staff/reset-password`); `verify-otp`/`resend-otp` unchanged
  (token-identified); wrong portal → generic "Invalid credentials" (no oracle). Existing buyer-login
  tests updated to `portal:'buyer'`, superadmin login test → `/auth/staff/login`. +9 tests
  (`a21-uniqueness`, `a21-login-portal`) → **101/101 green, lint clean.** Tracker A1/A5/A7.
  **PAUSED at the Step-3 gate** (reported every `Organisation.type` read; awaiting go-ahead to make
  `type=['business','platform']` + `buyerSide`/`exporterSide` flags). Steps 4 (two-step signup+claim),
  5 (org block) still to build.
- **2026-07-30** — **DOC-ONLY: repo-wide phantom-filename sweep.** Redirected **every** reference
  to the five phantom M2/M3 doc names to their actual repo paths, in one pass: Search-prompt →
  `…/Search.md`, SEO-rules → `…/m3-seo-rules.md`, Discovery-Full → `…/m3.md`, SavedItem-Model →
  `…/Saved-item.md`, Catalogue-Full → the three M2 files (`M2.md`+`Models.md`+`Category.md`). Full
  repo paths used from `docs/` (cross-directory); bare sibling names inside `m3.md`. The
  AI-search system-prompt pointer (Part B depends on it) now correctly resolves to
  `…/m3-search-filter-3-4days-max/Search.md` §11. Files changed: `MPX-Module3-COMPLETE-MEMO.md`,
  `MPX-COMPLETE-BRAIN.md`, `m3.md`, `MPX-M2-M3-Build-Prompt.md` (its 3 prior bare refs upgraded to
  full paths). Repo-wide grep for the five names now returns nothing. **Still phantom (unlisted,
  NOT fixed — no owner mapping):** the BRAIN "PART 9 — ALL FILES PRODUCED" historical manifest +
  a few demo refs — `MPX-HANDOFF`, `MPX-Module1-Identity-Access`, `MPX-Category-Tree` /
  `-Model-Schema` / `-Form-Fields`, `MPX-Phase1-Month1-Backend-SOW`, `MPX-Month1-Backend-KARNA-HAI`
  / `-NAHI-KARNA` / `-Modules`, and `MPX-Discovery-UI` / `MPX-Search-Demo` HTML demos.
- **2026-07-30** — **DOC-ONLY: fixed build-prompt "Document versions" — it had it backwards.**
  The section called the `modules-in-detailed/` files "reference only, never a source of truth"
  while they are in fact the **only maintained plan** (all corrections A16–A21 / A13 / verified /
  whitelist landed there). Rewrote to **TWO precedence levels** — (1) Part A, (2) the plan docs —
  and named level-2 docs by their **actual repo paths** (M2 split across `M2.md`+`Models.md`+
  `Category.md`; M3 = `m3.md`/`Search.md`/`Saved-item.md`/`m3-seo-rules.md` + `MPX-Module3-COMPLETE-MEMO.md`
  + `MPX-COMPLETE-BRAIN.md`), stating they are current/updated-in-place, not stale. Removed the
  3rd level + "reference only" entirely. Also fixed **3 body cross-refs** to phantom filenames
  (two SEO-rules pointers → `m3-seo-rules.md`, one AI-prompt pointer → `Search.md`). **Flagged:** the
  same phantom names still appear in MEMO/BRAIN/m3.md (AI-prompt / SEO pointers) — fixed in the next entry.
- **2026-07-28** — **DOC-ONLY: scrubbed + renamed the two load-bearing M3 docs; reported
  build-prompt version.** (a) **Renamed** `MPX-Module3-COMPLETE-MEMO (1).md` → `…-MEMO.md` and
  `MPX-COMPLETE-BRAIN (1).md` → `MPX-COMPLETE-BRAIN.md` (git mv) so they match the build-prompt's
  level-2 "current documents" names. (b) **Applied corrections 1/2/3** to both: correction 1
  (buyer-only `buyerOrgId`) was **already correct** in both; correction 2 (public `verified`
  boolean, never raw `kycStatus`) applied to MEMO L6 + BRAIN 6.8/6.10/§B7; correction 3 (`slug`
  on Product+Seller, `image` on Category) added to BRAIN 6.10 + MEMO L8. Also fixed a **duplicate
  L8 + a stale "buying is open to all"** in MEMO, and two more **"buying is open"** leftovers in
  Search.md/m3.md (search = public page, never a buying flow). (c) **CORRECTION to prior claim:**
  MEMO + BRAIN are **level-2 CURRENT / load-bearing** (they hold the Atlas-Search lock, full
  ranking order, and the AI system prompt that Part B depends on) — NOT "reference-only"; the
  level-3 "reference only" tag applies to the `modules-in-detailed/` copies. (d) **Build-prompt
  version finding:** the repo copy **has A16–A21** at level 1, but uses the **3-level** precedence
  wording (owner says current is 2-level), and **5 of its 7 listed "current documents" are MISSING
  from the repo** (only MEMO + BRAIN existed, under `(1)` names now fixed). Flagged for the owner.
- **2026-07-28** — **DOC-ONLY: three cross-module doc corrections** (no code). (1) **A13 reversed
  to buyer-only** — `SavedItem.buyerOrgId` (not `orgId`), unique `(buyerOrgId,targetType,targetId)`,
  only a buyer account saves; under A21 an exporter buys from a separate buyer account. Fixed in
  build-prompt A13 + A2, m3.md (§A13 override + saved endpoints), Saved-item.md (broken
  "orgId not orgId" override + §1/§2/§4), Search.md, M2 Models.md. (2) **Public seller projection
  = `verified` boolean, not raw `kycStatus`** (code is correct; docs were wrong — would have made
  `seller.kycStatus==='verified'` undefined and the tick never render). Fixed m3.md (B7 + 5b.1/5c.1
  + inline), Search.md §6, m3-public-projection.md, m1.md §5/§8; B7 *rule* unchanged (verification
  never filters). Noted `verifiedAt` is already returned by M1's `/exporters/:id`. (3) **Whitelist
  gaps added** (owner-authorised): `slug` on Product + Seller public projections, `image` on
  Category — in m3.md + m3-public-projection.md (needed for cards to render/link; A3 makes new
  fields private by default). ~~Left memo/brain stale as "reference-only"~~ — **corrected in the
  next entry: they are level-2 CURRENT (load-bearing), not reference-only.**
- **2026-07-28** — **DOC-ONLY: recorded decision A21 (dual accounts, two-step signup,
  Organisation claim)** — reverses the old "one shared login for all four roles". Buyer & exporter
  = separate accounts on separate portals (`/auth/login` + `portal`; staff on `/auth/staff/login`);
  same email/mobile may hold one buyer + one exporter (never two same-role, independent creds/OTP
  locks); signup = shared step-1 → OTP → step-2 Organisation claim-or-create; `Organisation.type`
  can no longer be the single buyer/exporter discriminator; admin block acts on the Organisation
  (both sides). Also corrected the M3 line that implied exporters can buy (search = public page,
  never a permission). Files touched (no code): `docs/MPX-M2-M3-Build-Prompt.md` (added §A21 +
  fixed A13 search/buy line), `modules-in-detailed/m1-max-1.5days/m1.md` (§3/§7/§8),
  `docs/Note.md` (S1 + confirmed-behaviour), `.claude/rules/remind.md` (S1),
  `.claude/rules/auth-sessions.md` (Accounts), `.claude/rules/mobile-app.md`. **Not yet built in
  code** — A21 implies future changes to login/signup + the Organisation model.
- **2026-07-28** — **M1 Phase 4 COMPLETE (M1-C review-align + M1-D KYC view).** Owner decisions
  locked: Cloudinary = **server multipart** (`cloudinary`+`multer`+`file-type`, upload
  `type:'private'` + randomised public_id); fix #3 = verify/approve **`submitted`-only for BOTH
  buyer & exporter** (doc-less `pending` → 409). **M1-C:** verification guard tightened
  (`verification.service.js`); resubmit = `rejected → submitted` via upload path (clears reason);
  tick expose — `GET /me/verification` (self status + doc metadata, no storageKey) and public
  `GET /exporters/:id` (curated, `verified` boolean only — never leaks raw `kycStatus`/`rejected`,
  type-constrained, deactivated→404). **M1-D:** `GET /employee/orgs/:id/kyc/documents` —
  `requirePermissions('kyc:view')`, mints short-lived signed URLs from private storageKey, records
  `kyc.view` access audit; `KYC_VIEW` added to catalogue. Existing tests updated for the
  submitted-only guard (verification + bugfixes BUG-5). +tests → **92/92 green, lint clean.**
  Only **M1-I** (real OTP delivery) remains — deferred by owner.
- **2026-07-28** — **`admin` role REMOVED — roles are now 4: `buyer · exporter · employee ·
  superadmin`.** Why: nothing ever created an `admin` user (signup → buyer/exporter, `POST
  /admin/employees` hardcodes `'employee'`, seed → superadmin), so the role was an unreachable
  branch; the quote itself names only a "Super admin dashboard" + "Employee panel", so this
  aligns the build **to** the quote — not a scope change. Code: `enums.js` ROLES (cascades to
  `User.role` + `AuditLog.actorRole`), `POST /admin/employees` and `/admin/users/:id/
  activate|deactivate` → `requireRole('superadmin')`, dropped the now-dead "only superadmin may
  modify an admin" branch in `userManagement.service.js` (self-lockout + superadmin-immunity
  guards KEPT), comment fixes. Tests: replaced the admin-hierarchy test with one asserting the
  role **cannot be assigned** (locks the decision in), self-state test now asserts the specific
  client message so it still proves the self-guard fired, permission test uses a non-staff role.
  **89/89 green, lint clean.** Behaviour change = zero (no admin user existed). URL prefix
  `/admin/*` and the `admin.*.js` filenames **kept on purpose** — that's a route namespace, not
  a role. **D4 renamed** "Admin/Super Admin TOTP" → "Super Admin TOTP". ⚠️ Stale: M1 images
  (`Flow-cart-full.png`, `Screens-web.png`) still show "Admin / Super Admin", and
  `docs/security-tracker.xlsx` control **A4** still says "Admin and Super Admin" — owner to fix.
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
