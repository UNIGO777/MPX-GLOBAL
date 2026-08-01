# M5 — Admin Console · Backend Build Plan

**Source of truth:** `modules-in-detailed/m5/m5.md` (locked 29 Jul 2026; it wins over older plan
docs), with `m5-rules.md` as the hard rules and `m5-features.md` as the screen inventory.
Diagrams read alongside them (architecture, sidebar, cross-links).

**The defining property:** M5 introduces **no new models**. It is a read + aggregate layer over what
M1–M4 already store, plus moderation actions those modules already defined. Rule 14: if a screen
appears to need a new collection or persisted field, that is the signal the feature belongs
elsewhere — 🔴 stop and ask.

---

## 0 · What is already built (verified endpoint by endpoint, 2026-08-01)

**12 of 16 screens already have their backend.** M5 is much smaller than it looks.

| Screen | Backend | Where it came from |
|---|---|---|
| Login/OTP · User mgmt · Verification actions · KYC viewer · Employees | ✅ | M1 |
| Category tree · Sub-category CRUD + attributes · Product monitoring · Takedown/restore | ✅ | M2 |
| All conversations · Chat viewer (+ block/unblock) | ✅ | M4, built 2026-08-01 |
| **Dashboard** | ❌ | this plan |
| **Audit log viewer** | ❌ | this plan |
| **Organisation list** | ❌ | this plan |
| **Organisation detail** | ❌ | this plan |

⚠️ **The web screens do not exist for ANY of these** — no web frontend has been built. `S1` fires
before building any M1 screen. This plan is backend only.

---

## 1 · Owner decisions (2026-08-01) — all four §10 open items closed

- **D1 · Permissions: `organisation:read` + `audit:read`**, both grantable. **The dashboard takes no
  permission of its own** — each tile is filtered by what the caller already holds, exactly as the
  sidebar is, so a tile can never link an employee to a list they cannot open.
- **D2 · Scope: all four new backends + the five M4 gaps** found in the second review pass (§3).
- **D3 · Verification turnaround counts VERIFICATIONS ONLY.** `verifiedAt − kycSubmittedAt`, read
  straight from the fields. Rejections are excluded because `verifiedAt` is deliberately cleared on
  reject (it means "verified, and when"; a rejected org must not carry one — fixed 2026-07-31), so a
  rejection's decision time lives only in AuditLog. **Label the tile "average days to verify"**, not
  "to decision" — the number must not claim more than it measures.
- **D4 · F6 repeat-offender: show the count, build no threshold.** `Organisation.takedownCount` is
  already persisted and already on the monitoring list; the admin decides. No number, no automatic
  action — an auto-suspend on a mis-set trigger takes a whole company offline, so any automatic
  enforcement stays in FINALIZE.

---

## 2 · The four new surfaces

### 2a · Organisation list — `GET /admin/orgs` · `organisation:read`

Five columns only (a wider table breaks on responsive): **Company · Verification · Products ·
Takedowns · State**. Country and slug ship on every row anyway so the frontend can add the
recommended second line under the company name without another request.

- **Filters:** `side` (buyer/exporter/both) · `verification` (kycStatus) · `blocked` · `q` (name)
- **Sort:** takedown count desc, then `createdAt`+`_id` (rule 9 — a tiebreaker, or rows repeat)
- **Products count:** `countDocuments({ exporterOrgId, status: 'active', 'takedown.isDown': {$ne:true} })`
  — the same shape as the D1 cap query and the public `productCount`, batched per page, never N+1
- **Takedowns:** `Organisation.takedownCount` (§A24 — persisted, increment-only, purge-proof).
  Never counted from `Product` rows: blocked products hard-delete at 180 days, which would
  undercount repeat offenders exactly when it matters
- `q` is **regex-escaped and prefix-anchored** (rule 9); `pageSize` hard-capped

### 2b · Organisation detail — `GET /admin/orgs/:id` · `organisation:read`

Shows **both sides' sections when the company has both**, and only the side that exists otherwise.

**Always:** header (name · slug · sides · verified state + since · active/blocked) · company
(country · address · entityType · logo · description · created) · verification · sides · users ·
audit trail link · buyer-side chat count · exporter-side chat count.

**Three values have NO field anywhere and are derived from AuditLog** (rule 14 — do not add schema
fields for these):

