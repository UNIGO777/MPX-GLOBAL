# MPX Global — demo accounts

Test logins for the client to try every panel. Created by
`npm run seed:test-accounts` in the backend.

> 🔴 **Development deployment only.** These accounts, and the fixed sign-in code
> below, exist only where the server runs with `NODE_ENV=development`. They do
> not work on production and must never be created there.

---

## The accounts

| Panel | Email | What it is |
|---|---|---|
| **Buyer** | `demo-buyer@mpx.test` | A buyer of "Demo Buyer Imports" (UK). Browse the catalogue, send enquiries, chat with sellers. |
| **Exporter** | `demo-exporter@mpx.test` | A seller at "Demo Exports" (India). Add listings, receive enquiries, reply in chat. |
| **Employee** | `demo-employee@mpx.test` | Staff. Reviews verifications, views KYC documents and companies, reads conversations and the audit log. |
| **Super admin** | *(your seeded superadmin)* | All-access. Created separately by `npm run seed`. |

**Password:** the same for all three, set as `SEED_TEST_PASSWORD` in the server's
`.env`. Share it with the client by whatever channel you normally use — it is
deliberately not written in this file or anywhere else in the repository.

**Sign-in code (OTP): `000000`** — every login asks for a code. On a development
server no real SMS or email is sent; the code is always six zeros.

---

## 🔴 Nothing is pre-verified, on purpose

Both the buyer and the exporter start exactly as a brand-new signup leaves them:
**no KYC submitted, no documents, no verified tick.**

This is so the client can walk the whole journey rather than look at a finished
screenshot:

1. Sign in as the **exporter** → company profile → upload KYC documents → submit.
2. Sign in as the **employee** → verification queue → open the documents → approve
   (or reject with a reason, or request another document).
3. Back as the **exporter** → the verified tick is now on the public profile, and
   the three-listing limit for unverified sellers is lifted.

The same review flow works for the buyer's verification.

---

## What the employee can and cannot do

The employee holds a **reviewer's** permissions — verification, KYC document
view, company and user directory read, conversation read, audit log — and not the
whole console. That is the product working correctly, not a missing feature: the
panel is drawn from permissions the server grants, and governance actions
(creating employees, blocking a company, changing permissions) are super-admin
only by design.

Use the **super admin** account to see everything.

---

## Notes for whoever runs the demo

- **Delete these before real users arrive.** Every email ends in `@mpx.test`, so
  they are easy to find and remove. They are shared generic logins, which the
  platform's own rules forbid for real staff.
- Re-running the seed command is safe: accounts that already exist are left alone.
- If the OTP is rejected, the server is not in development mode, or
  `OTP_DEV_FIXED_CODE=true` is missing from its `.env`.
