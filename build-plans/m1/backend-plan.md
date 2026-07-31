# M1 — Identity & Access · Backend Build Plan

> **Module:** Phase-1 Module 1 (Identity & Access) — auth, KYC, verification, user management.
> **Scope status:** 100% confirmed Phase-1 / month-1 scope. No Bucket-A/B or D-item red-alerts
> in this plan. (D1 = 3-product limit is enforced in the **catalogue** module, not here.)
> **Backend root:** `MPX-BACKEND-FULL-SAAS/`
> **Source of truth:** `modules-in-detailed/m1-max-1.5days/m1.md` + the four flow images.
> **Legend:** ✅ already built · 🔨 build now · 🧱 needs a decision/dependency before build.

---

## 0. Ground rules for this module (do not violate)

- Every new route: **declare a permission or `publicRoute`** (boot-time route-guard refuses
  otherwise) → **zod validation** (strict, unknown keys stripped) → **ownership/permission
  scoping** → business logic → **curated response** (never a full `User`/`Organisation` doc).
- Platform-staff reads (verification queue, user list, KYC view) are **RBAC-scoped, not
  org-owned** — fetch with `findOne({ _id, type })`, missing → **404** (never 403). This is the
  documented pattern already used in `verification.service.js`.
- **KYC values, tokens, OTPs, passwords, bank/PAN/Aadhaar never** get logged, returned, or
  written into an AuditLog snapshot.
- **AuditLog is append-only** — never update/delete. Every audit row carries the actor's
  `userId` (never just a role); `recordAudit()` already enforces this shape.
- **No secret in source.** Cloudinary / OTP-provider creds live only in `.env` (env keys
  already scaffolded in `config/env.js`).
- **Do not touch** any Phase-2 skeleton model (`Escrow`, `Contract`, `Order`, `Shipment`,
  `PayoutAccount`, `PayoutRequest`, `Milestone`, `TrustScore`, `Investment`, `Incentive`,
  `Subscription`, `PremiumApplication`).
- Smallest change that works. No refactor of adjacent code.

---

## 1. Current state (✅ done — do not rebuild)

- **Auth core:** buyer/exporter self-signup, login → OTP → access(15m, `tokenVersion`) +
  refresh(rotate-on-use, reuse ⇒ family revoke), `/auth/me`, logout, forgot/reset-password.
  Files: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `token.service.js`,
  `otp.service.js`, `password.service.js`.
- **Employee create:** `POST /admin/employees`, hard-gated `requireRole('admin','superadmin')`;
  admin-created accounts get `mustChangePassword: true` (enforcement pending — M1-G).
- **Verification review:** `POST /employee/buyers/:id/approve|reject`,
  `POST /employee/exporters/:id/verify|reject` → flips `Organisation.kycStatus`, appends
  AuditLog. Perms `buyer:approve`, `exporter:verify`.
- **Models:** `User`, `Organisation` (has `kycStatus`, `kycDocuments` `select:false`,
  `verifiedBy/At`, `kycRejectionReason`), `AuditLog` (append-only, DB-level intended).
- **Guards:** `authenticate` (DB-sourced `req.user`, tokenVersion check), `requireRole` /
  `requirePermissions` (default-deny, superadmin all-access), boot route-guard,
  `rejectMongoOperators`, central error handler, per-part zod `validate`.

**KYC lives on `Organisation`, not `User`** — this plan extends the Organisation model. (m1.md
says "user KYC" loosely; the codebase keeps it org-level and this is correct — one KYC per
tenant. Confirmed consistent.)

---

## 2. Sub-modules (build order)

Ordering follows data dependencies: model first, then upload, then review/resubmit, then the
management surface, then the cross-cutting auth hardening.

| ID | Sub-module | Depends on | Blocked? |
|----|------------|-----------|----------|
| **M1-A** | KYC data model & entity type | — | ✅ **DONE** (Phase 1) |
| **M1-B** | KYC document upload | A | ✅ **DONE** (Phase 4b) |
| **M1-C** | Verification review alignment + resubmit + tick expose | A, B | ✅ **DONE** (Phase 4c) |
| **M1-D** | KYC document view (signed URL, reviewers) | A, B | ✅ **DONE** (Phase 4d) |
| **M1-E** | User management (list/search, activate/deactivate) | — | ✅ **DONE** (Phase 2) |
| **M1-F** | Employee permission assignment (hard superadmin-gate) | — | ✅ **DONE** (Phase 3) |
| **M1-G** | `mustChangePassword` enforcement + change-password | — | ✅ **DONE** (bug-fix pass) |
| **M1-H** | Auth-event audit (login/signup/refresh-reuse/logout/reset) | — | ✅ **DONE** (bug-fix pass) |
| **M1-I** | Real OTP delivery provider | — | 🧱 dep/decision (provider + creds) |

