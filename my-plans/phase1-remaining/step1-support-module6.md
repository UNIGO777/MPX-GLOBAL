# STEP 1 — Help & Support + complete quote Module 6 (Employee panel)

Owner decisions (2026-09-24): tickets from **signed-in buyers + exporters** (web + app) · v1 =
**thread + image/PDF/Word/Excel attachments** · **two emails** (staff reply → company, resolved →
company) · routing = **buyer asks, staff routes**. No new npm dependency anywhere in this step.

Built in five sub-steps; each ends green (lint, build, backend suite + new tests) before the next.

---

## 1a · Support contact shown everywhere (small)

- **Backend:** `GET /public/support-contact` → `{ email, phone }` from `Settings` (null-safe, rate
  limited, no auth). Nothing else from Settings becomes public.
- **Web:** new public `/help` page — contact card (email/phone, links), "Raise a support ticket"
  (signed in → portal Support; guest → sign in). Footer gains "Help & support". `Legal.jsx`'s two
  "published contact address" lines render the real address (fallback text if unset).
- **Portals:** "Help & support" nav item → `/buyer/support`, `/exporter/support` (1b's screens).
- **App:** Profile → "Help & support" screen (contact + tickets from 1b).
- **Email:** the shared template footer shows the support contact when set; the "someone joined
  your company" email's "contact support" line gets the real address.

## 1b · Support tickets

**Models (new/filled):**
- `Ticket` (tenant, `orgId`-scoped): `orgId`, `side` (`buyer`|`exporter`), `createdBy`, `ref`
  (short human ref, e.g. `T-4F9K2`), `subject` ≤120, `category` (account · verification ·
  products · enquiries & chat · technical · other), `status` (`open` · `in_progress` ·
  `resolved`), `assignedTo`, `lastMessageAt`, `unread: { company, staff }`, `resolvedAt`.
- `TicketMessage` (append-only, like chat `Message`): `ticketId`, `orgId`, `authorType`
  (`company`|`staff`), `authorId`, `body` ≤2000 (optional when a file is attached),
  `attachment` (same shape as chat: kind, storageKey, format, name, size).

**Company endpoints** (`requireRole` buyer/exporter; every query `{ _id, orgId: req.user.orgId,
side }` → 404, never 403): `POST /support/tickets` (multipart, optional file) · `GET
/support/tickets` · `GET /support/tickets/:id` · `POST /support/tickets/:id/messages` (a reply on a
resolved ticket re-opens it). Rate limit on create (e.g. 10/day/user).

**Staff endpoints** — new grantable permission **`support:manage`** (Staff page → 15):
`GET /admin/support/tickets` (status · category · side · assignee · "mine" · search by ref/org) ·
`GET /admin/support/tickets/:id` · `POST …/messages` · `PATCH …/status` · `PATCH …/assign`.
AuditLog row on reply, status change and assign. Staff replies post as **"MPX Global Support"** —
the company never sees which employee (same rule as `blockedBy`).

**Attachments:** reuse `chatAttachment.storage.service.js` (private Cloudinary, magic-byte check,
macro/script screen, signed short-lived URLs) with a `support/<ticketId>` folder — no second
upload path.

**Emails (2 new events → D5 count 6 → 8):** staff reply → ticket creator; ticket resolved →
creator. Both link to the ticket. Copy drafted in the plan review.

**Screens:**
- Web portal `/buyer/support`, `/exporter/support`: my tickets (status chips, unread dot) + "New
  ticket" drawer (subject, category, message, file) + ticket page (thread, reply box, attach).
- App: same, from Profile → Help & support.
- Admin `/admin/support`: queue (toolbar chips: status, category, side, assignee, "Assigned to
  me") + ticket view (thread, reply, status, assign, company link, internal notes from 1c).
- Sidebar item gated on `support:manage`.

## 1c · Internal notes (staff-only)

- `InternalNote` (platform scope, **append-only** — a record, like audit): `subjectType`
  (`organisation` · `conversation` · `ticket`), `subjectId`, `body` ≤2000, `authorId`.
- Read/add allowed by the subject's own permission: org → `organisation:read`; conversation →
  `conversation:read`; ticket → `support:manage`.
- Notes panel on Organisation detail, the conversation viewer rail, and the ticket view.
- 🔴 Never in any company-facing projection — pinned by a test.

## 1d · Enquiry routing ("help me find a supplier")

- `Lead` (platform-owned, already has `assignedTo`): `buyerOrgId`, `createdBy`, request
  (`what`, `categoryId?`, `quantity`, `unit`, `destinationCountry`, `note` ≤500), `status`
  (`new` · `in_progress` · `routed` · `closed`), `routedTo[]` (`exporterOrgId`, `productId`,
  `conversationId`, `at`, `by`).
- **Buyer** (web + app): "Help me find a supplier" form + "My requests" (status, suppliers
  connected, links to those chats).
- **Staff** — new grantable **`lead:manage`** (Staff page → 16): queue, assign, **route** = pick
  an exporter and one of its products → creates a normal enquiry + chat through the existing
  `createInquiry` path, owned by the buyer, with a platform notice "MPX Global connected you".
  If that (buyer, product) enquiry already exists, link it instead of duplicating.
- The exporter hears about it through the EXISTING new-enquiry push/email — no new event.

## 1b+ · Super admin dashboard — Support section (owner, 2026-09-24)

- A new **"Support tickets"** section on the super admin dashboard:
  - counts: open · in progress · unassigned · resolved in the last 7 days;
  - the **open tickets list** — ref, company, subject, category, age, and **who it is assigned
    to** (or an "Unassigned" chip) — each row opens the ticket;
  - "Assign" straight from the row for unassigned ones.
- A **ticket activity log** — "who did what, when": created, assigned (from → to), status
  changes, replied, **resolved by whom**, reopened by the company.
  - Per ticket: a timeline in the ticket view.
  - Across all tickets: a "Ticket log" tab on `/admin/support` with filters (employee, action,
    date range) — e.g. "resolved by Ravi, last 30 days".
  - Source: `AuditLog` rows written by 1b (append-only, so the log can't be edited).
- Visible to superadmins; employees with `support:manage` see the queue and a ticket's own
  timeline, and the cross-ticket log only for their own actions (the full team log is
  superadmin-only, like the reports in 1e).

## 1e · Per-employee dashboard + reports

- Dashboard gains **"My work"** for employees: tickets assigned to me (open), leads assigned to
  me, and my last-30-day actions (verifications decided, takedowns, blocks, tickets resolved,
  leads routed) — aggregated from `AuditLog`.
- **Reports** `/admin/reports`: an employee sees their own; a **superadmin** sees every
  employee (actions by type, 7/30/90 days, CSV export). Source: `AuditLog` only (no new data).

---

## Tests (new)

Ownership (company A never reads B's ticket/lead — 404) · side separation (a both-sides org's
buyer account never sees the exporter account's tickets) · permission default-deny on every new
admin route · staff identity never in company responses · internal notes never in company
responses · append-only (no update/delete route on TicketMessage / InternalNote) · every ticket
action writes exactly one log row with the acting employee · the team-wide ticket log refuses an
employee (their own actions only) · attachment
checks reused · the two emails fire once each · routing reuses an existing enquiry · report
scoping (employee sees only self).

## Docs updated in the same pass

`docs/Note.md` D5 (8 email events) + `.claude/rules/remind.md` mirror · `docs/month1-not-doing.md`
A2 items marked built · `web/src/lib/permissions.js` + server catalogue (16) · `docs/History.md`
per sub-step · `docs/Pending-Work.md` C4 closed.

## Not in Step 1

In-app notification centre (Step 2) · WhatsApp · SLA timers / auto-assignment · guest contact
form · ticket satisfaction ratings.
