# FINALIZE — Backend Build Plan

**Source of truth:** `modules-in-detailed/m6-Finalization/MPX-FINALIZE-Module.md`, plus the
**project-close checklist** in `docs/Note.md` (which carries code items the FINALIZE file does not).

**Where this module stands after 2026-08-01:** F1 is **complete** (F1-A + F1-B), F6 is **closed by
owner decision**, F2 was cancelled and F4 moved into M4. So most of the original register is done —
what is left is smaller than the file's length suggests, and a good part of it is not code.

---

## 0 · What is actually left

| # | Item | Kind | Status |
|---|---|---|---|
| **F-A** | Error-log **viewer** | Code — small | Data layer already built + tested; only a gated read is missing |
| **F-B** | **D4 · Super Admin TOTP 2FA** | Code — real feature | 🔴 **ON-HOLD D-ITEM — needs explicit owner confirmation before any code** |
| **F-C** | Pre-production hygiene pass | Code + ops | Several items; one already passes |
| **F-D** | Featured listings + banners | Code — new model | 🔴 **Phase-1 scope but explicitly NOT month 1 — needs an owner decision** |
| — | F3 · the unreachable fields | Nothing to build | Capture is Phase 2; M5 already labels them "not captured" |
| — | Content + infrastructure | Not code | Owner/client side; some are go-live blockers |

---

## F-A · Error-log viewer

**Most of this already exists.** `ErrorLog` carries a 90-day TTL, `errorHandler` persists **5xx
only** with a shaped field list (no bodies, no headers, no secrets), and `m2-crosscutting.test.js`
proves a 4xx writes nothing. What is missing is a way to read it.

- `GET /admin/errors` — filters: `from`/`to` · `route` · `statusCode` · `requestId`
- `GET /admin/errors/:id` — the full entry including the stack
- Same posture as the audit viewer: **read-only**, page-size capped, `occurredAt` + `_id` tiebreaker
- `requestId` is the point of the screen: it ties a user's "something went wrong, here is my
  reference" straight to the server-side detail
- New index likely needed: `{ occurredAt: -1 }` already exists via the TTL field? **Verify at build
  time** rather than assuming — the TTL index is on `occurredAt` and may serve the sort

**🔴 Decision needed — which permission gates it?** Rule 6 forbids inventing a permission string
inline. Two candidates, and they are genuinely different:
- **`errorlog:read`** (new string) — errors are stack traces and internal messages; a separate grant
  lets an operator give someone debugging access without the audit trail
- **reuse `audit:read`** — no new string, but the audit trail records every KYC view and every
  conversation read, so it is a much heavier grant to hand out for stack traces

*Recommendation: a new `errorlog:read`.* Fewer things bundled into the heaviest grant.

---

## F-B · D4 · Super Admin TOTP 2FA

# 🔴🔴 STOP — THIS IS AN ON-HOLD D-ITEM

**`docs/Note.md` D4 · Super Admin TOTP 2FA — ⏸ ON HOLD.** `.claude/rules/remind.md` requires a red
alert and **explicit owner confirmation before any code is written**, even when the task appears to
ask for it. This section is the alert. Nothing here gets built until you say so.

The note itself says *"restore before close (A4)"*, and finalization is that moment — but the
confirmation still has to be yours, not mine.

**What already exists** (verified in code, not assumed): `twofactor.service.js` is complete —
`generateTotpSecret`, `totpKeyUri`, `generateTotp`, `verifyTotp`, and hashed single-use backup
codes. `User` carries `isTwoFactorEnabled`, `twoFactorSecret` and `twoFactorBackupCodes` (all
`select: false`). And `completeLogin` **already branches on `method === 'totp'`** and verifies it.

**What is missing** is only the flow around it:
1. **Enrolment** — `POST /auth/2fa/setup` returns a secret + `otpauth://` URI for the authenticator
   app; `POST /auth/2fa/enable` confirms with a live code before anything is stored, and returns the
   backup codes **once**
2. **The login switch** — `loginWithRole` currently hardcodes `method = 'otp'` with the comment
   *"ON HOLD (D4)"*. It becomes: TOTP when the account has it enabled, OTP otherwise
3. **Backup-code redemption** — verify against the hashed list, mark `usedAt`, never delete (A4)
4. **Disable** — `POST /auth/2fa/disable`, requiring a current code

**🔴 Two decisions this needs:**
- **Who?** A4 says *"TOTP required for the **Super Admin** at login"*. Superadmin only, or all staff
  (employees too)?
- **Mandatory or opt-in?** Mandatory is what A4 implies — but a superadmin who loses their
  authenticator with no backup code is **locked out of the platform permanently**. Opt-in plus
  backup codes is the safer first step. *Recommendation: build it, enable it for superadmin, keep
  enforcement opt-in until the owner has enrolled and stored their backup codes.*