| Derived value | Source |
|---|---|
| **Which side was actually reviewed** | `buyer.approve` vs `exporter.verify` rows ✅ both written today |
| **Resubmit count** | count of `kyc.submit` rows ✅ written today |
| **Side-enabled dates + claim history** | `auth.signup` ✅ + **`org.claim` ❌ NOT WRITTEN** |

🔴 **`org.claim` does not exist** because A21 Step 4b (signup step-2 organisation claim) is not
built. So **claim history will render empty** until it lands. The doc anticipated this ("once A21
Step 4b writes them"); the screen must say "no claim recorded", never imply the data is missing.

**Exporter side:** products by status (active/inactive/archived/blocked) · takedown count · link to
the monitoring list filtered to this org · link to the public seller profile.
**Buyer side:** enquiries sent (`Inquiry` count) · saved items (`SavedItem` count) · link to chats.
*(🚫 "working categories" was cancelled 2026-07-30 with "business type" — the field does not exist
and is not to be built. `entityType` carries that signal.)*

**Two things the response must be honest about (rule 13):**
1. **`kycStatus` is one shared value across both sides** — whichever side is reviewed first verifies
   the whole company, so the response carries `reviewedSide` and the frontend must show it, or an
   unreviewed exporter side reads as verified.
2. **Never-captured fields.** `registrationNumber`, `website`, `taxId`, `establishedYear`,
   `authorisedSignatory` exist on the model with no capture path (identity capture is Phase 2). The
   response marks them explicitly so the screen can label them "not captured" rather than render
   empty inputs awaiting data. **`website` additionally stays out of every PUBLIC projection** —
   this is a staff-only surface.

### 2c · Audit log viewer — `GET /admin/audit` + `GET /admin/audit/:id` · `audit:read`

List: timestamp · actor · action · target. Detail: the whole entry (before/after, reason, actor
role, target id). **Read-only and append-only — no edit, no delete, no exceptions** (rule 1).

- **Filters:** `actorId` · `action` · `from`/`to` date range · `entityType`+`entityId` (see W6 for
  validation)
- 🔴 **New index required: `{ action: 1, occurredAt: -1 }`.** §6 filters by action type and there is
  no index on `action` today. The collection is append-only so it only ever grows, and `kyc.view` +
  `conversation.read` make it the highest-write collection in the system — an unindexed filter here
  becomes a collection scan. **This is an index, not a schema field**, so it does not breach rule 14
- Actor names are resolved by a **batched** `User` lookup per page, never per row — and
  **`actorId: null` renders as "System"** (the 180-day purge writes exactly that — W2)
- `pageSize` hard-capped; sort `occurredAt` desc + `_id` tiebreaker

**Coverage check against §6 — all present except one.** `kyc.submit` · `kyc.view` ·
`buyer.approve`/`reject` · `exporter.verify`/`reject` · `product.takedown`/`restore` ·
`product.purge` · `conversation.block`/`unblock` · `conversation.read` · `user.activate`/`deactivate`
· `employee.permissions.update` · `org.block`/`unblock` — ✅ all written today.
❌ **`org.claim`** — missing, see 2b.

### 2d · Dashboard — `GET /admin/dashboard` · no permission of its own (D1)

Three bands, ordered by how often they are acted on. **Every number is a link target**, so each tile
carries the query that reproduces its list — a count that cannot be clicked through is a dead end.

**Needs action:** pending verifications **buyer and exporter counted separately** · rejected awaiting
resubmit · blocked products · nearing purge (blocked 150+ days).

⚠️ **The two verification tiles are NOT independent queues.** `kycStatus` is one shared value, so a
both-sides org in `submitted` appears in **both** tiles, and whichever review runs first verifies the
whole company. The response therefore also returns `bothSidesPending` so the screen can say so —
otherwise the two numbers read as two separate reviews and sum to more work than exists.

**Health:** verification turnaround — average days `kycSubmittedAt → verifiedAt`, **verifications
only** (D3).
**Totals:** organisations by side (buyer / exporter / both) · active products · conversations · users.

**Permission filtering:** a tile is computed and returned **only if the caller holds the permission
for the list it links to** (`buyer:approve` → buyer queue, `exporter:verify` → exporter queue,
`product:read` → product tiles, `organisation:read` → org totals, superadmin → everything). An
employee holding only `exporter:verify` has no reason to see the buyer queue.

**Deliberately absent:** saved-item counts, message counts, trend graphs, error tile. Month 1 will
not have enough data for a graph to mean anything, and the error log moved to FINALIZE.

---

## 3 · Five M4 gaps found reviewing M5 (D2) — two are rule violations

| # | Gap | Why it matters |
|---|---|---|
| **G1** 🔴 | `/admin/conversations` uses **skip pagination**; `m5-rules §9` requires **cursor** for conversation lists | The list sorts by `lastMessageAt`, so every new message shifts rows — a moderator paging through sees repeats and gaps. The party list already uses a cursor; only the admin one was wrong |
| **G2** 🔴 | The **staff conversation view has no `unread`** | `m5-features #10` lists it as Data — *the parties'* unread, derived from `buyerLastReadAt`/`exporterLastReadAt` (admin has no read-tracking of its own). It is how a moderator spots a thread the seller never opened |
| **G3** | No way to filter admin conversations **by product** | §4's action list includes "view that product's chats". Today `q` branches only on an **org** id; a product id matches nothing |
| **G4** | No way to filter **by one side** | §7 requires two separate sections and explains why they work — "each filtering on its own field". The current search always `$or`s both org ids, so a both-sides company cannot be split |
| **G5** | Monitoring returns `takedown.byUserId` as a **raw id** | The screen wants *who* took it down. Needs a batched actor-name lookup — **staff view only**; §A9 keeps the acting admin invisible to the seller, and that must not regress |

---

## 3b · 🔎 Verification pass on this plan — five holes closed

**V1 · 🔴 The dashboard route had no role gate.** D1 says it takes no *permission*, and the first
draft turned that into `authenticate` only — which would let a **buyer or an exporter** hit an
`/admin/*` route. They would get an empty object (no permissions, no tiles), but a party account
reaching an admin endpoint at all is wrong. **Gate: `requireRole('employee', 'superadmin')`**, then
filter tiles by permission inside. "No permission of its own" never meant "no gate".

**V2 · Org detail must not leak other users' permissions.** The Users section lists every person on
the Organisation, and rule 8 forbids returning *another user's* permissions. The projection is
`{ id, name, email, role, isActive, lastLoginAt }` — **no `permissions`, no `passwordHash`**.
Permission sets are the Employees screen's job, and that is superadmin-only.

**V3 · Org detail must not carry KYC documents.** `organisation:read` is a weaker grant than
`kyc:view`. The detail returns the verification *status* plus a **link**, never `kycDocuments` or a
`storageKey` — the documents stay behind their own permission and their own `kyc.view` audit row.
Anything else would let `organisation:read` silently escalate into document access.

**V4 · The org list's product counts must not be N+1.** "Batched per page" was asserted without a
method. It is **one aggregation** over `Product` — `$match` the page's `exporterOrgId`s, `$group` by
org with the active/not-taken-down filter — then joined in memory. Twenty orgs must cost one query,
not twenty.

**V5 · `GET /admin/orgs/:id` must refuse the platform org.** `Organisation` also holds the single
`type: 'platform'` row that owns the superadmin. It is not a company, has no sides, no products and
no chats, and rendering it as one is meaningless. The list filters it out and the detail returns
**404** — the same posture `loadCompanyOrg` already takes for block/unblock.

## 3c · 🔎 Second verification pass — six more, two of which would make a screen lie

**W1 · 🔴 The "nearing purge" tile must use the purge job's OWN filter, or the countdown lies.**
The job matches `takedown.isDown: true` **AND** `takedown.at <= cutoff` **AND**
`status: { $ne: 'archived' }` — archived rows are never purged (A7). The plan said only "blocked
150+ days". Without the archived exclusion the tile counts products that will **never** be deleted,
and an admin watching a countdown that never fires stops trusting the number. **Reuse the job's
filter, do not re-write it** — `PURGE_AFTER_DAYS` is already exported from `adminProducts.service`.

**W2 · 🔴 The audit viewer must handle a NULL actor.** `purgeBlockedProducts` writes
`actorId: null` — it is a system job with no acting user, deliberately. A batched user lookup leaves
that row nameless. It must render **"System"**, and the 180-day purge is precisely the entry a
dispute is most likely to need. *(Verified in code, not assumed.)*

**W3 · An archived product COUNT is not an archived product LIST.** §7's exporter side shows
products by status including `archived`, while §4 hides archived rows from monitoring entirely. Both
are correct — but the count must **not** link into the monitoring list, because that list can never
show those rows. This is §4's own accepted gap ("archived invisible to the admin") surfacing on a
different screen; render the number without a link.

**W4 · Correction to my own rationale for the audit index.** I wrote that "every admin read writes a
row". It does not — only `kyc.view` and `conversation.read` do. The index is still needed (those two
are the highest-frequency writes in the system and the collection is append-only, so it only ever
grows), but the plan should not overstate the reason it is asking for something.

