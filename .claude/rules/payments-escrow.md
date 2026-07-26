---
paths:
  - "**/*[Pp]ayment*.{js,jsx,ts,tsx}"
  - "**/*[Pp]ayout*.{js,jsx,ts,tsx}"
  - "**/*[Ee]scrow*.{js,jsx,ts,tsx}"
  - "**/*[Ww]ebhook*.{js,jsx,ts,tsx}"
  - "**/*[Rr]econcil*.{js,jsx,ts,tsx}"
  - "**/*[Ll]edger*.{js,jsx,ts,tsx}"
  - "**/[Pp]ayment*/**/*.{js,jsx,ts,tsx}"
  - "**/[Ee]scrow*/**/*.{js,jsx,ts,tsx}"
---

# Payments, escrow and payouts

The highest-risk code in this project. Twelve controls were committed to the client here.
Plan before implementing, and say which controls your change touches.

## Money never moves from our code alone

The platform records **intent and authorisation**. The actual release is confirmed
provider-side by the client's own authorised user, under their own 2FA. No credential we
hold may release funds on its own. If a design would let our server move money
unattended, it is wrong — raise it.

## Required on every payout path

- **Tokenised beneficiaries (C1)** — send the provider's beneficiary token. Bank numbers in
  our database are display-only and can never redirect a payment.
- **Idempotency (C3)** — deterministic key per `(dealId, milestoneId, attempt)`, unique
  index in MongoDB, same key in the provider's idempotency header.
- **Cooling-off (C5)** — no release to a payout account changed within the last 48 hours.
  Enforced server-side, never in the UI.
- **Out-of-band alerts (C6)** — on account change, notify the **previous** email and mobile,
  not the new one. On every payout, notify exporter and client admin.
- **Name verification (C7)** — penny-drop, then match the returned holder name against the
  registered company name. Unmatched accounts stay unusable until an admin overrides with a
  logged reason.
- **Maker-checker (C8)** — `raisedBy` must never equal `approvedBy`. `escrow.approve` is its
  own permission, separate from every other employee permission.
- **Caps (C9)** — per-transaction and per-day limits checked server-side before the call.
- **Append-only audit (C10)** — every approval writes an immutable record: approver,
  timestamp, deal, milestone, amount, currency, beneficiary, masked account, and a snapshot
  of the verification signals as they appeared at that moment.
- **Off-server mirror (C11)** — approvals, payouts and account changes also stream to
  external storage.
- **Daily reconciliation (C12)** — scheduled comparison against the provider ledger, with an
  alert on any mismatch.

## Webhooks

Verify the HMAC against the **raw body before parsing JSON**. Express needs
`express.raw()` on the webhook route, not `express.json()`. Reject replays via event ID
plus a five-minute timestamp window. Never trust webhook payload fields for authorisation
decisions without re-reading our own state.

## Approval screens

View-only. Bank details cannot be edited from an approval screen. Account numbers are
masked; revealing one is a separate permissioned action that writes an audit entry.

## Never

- A code path that releases funds without an approval record
- Retry logic without an idempotency key
- A webhook handler that parses before verifying
- Any endpoint that lets a mobile client trigger a release
- Test fixtures containing real bank details
