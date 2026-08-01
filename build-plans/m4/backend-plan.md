# M4 — Enquiry & Chat · Backend Build Plan

**Source of truth:** `modules-in-detailed/m4/m4.md` (locked; it wins over the PNGs and over older
plan docs by its own precedence line). Diagrams read alongside it: `m4.png`, `Models.png`,
`enquiry+chat-flow1.png`, `product-enquire-flow2.png`, `admin-block.png`, `Buttons-summaries.png`,
`screens.png`.

**Depends on:** M2 (Product, Category) ✅ built · M3 (public seller projection) ✅ built.

---

## 0 · Scope

### In (month 1)
Enquiry creation · one thread per (buyer org, product) · messaging with server-side guards ·
read/unread · role-aware chat list with native `$text` search · admin read + chat block/unblock ·
product-state effects on threads · Socket.io live delivery + freeze push · **socket reconnect
recovery** · **FCM push (narrow slice)** · F4 self-enquiry guard (M4-39).

### Out — deferred, do NOT build (each still red-alert guarded unless noted)
| Item | Where it is deferred |
|---|---|
| Quotation / negotiation, `Quotation` skeleton | `month1-not-doing.md` A1 — **do not touch the model** |
| Email · WhatsApp · `Notification` model · in-app centre · admin per-type toggles · delivery tracking + retry | A3 / D5 — **still on hold** |
| Push on any **non-M4** event (signup, verify/reject, quotation) | A3 / D5 |
| Enquiry routing (employee connects buyer↔seller manually) | A2 |
| Employee panel UI | A2 — month 1 is **read permission only** (M4-38) |
| `Inquiry.status` lifecycle | m4.md §13 — field is written at creation and left alone |
| Attachments (M4-14) · contact-detail detection (M4-15) | m4.md / Phase 2 |
| User report option | m4.md §13 |
| **F1-B account-block cascade** (§6.5) | FINALIZE — and its doc **forbids staging it as dormant code here** |

### ✅ Owner decisions pulled INTO month 1 (2026-07-31)
- **FCM push**, narrow slice only — schedule change, not scope change (Module 8 is already Phase 1).
  Recorded in `scope-guard.md`, `remind.md`, `month1-not-doing.md` A3, `Note.md` D5.
- **Socket reconnect recovery** — was only in `m4.md` §13's own month-2 list, never in a scope
  bucket, so it needed no alert. Deviation recorded here.

---

## 1 · Contradictions found in the plan — and how this build resolves them

| # | Contradiction | Resolution |
|---|---|---|
| **C1** | §4 Message table says `body \| max 200 characters`, but **M4-12** exempts the composed first message and system messages — a model-level cap would **reject the thread's own opening message** | **M4-12 wins** (later decision, and it says so explicitly). **No `maxlength` on the model.** The 200 cap is enforced at the route/socket boundary for `senderType: buyer\|exporter` only. Model keeps a generous hard ceiling (4000) purely as an abuse backstop |
| **C2** | `m4.png` shows an **"Atlas Search index"** | Stale — **§A26 reversed to native `$text`**; `m4.md` §8.3 is already corrected. One compound text index on Conversation |
| **C3** | `Models.png` omits `Inquiry.fields`, `Inquiry.note`, `Conversation.buyerOrgName/exporterOrgName`, `blockedReason/By/At` | `m4.md` §4 wins (precedence line) — build the fuller field set |
| **C4** | `Buttons-summaries.png` row *"Product delete ho gaya → red label"* vs **M4-20** (seller archive → chat unaffected, **no label**) | **M4-20/M4-22 win.** Red label belongs to the **180-day purge only**. Seller archive/inactive changes nothing on the thread. ⚠️ *One-line owner confirmation requested* |
| **C5** | **M4-22** says the label turns red at purge, but **M4-29** says `frozenReason` is set once and never overwritten | `frozenReason` records **why messaging froze** and stays `takedown`. **`purged` is not a frozen reason** — the red label is **derived at read time** from "the product row no longer exists". Keeps M4-29 literally true and needs no purge-time write to every conversation |
| **C6** | `src/models/Inquiry.js` comment says *"Detailed fields land in M2"* | Stale — it is M4. Fix the comment when fleshing the model |

