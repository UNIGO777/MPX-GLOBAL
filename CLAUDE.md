# MPX Global — Project Instructions

B2B import/export marketplace. Indian exporters, international buyers. Web platform +
mobile app on one backend. By design the platform sits in the path of escrowed importer
funds — but **escrow, payouts and contracts are Phase 2 and are not being built now**
(`docs/scope-of-work.md`, `docs/month1-not-doing.md` Bucket B). **Phase 1 is discovery and
trust: no money moves.** The Phase-2 skeleton models are placeholders — do not touch them.

**Read this first:** this is a payments-adjacent system. A bug here can move money to the
wrong account. Correctness and caution beat speed on anything touching payouts, escrow,
auth or contracts.

## Stack

- **Web:** React + Tailwind
- **Backend:** Node.js + Express
- **Database:** MongoDB (Mongoose)
- **Mobile:** React Native (Expo)
- **Auth:** JWT + OTP
- **Storage:** Cloudinary
- **AI:** OpenAI GPT
- **Payments:** gateway with hold/release (escrow)

## Roles

Buyer · Exporter · Employee · Super Admin. **There is no separate "Admin" role** —
platform governance is superadmin-only; everyone else on staff is an Employee holding
individually granted permissions. In Phase 1, both buyers and exporters self-register.

A **buyer is fully active from signup — there is no approval gate.** An Employee's
"approval" is a recorded status only (it flips `kycStatus` for the tick). Adding any buyer
activation or participation gate is guarded — red-alert first (`docs/Note.md` **D3**). An
**exporter** self-registers and is then verified by an Employee.

An exporter's profile is publicly visible from signup and gains a verified tick once an
Employee verifies it. Do not gate an exporter's public visibility behind verification.
**Never expose raw `kycStatus` on a public response.** Return a server-derived **`verified`
boolean plus `verifiedAt`** — never the raw status, never a `rejected` state, never a
rejection reason. The frontend renders the tick from `verified`, not from `kycStatus`. There
is no "not verified" badge: absence of the tick is the only signal.

## Auth shape

The shape only — detail is in `docs/MPX-M2-M3-Build-Prompt.md` **§A21** (accounts, portals,
two-step signup) and **§A22** (company profile). A21 is mid-build; read it before touching
signup or login.

- **Four roles:** `buyer` · `exporter` · `employee` · `superadmin`. **No `admin` role.** The
  `/admin/*` prefix is a **route namespace, not a role** — those routes are guarded
  per-endpoint, some by `requireRole('superadmin')`, some by a granted employee permission.
- **Buyer and exporter are separate accounts on separate portals**, each with its own login
  page. The same email or mobile may hold one buyer **and** one exporter account — never two
  of the same role. Credentials and OTP locks are independent; do not "fix" that by merging them.
- **`POST /auth/login` carries a `portal` scope.** Staff use **`POST /auth/staff/login`** (no
  portal — a staff email is exclusive). A wrong portal returns the same generic
  "Invalid credentials" as a wrong password; never reveal that the account exists elsewhere.
- **Signup is two steps with OTP between them**, then an organisation step that either
  **claims** an existing Organisation or **creates** one. Signup does not create User +
  Organisation in a single call.
- **One company = one Organisation.** A claimed Organisation **carries its verification over** —
  no second KYC, one tick, one public profile. An Organisation may be buyer-side,
  exporter-side, or both, so `Organisation.type` is **not** the buyer/exporter discriminator.
- **Both buyer and exporter can edit their own company profile (§A22).** Organisation data is
  not write-once at signup. Fields verified against the KYC documents — name, country, address,
  `entityType` — **lock once verified**; changing one is allowed but drops `kycStatus` back to
  `submitted`, so the tick is withheld until re-approval.

## Non-negotiable rules

These are contractual commitments to the client, not preferences. If a change would
break one of these, stop and tell me instead of working around it.

1. **Never query by `_id` alone.** Every read and write scopes by owner:
   `findOne({ _id: id, orgId: req.user.orgId })`. A missing record returns 404, never 403.
   The owner **field name** is per-model — `Product.exporterOrgId`, `SavedItem.buyerOrgId`
   (build-prompt §A2) — but the scoping itself is never optional. `Organisation` is the tenant
   root and carries no `orgId` of its own, so it scopes as `findOne({ _id: req.user.orgId })`;
   the org is always taken from the token, never from a body or path parameter.