---

## F-C · Pre-production hygiene pass

From `docs/Note.md`'s close checklist. Some are code, some are verification, some are the owner's.

| Item | Kind | State |
|---|---|---|
| **KYC docs must be Cloudinary `private`/`authenticated` with a randomised public_id** | Verify | ✅ **Already correct** — `kyc.storage.service.js` uses `type: 'private'` and `randomBytes(12)`. Add an explicit test so a future change cannot silently make KYC world-readable |
| **Remove the dev-only OTP terminal print** | Code | Hard-gated to non-production today; must be **removed** when real OTP delivery is wired. Blocked on the client's provider |
| **`SEED_SUPERADMIN_PASSWORD` out of `.env` after seeding** | Ops | The argon2 hash is already in the DB; the plaintext has no further use |
| 🔴 **Rotate the Firebase service account** | Owner | The current key was downloaded into the repo directory and passed through a chat transcript — **compromised** by `secrets-and-hygiene.md`. Fine for testing; regenerate before launch and delete the old key |
| **Rotate the seeded superadmin password** | Owner | Typed in chat; same rule |
| **Secret-scan git history** (gitleaks / trufflehog, tracker E6) | Ops | Once the repo has commits |
| 🔴 **C10 · append-only audit grant** | Ops | The app's Mongo user gets **insert + find only** on `auditlogs`. This is the *real* guarantee — the model-level guards are a helper, and the raw driver bypasses them (proven by a test). Self-hosting finally makes it enforceable |
| **Mongo auth on + bound to localhost, `mongodump` with off-server retention** | Ops | Go-live blockers |

**Also worth doing here (code):** a `npm run` task that syncs indexes against a target database, so
the production deployment does not rely on a test run to create them.

---

## F-D · Featured listings + banners

# 🔴 SCOPE — needs an owner decision before any code

**It is in the quote** (`scope-of-work.md` Module 5 names "banners"), so it is Phase-1 work, not a
change request. **But FINALIZE F5 says explicitly: "just not month 1."**

It also **needs storage** — a new model — which is precisely why it was moved out of M5 (whose
defining property is no new models). So it is not a small addition.

Rough shape if approved: a `FeaturedItem` (or `Banner`) model with a type, a target ref, an order, an
active window (`from`/`to`), plus superadmin-only CRUD and a public read for the landing page.

**Do not build without your explicit go-ahead.** Same posture as FCM: a schedule decision, not a
scope change.

---

## 1 · Phases (for whatever is approved)

**F-A · Error-log viewer** — permission string, endpoints, projections, tests. Small and
self-contained; a good first phase because it touches nothing else.

**F-B · TOTP (only if confirmed)** — enrolment, the login switch, backup codes, disable. Touches the
**auth path**, so per CLAUDE.md this one gets its own plan-and-confirm step before code, and every
change carries a test: an enrolled account must not be able to log in with OTP alone, and a used
backup code must never work twice.

**F-C · Hygiene** — the KYC-private regression test and the index-sync task are code; the rest is a
checklist to hand you.

**F-D · Featured content (only if approved)** — model, admin CRUD, public read.

---

## 2 · Test plan

| Area | Must prove |
|---|---|
| **Error viewer gate** | no grant → 403; the chosen permission opens it; parties and guests refused; **no write route exists in any verb** |
| **Error viewer content** | 5xx entries appear and 4xx do not; `requestId` matches the one the client was given; filters work; page size capped |
| **Error viewer leaks** | a stack trace is visible to staff, but no request body, header, token, OTP or KYC value is — the exclusion list is enforced at the write site and re-asserted here |
| **TOTP enrolment** | a secret is never stored until a live code confirms it; backup codes are returned **once** and stored hashed |
| **TOTP login** | an enrolled account cannot complete login with an OTP; a wrong code fails; a **used backup code never works twice**; lockout behaviour matches A3 |
| **KYC privacy regression** | the upload path sets `type: 'private'` and a randomised public_id — a test that fails if either is ever relaxed |
| **Regression** | the full M1–M5 + F1-B suite stays green |

---

## 3 · Owner decisions — ANSWERED 2026-08-01

1. **F-A permission** → ✅ **new `errorlog:read`**. Stack traces do not get bundled into the
   heaviest grant on the platform.
2. **F-B · D4 TOTP** → 🔴 **NOT now — D4 stays ON HOLD.** Staff continue on OTP. This must be
   raised again at project close (`remind.md` requires it), and `auth.service.js`'s
   *"ON HOLD (D4)"* comment stays accurate and stays put.