---

## 2 · Decisions taken in this plan (owner may override any)

**FCM (the three questions, defaults applied):**
- **D-N1 — no message body in the push.** Payload is *"New message from {Company} — {Product}"*.
  The entire module exists to keep contact and commercial detail off other channels; a push lands
  on a **lock screen**. One template function, trivial to change.
- **D-N2 — notify every active user of the counterparty org.** An Organisation can hold several
  users and any of them may be the one watching.
- **D-N3 — suppress when the user is already in that room** (socket presence), and never notify
  the sender.

**Other build decisions:**
- **D-M1** — `Message.body` has no model cap (C1); boundary enforces 200 for user sends.
- **D-M2** — **two** new permission strings (the catalogue has none for chat):
  **`conversation:read`** and **`conversation:block`**. Superadmin is all-access as always;
  employees need each grant individually (default deny). Admin/employee **reads are audited**
  regardless of which permission carried them (M4-34).
  🚫 **Owner override of M4-38 (2026-07-31).** M4-38 reads *"In month 1 employees get **read
  permission only**"*. The owner has decided employees must be **grantable the block permission
  too**, so `conversation:block` exists from month 1. Still least-privilege — it is granted
  per-employee, never blanket (`security-baseline` "Least privilege"), and the **employee panel UI
  is still month 2** (A2), so grants are made by the superadmin through the existing
  `PATCH /admin/employees/:id/permissions`. Recorded as a deviation in `m4.md` M4-38 and
  `docs/History.md`.
- **D-M3** — **rate limit on message send** (`messageLimiter`). M4-5 makes one-enquiry-per-product
  the spam control for *threads*, but messages are unbounded and the `api-endpoints` rule requires
  limits on write paths of this kind.
- **D-M4** — `productNameSnapshot`, `buyerOrgName`, `exporterOrgName` are written at creation.
  The org-rename sync function is **written here** but has **no caller yet** — the A22 org-edit
  endpoint does not exist (verified: `rebuildForOrganisation` has no caller outside searchSync
  either). A22 wires both when it lands. Recorded as a known unwired hook, not a silent gap.

---

## 3 · ✅ §14 open items — BOTH LOCKED by the owner (2026-07-31)

**O1 · Welcome message (M4-11) — final wording, use verbatim:**

> *MPX Global is part of this conversation. Please keep all discussion and documents here — it is
> how we can support you if anything goes wrong.*

Deliberately avoids the "complete your deal" phrasing m4.md §14 flagged as pushing deals
off-platform against the Phase-2 escrow model. One template; only names change, or it runs with
no names (M4-11).

**O2 · Enquiry fields (M4-7 / M4-9) — locked.** Mirrors `Product`'s own goods/service split so
both forms speak the same language:

| Type | Fields |
|---|---|
| **Goods** | `quantity` (number) + `unit` (string) · `targetPrice` (number) + `currency` (ISO-4217) · `deliveryCountry` (ISO alpha-2) · `deliveryTimeline` (string) |
| **Services** | `engagementType` · `budget` (number) + `currency` · `timeline` · `deliveryModel` |
| **Both** | `note` — free text, **200 chars**, the only free field (M4-7) |

All optional except `note`; unknown keys **rejected** at the boundary (not stripped — same posture
as `rejectMongoOperators`); shape chosen by the **sub-category's `type`**, exactly as the product
form does (M4-9). `currency` uses the existing ISO-4217 allowlist; `deliveryCountry` the ISO
alpha-2 check.

**C4 confirmed by owner:** seller archive/inactive changes **nothing** on a thread (M4-20); the red
label belongs to the 180-day purge alone (M4-22). `Buttons-summaries.png` is stale on that row.

---

## 3b · 🔎 Gaps found on re-reading this plan — now covered

The first draft named the phases but left holes a coder would hit. Twelve, in rough severity order.