> **⚠️ Plan vs shipped code (2026-07-27):** a parallel bug-fix pass (`Bug.supporter.md`) already
> shipped **M1-G** and **M1-H**, and part of **M1-C** — verification review now accepts
> `pending` **or** `submitted` ([verification.service.js](../../MPX-BACKEND-FULL-SAAS/src/services/verification.service.js)),
> and the `mustChangePassword` gate lives inside `requireRole`/`requirePermissions`
> ([authorize.js](../../MPX-BACKEND-FULL-SAAS/src/middleware/authorize.js)), not folded into
> `authenticate`. See the per-section notes — fix #5 is effectively satisfied; fix #3 is now an
> open reconciliation decision (§3.6).

**Status (2026-07-28):** A·B·C·D·E·F·G·H all **DONE**. Owner decisions locked — Cloudinary =
**(b) server multipart** (deps `cloudinary`+`multer`+`file-type`, upload `type:'private'`); fix #3
= verify/approve **`submitted`-only for BOTH buyer and exporter** (no verify without docs). Only
**M1-I** (real OTP delivery) remains — deferred by owner (terminal-print dev affordance stays).

---

### M1-A · KYC data model & entity type  ✅ DONE (Phase 1, 2026-07-27)

> **Shipped:** `KYC_DOC_TYPE` + `KYC_DOCS_BY_ENTITY` enums added; `Organisation.kycDocuments`
> sub-doc refactored to `{ docType (enum, required), storageKey (required — Cloudinary
> public_id, never a public URL), format, uploadedAt (default now), verifiedAt, verifiedBy }`
> with `select:false` kept; `kycSubmittedAt` added. `entityType` + `ENTITY_TYPE` were already
> shipped by the bug-fix pass. New `tests/organisation.model.test.js` (4 tests) — 38/38 green,
> lint clean.
>
> **fix #4 reconciled:** `entityType` is captured at **exporter signup** (shipped: required in
> `exporterSignup` validator + stored by `registerExporter`, per the m1.md fields image), **not**
> at upload as the plan originally proposed. M1-B upload will **validate submitted `docType`s
> against the org's `entityType`** (via `KYC_DOCS_BY_ENTITY`) rather than set it.

**Goal:** give the KYC flow the fields it needs; fix a naming/security gap in the current
`kycDocuments` sub-doc.

**Changes — `src/models/Organisation.js`:**
- Add `entityType: { type: String, enum: ['business','individual'] }` (drives the KYC path —
  business ⇒ registration/GST/certs; individual ⇒ PAN/Aadhaar/passport). **Captured at
  KYC-upload time (M1-B), not at signup** — the KYC path is decided when docs are submitted, so
  a single source of truth avoids a signup field drifting out of sync with the actual docs. (No
  change to `exporterSignup`/`registerExporter`.) Nullable until first upload.
- `kycDocuments` sub-doc: **store the private storage reference, not a public URL.** Rename the
  `url` field to `storageKey` (Cloudinary `public_id`) + add `format`, `docType`
  (`registration|gst|certificate|pan|aadhaar|passport|other`). The current field is literally
  named `url` while the comment says "public URLs are never stored here" — close that gap so no
  public URL is ever persisted (rule A7 / tracker E3). Signed URLs are minted on read (M1-D).
- Add `kycSubmittedAt: { type: Date }` so the review queue can order by submission time.
- Add enum `ENTITY_TYPE = ['business','individual']` to `src/models/enums.js`.

**Add `KYC_DOC_TYPE` enum** to `enums.js` for the `docType` values above.

**Security/tracker:** A7 / E3 (KYC docs never public), keeps `select:false`.
**Tests:** model unit — `kycDocuments` excluded by default; included only with explicit
`.select('+kycDocuments')`.

> ⚠️ **Behaviour note:** renaming `url`→`storageKey` is safe because no KYC docs exist yet in any
> real data (feature not built). If any seed/fixture references `kycDocuments[].url`, update it.

---

### M1-B · KYC document upload  ✅ DONE (Phase 4b, 2026-07-28)

