# M1 · Backend — Step by Step Prompts

Har step ek alag prompt hai. Ek step khatam karo, check karo, phir agla.
Ek saath sab mat de dena — chhote steps me Claude Code kaafi behtar kaam karta hai.

**Shuru karne se pehle:** project root pe `claude` chalao aur `/context` se confirm
karo ki `CLAUDE.md` aur `security-baseline.md` load ho rahe hain.

---

## Step 1 — Project init aur folder structure

```
Initialise the backend for MPX Global. Node.js, Express, ES modules, MongoDB.

Create the folder structure only — no logic yet:

src/
  config/       env loading, constants
  models/       mongoose schemas
  routes/       route definitions
  controllers/  request handlers
  services/     business logic
  middleware/   auth, rbac, validation, error handling
  validators/   zod schemas
  utils/        helpers
tests/

Also create:
- package.json with scripts: dev, start, test, lint
- .gitignore — node_modules, .env, .env.*, logs, coverage
- .env.example with every variable name we will need, no real values
- README with just the run commands

Install: express, mongoose, dotenv, helmet, cors, express-rate-limit,
express-mongo-sanitize, zod, argon2, jsonwebtoken, otplib, pino, pino-pretty.
Dev: nodemon, vitest, supertest.

Do not write any application logic yet. Show me the structure when done.
```

**Check:** `.env` gitignore me hai? Folder structure ban gaya?

---

## Step 2 — Express core setup

```
Now build the Express application core. No business routes yet.

1. src/config/env.js — load and validate environment variables with zod at startup.
   The server must refuse to start if a required variable is missing.

2. src/utils/logger.js — pino logger with a redaction list covering: password, token,
   accessToken, refreshToken, otp, authorization header, bankAccountNumber, ifsc,
   panNumber, aadhaar, kyc. These must never appear in any log.

3. src/middleware/errorHandler.js — central error handler. Returns a generic message
   plus a requestId to the client. Logs full detail server-side against that requestId.
   Never leaks a stack trace, Mongo error text or collection name.

4. src/utils/AppError.js — typed error class with statusCode and a safe client message.

5. src/app.js — express app with helmet (CSP, HSTS), cors restricted to our origins,
   express-mongo-sanitize, json body limit, request ID middleware, and the error
   handler registered last.

6. src/server.js — starts the app.

7. GET /health returning status and uptime.

Then run the server and confirm /health works.
```

**Check:** ek required env variable hata ke server chala ke dekho — start hi nahi hona chahiye.

---

## Step 3 — MongoDB connection

```
Add the MongoDB layer.

1. src/config/database.js — mongoose connection with retry on failure, connection
   event logging, and graceful shutdown on SIGINT/SIGTERM.

2. Decide and document our model conventions in a short comment block:
   - timestamps on every schema
   - orgId on every business document, indexed
   - soft delete via isActive rather than hard delete, except where noted
   - no toJSON leaking of sensitive fields

3. A base schema options object that every model reuses, with a toJSON transform that
   removes __v and any field marked select:false.

Do not create any models yet.
```

---

## Step 4 — Core models

```
Create the three models M1 actually uses. Propose the schemas first and wait for my
review before writing the files.

1. User
   - name, email (unique, lowercase), mobile (with country code), passwordHash
   - role: buyer | exporter | employee | admin | superadmin
   - orgId reference
   - permissions array — for employees, individually assignable
   - tokenVersion (number, default 0) — this is how we invalidate sessions
   - isActive, isEmailVerified, isMobileVerified
   - twoFactorSecret and twoFactorBackupCodes, both select:false
   - lastLoginAt, createdBy
   - passwordHash and twoFactorSecret must be select:false and never appear in toJSON

2. Organisation
   - name, type: buyer | exporter
   - country, address, website, description, logo
   - businessProfile: registration number, tax id, established year
   - authorisedSignatory: name, designation, email, mobile
     (this is used later for contract signing — get it right now)
   - kycStatus: pending | submitted | verified | rejected
   - kycDocuments array — type, url, uploadedAt, verifiedAt, verifiedBy
   - verifiedBy, verifiedAt, isActive

3. AuditLog
   - actorId, actorRole, action, entityType, entityId, orgId
   - before and after snapshots, ipAddress, userAgent, requestId, timestamp
   - APPEND ONLY: no update or delete methods, and add a pre-hook that throws on any
     update or delete attempt
   - indexed on actorId, entityType+entityId, and timestamp
```