### 🔴 Security / data-exposure

**G1 · `blockedBy` must never reach a party.** M4-25 says **both parties see the reason** — it says
nothing about *who* wrote it. This is the same rule as A9's `takedown.byUserId`, which the seller
must never see. The party projection carries `blockedReason` **only**; `blockedBy` / `blockedAt`
are staff-view fields. *(Not stated in the first draft — it would have leaked the acting admin.)*

**G2 · `senderUserId` must never reach the counterparty.** M4-17 is explicit: **company names,
never person names.** The stored `senderUserId` is for our own audit, not for display. The message
projection exposes `senderType` only, never the user id or any person's name.

**G3 · `Message` cannot use `ownershipFilter` — it has no owner field.** It is scoped *through* its
conversation. The rule is therefore: **always load the Conversation first, assert the caller's org
is in `parties` (404 if not), and only then query messages by `conversationId`.** Never query
Message by id alone. Same 404-never-403 posture as everywhere else.

**G4 · Enquiry creation is buyer-only, and only on a publicly visible product.** Two guards the
first draft omitted, both mirroring M3's `POST /saved`:
- `requireRole('buyer')` **plus** the org's `buyerSide` flag — an exporter account cannot enquire
  (§A13's posture; superadmin is blocked too, exactly as `saved` blocks it).
- The product must pass the **shared availability check** — draft / inactive / archived /
  taken-down / dead-category all → **404**, never a thread. Reuse
  **`getPublicProduct(idOrSlug)`** from `publicProducts.service.js` (it already composes
  `buildAvailabilityFilter()` and throws the 404), never a hand-rolled check, so it can never
  drift from search. *(Corrected in the verification pass — the first draft named
  `buildPublicProductFilter`, which is the **list** builder and takes `{category, seller}`; it is
  the wrong helper for a single product.)*

### 🟠 Correctness — would have caused rework

**G5 · The `$text` + org-id search trap (M3 already paid for this one).** §8.4 wants three names
**and** two ids matched. But native `$text` **must be the first `$match` and cannot sit inside an
`$or`** — so "name OR id" in one query is impossible. Resolution: **branch on the input.** If `q`
parses as an ObjectId → an exact `$or` on `buyerOrgId`/`exporterOrgId`, no `$text` at all.
Otherwise → `$text`. Two branches, one shared scope filter and one shared projection, so §8.4's
"one path, one filter" intent survives where it actually matters.

**G6 · Cursor pagination needs a tiebreaker.** Sorting by `lastMessageAt` alone is unstable —
timestamps collide and a row can be skipped or repeated across pages. Cursor is
**`(lastMessageAt, _id)`**, both in the sort and in the cursor. Same fix M3's list paths carry.

**G7 · Unread must not be an N+1.** §7.5 says "no counters", derived by comparison — but deriving a
*count* per row means one query per conversation. Resolution: the list returns a **boolean**
`unread` = `lastMessageAt > myLastReadAt`, which is free (both fields are already on the row). The
nav badge is **one** `countDocuments` over the caller's conversations with that same comparison —
not a per-row count. No counter is stored, so §7.5 holds.

**G8 · The product page's button state needs a source.** `Buttons-summaries.png` / screens.png
switch between *Create enquiry* and *Open chat*, which means the client must know whether a thread
exists. `GET /public/products/:id` is a **public, guest-cacheable** endpoint and must not grow a
per-user field. Resolution: a separate authenticated lookup
**`GET /conversations/by-product/:productId`** → `{ conversationId }` or 404. Keeps the public
projection untouched (the `m3-public-projection` rule) and costs one indexed query.

**G9 · Reconnect replay must be bounded.** "Replay what I missed" is unbounded — a user offline for
a week would be sent thousands of messages over the socket. Cap the replay (e.g. 100); beyond it
the server tells the client to refetch that thread over REST instead. The socket is for *live*
delivery, not bulk history (§7.1).

**G10 · `DeviceToken` needs upsert semantics, not plain insert.** The token is unique, but a device
can change hands (user logs out, another logs in) — a plain insert would collide forever.
Register is an **upsert on `token`** that reassigns `userId`/`orgId` and bumps `lastSeenAt`.
Logout should drop the caller's token.

### 🟡 Specification detail

**G11 · Audit scope, stated precisely.** §12 says "every admin or employee read of a conversation".
Audit `GET /admin/conversations/:id` **and** its message fetch (that is where content is read);
do **not** audit `GET /admin/conversations` (the list is metadata, and auditing every keystroke of
a search would drown the log). Actions: `conversation.read` · `conversation.block` ·
`conversation.unblock`.

**G12 · Rate limits, with numbers.** Two new limiters:
- **enquiry creation** — 20/hour per user. M4-27 deliberately lets a blocked buyer open a thread on
  another product, which makes thread-creation spam the obvious abuse path.
- **message send** — 60/minute per user. M4-5 makes one-enquiry-per-product the *thread* control;
  messages themselves are unbounded without this.

### 🧾 Verification pass — 11 more, found by walking M4-1…M4-39 one by one

**V1 · M4-1 was not implemented anywhere.** The decision is not just "the platform is in the room" —
it says the platform's presence *"stays visible in the thread **header or participant list**, not
just in the opening message."* Nothing in the projection carried it. The party view gains a
**`participants`** block: `[{type:'buyer',name}, {type:'exporter',name}, {type:'platform',name:'MPX Global'}]`.
Composed at read time; **the platform is still never written into `parties`** (M4-2).

**V2 · M4-13 was not implemented.** *"Sent messages can never be edited or deleted, by anyone."*
There is no PATCH/DELETE in the endpoint table, but absence is not enforcement — this is the same
posture as the append-only AuditLog (`security-baseline` rule 5). Enforce on the **model**: block
`findOneAndUpdate` / `updateOne` / `updateMany` / `deleteOne` / `deleteMany` on `Message` via
pre-hooks, so no future code path can quietly edit history. Mirror what `AuditLog` already does.

**V3 · M4-19 was not implemented.** *"Colour never carries meaning alone. Every label pairs a colour
with text."* The plan carried only `frozenLabel: none|yellow|red` — a colour on its own, which is
exactly what the decision forbids and an accessibility commitment besides. The projection returns
**`frozenLabel: { tone, text }`** — e.g. `{tone:'yellow', text:'Product under review'}`,
`{tone:'red', text:'Conversation blocked by MPX Global'}` / `{tone:'red', text:'Product no longer available'}`.

**V4 · Wrong helper named for the availability check** — corrected in G4 above.

**V5 · `withPartiesScope` silently adds `isActive`.** Verified in `models/scoping.js`: the mixin
adds `buyerOrgId`, `exporterOrgId`, `parties` **and `isActive: true`**. On `Conversation` that is a
second, competing notion of "switched off" sitting next to `frozen`, and two flags meaning almost
the same thing is how a thread ends up half-open. **Decision: use the mixin, ignore `isActive`, and
never read or write it on Conversation** — `frozen` + `frozenReason` are the only state. Documented
in the model so nobody wires it later. *(Do not modify the shared mixin — M1/M2 models depend on it.)*

**V6 · Enquiry creation is four writes with no transaction.** Inquiry → Conversation → message #1 →
message #2, on standalone MongoDB (no replica set, so no transactions — the same constraint M1's
`createUserWithOrg` works around). A failure midway leaves an orphan Inquiry, or a thread with no
messages that renders blank forever. **Order + compensation:** create Inquiry, then Conversation,
then both messages; if any step throws, **delete what this request created** and surface a clean
error — exactly the compensation pattern `createUserWithOrg` uses.