> **Decision taken:** Cloudinary approach **(b) server multipart** (owner choice). Deps added:
> `cloudinary`, `multer`, `file-type`. **Shipped:**
> - **4a infra:** `config/cloudinary.js` (lazy config + `isCloudinaryConfigured`),
>   `middleware/upload.js` (multer memory, single `document` field, 10 MB cap, typed errors),
>   `services/kyc.storage.service.js` — `verifyKycFile` (magic-byte allowlist: pdf/jpg/png/webp,
>   size cap), `uploadKycDocument` (uploads as Cloudinary **`type: 'private'`** with a
>   **randomised public_id**, returns only `storageKey`), `signedKycUrl` (expiring
>   `private_download_url`). Satisfies the Note.md production reminder (private, not public).
> - **4b endpoint:** `POST /me/kyc/documents` (authenticate + generalLimiter + multer + zod).
>   Self-write to caller's org. entityType: exporter uses signup value (mismatch → 400); buyer
>   must supply it (then set). docType validated against entity via `KYC_DOCS_BY_ENTITY`.
>   `pending|rejected → submitted`, sets `kycSubmittedAt`, **clears `kycRejectionReason`**;
>   `verified` → 409; employee/admin → 403. Audit `kyc.submit` = **docType + status only, no
>   storageKey**. Files: `kyc.validators.js`, `kyc.service.js`, `kyc.controller.js`,
>   `me.routes.js`. Tests: `kycStorage.test.js` (5, real magic-byte) + `kyc.test.js` (10, storage
>   mocked). **75/75 green, lint clean.**

**Goal:** exporter (mandatory) / buyer (optional) uploads business or personal ID docs; status
moves `pending → submitted` (and `rejected → submitted` on resubmit, see M1-C).

