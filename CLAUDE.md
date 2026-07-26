# MPX Global — Project Instructions

B2B import/export marketplace. Indian exporters, international buyers. Web platform +
mobile app on one backend. The platform sits in the path of escrowed importer funds.

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

Buyer · Exporter · Employee · Admin/Super Admin. In Phase 1, both buyers and
exporters self-register. A buyer's account is then approved by an Employee; an
exporter self-registers and is then verified by an Employee. An exporter's
profile is publicly visible from signup, marked as not-yet-verified, and gains
a verified tick once an Employee verifies it. Do not gate an exporter's public
visibility behind verification — expose kycStatus instead so the frontend can
show the tick.

## Non-negotiable rules

These are contractual commitments to the client, not preferences. If a change would
break one of these, stop and tell me instead of working around it.

1. **Never query by `_id` alone.** Every read and write scopes by owner:
   `findOne({ _id: id, orgId: req.user.orgId })`. A missing record returns 404, never 403.
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

Area-specific rules live in `.claude/rules/` and load automatically when you work on
matching files:

- `security-baseline.md` — always loaded, the five controls that matter most
- `payments-escrow.md` — payout, escrow, webhook, reconciliation code
- `auth-sessions.md` — login, JWT, OTP, RBAC, sessions
- `api-endpoints.md` — routes, controllers, validation, error handling
- `contracts-esign.md` — contract generation, versioning, signing
- `mobile-app.md` — React Native app