**W5 · "Returns a link" is not a backend contract.** V3 said the org detail returns "a link" to the
KYC documents. An API returns data. It returns **`kycDocumentCount`** so the screen can show or hide
the entry point — and the documents themselves stay behind `kyc:view`, on their own endpoint, still
writing their own `kyc.view` audit row. A count is not document access.

**W6 · Filter inputs need validating, not just accepting.** `from`/`to` must parse as dates and
`from <= to` (an inverted range silently returns nothing, which reads as "no activity"). `action` is
a bounded string — deliberately **not** an enum, because the action list grows with every module and
a stale allowlist would hide new entries — but the response should say when a filter matched zero
rows so a typo is distinguishable from genuine silence.

---

## 4 · Endpoints

| Method | Path | Gate | Notes |
|---|---|---|---|
| GET | `/admin/orgs` | `organisation:read` | 5 columns + country/slug; filters; sorted by takedowns |
| GET | `/admin/orgs/:id` | `organisation:read` | both-sides aware; derived values from AuditLog |
| GET | `/admin/audit` | `audit:read` | actor · action · date range · target; batched actor names |
| GET | `/admin/audit/:id` | `audit:read` | full entry |
| GET | `/admin/dashboard` | `requireRole('employee','superadmin')` | no *permission* of its own (D1), but a role gate — see V1. Tiles filtered by held permissions |
| GET | `/admin/conversations` | `conversation:read` | **changed**: cursor (G1), `+unread` (G2), `?productId=` (G3), `?side=&orgId=` (G4) |
| GET | `/admin/products` | `product:read` | **changed**: takedown actor name (G5) |