**V7 · The unique-index race must not surface as a 500.** Two concurrent enquiries on the same
product both pass the "does a thread exist?" check; one wins the unique index and the other gets
**E11000**. Catch it and **return the existing thread** (M4-5: a second enquiry never opens a second
thread). Same shape as `createOrgHandlingDuplicates`. Without this the loser sees a raw 500.

**V8 · The admin-block guard was muddled** — §5b listed `conversation:read` **and**
`requireRole('superadmin')`, which is incoherent (superadmin is all-access, so the permission adds
nothing). Corrected to a **hard `requireRole('superadmin')` only**, matching M2 moderation.

**V9 · M4-32 had no test.** *"Search covers the conversation list only. Message content is never
searched."* Added: a message containing a distinctive word must **not** surface in list search.

**V10 · The reconnect event does not exist in §11.** §11 is a closed list and has no replay event —
reconnect recovery is our approved addition, so it needs a new pair, named here so it is not
invented ad hoc at build time: client → `conversation:resync {conversationId, lastMessageId}`,
server → `conversation:resync:result {messages[], truncated}` (`truncated: true` tells the client
to refetch over REST — the G9 cap).

**V11 · `Inquiry.categoryId` was dropped.** The existing skeleton carries it; keep it — it costs
nothing and month-2 routing/reports will want it.