**Check:** `AuditLog.findByIdAndUpdate()` chala ke dekho — error aana chahiye.

---

## Step 5 — Remaining models

```
Create skeleton schemas for the remaining models. Core fields, correct references and
indexes only — the detailed fields come in M2. The point is that we never have to
restructure relations later.

Product, Category, Inquiry, Quotation, Deal, Contract, Order, Shipment, Escrow,
PayoutAccount, PayoutRequest, Notification, Lead, Ticket, TrustScore, Incentive,
Investment, PremiumApplication, Subscription, Banner, CmsPage

Rules:
- Every business document has orgId, indexed
- Deal is the spine: it links inquiry, quotation, contract, order, shipment and escrow
- PayoutAccount stores only the provider token and masked last four digits — never a
  full account number
- Escrow and PayoutRequest reference Deal and milestone

Show me the relationship map before writing the files.
```

---

## Step 6 — Validation and rate limiting

```
Add the request validation and rate limiting layers.

1. src/middleware/validate.js — takes a zod schema, validates body/query/params,
   strips unknown keys, and returns a clean 400 with field-level errors on failure.
   Validation runs before any controller logic.

2. src/middleware/rateLimit.js — express-rate-limit with a Redis store so limits
   survive restarts and hold across processes. Export three configured limiters:
   authLimiter (strict), otpLimiter (stricter, per identifier not just per IP),
   and generalLimiter.

3. Reject objects where a string is expected, so a password field cannot receive
   {"$gt": ""}. Add a shared zod string helper that enforces this.

Write a test proving {"$gt": ""} in a string field is rejected.
```

---

## Step 7 — Token layer

```
Build the token layer. This is security-critical — follow
.claude/rules/auth-sessions.md exactly.

1. src/services/password.service.js — argon2id hash and verify.

2. src/services/token.service.js
   - Access token: 15 minute expiry, payload has userId, role, orgId, tokenVersion
   - Refresh token: 7 days, rotated on every use
   - Store only the HASH of refresh tokens, with a familyId
   - Reuse detection: if an already-rotated refresh token is presented, revoke the
     entire family and force re-login
   - Include tokenVersion in the access token

3. src/models/RefreshToken.js — tokenHash, familyId, userId, expiresAt, rotatedAt,
   revokedAt, ipAddress.

4. src/middleware/authenticate.js — verifies the access token, loads the user, and
   compares tokenVersion. Mismatch means the session is dead.

Write tests for: token expiry, rotation, reuse detection revoking the family, and
tokenVersion mismatch rejecting the request.
```

**Check:** ek refresh token do baar use karo — doosri baar fail hona chahiye aur session family revoke.

---

## Step 8 — Permission registry aur RBAC

```
Build access control. Do this before any business endpoints so every route is born
protected.

1. src/config/permissions.js — a single registry naming every permission we will ever
   use, grouped by module. Start with the M1 set plus placeholders for M2 modules like
   escrow.approve, exporter.verify, employee.manage.

2. Role to permission mapping. Buyer, Exporter, Admin and Super Admin get fixed sets.
   Employee gets NO fixed set — an employee's permissions come from their user
   document, assigned individually.

3. src/middleware/authorize.js — takes a permission name, checks it against the
   authenticated user, default deny.

4. A route registry pattern where every route declares its required permission.

5. A STARTUP CHECK: walk all registered routes and throw at server start if any route
   has no declared permission. A route must never be able to run unprotected because
   someone forgot. Public routes declare themselves public explicitly.

Show me the permission registry before implementing.
```

**Check:** ek route bina permission ke add karo — server start hi nahi hona chahiye.

---

## Step 9 — Ownership scoping aur audit helper

```
1. src/middleware/ownership.js and a query helper that enforces orgId scoping.
   Provide a scopedFindOne helper so controllers never call findById directly.
   Not found returns 404, never 403 — a 403 would confirm the record exists.

2. Add an eslint rule or a simple test that fails if findById appears anywhere in
   controllers.

3. src/services/audit.service.js — writes AuditLog entries. Called on: login, failed
   login, password change, role change, account creation, deactivation. Captures
   actor, action, entity, ip, userAgent, requestId.

Write a test: Exporter A's document requested with Exporter B's token returns 404.
```

---

## Step 10 — OTP service

