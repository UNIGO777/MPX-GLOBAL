# Support runbook

Procedures for the platform's support person (a superadmin). Each one uses machinery that
already exists — nothing here needs a code change.

---

## 1 · A company's seller (or buyer) has left, and a replacement needs the account

**Why this is a support action.** Each company holds at most **one active buyer account and one
active exporter account** (build-prompt §A21, rule 1 — enforced by a database index). There is no
self-service way to add a second login or remove the current holder (owner decision, 2026-09-23).
Changing who holds a seat is done here.

**Before you start — confirm the request is genuine.** You are about to let a new person into a
company, with its verified tick, products and enquiry history. Verify the requester against the
company's registered details (the KYC documents on file) before acting. Never act on an email
alone.

**Steps**

1. In the admin console, find the departed person's account (`/admin/users`, search by email or
   mobile).
2. **Deactivate** it (`POST /admin/users/:id/deactivate`). This:
   - signs them out everywhere (their `tokenVersion` is bumped),
   - writes an audit entry,
   - **frees the company's seat** for that role.
3. Tell the replacement to **sign up normally** on the right portal (seller or buyer) with their
   own email and mobile.
4. At the company step they are offered the company **only if** their email or mobile matches
   the company's remaining member. Then:
   - if their email is that member's own address, they join directly;
   - otherwise a code goes to **that member's inbox**, and the member passes it on.
5. If the company has **no remaining active member** (both seats vacated), the signup will **not**
   offer the company — there is nobody left to vouch for the join. This case needs an engineer:
   do not work around it by editing the database by hand. Escalate.

**What the replacement inherits:** the company's profile, products, enquiries and verification
tick. A seller joining a buyer-only company must add the seller-side registered details, which
sends the company back for a quick verification check.

**Known consequence (accepted):** two sales people at one company share one seller login, so the
audit trail records the company's seller account, not which individual acted.

---

## 2 · "Someone joined my company and I don't recognise them"

The existing member is emailed on every join ("Someone joined your company"). If they report a
join they did not expect:

1. Find the new account in `/admin/users` and **deactivate** it immediately.
2. Check the audit trail for the company (`/admin/audit`, filter by the organisation):
   - `organisation.claim_attempt` rows show every join code that was sent, and whether the company
     was reached by **email** or **phone** (`matchedOn`);
   - the `organisation.claim` row shows how the join was proved (`verifiedVia`: `own_email` or
     `org_email_otp`).
3. If a seller joined and the company's tick was paused by the new seller-side details, the
   verification team re-reviews it from the queue as usual.