### ⚠️ Two interactions to state, not fix here

- **A blocked org's products are still publicly visible** (the known F1-B gap), so a buyer can
  today create a **live thread with a blocked company**. Not introduced by M4 — but M4 makes it
  visible. Closing it belongs to F1-B in FINALIZE; **do not** bolt a partial cascade on here.
- **M4-28** (buyer blocked → seller sees it, chats freeze) is **F1-B's cascade**, which is deferred.
  So in month 1 a blocked account's threads do **not** freeze. State it plainly rather than
  half-building it.

---

## 4 · Models

### Inquiry (flesh out the existing skeleton)
`buyerOrgId` · `exporterOrgId` · `parties` (all three from `withPartiesScope`) · `productId` ·
**`categoryId`** (already on the skeleton — keep, V11) · `fields` (Mixed, shape per §3 O2) ·
`note` (200) · `status` (`open`/`responded`/`closed`, written once — lifecycle is month 2) ·
`createdBy` · timestamps. Fix the stale *"lands in M2"* comment (C6).

### Conversation (new)
`inquiryId` · `parties [buyerOrgId, exporterOrgId]` · `buyerOrgId` · `exporterOrgId` · `productId`
(may dangle after purge — expected) · `productNameSnapshot` · `buyerOrgName` · `exporterOrgName` ·
`frozen` · `frozenReason` (`takedown` | `blocked`; **not** `purged` — see C5) · `blockedReason` ·
`blockedBy` · `blockedAt` · `lastMessageAt` · `lastMessagePreview` · `buyerLastReadAt` ·
`exporterLastReadAt` · timestamps.
⚠️ `withPartiesScope` also injects **`isActive`** — **unused on this model, never read, never
written** (V5). `frozen` + `frozenReason` are the only state.

### Message (new)
`conversationId` · `senderType` (`buyer`/`exporter`/`system`) · `senderOrgId` (null for system) ·
`senderUserId` · `body` · `createdAt`.
🔒 **Append-only at the model layer (V2 / M4-13):** pre-hooks block `updateOne` / `updateMany` /
`findOneAndUpdate` / `deleteOne` / `deleteMany`, the same way `AuditLog` is protected. *(The A8
purge deletes Products, never Messages — a purged thread keeps its full history, M4-22.)*

### DeviceToken (new — FCM)
`userId` · `orgId` · `token` (**unique**) · `platform` (`android`/`ios`/`web`) · `lastSeenAt`.

### Indexes
| Model | Index | Why |
|---|---|---|
| Conversation | **unique** `(buyerOrgId, productId)` | M4-3, at the DB level |
| Conversation | `parties` | B1 scoping |
| Conversation | `lastMessageAt` | list ordering |
| Conversation | **one** `$text` on `productNameSnapshot + buyerOrgName + exporterOrgName` | §8.3 — native, **not** Atlas; one text index per collection |
| Message | `(conversationId, createdAt)` | history + cursor paging |
| DeviceToken | unique `token`, plus `userId` | fan-out + dedupe |

---

## 5 · Phases

**M4-A · Models + indexes.** Three models + DeviceToken, scoping declarations, `syncIndexes`.
Tests: unique thread index fires; text index exists; scoping declared.