**Endpoint:** `POST /me/kyc/documents` (authenticated; self — writes the caller's **own** org).
- Scope: caller's org via `req.user.orgId` — this is a **self** write, not a staff action.
- **Rate-limited** — reuse `authLimiter` (or a dedicated `uploadLimiter`) so repeated uploads
  can't be used to abuse Cloudinary quota / storage. (fix #9)
- Accepts `entityType` + one or more documents (`docType` + the uploaded file/reference).
- Validation (zod): `entityType` enum; `docType` enum; per §3 upload-approach decision.
- Enforce **business ⇒ business docs**, **individual ⇒ ID doc** at the route boundary — use
  `KYC_DOCS_BY_ENTITY` (added in M1-A) to check each `docType` is valid for the entity type.
- **entityType source (confirmed Phase-1 bug check):** exporters already have `entityType` from
  signup → use it; if the request also sends one, it must **match** (else 400). **Buyers have no
  `entityType` at signup** (buyer signup doesn't capture it) → the upload **must accept and set**
  it on first submission. So: exporter = validate-against-existing; buyer = accept-and-set.
- On success: push into `org.kycDocuments`, set `entityType`, set `kycSubmittedAt`, transition
  `kycStatus: pending|rejected → submitted`, and **clear `kycRejectionReason`** (so a resubmit
  drops the stale reason — fix #8). If already `submitted`, treat as an additive re-upload
  (still `submitted`); if already `verified`, reject with 409 (nothing to resubmit).
  Append AuditLog `kyc.submit` with a **minimal safe snapshot: `docType` values + count only** —
  **no** doc contents and **no** `storageKey` (fix #10).

**Status machine:** `pending` (signup) → `submitted` (this endpoint) → `verified` / `rejected`
(M1-C) → `submitted` again (resubmit).

**Security/tracker:** B6 (file uploads — allowlist ext, MIME via magic-bytes, size cap),
A7/E3, ownership (self-write), default-deny, rate-limit (B7).

**🧱 Blocked on §3 decision** — server-side multipart upload vs signed direct-to-Cloudinary.
That decision determines the validator shape, the dependencies, and whether magic-byte MIME
checking happens on our server or is enforced via Cloudinary upload constraints.

---

### M1-C · Verification review alignment + resubmit + tick expose  🔨

**Goal:** make review act on **submitted** docs, add the resubmit loop, and expose the verified
tick.

**Change — `src/services/verification.service.js`:**
- **Shipped state (bug-fix pass):** `reviewOrg` now accepts `kycStatus` ∈ {`pending`,
  `submitted`} (was `pending`-only). It permits reviewing before the KYC-upload flow exists.
- **fix #3 — OPEN RECONCILIATION (§3.6):** once M1-B lands (upload sets `submitted`), do we
  **tighten to `submitted`-only** so nothing is verified without evidence (my recommendation for
  exporters, whose docs are mandatory), or **keep `pending`|`submitted`** so a doc-less buyer can
  still be given a trust tick directly? Exporter → should be `submitted`-only; buyer → owner call.
  Proposed: tighten **exporter** verify to `submitted`-only; leave **buyer** approve accepting
  `pending`|`submitted`. Needs owner confirmation before changing the shipped guard.
- Keep verify → `verified` (+ `verifiedBy/At`, clear rejection reason) and reject → `rejected`
  (+ reason), both already appending AuditLog. No change to the audit shape.

**Resubmit:** handled by M1-B (a `rejected` org uploading docs returns to `submitted`, which
re-enters the queue). No separate endpoint needed — the upload endpoint is the resubmit path.
Verify this is covered by a test.

**Tick expose (B7) — two pieces:**
1. **Own status (authenticated):** `GET /me/verification` → returns the caller's org
   `{ kycStatus, kycRejectionReason (only if rejected), verifiedAt, entityType, kycDocuments
   metadata (docType/uploadedAt only, no storageKey) }`. Powers the buyer/exporter "Verification
   status" + "resubmit after reject" screens. Self-scoped.
2. **Public tick:** `GET /exporters/:idOrSlug` (public) → curated public exporter profile;
   **never filter by verification** (CLAUDE.md: exporter public from signup). Marked `publicRoute`.
   - 🔴 **CORRECTED 2026-07-31 — this bullet used to say "including `kycStatus` so the frontend
     renders the tick". That is exactly the leak B7 forbids** (and precisely the stale-instruction
     class this project has been bitten by twice — see the History entries on CLAUDE.md). **What
     actually shipped, and what is correct:** the response carries a server-derived **`verified`
     boolean + `verifiedAt`** — raw `kycStatus` and any `rejected` state are **never** exposed.
   - **Shipped whitelist** (`Organisation.PUBLIC_FIELDS`/`PUBLIC_DERIVED`, serialised by the shared
     `toPublic()` — A3): `id · name · slug · country · description · logo · entityType ·
     establishedYear · memberSince (year only) · verified · verifiedAt · productCount` — no
     contacts, no address, no `website`, no KYC. Pinned by an exact-key test in `kyc.test.js`.
   - **Query constrains side + activeness (fix #7, updated by A21):**
     `findOne({ ...idOrSlug, exporterSide: true, isActive: true })` — `type: 'exporter'` no longer
     exists (A21 replaced it with the side flags). The side guard stops this public
     route from leaking a buyer/platform org via a guessed id, and `isActive` makes a
     **deactivated** org return **404**. A `rejected` exporter is still public — it simply comes
     back with **`verified: false`**, and the rejection is never disclosed (no raw status, no
     reason); only deactivated → 404.

> **Scope note:** a full public exporter *directory/search* is Module 3 (discovery). M1 ships
> only the single-profile public read above so the B7 tick requirement is honoured now; the
> **"never filter by verification, return a derived `verified` boolean"** rule (corrected
> 2026-07-31 — it previously read "expose `kycStatus`, don't gate", which was the leak itself)
> then applies to Module 3's listing when built.

**Existing tests:** `tests/verification.test.js` seeds orgs at `pending` (`makeOrg` default) and
currently passes because the shipped guard accepts `pending`. **Only if fix #3 tightens exporter
verify to `submitted`-only** must the exporter tests seed `submitted` and add a 409-on-`pending`
case — do not weaken the guard to keep old tests green. If the guard stays `pending`|`submitted`,
no test change is needed here.

**Security/tracker:** B7 (public visibility not gated), A6 (staff read by id+type → 404),
append-only audit (C10).

---

### M1-D · KYC document view (signed URL)  🔨 🧱

**Goal:** a reviewing employee/admin can view the actual uploaded docs, via short-lived signed
Cloudinary URLs — public URLs never stored or returned in bulk.

**Endpoint:** `GET /employee/orgs/:id/kyc/documents`
- **Permission:** `kyc:view` (new, grantable — a reviewer who can `exporter:verify` needs to see
  docs; superadmin all-access). See §3 permission decision.
- Fetch org by id (`findOne({ _id })`, 404 if missing) **with** `.select('+kycDocuments')`.
- **⚠️ toJSON gotcha (confirmed during Phase-1 bug check):** `baseSchema.toJSON` strips every
  `select:false` path — including `kycDocuments` — **even when explicitly selected**
  ([baseSchema.js](../../MPX-BACKEND-FULL-SAAS/src/models/baseSchema.js)). So `res.json(org)` will
  **never** emit the docs. Read `org.kycDocuments` in code (mongoose doc property, pre-serialize)
  and build a **fresh curated array** for the response — do not spread the org.
- For each doc, mint a **signed expiring** Cloudinary URL (short TTL, e.g. 60–120s) from the
  stored `storageKey` and return `{ docType, uploadedAt, signedUrl, expiresAt }`. Do not return
  `storageKey`; the signed URL is the access path.
- Append AuditLog `kyc.view` (who viewed whose docs — an access record, no doc contents).

**Security/tracker:** A7/E3 (signed expiring, never public), C10 audit, default-deny perm.
**🧱 Blocked on Cloudinary being wired (same dep as M1-B).**

---

### M1-E · User management (list/search, activate/deactivate)  ✅ DONE (Phase 2, 2026-07-28)

> **Shipped:** `GET /admin/users` (list+search, aggregation join to org for `kycStatus`, curated
> projection, pageSize hard-capped ≤100, `q` regex-escaped anchored prefix), `GET /admin/users/:id`
> (curated user + org summary) — both `requirePermissions('user:read')`.
> `POST /admin/users/:id/activate|deactivate` — `requireRole('admin','superadmin')` (hard, not
> grantable); deactivate sets `User.isActive=false` + bumps `tokenVersion` (kills sessions/login),
> audits `user.activate|deactivate`. Target-role guards: no self-change, superadmin untouchable,
> only superadmin may act on an admin. Uses `updateOne` (not `save`) to avoid the required
> `passwordHash` validation trap. New files: `routes/admin.routes.js`, `controllers/admin.controller.js`,
> `services/userManagement.service.js`, `validators/admin.validators.js`; `USER_READ` added to
> `config/permissions.js`. 13 new tests in `tests/userManagement.test.js` — **51/51 green, lint clean.**
> **Note:** `USER_READ` was added here (M1-E needs it), so M1-F only adds `KYC_VIEW`.

**Goal:** the super-admin management screens (m1.md §6). Month-1 = super admin operates these;
employee panel dashboard is deferred, so gate to staff.

**Permission model (fix #1 — split reads vs mutations):**
- **Reads** (`GET /admin/users`, `GET /admin/users/:id`) → grantable `user:read` (superadmin
  all-access). Delegable, low-risk.
- **Mutations** (activate/deactivate) → **hard `requireRole('admin','superadmin')`, NOT a
  grantable permission.** A grantable `user:manage` would let an employee holding it deactivate
  an admin — or re-activate itself — a privilege-escalation vector. State-changing user ops stay
  role-gated so no employee can ever perform them regardless of granted perms. (So `user:manage`
  is **dropped** from the catalogue; only `user:read` is added — see M1-F config note.)

**Endpoints:**
- `GET /admin/users` — list + search buyers/exporters/employees. Query params (validated):
  `role?`, `kycStatus?`, `q?`, `page`, `pageSize` (**max page size capped**).
  - **Search `q` safety (fix #6):** never build a `$regex` from raw input. Either (preferred) an
    anchored prefix match with the input **regex-escaped** (`^` + escaped `q`, case-insensitive),
    or a Mongo **text index** — so a crafted `q` cannot cause ReDoS or an unintended match.
    (`rejectMongoOperators` blocks operator *objects*, not regex meta-chars inside a string.)
  - Response = curated rows (`id, name, email, mobile.e164, role, isActive, orgId,
    org.kycStatus`), **no** `passwordHash`, no other users' `permissions`, no KYC docs.
- `GET /admin/users/:id` — one curated user + its org summary.
- `POST /admin/users/:id/activate` and `/deactivate` — flip **`User.isActive`** (this is what
  auth actually enforces). **Deactivate must set `User.isActive = false` AND bump
  `tokenVersion`** (this is what kills live sessions + blocks login — auth-sessions A7).
  - **Org flag caveat (fix #2):** `authenticate` and `login` check **only `User.isActive`**, not
    `Organisation.isActive` — so flipping only the org flag is a silent no-op that does **not**
    log the user out or block login. Therefore deactivation acts on the **User**. If a buyer/
    exporter org's flag is also flipped for display, it is cosmetic only and must never be
    relied on for access control. (Do **not** add an `Organisation.isActive` check into
    `authenticate` in M1 — that's a wider change; keep enforcement on the user.)
  - Append AuditLog `user.activate` / `user.deactivate`.

**Target-role guards (server-side, enforced in business logic):** cannot deactivate a
`superadmin`; only a `superadmin` may act on an `admin` (an `admin` may act on buyer/exporter/
employee users only). These checks run **in addition to** the route role-gate, since even an
admin must not touch another admin.

**Security/tracker:** A6/default-deny, pagination cap (B-api), tokenVersion invalidation (A7),
audit (C10). Never return full user docs.

---

### M1-F · Employee permission assignment  ✅ DONE (Phase 3, 2026-07-28)

> **Shipped:** `PATCH /admin/employees/:id/permissions` — hard `requireRole('superadmin')`.
> Body `permissions: string[]`, each **must be in the `PERMISSIONS` catalogue** (`z.enum` over
> `Object.values(PERMISSIONS)` → unknown/non-grantable values 400), max 50, de-duped. Target
> must be `role: 'employee'` else **404** (never reveal a non-employee). Audits
> `employee.permissions.update` (before/after arrays). Files touched: `admin.validators.js`,
> `userManagement.service.js` (`setEmployeePermissions`), `admin.controller.js`, `admin.routes.js`.
> +7 tests → **60/60 green, lint clean.**
>
> **⚠️ Deviation from plan (deliberate) — no `tokenVersion` bump:** the plan said bump so the
> change "takes effect next request", but `authenticate` reads `permissions` **from the DB on
> every request**, so a grant/revoke is already live on the employee's next call **without**
> re-login. auth-sessions A7 bumps `tokenVersion` on role-change/deactivation, **not** on a
> permission edit. Bumping would only force an unnecessary logout with zero enforcement benefit,
> so it is omitted. A test proves the new permission is live on the SAME token (session intact).

**Goal:** super admin edits an employee's `permissions`. **This must be a HARD role gate, never a
grantable permission flag** — otherwise an over-permissioned employee grants itself everything
(privilege escalation). m1.md §6 calls this out explicitly.

**Endpoint:** `PATCH /admin/employees/:id/permissions`
- **Gate:** `requireRole('superadmin')` — hard, not `requirePermissions`.
- Validate: `permissions: string[]`, each value must be a **member of the `PERMISSIONS`
  catalogue** (reject unknown perms — no free-text permission strings). Cap array length.
- Only applies to `role === 'employee'` targets (404 otherwise). Set `user.permissions`. **(Do
  NOT bump `tokenVersion`** — see the deviation note above; permissions are DB-sourced per request
  so the change is already live without a forced logout.) Append AuditLog
  `employee.permissions.update` (before/after permission arrays).

**Config — `src/config/permissions.js`:** add `KYC_VIEW = 'kyc:view'` (this module's new grantable
perm). `USER_READ = 'user:read'` was **already added in M1-E**. Keep `BUYER_APPROVE`, `EXPORTER_VERIFY`.
**Deliberately NOT in the catalogue** (never grantable): user **activate/deactivate** (hard
role-gate, fix #1) and permission-**assignment** itself (superadmin-only hard gate) — both are
privilege-escalation surfaces.

**Security/tracker:** privilege-escalation prevention (governance hard-gate), A5 default-deny,
tokenVersion (A7), audit (C10).

---

### M1-G · `mustChangePassword` enforcement + change-password  ✅ DONE (bug-fix pass)

> **Shipped:** `POST /auth/change-password` (authenticate-only), `authenticate` selects+exposes
> `mustChangePassword`, and the gate is folded into `requireRole`/`requirePermissions`
> ([authorize.js](../../MPX-BACKEND-FULL-SAAS/src/middleware/authorize.js)) so every privileged
> route blocks until the password is changed; `/auth/me`, `/auth/logout`, `/auth/change-password`
> stay reachable. Covered by `tests/bugfixes.test.js` (BUG-5). **fix #5 is satisfied** — because
> the boot route-guard forces a `requireRole`/`requirePermissions` on every non-public route, the
> gate is unbypassable by construction (residual: a new route mounting only `authenticate` with
> no permission guard would skip it — same shape as the existing allowlist; acceptable). The
> plan's original "fold into `authenticate`" is an equivalent alternative, **not** required.

The design below is retained for reference; no further build needed unless fix #3/§3.6 changes it.

**Goal:** admin-created employees (temp password, `mustChangePassword: true`) must set a new
password on first login before doing anything else (decision A2).

**Add endpoint:** `POST /auth/change-password` (authenticated)
- Body: `{ currentPassword, newPassword }`. Verify current password, set new hash, clear
  `mustChangePassword`, **bump `tokenVersion` + revoke all refresh tokens** (A7), same as reset.
- Distinct from forgot/reset (which is OTP-based and unauthenticated).

**Enforcement gate (fix #5 — no bypass surface):** there is **no global authenticated
middleware** in this app — every protected route mounts `authenticate` individually, so a
separately-mounted gate could be forgotten on a new route and silently bypassed. Instead, **fold
the check into `authenticate` itself**: after it builds `req.user`, if `mustChangePassword` is
true and the request path is not one of the allowlisted escapes
(`/auth/change-password`, `/auth/logout`, `/auth/me`), reject with 403 +
`code: 'password_change_required'`. Because every protected route already runs `authenticate`,
the gate is unbypassable by construction. To read the flag, add `mustChangePassword` to the
`.select(...)` in `authenticate.js` and expose it on `req.user`.

**Surface it:** include `mustChangePassword` in the `verify-otp` login response and in
`/auth/me` so the client can route to the change-password screen.

**Security/tracker:** A2 (first-login reset), A7 (tokenVersion), default-deny.
**Tests:** employee with flag can only hit change-password; after change, flag cleared, old
tokens dead, normal routes work.

---

### M1-H · Auth-event audit  ✅ DONE (bug-fix pass)

> **Shipped:** auth-event audit logging for login / employee-create / password-reset / change is
> in (per `Bug.supporter.md` fixes, 30 tests green). **Residual:** confirm `auth.refresh.reuse`
> (theft-detection) writes an audit row and that `tokenVersion` is bumped on reuse — History
> notes BUG-10 (no tokenVersion bump on reuse) was **left per decision**; revisit if that reuse
> path should also audit + hard-revoke. The reference design below stands.

**Goal:** record security-relevant auth events (m1.md build list).

**Add `recordAudit` calls (safe snapshots — no tokens/OTP/password):**
- `auth.signup` (buyer/exporter/employee create) — actor = the new user (or the admin for
  employee create), entity = User.
- `auth.login.success` — on `completeLogin`, actor = user.
- `auth.logout` — on logout.
- `auth.password.reset` — on resetPassword; `auth.password.change` — on M1-G.
- **`auth.refresh.reuse`** — the critical one: when the refresh-token rotation detects reuse and
  revokes the family (in `token.service.js`), append an audit row (actor = the token's user,
  action flags theft). Verify where the reuse path lives before wiring.

**Note:** audit for pre-auth failures (bad password / unknown user) is intentionally **omitted**
to avoid a login-oracle and log volume; only successful/again-authenticated events are recorded.
Call this out as a deliberate gap.

**Security/tracker:** append-only audit (C10), never log secrets (rule 4).

---

### M1-I · Real OTP delivery provider  🔨 🧱

**Goal:** replace the dev terminal print in `otp.sender.js` with a real SMS/email/WhatsApp
provider (OTP delivery is explicitly **in scope** — only the broader notification layer, D5, is
deferred).

**Current:** `sendOtp` hard-gates the terminal print to non-production and warns in production.
**Build:** wire the chosen provider inside the `production` branch; keep the dev print. **Never
log or return the code.** Provider creds → `.env` only (add env keys, mark required once wired).

**🧱 Blocked on §3 decision** — which provider (SMS: MSG91/Twilio; email: SES/Resend; WhatsApp is
D5-deferred) and the account/credentials. No provider account = cannot complete; ship the
integration seam and leave production delivery as the last wire-up.

---

## 3. Decisions to confirm before B / D / E / F / I (owner input needed)

1. **Cloudinary upload approach (blocks M1-B, M1-D):**
   - **(a) Signed direct-to-Cloudinary (recommended):** backend mints a signed upload signature;
     client uploads the file straight to Cloudinary; client returns the `public_id`; backend
     stores `storageKey`. **Keeps files off our server** (api-endpoints B6 prefers this). MIME/
     size limits enforced via Cloudinary upload constraints, not our magic-byte check.
     **New dependency:** `cloudinary` (official SDK) only.
   - **(b) Server-side multipart:** client uploads to us; we magic-byte-verify (`file-type`),
     size-cap, then push to Cloudinary. Full B6 control on our server. **New dependencies:**
     `cloudinary` + `multer` (or `busboy`) + `file-type`.
   - Either way this is a **new-dependency decision** (CLAUDE.md rule) — need your OK on which.

2. **Permission granularity for user management (M1-E):** ~~open~~ **RESOLVED (fix #1):** reads
   grantable (`user:read`, `kyc:view`); state-changing user ops (activate/deactivate) + permission
   -assignment stay **hard role-gated, never grantable** — closing the privilege-escalation path.
   No owner input needed unless you want employees to eventually deactivate users too.

3. **OTP provider (M1-I):** which channel/provider and do we have an account? Until then M1-I
   ships as a seam only.

4. **Buyer KYC (m1.md open Q1):** confirm buyer verification is **optional** (trust tick only).
   Plan assumes yes.

5. **Client sign-off (m1.md open Q3):** buyer full-access (no approval gate) + exporter
   3-product-trial-then-mandatory-verify deviates from the quote. Written confirmation from
   Girish recommended (not a blocker for backend build, but a documented deviation).

6. **Verification guard reconciliation (fix #3):** ~~open~~ **RESOLVED (2026-07-28, owner):**
   verify/approve requires `kycStatus === 'submitted'` for **BOTH buyer and exporter** — a
   doc-less (`pending`) org returns **409**; nothing is verified without submitted evidence.
   Shipped in `verification.service.js`; existing tests updated (verification + bugfixes BUG-5)
   to seed `submitted`. Resubmit (`rejected → submitted` via the upload path) re-enters review.

---

## 4. New dependencies (flagged per CLAUDE.md — none added without your OK)

- `cloudinary` (required for KYC upload/view).
- `multer`/`busboy` + `file-type` **only if** upload approach (b) is chosen.
- An OTP provider SDK (M1-I) — TBD by decision 3.

No auth library, ORM, or state manager added. No changes to the approved stack.

---

## 5. Behaviour changes to existing code (explicit — not silent)

- **Verify/reject guard** (M1-C, fix #3) — **shipped** as `pending`|`submitted`. Optional
  tightening to `submitted`-only (exporter) is pending §3.6; tests change only if tightened.
- **`kycDocuments.url` → `storageKey`** (M1-A) — never persist a public URL. ✅ **shipped**
  (+ `docType` enum, `format`, `kycSubmittedAt`).
- **`mustChangePassword` gate** (M1-G, fix #5) — **shipped** inside `requireRole`/
  `requirePermissions`; `authenticate` selects + exposes the flag. Unbypassable via the boot
  route-guard. (Plan's "fold into `authenticate`" is an equivalent alternative, not needed.)
- **Deactivation targets `User.isActive` + `tokenVersion`** (M1-E, fix #2) — `Organisation.isActive`
  is not checked by auth, so it is never the enforcement point. ✅ **shipped**.

---

## 6. Testing (security-relevant — required per CLAUDE.md)

Add/extend vitest coverage for: KYC upload ownership + state transitions; resubmit loop (rejected
→ submitted **clears `kycRejectionReason`**); verify/reject/approve only from `submitted` (a
no-docs `pending` org returns 409); public exporter read returns a derived **`verified` boolean
(never raw `kycStatus`)**, is **not** gated, constrains **`exporterSide: true`** (A21 — not the
removed `type`), accepts an **id or slug**, and 404s a **deactivated** org (fix #7); KYC-view requires
`kyc:view` and returns signed (not public) URLs; user list pagination cap + no `passwordHash`
leak + **`q` regex-injection is neutralised** (fix #6); **deactivate sets `User.isActive=false`
and bumps `tokenVersion` so login + live sessions die** (fix #2); **activate/deactivate is
role-gated — an employee (even with any granted perm) gets 403, and an admin cannot act on
another admin/superadmin** (fix #1); permission-assign is superadmin-only and rejects unknown
perms; `mustChangePassword` blocks every route except the allowlist and cannot be bypassed on a
new route (fix #5); audit rows written for each event and contain no secrets/KYC values.

---

## 7. Out of scope / deferred (do NOT build here)

- Employee **panel dashboard** (inner) — Bucket A, deferred.
- Admin/Super-admin **TOTP 2FA** restore — D4, project-close checklist.
- **Notification layer** beyond OTP (incl. WhatsApp) — D5.
- Public exporter **directory/search**, product catalogue, **3-product limit (D1)** — Module 3.
- Any escrow/payout/contract/order/trust-score wiring — Phase 2 skeleton models, untouched.

---

## 8. Suggested execution sequence

1. M1-A (model) → 2. M1-G (mustChangePassword) → 3. M1-H (auth audit) →
4. M1-E (user mgmt) → 5. M1-F (permission assign) → 6. **[decision 1]** → M1-B (upload) →
7. M1-C (review align + resubmit + tick) → 8. M1-D (KYC view) → 9. **[decision 3]** → M1-I (OTP).

Steps 1–5 need no external decision and deliver the management + auth-hardening slice first;
6–8 land once the Cloudinary approach is chosen; 9 last.

Each sub-module: build → test → tell you the tracker ID(s) touched → append a `docs/History.md`
change-log line.