3. **F-D · featured listings** → ~~month 2~~ ⏩ **REVERSED THE SAME DAY — BUILD NOW.** The landing
   page needs it. Confirmed before building that this is **not** a scope change: `scope-of-work.md`
   Module 5 names "banners", Module 1 names "featured categories and highlighted suppliers", and
   the item is in **neither** `month1-not-doing.md` bucket and is not a D-item. Only FINALIZE F5's
   own "just not month 1" line had deferred it.

**So this build is: F-A + the code half of F-C.** Everything else is either deferred by the
decisions above or is an ops/owner checklist item.

---

## 4 · Build result — 2026-08-01

✅ **F-A and the code half of F-C are DONE. 723/723 green** (681 → +42), lint clean, 50 files.

| Built | Where |
|---|---|
| `errorlog:read` permission (catalogue 12 → 13) | `src/config/permissions.js` |
| `GET /admin/errors` + `/admin/errors/:id` | `src/routes/admin.routes.js` |
| Viewer service / view / validators / controller | `errorLogViewer.service.js`, `views/errorLog.view.js`, `validators/errorLog.validators.js`, `controllers/errorLog.controller.js` |
| Sort index `{occurredAt:-1,_id:-1}` | `src/models/ErrorLog.js` |
| **Secret redaction at the write site** | `src/utils/redact.js` + `middleware/errorHandler.js` |
| `npm run indexes:sync` / `indexes:check` | `scripts/sync-indexes.mjs` |
| KYC-private regression tests | `tests/kycStorage.test.js` |
| 37 viewer tests | `tests/f5-error-log-viewer.test.js` |

**Two findings the build surfaced that the plan had not anticipated:**

1. **A secret leak the viewer would have opened.** `err.message` and `err.stack` are the only
   persisted fields whose shape we do not control, and a Mongo driver failure quotes its own
   connection string — which in production carries the database password (§A26). Redaction now
   runs at the **write site**, so the value never reaches the collection, a backup or a
   `mongodump`. Read-side redaction would have left the live credential sitting in the database.
2. 🔴 **Production would have had no indexes at all.** `autoIndex` is off in production by design
   and nothing runs `syncIndexes()` at boot — so `ErrorLog`'s 90-day TTL, i.e. **A19's entire
   retention guarantee**, would silently not have existed. Added to the close checklist as a
   go-live step, not just a script.

---

## 5 · F-D build result — 2026-08-01 (same day, after the reversal)

✅ **Featured landing content DONE. 757/757 green** (723 → +34), lint clean, 51 files.

| Built | Where |
|---|---|
| `FeaturedItem` model — 4 kinds, curation order, active window | `src/models/FeaturedItem.js` |
| `featured:manage` permission (catalogue 13 → 14) | `src/config/permissions.js` |
| `GET /public/featured` — all four groups, one call | `src/routes/public.routes.js` |
| Admin CRUD + banner upload/replace | `src/routes/admin.routes.js` |
| Service / view / validators / controller | `featured.service.js`, `views/featured.view.js`, `validators/featured.validators.js`, `controllers/featured.controller.js` |
| 34 tests | `tests/f5b-featured.test.js` |

**The one design decision to preserve:** a featured row is a **pointer, never a snapshot**. It
stores `targetId` and nothing about the target. The public read re-resolves each one through the
*same* availability rules the rest of the public surface uses, so a taken-down product, a
deactivated category or a **blocked company leaves the landing page on its own**. Denormalising a
name or price onto the row to "save a lookup" would keep a blocked supplier on the front page —
re-opening precisely the failure F1 was built to close. The self-healing tests exist to stop that.

**Also worth knowing:**
- `linkUrl` is allowlisted to a relative path or an absolute http(s) URL — a **security** control,
  since the frontend renders it into an `href` and `javascript:…` would be stored XSS placed by a
  `featured:manage` holder and served to every visitor.
- Curation deliberately allows an **unverified** supplier (B7: verification is never a gate); the
  public read decides what renders, not the curation step.
- `kind` / `targetId` are not patchable — repointing a slot would silently rewrite what was
  audited at creation. Delete and re-add instead.
- The empty, unused `Banner` skeleton is now redundant. **Left in place** — removing it is the
  owner's call.

---

## 6 · Still open / not done

Each by an explicit decision, not an oversight:
- **F-B · D4 TOTP** — deferred by the owner; `docs/Note.md` D4 records what remains and the two
  decisions it still needs. **Must be raised again at close.**
- **F-C ops items** — Firebase key rotation, superadmin password rotation, removing the dev OTP
  print (blocked on the real provider), the C10 append-only audit grant, Mongo auth/backups,
  the secret scan, and the live check that a raw KYC URL returns 401/404. All owner/ops side.
- **Content** — the 40 top-category synonyms and 40 category images, and now also the actual
  banner artwork and the first curation choices. Not code.
