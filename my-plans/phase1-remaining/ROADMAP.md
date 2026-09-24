# Phase 1 — remaining work, in order (owner, 2026-09-24)

Rule: **one step at a time.** A step is DONE only when it is built on web + app (where it applies),
tested (backend suite green + new tests + browser check), and logged in `docs/History.md`.
Then — and only then — the next step starts. Nothing in Phase 1 is "later".

---

## ▶ STEP 1 — Help & Support + complete quote Module 6 (Employee panel)   ✅ DONE 2026-09-24

Built already in Module 6: assignable permissions · seller verification · buyer approval ·
product monitoring · live-chat monitoring. Missing, in build order:

| # | Piece | What it is | Starts from |
|---|---|---|---|
| 1a ✅ 2026-09-24 | **Support contact shown everywhere** | Public read of `supportEmail`/`supportPhone`; shown on a Help/Contact page, the footer, buyer + exporter portals, the app, and the privacy page's "published contact address" | `Settings` model (built, no reader) |
| 1b ✅ 2026-09-24 | **Support tickets** (quote: "ticket/query queue") + dashboard section + ticket log | Buyer/exporter raises a ticket (web + app) → sees status + replies. Staff Support queue: open / in progress / resolved, assign, reply, audit rows. New grantable permission (e.g. `support:manage`) → Staff page shows 15 | `Ticket.js` skeleton only |
| 1c ✅ 2026-09-24 | **Internal notes** | Staff-only notes on an organisation and on a conversation (never shown to the company) | nothing |
| 1d ✅ 2026-09-24 | **Enquiry routing** | Staff connect a buyer to a seller manually (buyer asks for help finding a supplier → staff route it) | `Lead.js` model (platform-owned, `assignedTo`) |
| 1e ✅ 2026-09-24 | **Per-employee dashboard + reports** | "My work": tickets assigned to me, leads I route, my verification/moderation counts; scoped reports | nothing |

**Test gate:** new backend tests (ownership, permission default-deny, a company never sees internal
notes or another company's ticket), full backend suite green, web in the browser at
1680 / 1024 / 390, app parse/lint (device test still owed).

## STEP 2 — In-app notifications (quote Module 8)   ⏸ PENDING — owner put it on hold 2026-09-24; do not start until they say go

Bell + notification centre (web + app) on the `Notification.js` skeleton; which events feed it;
read/unread. Then the rest of Module 8 as decided: the approved "Request more information" email
(B2), admin per-type on/off, delivery tracking/retry, WhatsApp (quote says "partial").

## STEP 3 — Quotation & negotiation (quote Module 4, whole module)

Seller quote (template) · buyer accept / negotiate · history · employee email alert on a new
quote. `Quotation.js` skeleton only.

## STEP 4 — Loose ends before handover

- Consent capture at signup (C2) · app document file names (needs `expo-file-system` +
  `expo-sharing` — new deps, ask) · app logo/icon/splash to the red artwork · device test the app
- Security tracker evidence pass (0 of 58 recorded; ~25 built)
- International SMS provider swap (priced first)
- Deployment: `NODE_ENV`, `indexes:sync`, `TRUST_PROXY`, nginx WebSocket, credential rotation,
  secret scan
- Client inputs: support/privacy contact, Terms + Privacy text, company details, 40 category
  synonyms + images, domain

## Still guarded (unchanged)

Phase 2 (escrow, payouts, contracts, orders…), out-of-quote work, D3 (buyer approval gate),
D2. Each new email event still needs its own OK (D5 — six approved so far).
