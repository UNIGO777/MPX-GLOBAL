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
| **M1-A** | KYC data model & entity type | — | no |
| **M1-B** | KYC document upload | A | 🧱 dep/decision (Cloudinary approach) |
| **M1-C** | Verification review alignment + resubmit + tick expose | A, B | no |
| **M1-D** | KYC document view (signed URL, reviewers) | A, B | 🧱 dep (Cloudinary) |
| **M1-E** | User management (list/search, activate/deactivate) | — | no |
| **M1-F** | Employee permission assignment (hard superadmin-gate) | — | no |
| **M1-G** | `mustChangePassword` enforcement + change-password | — | no |
| **M1-H** | Auth-event audit (login/signup/refresh-reuse/logout/reset) | — | no |
| **M1-I** | Real OTP delivery provider | — | 🧱 dep/decision (provider + creds) |

M1-A/E/F/G/H are unblocked and can start immediately. B/D/I wait on the decisions in §3.

---

### M1-A · KYC data model & entity type  🔨

**Goal:** give the KYC flow the fields it needs; fix a naming/security gap in the current
`kycDocuments` sub-doc.

**Changes — `src/models/Organisation.js`:**
- Add `entityType: { type: String, enum: ['business','individual'] }` (drives the KYC path —
  business ⇒ registration/GST/certs; individual ⇒ PAN/Aadhaar/passport). Set at signup for
  exporters (m1.md fields), optional for buyers.
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

### M1-B · KYC document upload  🔨 🧱

**Goal:** exporter (mandatory) / buyer (optional) uploads business or personal ID docs; status
moves `pending → submitted` (and `rejected → submitted` on resubmit, see M1-C).