2. **Permissions are checked on the server, on every endpoint.** Hiding a button in the UI
   is not access control. Default deny — a route with no declared permission must not run.
3. **No secrets in code.** Never write a key, token, password or connection string into a
   source file, a test, a comment or a commit. They live in environment variables only.
4. **Never log or return sensitive values.** No tokens, OTPs, passwords, bank account
   numbers or KYC data in logs, error responses, or crash reports.
5. **The app never decides its own permissions.** Mobile and web clients render from
   server-supplied permissions; the server re-checks every request.
6. **No payment release capability in the mobile app.** Approval is web-only.
7. **Audit records are append-only.** Never write code that updates or deletes an audit or
   approval record. If a change seems to need that, stop and ask.

## Before you write code

- **Plan first for anything touching payments, escrow, payouts, auth, contracts or audit.**
  Explain the approach and wait for confirmation before implementing.
- Check whether a rule in `.claude/rules/` covers the area you are about to touch.
- Prefer the smallest change that solves the problem. Do not refactor adjacent code
  unless I ask.

## After you write code

- Validate inputs at the route boundary before any business logic runs.
- Add or update a test for anything security-relevant — auth, ownership, permissions,
  payout logic, contract state transitions.
- Tell me plainly what you did NOT handle. Silent gaps are worse than known ones.

## Style

- ES modules, async/await. No callback style, no `.then()` chains.
- Named exports. One responsibility per file.
- Errors: throw typed errors, handle centrally. Never `catch {}` silently.
- Comments explain *why*, not *what*.
- No new dependency without telling me first and saying why.

## Things I do not want

- Do not add authentication libraries, ORMs or state managers beyond what is listed above
  without asking.
- Do not generate migration or seed scripts that touch production-shaped data.
- Do not commit. I run git myself.
- Do not create README or documentation files unless I ask.
- Do not add `console.log` to committed code — use the logger.

## Security tracker

Every security control committed to the client is tracked in
`docs/security-tracker.xlsx`. When you implement one, tell me its ID (for example C3 or
A6) so I can record the evidence against it.

## Detailed rules

Rules live in `.claude/rules/`. Some load in **every** session; the rest load automatically
when you work on matching files.

**Always loaded — read them as part of these instructions:**

- `scope-guard.md` — 🔴 highest priority. Phase-1 scope + month-1 deferrals; stop and
  red-alert before building anything out of scope or in a deferred bucket
- `remind.md` — 🔴 the deferred-work / D-item guard (companion to `scope-guard.md`)
- `security-baseline.md` — the five controls that matter most
- `secrets-and-hygiene.md` — credentials, `.env`, dev shortcuts
- `history-log.md` — append to `docs/History.md` after every meaningful step

**Area-specific:**

- `payments-escrow.md` — payout, escrow, webhook, reconciliation code
- `auth-sessions.md` — login, JWT, OTP, RBAC, sessions
- `api-endpoints.md` — routes, controllers, validation, error handling
- `contracts-esign.md` — contract generation, versioning, signing
- `mobile-app.md` — React Native app
- `m3-public-projection.md` — M3 search/discovery public whitelist projection (Product /
  Category / seller); alert before widening the public surface
- `m3-seo.md` — M3 public discovery pages SEO (slugs, meta/canonical/JSON-LD, sitemap/robots,
  noindex on search/filtered URLs; never expose private fields)
- `web-frontend.md` · `web-design.md` · `web-ui-notes.md` — the React/Tailwind web client

## When a decision changes

**Check this file and `.claude/rules/` in the same pass as the plan docs.** They are read
first and outrank plan docs, so a stale line in either **wins** over a corrected plan — a
session follows the instruction it was given before it ever opens the doc you fixed.

This has already cost us twice: CLAUDE.md kept telling sessions to expose raw `kycStatus`
long after four plan docs said never to, and it described buyer approval as a gate that
`docs/Note.md` **D3** guards against building.

So a decision change is not done when the plan doc is updated. It is done when:

1. The plan doc is updated (and it says which decision supersedes what).
2. **CLAUDE.md** is checked — is any line here now wrong, or now silent where it used to be
   right? A description that was merely incomplete becomes actively wrong the moment the new
   behaviour ships.
3. **`.claude/rules/`** is checked — especially the always-loaded five above.
4. `docs/History.md` records it (`history-log.md`).