**M4-B · Enquiry creation.** `POST /inquiries` — validates fields against the sub-category `type`,
creates Inquiry + Conversation + **both opening messages in the fixed order** (buyer's composed
enquiry first, system welcome second — M4-10), snapshots the three names.
**F4 self-enquiry guard (M4-39):** reject when `buyerOrgId === exporterOrgId`, server-side.
Duplicate → returns the existing thread, never a second one.

**M4-C · Thread reads.** `GET /conversations` (role-scoped, cursor, `?q=`), `GET /conversations/:id`,
`GET /conversations/:id/messages` (`?before=&limit=30`), `POST /conversations/:id/read`.
Titles composed at read time (M4-17/M4-18). Whitelist projections throughout (§12).

**M4-D · Sending.** `POST /conversations/:id/messages` (REST) + the shared send service.
Three server-side guards on every send (§7.3): **party** · **not frozen** · **200 chars** (user
sends only). Updates `lastMessageAt` / `lastMessagePreview`. Rate-limited (D-M3).

**M4-E · Admin moderation.** `GET /admin/conversations`, `GET /admin/conversations/:id` (read-only,
**audited** — M4-34), `POST .../block` (reason required), `POST .../unblock` with the **M4-30
re-check**: unfreeze only if no other reason still applies, derived from live state, not from the
stored value. Admin sends rejected by role — *admin can read, admin cannot speak* (§7.3).

**M4-F · Cross-module wiring (touches M2 — the riskiest phase).**
- `takedownProduct` → freeze that product's threads + post system message + push freeze event (M4-21)
- `restoreProduct` → unfreeze **through the M4-30 re-check**, never a blind unfreeze
- `purgeBlockedProducts` → leaves conversations **untouched** (M4-22); the red label is derived (C5)
- Seller `inactive` / `archive` → **no thread change at all** (M4-20)
Regression tests on the existing M2 suites must stay green.

**M4-G · Socket.io.** New dependency. JWT handshake **plus** the §7.2 build note: re-verify
`tokenVersion` on every `message:send` (the send guard already hits the DB), so a bumped token
cannot keep an open socket alive. Rooms per §7.2 — parties auto-join, **admin joins no room by
default** and only on explicit `conversation:open`. Events per §11.
**Reconnect recovery (approved deviation).** §11 is a closed list with no replay event, so this
adds one pair (V10): client → `conversation:resync {conversationId, lastMessageId}`, server →
`conversation:resync:result {messages[], truncated}`. Replay is **capped** (G9); `truncated: true`
tells the client to refetch that thread over REST instead — the socket carries live delivery, not
bulk history (§7.1). Closes the gap m4.md §13 described as *"seen on next load"*.
Redis adapter required the moment hosting runs >1 process (§7.7) — wired behind config.

**M4-H · FCM (approved slice).** `firebase-admin`; `isPushConfigured()` so a **missing credential
makes the layer inert, never a crash** (same pattern as `ai.client.js`); `POST /me/devices` +
`DELETE /me/devices/:token`; send on the two events; **dead-token cleanup** on
`registration-token-not-registered`. **Push is fire-and-forget — a notification failure must never
fail a message send.** Tests mock the sender entirely, so no key is needed to build or test.

---

## 5b · Endpoints — with guard and validator (the first draft named none)

| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/inquiries` | `authenticate` + **buyer role + `buyerSide`** (G4) | creates Inquiry + Conversation + both opening messages; F4 self-enquiry guard; availability check (G4); `enquiryLimiter` |
| GET | `/conversations` | `authenticate` | role-scoped, cursor `(lastMessageAt,_id)` (G6), `?q=` branches on ObjectId (G5), boolean `unread` (G7) |
| GET | `/conversations/unread-count` | `authenticate` | the nav badge — one aggregate, no stored counter (G7) |
| GET | `/conversations/by-product/:productId` | `authenticate` | button state; `{conversationId}` or 404 (G8) |
| GET | `/conversations/:id` | `authenticate` + party | thread metadata; 404 if not a party |
| GET | `/conversations/:id/messages` | `authenticate` + party | `?before=&limit=30`; conversation loaded first (G3) |
| POST | `/conversations/:id/messages` | `authenticate` + party | REST send; three §7.3 guards; `messageLimiter` |
| POST | `/conversations/:id/read` | `authenticate` + party | sets the caller's `lastReadAt` |
| POST | `/me/devices` | `authenticate` | FCM token **upsert** (G10) |
| DELETE | `/me/devices/:token` | `authenticate` | unregister |
| GET | `/admin/conversations` | `conversation:read` | all threads, searchable; **not** audited (G11) |
| GET | `/admin/conversations/:id` | `conversation:read` | read-only; **audited** (G11) |
| GET | `/admin/conversations/:id/messages` | `conversation:read` | **audited** (G11) |
| POST | `/admin/conversations/:id/block` | **`conversation:block`**¹ | reason required |
| POST | `/admin/conversations/:id/unblock` | **`conversation:block`**¹ | M4-30 re-check, never a blind unfreeze |

¹ **Owner decision, 2026-07-31 — grantable, not a hard superadmin gate.** One permission covers
both directions: M4-24 makes a block reversible, and a moderator who can freeze a thread but not
unfreeze it is a half-power that just creates escalations. Superadmin passes as all-access.
*(The verification pass had first corrected this to `requireRole('superadmin')` because the draft
listed a role gate and a permission together, which was incoherent; the owner has now chosen the
grantable route instead — this overrides M4-38's "read permission only".)*
⚠️ Grant `conversation:read` alongside it in practice — blocking a thread you cannot open is not
a workflow. Not enforced as a dependency; it is an assignment-time convention.

🚫 **No PATCH or DELETE on messages, ever** (M4-13 / V2) — and the model refuses them too.

## 5c · Public projections (§12 — whitelist, never blacklist)

Built the same way as `Organisation.PUBLIC_FIELDS` + `toPublic()`; a controller must never
hand-roll an object literal (that is how `website` once leaked).

**Conversation → party view:** `id` · `title` (composed at read time per M4-17/M4-18) ·
`product {id, slug, name}` (name from the live product, else `productNameSnapshot`) ·
`counterparty {name}` · **`participants`** (buyer / exporter / **platform** — M4-1, V1) ·
`lastMessageAt` · `lastMessagePreview` · `unread` (bool) ·
`frozen` · **`frozenLabel {tone, text}`** (derived; **never a bare colour** — M4-19, V3) ·
`blockedReason` (M4-25) · `createdAt`.
🚫 **Never to a party:** `blockedBy` · `blockedAt` (G1) · raw `parties` · `buyerOrgId` /
`exporterOrgId` · `inquiryId`.

**Conversation → staff view:** the above **plus** `buyerOrg {id,name}` · `exporterOrg {id,name}` ·
`blockedBy` · `blockedAt` · `frozenReason`.

**Message → both views:** `id` · `senderType` · `body` · `createdAt`.
🚫 **Never:** `senderUserId` (G2) · `senderOrgId`.

**Inquiry → party view:** `id` · `fields` · `note` · `createdAt`. `status` is not surfaced (its
lifecycle is month 2 and nothing drives it).

## 6 · New dependencies (CLAUDE.md requires flagging)
- **`socket.io`** — the module's core; named in `scope-of-work.md`'s stack
- **`@socket.io/redis-adapter`** — only needed at >1 process, but wire it now behind config (§7.7)
- **`firebase-admin`** — the approved FCM slice
- ⚠️ **`CLAUDE.md`'s Stack section lists neither Socket.io nor Firebase** though `scope-of-work.md`
  does. Update it in the same pass (the "when a decision changes" doctrine).

---

## 7 · Secrets
`FIREBASE_SERVICE_ACCOUNT_JSON` (base64 of the service-account JSON) — **`.env` only**, and `.env`
is now untracked (2026-07-31). Never logged, never echoed, never in a response. Owner supplies it
whenever convenient; the build does not wait on it.

---

## 7b · Test plan (the first draft had none)

Per phase, and every security-relevant rule gets a test that **fails without the guard**:

| Area | Must prove |
|---|---|
| **Ownership (A6)** | a non-party gets **404**, never 403, on thread read / messages / send / mark-read; Message is unreachable without its Conversation (G3) |
| **Enquiry guards** | exporter account → 403 (G4); superadmin → 403; guest → 401; hidden/draft/taken-down/dead-category product → **404**; **F4 self-enquiry** (`buyerOrgId === exporterOrgId`) → rejected |
| **One thread rule** | the unique index fires; a second enquiry returns the **existing** thread, never a duplicate; concurrent double-submit resolves to one |
| **Message order** | buyer's composed enquiry is message #1, system welcome #2 (M4-10), welcome text matches O1 verbatim |
| **C1 regression** | the composed first message **exceeds 200 chars and is still accepted**; a 201-char *user* send is rejected — the exact bug a model-level cap would have caused |
| **Freeze** | takedown freezes both sides + posts a system message; restore unfreezes **only** via the M4-30 re-check; a chat blocked *and* product taken down stays frozen after **one** is lifted; `frozenReason` is never overwritten (M4-29) |
| **M4-20** | seller `inactive` and `archive` leave the thread **completely untouched** — no freeze, no label |
| **Purge** | conversation survives with full history; title falls back to `productNameSnapshot`; label derives red (C5) |
| **Projections** | exact key-set assertions on party view and message view; explicitly assert `blockedBy` (G1) and `senderUserId` (G2) are absent; `participants` includes **platform** (M4-1/V1); `frozenLabel` always carries **text**, never a bare colour (M4-19/V3) |
| **M4-13 append-only** | `updateOne`/`findOneAndUpdate`/`deleteOne` on a Message all **reject** (V2); no route exists to edit or delete one |
| **Creation atomicity** | a forced failure at message #2 leaves **no** orphan Inquiry and no empty thread (V6); the E11000 race returns the **existing** thread, not a 500 (V7) |
| **Search** | ObjectId input takes the id branch, text takes the `$text` branch (G5); scope filter isolates buyer/seller; admin sees all; **a distinctive word inside a message body does NOT surface in list search** (M4-32/V9) |
| **Paging** | cursor is stable when a new message arrives mid-scroll (G6) |
| **Unread** | boolean per row correct after read/unread; badge count matches; no counter field exists (G7) |
| **Audit** | block/unblock/admin-read written; list read **not** audited (G11); records are append-only |
| **Permissions (default deny)** | employee with **no** grant → 403 on every admin conversation route; `conversation:read` alone → can read but **403 on block/unblock**; `conversation:block` → can block **and unblock**; superadmin passes without either; an unknown permission string is rejected by the existing catalogue validator |
| **Socket** | non-party cannot join a room; a bumped `tokenVersion` blocks the next `message:send` on an already-open socket (§7.2 build note); admin joins no room by default; admin send rejected by role |
| **Reconnect** | replay returns only what was missed, capped, and falls back to REST beyond the cap (G9) |
| **FCM** | sender mocked throughout; **no credential → inert, no crash**; a push failure **does not fail the message send**; dead token deleted on `registration-token-not-registered`; token upsert reassigns user (G10); no push to sender; none when the recipient is in the room (D-N3); payload carries **no message body** (D-N1) |
| **M2 regression** | the whole existing M2/M3 suite stays green after the §5 M4-F wiring |

## 8 · Accepted gaps to state plainly
- **M4-27** — a blocked buyer can still open a thread on a different product; repeat behaviour is
  handled by suspending the account. Deliberate (M4-26 rejected a middle level).
- **Org rename sync has no caller** until A22 lands (D-M4).
- **Single-process assumptions accumulating** — the M2 purge job already has one; sockets add
  another. Both are fine on one process, both need attention before scaling.
- **No email/WhatsApp** — FCM is the only channel, so a seller with no device registered still
  learns of an enquiry only by logging in.
