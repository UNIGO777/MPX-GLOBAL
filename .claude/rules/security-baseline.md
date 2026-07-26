# Security baseline

Loaded in every session. These are the controls where a mistake loses money or exposes
another party's data. Everything else in `.claude/rules/` is area-specific detail.

## The five that matter most

**1 · Bank details are never authoritative in our database (tracker C1)**
Payout beneficiaries are registered with the payment provider. We store the provider's
token plus the masked last four digits — nothing more. Every payout call sends the token.
If code anywhere sends an account number we hold to a payment API, that is a bug, not a
shortcut.

**2 · Idempotency on every payout and release call (tracker C3)**
Deterministic key per `(dealId, milestoneId, attempt)`, a unique index in MongoDB, and the
same key sent as the provider's idempotency header. A double click, a retry or a
concurrent request must never produce two payouts.

**3 · Webhook signatures verified on the raw body (tracker C4)**
Verify the provider's HMAC against the **raw request body, before parsing JSON**. Reject
unknown event IDs and anything outside a five-minute timestamp window. An unverified
webhook handler is an open door to forged payment confirmations.

**4 · Ownership scoping on every query (tracker A6)**
`findOne({ _id: id, orgId: req.user.orgId })` — never `findById(id)`. Applies to deals,
quotes, contracts, orders, shipments, documents, payouts and messages. Not found returns
**404**, never 403: a 403 confirms the record exists.

**5 · Audit trail is append-only at the database level (tracker C10)**
The application's database user has insert and find on audit collections — no update, no
delete. Never write an endpoint, script or migration that modifies an audit record. Code
that "cleans up" audit data is never correct here.

## How to behave on this codebase

- **Stop and ask** rather than guessing on anything involving money movement, permissions
  or audit. A clarifying question costs a minute; a wrong assumption here costs more.
- **Never weaken a control to make a test pass.** If a test fails because a security check
  fires, the test is wrong, not the check.
- **Never add a bypass flag** (`skipAuth`, `isDev`, `FORCE_RELEASE`) even temporarily.
  These survive into production.
- **Say what you did not cover.** If you implemented six of eight cases, list the two you
  did not.
- When you finish something on the security tracker, name its ID so it can be recorded.

## Never write

- A secret, key or connection string in source, tests, comments or fixtures
- `console.log` of a token, OTP, password, bank number or KYC field
- A route with no permission declaration
- A raw `req.body` passed into a Mongo query
- An update or delete against an audit or approval collection