Existing block/unblock, verify/reject, activate/deactivate and category routes are unchanged.

---

## 4b · Phases

Ordered by real dependency, not by size. Each phase ends green before the next starts.

**M5-A · Foundation.** The two new permission strings in the catalogue (`organisation:read`,
`audit:read`) and the new AuditLog index `{ action: 1, occurredAt: -1 }`.
*Everything below needs one or the other. Tests: the strings are assignable and rejected when
mistyped; the index exists.*

**M5-B · The five M4 gaps (§3).** G1 cursor · G2 staff unread · G3 `?productId=` · G4 `?side=&orgId=`
· G5 takedown actor name.
*Deliberately first among the real work: two are rule violations in shipped code, and **G4 unblocks
M5-D** — Organisation detail cannot render its two separate chat sections without it. Existing M4
tests must stay green, and the §A9 regression (seller never sees `byUserId`) is re-asserted.*

**M5-C · Audit log viewer.** `GET /admin/audit` + `/admin/audit/:id`, filters, batched actor names.
*Needs M5-A's index. The append-only guarantee is re-proven from the route side: no path edits or
deletes a row.*

**M5-D · Organisation list + detail.** Both endpoints, the AuditLog-derived values, the
"not captured" flags, the platform-org exclusion (V5).
*Needs M5-B/G4. This is the largest phase and carries the most honesty requirements — `reviewedSide`,
the block's real reach, and the empty claim history.*

**M5-E · Dashboard.** `GET /admin/dashboard`, permission-filtered tiles, `bothSidesPending`,
verifications-only turnaround.
*Last, because every tile links to a list built in M5-B/C/D — building it first would mean linking
to endpoints that do not exist yet.*

**M5-F · Cross-module pass.** Full M1+M2+M3+M4+M5 suite, an adversarial pass over the new admin
surface (permission escalation, IDOR, projection leaks), and three consecutive clean runs.

---

## 5 · Rules this build must not break

- **Rule 1 — admin never deletes.** No delete endpoint anywhere in M5. The only deletion in the
  system stays the automated 180-day purge
- **Rule 2 — takedown never touches `status`**; "Blocked" reads `takedown.isDown`, never `status`
- **Rule 3 — admin cannot edit seller content.** M5 adds **read endpoints only** plus the moderation
  actions M1/M2/M4 already defined. No new write path