**Endpoint:** `POST /me/kyc/documents` (authenticated; self — writes the caller's **own** org).
- Scope: caller's org via `req.user.orgId` — this is a **self** write, not a staff action.
- Accepts `entityType` + one or more documents (`docType` + the uploaded file/reference).
- Validation (zod): `entityType` enum; `docType` enum; per §3 upload-approach decision.
- Enforce **business ⇒ business docs**, **individual ⇒ ID doc** at the route boundary.
- On success: push into `org.kycDocuments`, set `kycSubmittedAt`, transition
  `kycStatus: pending|rejected → submitted`. If already `verified`, reject with 409 (nothing to
  resubmit). Append AuditLog `kyc.submit` (snapshot = docTypes + count only, **never** the doc
  contents or storageKeys-as-secrets... storageKey is fine to log as an id, but keep it minimal).

**Status machine:** `pending` (signup) → `submitted` (this endpoint) → `verified` / `rejected`
(M1-C) → `submitted` again (resubmit).

**Security/tracker:** B6 (file uploads — allowlist ext, MIME via magic-bytes, size cap),
A7/E3, ownership (self-write), default-deny.

**🧱 Blocked on §3 decision** — server-side multipart upload vs signed direct-to-Cloudinary.
That decision determines the validator shape, the dependencies, and whether magic-byte MIME
checking happens on our server or is enforced via Cloudinary upload constraints.

---

### M1-C · Verification review alignment + resubmit + tick expose  🔨

**Goal:** make review act on **submitted** docs, add the resubmit loop, and expose the verified
tick.

**Change — `src/services/verification.service.js`:**
- `reviewOrg` currently requires `kycStatus === 'pending'`. **Change the guard to
  `kycStatus === 'submitted'`** — a reviewer verifies/rejects *documents*, which only exist after
  submission. (Buyer "approve" in Phase 1 = grant the trust tick after the buyer optionally
  submits docs; it is not an activation gate — buyer is already fully active. This keeps
  buyer and exporter review symmetric.)
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
2. **Public tick:** `GET /exporters/:id` (public) → curated public exporter profile **including
   `kycStatus`** so the frontend renders the verified tick; **never filter by verification**
   (CLAUDE.md: exporter public from signup). Returns only public fields (name, country,
   description, logo, businessProfile subset, `kycStatus`, `verifiedAt`) — no contacts, no KYC
   docs. Marked `publicRoute`.

> **Scope note:** a full public exporter *directory/search* is Module 3 (catalogue). M1 ships
> only the single-profile-by-id public read above so the B7 tick requirement is honoured now;
> the "expose `kycStatus`, don't gate" rule then applies to Module 3's listing when built.

**Existing tests to update:** `tests/verification.test.js` currently seeds orgs at `pending` and
expects verify/reject to succeed from `pending`. After the guard change they must seed
`submitted`. **This is a deliberate behaviour change — update the tests to the new state
machine, do not weaken the guard to keep old tests green.**

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
- For each doc, mint a **signed expiring** Cloudinary URL (short TTL, e.g. 60–120s) from the
  stored `storageKey` and return `{ docType, uploadedAt, signedUrl, expiresAt }`. Never return
  `storageKey` raw is acceptable, but the signed URL is the access path.
- Append AuditLog `kyc.view` (who viewed whose docs — an access record, no doc contents).

**Security/tracker:** A7/E3 (signed expiring, never public), C10 audit, default-deny perm.
**🧱 Blocked on Cloudinary being wired (same dep as M1-B).**

---

### M1-E · User management (list/search, activate/deactivate)  🔨

**Goal:** the super-admin management screens (m1.md §6). Month-1 = super admin operates these;
employee panel dashboard is deferred, so gate to staff.

**Permission model:** gate reads with `user:read` and the activate/deactivate action with
`user:manage` (both **grantable**; superadmin all-access). Rationale: consistent with the
existing permission-based review model; superadmin covers month-1 fully, and the surface can be
delegated later without a rewrite. *(Alternative — hard `requireRole('admin','superadmin')` — is
also acceptable; see §3.)*

**Endpoints:**
- `GET /admin/users` — list + search buyers/exporters/employees. Query params (validated):
  `role?`, `kycStatus?`, `q?` (name/email/mobile prefix — **built from validated strings only**,
  never raw `req.query` into the query), `page`, `pageSize` (**max page size capped**).
  Response = curated rows (`id, name, email, mobile.e164, role, isActive, orgId, org.kycStatus`),
  **no** `passwordHash`, `permissions`-of-others leakage minimal, no KYC docs.
- `GET /admin/users/:id` — one curated user + its org summary.
- `POST /admin/users/:id/activate` and `/deactivate` — flip `User.isActive`. **Deactivate must
  bump `tokenVersion`** (kills live sessions — auth-sessions A7) and should also flip the org's
  `isActive` where appropriate (decide per role; a buyer/exporter user maps 1:1 to its org).
  Append AuditLog `user.activate` / `user.deactivate`.

**Guards:** cannot deactivate a `superadmin`; an admin cannot deactivate another admin/superadmin
(only superadmin can act on admins). Enforce server-side.

**Security/tracker:** A6/default-deny, pagination cap (B-api), tokenVersion invalidation (A7),
audit (C10). Never return full user docs.

---

### M1-F · Employee permission assignment  🔨

**Goal:** super admin edits an employee's `permissions`. **This must be a HARD role gate, never a
grantable permission flag** — otherwise an over-permissioned employee grants itself everything
(privilege escalation). m1.md §6 calls this out explicitly.

**Endpoint:** `PATCH /admin/employees/:id/permissions`
- **Gate:** `requireRole('superadmin')` — hard, not `requirePermissions`.
- Validate: `permissions: string[]`, each value must be a **member of the `PERMISSIONS`
  catalogue** (reject unknown perms — no free-text permission strings). Cap array length.
- Only applies to `role === 'employee'` targets (404 otherwise). Set `user.permissions`, bump
  `tokenVersion` so the change takes effect on the employee's next request. Append AuditLog
  `employee.permissions.update` (before/after permission arrays).

**Config — `src/config/permissions.js`:** add the new grantable perms this module introduces:
`KYC_VIEW = 'kyc:view'`, `USER_READ = 'user:read'`, `USER_MANAGE = 'user:manage'`. Keep
`BUYER_APPROVE`, `EXPORTER_VERIFY`. (Permission-**assignment** itself is deliberately **not** in
this catalogue — it stays a superadmin-only hard gate.)

**Security/tracker:** privilege-escalation prevention (governance hard-gate), A5 default-deny,
tokenVersion (A7), audit (C10).

---

### M1-G · `mustChangePassword` enforcement + change-password  🔨

**Goal:** admin-created employees (temp password, `mustChangePassword: true`) must set a new
password on first login before doing anything else (decision A2).

**Add endpoint:** `POST /auth/change-password` (authenticated)
- Body: `{ currentPassword, newPassword }`. Verify current password, set new hash, clear
  `mustChangePassword`, **bump `tokenVersion` + revoke all refresh tokens** (A7), same as reset.
- Distinct from forgot/reset (which is OTP-based and unauthenticated).

**Enforcement gate:** a small middleware (mounted after `authenticate`) that, when
`req.user.mustChangePassword` is true, blocks every authenticated route **except**
`/auth/change-password`, `/auth/logout`, `/auth/me` with a 403 + a clear
`code: 'password_change_required'`. To read the flag, `authenticate` must also select
`mustChangePassword` (add it to the `.select(...)` in `authenticate.js` and to `req.user`).

**Surface it:** include `mustChangePassword` in the `verify-otp` login response and in
`/auth/me` so the client can route to the change-password screen.

**Security/tracker:** A2 (first-login reset), A7 (tokenVersion), default-deny.
**Tests:** employee with flag can only hit change-password; after change, flag cleared, old
tokens dead, normal routes work.

---

### M1-H · Auth-event audit  🔨

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

2. **Permission granularity for user management (M1-E):** grantable perms (`user:read`,
   `user:manage`, `kyc:view`) **vs** hard `requireRole('admin','superadmin')`. Recommend
   grantable (consistent, delegable later; superadmin still covers month-1). Confirm.

3. **OTP provider (M1-I):** which channel/provider and do we have an account? Until then M1-I
   ships as a seam only.

4. **Buyer KYC (m1.md open Q1):** confirm buyer verification is **optional** (trust tick only).
   Plan assumes yes.

5. **Client sign-off (m1.md open Q3):** buyer full-access (no approval gate) + exporter
   3-product-trial-then-mandatory-verify deviates from the quote. Written confirmation from
   Girish recommended (not a blocker for backend build, but a documented deviation).

---

## 4. New dependencies (flagged per CLAUDE.md — none added without your OK)

- `cloudinary` (required for KYC upload/view).
- `multer`/`busboy` + `file-type` **only if** upload approach (b) is chosen.
- An OTP provider SDK (M1-I) — TBD by decision 3.

No auth library, ORM, or state manager added. No changes to the approved stack.

---

## 5. Behaviour changes to existing code (explicit — not silent)

- **Verify/reject guard `pending` → `submitted`** (M1-C) — reviewers act on submitted docs.
  `tests/verification.test.js` updated to the new state machine (not weakened).
- **`kycDocuments.url` → `storageKey`** (M1-A) — never persist a public URL.
- **`authenticate` selects `mustChangePassword`** and adds it to `req.user` (M1-G).

---

## 6. Testing (security-relevant — required per CLAUDE.md)

Add/extend vitest coverage for: KYC upload ownership + state transitions; resubmit loop;
verify/reject only from `submitted`; public exporter read exposes `kycStatus` and is **not**
gated; KYC-view requires `kyc:view` and returns signed (not public) URLs; user list pagination
cap + no `passwordHash` leak; activate/deactivate bumps `tokenVersion`; permission-assign is
superadmin-only and rejects unknown perms; `mustChangePassword` blocks other routes until
changed; audit rows written for each event and contain no secrets.

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