```
Build OTP. Follow .claude/rules/auth-sessions.md.

- 6 digits, 5 minute expiry, stored HASHED
- Maximum 5 attempts, then a 15 minute lock on that identifier
- Rate limited per mobile, per email and per IP
- Single use — consumed on successful verification
- Never returned in an API response, never logged
- Purpose field: login | signup | reset | signing (signing is used in M2)
- Delivery through a provider interface so we can swap SMS/email providers later.
  For now, a console adapter in development.

src/models/Otp.js and src/services/otp.service.js.

Tests: expiry, attempt limit, lock, single use, and that the OTP never appears in any
response body or log.
```

---

## Step 11 — Auth endpoints

```
Now wire the actual auth endpoints, using everything built so far.

POST /api/auth/signup          Buyer self-registration only
POST /api/auth/login           email or mobile + password, then issues OTP challenge
POST /api/auth/verify-otp      completes login, issues tokens
POST /api/auth/refresh         rotates the refresh token
POST /api/auth/logout          increments tokenVersion, revokes the refresh family
GET  /api/auth/me              current user with permissions

Rules:
- There is NO public exporter, employee or admin signup. Signup creates a buyer only
- Login must not reveal whether an account exists — same response and same timing for
  unknown email and wrong password
- Every auth event writes an audit log entry
- authLimiter on login, otpLimiter on verify-otp
- /api/auth/me returns the permission list the frontend will render menus from

Then run all tests.
```

---

## Step 12 — Forgot password aur reset

```
Add the password reset flow.

POST /api/auth/forgot-password   sends a reset OTP or link
POST /api/auth/reset-password    verifies and sets the new password

Rules:
- Always return the same response whether or not the account exists
- Reset consumes the OTP and is single use
- On success: increment tokenVersion so every existing session dies, revoke all
  refresh token families, and write an audit entry
- New password cannot equal the current one
- Rate limited

Test that a password reset kills an active session on another device.
```

---

## Step 13 — Two-factor for Admin

```
Add TOTP two-factor authentication for admin and superadmin.

POST /api/auth/2fa/setup      returns a QR provisioning URI
POST /api/auth/2fa/enable     verifies the first code and turns it on
POST /api/auth/2fa/verify     during login
POST /api/auth/2fa/disable    requires password plus a current code

Rules:
- otplib, 30 second window, small drift tolerance
- 10 single-use backup codes, stored hashed, shown once at enable time
- Admin and superadmin cannot complete login without 2FA once enabled
- twoFactorSecret is select:false and never returned after setup
- Enable, disable and backup code use are all audited
```

---

## Step 14 — Account creation endpoints

```
Add the controlled account creation paths. API only, no UI.

POST /api/exporters              Employee with exporter.create permission creates an
                                 exporter account and organisation, generates
                                 credentials, and emails them
POST /api/employees              Admin creates an employee with an explicit permission
                                 list
PATCH /api/employees/:id/permissions   Admin updates permissions — this must increment
                                 the target user's tokenVersion so their session
                                 reloads with the new permissions
PATCH /api/users/:id/deactivate  increments tokenVersion, kills sessions

Rules:
- Exporter accounts can ONLY be created this way. There is no other path, ever
- Creating an exporter requires the organisation KYC status to be verified first
- Every creation and permission change is audited with before/after snapshots
- Generated passwords are single-use and must be changed on first login
```

---

## Step 15 — Acceptance tests

```
Write the M1 acceptance test suite. These must all pass before we call M1 done.

1. A buyer's token on an admin-only endpoint returns 403
2. Exporter A's document requested as Exporter B returns 404, not 403
3. Login on two sessions, change password on one — the other session's next request fails
4. Login with password field {"$gt": ""} is rejected as invalid input
5. Using the same refresh token twice fails and revokes the token family
6. A route registered without a declared permission makes the server fail to start
7. Six rapid OTP requests get throttled; five wrong attempts trigger the lock
8. An OTP never appears in any response body
9. AuditLog cannot be updated or deleted through the application
10. No token, password, OTP or bank field appears in logs during a full login flow
11. There is no route that creates an exporter without employee permission

Then give me a handover note: what is built, what is not, and which security tracker
IDs this covers.
```

**Check:** saare 11 pass? Tab M1 backend done. Security tracker me A1–A8 evidence bhar do.

---

# Aage kya

Backend done hone ke baad `M1-02-web.md`, phir `M1-03-app.md`.
Bolo to unko bhi isi tarah step-by-step tod dun.