- **Rule 5 — governance stays hard `requireRole('superadmin')`**: user activate/deactivate, employee
  create, permission assignment, org block/unblock. `organisation:read` and `audit:read` are READS
- **Rule 7 — staff reads are RBAC-scoped, not org-owned.** `findOne({ _id })`, missing → **404**
- **Rule 8 — never return a raw document.** Every response is a curated projection; `kycDocuments`,
  `passwordHash`, tokens and other users' permissions never appear
- **Rule 11 — the org block does NOT cascade to catalogue/products/chats.** The detail response must
  report what a block actually does, or an admin blocks a company and leaves its listings live
- **Rule 14 — no new models.** Verified: every field these screens read already exists

---

## 6 · Test plan

| Area | Must prove |
|---|---|
| **Permissions** | no grant → 403 on every new route; `organisation:read` alone cannot read audit and vice versa; superadmin passes both; unknown permission string rejected by the catalogue validator |
| **Dashboard filtering** | an employee with only `exporter:verify` gets the exporter tile and **not** the buyer tile; a superadmin gets all; every returned tile carries the query that reproduces its list |
| **Both-sides honesty** | a both-sides org in `submitted` appears in **both** verification tiles and is reported in `bothSidesPending`; `reviewedSide` reflects which of `buyer.approve`/`exporter.verify` actually ran |
| **Turnaround (D3)** | averages verifications only; a rejected org does **not** contribute; a never-verified org does not skew it |
| **Org list** | counts match reality; takedowns read `Organisation.takedownCount` and **survive a purge**; sort tiebreaker keeps paging stable; `q` is regex-escaped (`.*` matches nothing) |
| **Org detail** | both-sides org shows both chat sections with **separate** counts (G4); never-captured fields are flagged, not blank; `website` absent from any public projection; claim history renders empty (no `org.claim` rows) without erroring |
| **Audit viewer** | filters work; the new `action` index exists; actor names batched; **append-only proven — no route can edit or delete a row** |
| **G1 cursor** | admin conversation paging is stable when a new message arrives mid-scroll |
| **G2 unread** | staff view reports the PARTIES' unread; reading as admin never changes it |
| **G3/G4 filters** | `?productId=` returns that product's threads only; `?side=buyer&orgId=` and `?side=exporter&orgId=` split a both-sides company into two clean lists |
| **G5 actor name** | staff monitoring shows who took a product down; the SELLER's own view still never sees `byUserId` (§A9 regression) |
| **Rule 1** | no admin route deletes a product, org, user or audit row |
| **V1 role gate** | a buyer and an exporter both get **403** on `/admin/dashboard`, not an empty object |
| **V2 no permission leak** | org detail's user list carries no `permissions` and no `passwordHash` for anyone |
| **V3 no KYC escalation** | `organisation:read` alone returns **no** `kycDocuments` and no `storageKey`; documents still need `kyc:view` and still write a `kyc.view` audit row |
| **V4 no N+1** | a 20-org page issues **one** aggregation for product counts, not twenty queries |
| **V5 platform org** | the platform org is absent from the list and 404s on detail |
| **W1 purge tile** | an **archived** taken-down product is NOT counted as "nearing purge" — it will never be purged (A7), and the tile must agree with the job |
| **W2 system actor** | the `product.purge` row (`actorId: null`) renders as **"System"**, never blank, and its snapshot still shows the product and seller names |
| **W3 archived count** | the exporter-side archived count is returned, and the monitoring list still refuses to show archived rows — the two do not contradict |
| **W5 KYC count only** | org detail returns `kycDocumentCount`; fetching a document still requires `kyc:view` and still writes a `kyc.view` row |
| **W6 filter validation** | an inverted `from`/`to` range is a **400**, not a silent empty page |
| **Regression** | the full M1+M2+M3+M4 suite stays green |

---

## 7 · Accepted gaps to state plainly

- **`org.claim` audit rows do not exist** until A21 Step 4b is built, so claim history and
  side-enabled dates render empty (§2b)
- **Archived products are invisible to the admin forever** (§4's own accepted gap) — a later "the
  seller listed it then deleted it" dispute has nothing to show. A link from the audit log could
  cover it later
- **A block does not hide the seller's listings** — F1-B, FINALIZE. Already pinned by a test in M4
- **The verification queue is org-centric**, but the built `GET /admin/users?kycStatus=` returns
  USERS — an org with three users appears three times. The Organisation list (§2a) with a
  `verification` filter is the correct queue and supersedes it
