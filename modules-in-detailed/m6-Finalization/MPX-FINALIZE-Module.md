# MPX — FINALIZE module

A module built **last**, after M1–M5. It holds everything that cuts across modules, or that can't be closed while a dependency is still unbuilt.

**Why it exists, in the owner's words:** if something can't be finished within month 1, it moves to the next month. FINALIZE is where those items wait rather than being dropped.

**Status:** open register. **F1 is now COMPLETE — F1-A shipped 2026-07-30, F1-B shipped 2026-08-01**
(see F1 below). **F6 is CLOSED by owner decision (2026-08-01): no threshold is being built.** F2 and
F4 were already cancelled/moved. What remains is F3 (unreachable fields), F5 (featured content + the
error-log viewer), and the content/infrastructure list — most of which is not code.

---

## F1 · Seller account block cascade

**The core entry.** Today there is **no account block at all** — only a per-user deactivate (`setUserActive`, one user at a time), which stops that user's login and nothing else. Everything the seller published stays live. A buyer can still find their products, still send enquiries, and still get no reply.

### F1 splits in two — scope and build them separately

**F1-A · M1-core — ✅ BUILT 2026-07-30** (A21 Step 5). Touches only `User` and `Organisation`:

- ✅ **org-level block / unblock entry point** — `POST /admin/orgs/:id/block` · `/unblock`, hard `requireRole('superadmin')` (governance — never a grantable permission, so `permissions.js` was **not** touched)
- ✅ **reason on the block** — required by the validator, stored as `Organisation.blockReason` (+ `blockedAt`, `blockedBy`), and written into the `org.block` / `org.unblock` AuditLog rows (closes open point 2)
- ✅ **user cascade** — every user of the org gets `isActive: false` + `tokenVersion++`, with **`User.prevActive`** capturing prior state so unblock restores rather than blanket-reactivates (closes open point 1 *for users*; products/chats still need their own)
- ✅ **the `Organisation.isActive` writer** — the flag that nothing used to set. The public seller profile 404s the moment it flips
- ✅ **three holes closed** — a claim onto a blocked org is refused (`assertOrgClaimable()`, which **Step 4c must call**); `POST /admin/users/:id/activate` returns 409 while the org is blocked; unblock restores prior state only
- Also guarded: the **platform org can never be blocked** (self-lockout), and double-block / double-unblock are 409s

`src/services/orgBlock.service.js` · `tests/f1a-org-block.test.js` (9 tests) · suite 121/121.

**F1-B · ✅ BUILT 2026-08-01 — both halves.** *(History: the PRODUCTS half unblocked 2026-07-31 when M2/M3 shipped; the CHATS half unblocked when M4 shipped, and the two were built together.)* Original note: M2 shipped
`Product.exporterOrgId`, `status` and the full `takedown` object, and M3 shipped discovery — so a
blocked company's listings are now **provably still public** (pinned by a test in
`m1-m2-m3-integration.test.js`, which asserts the gap on purpose so closing it is a deliberate
act, never an accident). **Schedule the products cascade next**; the CHATS half still waits on M4.
Original blockers, for the record:

- **products into takedown** — needs **M2**. `Product` is still a 2-field stub: no `exporterOrgId` (§A2), no `status`, no `takedown` object
- **chats freeze** — needs **M4**. `Conversation` does not appear anywhere in `src/` yet
- each needs its **own `prevActive` design**, so an unblock does not reinstate a product or a conversation that an admin had taken down individually *beforehand*

> ⚠️ **Do not stage F1-B inside F1-A as commented-out or dormant code.** A half-written products/chats cascade — one without `prevActive` and without the `takedown` object — must not be sitting in the block path waiting for M2 to make it live. When B is built it gets written deliberately, not woken up.

### What must happen on block

| Area | Effect | Status |
|---|---|---|
| Account | `isActive: false`, `tokenVersion++` on **every user of the org** | ✅ **BUILT (F1-A, 2026-07-30)** — cascades from `POST /admin/orgs/:id/block` |
| Organisation | Also deactivated, so the public seller profile disappears from discovery | ✅ **BUILT (F1-A)** — the writer now exists; the read side already filtered `isActive` |
| Catalogue | The seller's entire catalogue deactivated | ✅ **BUILT (F1-B, 2026-08-01)** — live products go into takedown; **drafts and archived rows are exempt** (a draft was never public; an archived row in takedown would match the §A8 purge and be deleted, breaking A7) |
| Products | Every product goes into takedown | ✅ **BUILT (F1-B)** — reason: "Account blocked by MPX Global". ⚠️ `Organisation.takedownCount` is deliberately **NOT** incremented: §A24 counts individual moderation decisions, and one account block is ONE decision — inflating it by catalogue size would corrupt the very signal F6 was about |
| Chats | Every in-progress conversation involving that seller freezes | ✅ **BUILT (F1-B)** — a third freeze reason `account` was added, because lifting a product takedown must not reopen a thread whose COMPANY is still blocked |
| Reason | The same reason used everywhere: the account was blocked by an admin | ✅ **BUILT (F1-A)** — required on block, stored + audited |

**The read side was already plumbed** — the public exporter read filters `isActive: true` on `Organisation` (`getPublicExporter`), and A21 indexed `{ exporterSide: 1, isActive: 1 }` for it. So the profile hides **the moment that flag flips**.

**The writer now exists (F1-A, 2026-07-30).** `blockOrganisation()` in `services/orgBlock.service.js` is the only thing that sets `Organisation.isActive = false`; before it, the flag was permanently `true` for every org and the filter guarded a state nothing could produce. The query side needed no change, exactly as predicted.

### F1 open points

**1. ~~Unblock must not blanket-restore.~~** ✅ **CLOSED (F1-B, 2026-08-01)** — implemented exactly as
this entry proposed. `Product.prevTakedown` and `Conversation.prevFrozen` capture prior state before
the cascade, and unblock restores only what the cascade itself switched off: a product taken down
individually beforehand stays down **with its own reason**, and a chat blocked individually stays
blocked. Unfreezing routes through `recomputeFreeze` (M4-30), so a thread reopens only when nothing
at all still holds it shut. Pinned by `tests/f1b-block-cascade.test.js`.

**2. There is no reason field on the block.** The AuditLog only records the before/after of `isActive`. F1 needs a reason on the block itself, both to show the cascade explanation and so the audit trail says *why*.

**3. ~~Timed suspension.~~** ✅ **DECIDED 2026-08-01 — not being built.** The block stays a manual
on/off toggle. An auto-expiry needs its own scheduled job, and a job that misfires brings a blocked
company back online by itself.

**4. ~~Scale.~~** ✅ **DECIDED 2026-08-01 — the cascade runs in the BACKGROUND.** The admin gets an
immediate response; the account half (which ends every session) stays synchronous, because that is
the part that cannot wait. ⚠️ **Consequence, deliberately handled:** a background job failing
silently would leave a blocked company's catalogue live with nobody aware — strictly worse than the
gap it replaced. So the cascade records its state on `Organisation.blockCascade` and the admin
Organisation screen reports `running` / `done` / **`failed`** alongside the row counts.

**5. ⚠️ Corrected — there is NO org-level cascade today.** An earlier version of this point said the dual-account work "cascades an org block to its users". **It does not.** A21's **Step 5 (org block) was never started** — steps 1–4a shipped, 4b and 5 did not. What M1 actually shipped is `setUserActive()`: a superadmin toggle that sets `isActive: false` and bumps `tokenVersion` for **one named user**, killing that user's sessions and login. There is no org-level block, and no cascade of any kind.

The design intent behind it still holds and should be kept when F1-A is built: cascade the flag + `tokenVersion` bump **onto the user rows**, so a block kills sessions and login **without** adding a per-request Organisation lookup to `authenticate`. Note this cuts the other way too — because `authenticate` never reads the org, setting `Organisation.isActive = false` **alone would not log anyone out**; the org's users would keep working, with only the public profile going dark. The user cascade is not optional.

That cascade is **F1-A (M1-core)**, buildable now. It still does **not** reach the catalogue, products or chats — that reach is **F1-B**, blocked on M2 and M4. Any screen or copy implying a block hides the seller's listings is wrong until F1-B lands.

---

## F2 · Purge of archived products — 🚫 CANCELLED 2026-07-30 (A7 reconfirmed by owner)

**The 29-July reversal is itself reversed.** The owner reconfirmed **§A7 as final**: archived
(seller-deleted) products keep their DB row **and** Cloudinary images **indefinitely — no purge,
no expiry, ever.** The only deletion in the system remains §A8's 180-day purge of admin-**blocked**
products.

Why this entry stays in the file: for two days Part A §A7 said "keep forever" while this entry said
"purge at 180 days" — and Part A always wins, so the reversal was never propagated. Rather than
propagate it, the owner cancelled it. **Do not build an archived-product purge**; the §A8 job keeps
exactly one trigger (takedown), and M4's red-label text needs no seller-archive variant.

**Still true (accepted, unchanged):** archived products are hidden from the admin monitoring list,
so a later *"this seller listed it then deleted it"* dispute has only the AuditLog archive entry to
point at — but the row and images do still exist (A7), so evidence is retained even if no screen
shows it. A link from the audit log could surface it later.

---

## F3 · The fields nobody can fill

These exist on the `Organisation` model but no form anywhere captures them, so they are unreachable:

`registrationNumber` · `website` · `taxId` · `establishedYear` · `authorisedSignatory`

`registrationNumber` is the notable one: it carries a unique partial index on `(registrationNumber, country)`, and verification is exactly the moment an admin would match it against the certificate. That index has never had anything to enforce.

Until this closes, the Organisation detail screen must **hide these or label them "not captured"** — not render them as empty inputs awaiting data.

---

## F4 · Self-enquiry guard — ➡️ moved INTO M4 (decided 2026-07-30)

Now that one Organisation can hold both a buyer and an exporter side (A21), a company's buyer account can enquire on its own exporter listing, making `buyerOrgId === exporterOrgId`.

In that case the chat shows in both portals, the company gets notified about itself, and enquiry counts skew. A guard on enquiry creation closes it.

**Decision 2026-07-30: the guard is built in M4 itself, at `POST /inquiries` — see m4.md M4-39.**
It is not FINALIZE work any more; this entry stays only as the record of why the guard exists.
Until M4 ships, the gap is moot (no enquiry endpoint exists at all).

---

## F5 · M5 pieces moved out

| Item | Note |
|---|---|
| **Featured listings + banners** | Confirmed in scope by the quote — Module 5 "Content — banners, featured listings" and Module 1 "Featured categories and highlighted suppliers". So it is Phase-1 work, just not month 1. It also needs storage, which would break M5's no-new-models property |
| **Error log + the dashboard's error tile** | Moving these out also collapsed a planned two-tab "Logs" screen back into the audit log viewer alone |

The error log, when built: errors only, its own collection separate from `AuditLog`, a 90-day TTL (AuditLog stays permanent, no TTL), and a strict exclusion list — never KYC documents or their URLs, tokens, passwords or hashes, OTP values, full request bodies, or seller contact details.

---

## F6 · The number that is still undefined

🚫 **CLOSED 2026-08-01 — no threshold is being built.** The console shows `Organisation.takedownCount`
and the admin decides; there is no number and no automatic action. An auto-suspend firing on a
mis-set trigger would take an entire company offline, so automatic enforcement stays out of month 1.
The original entry follows, for its reasoning.

~~**The repeat-offender suspension threshold** — how many takedowns before an account is suspended.~~

This matters more than it looks. Under A10 a taken-down product no longer occupies a slot in the D1 three-active cap, so blocking a product *frees* a slot. Account suspension is therefore the **only real abuse control left**, and it has no trigger value.

The platform settings screen would have given it a home, but that screen moved to month 2. So the number has to be chosen as a constant in code.

**Trigger data decided (2026-07-30, §A24):** the count the threshold fires on is the persisted
**`Organisation.takedownCount`** — incremented on every takedown, never decremented on restore,
so it survives the §A8 purge (counting from `Product` rows would undercount repeat offenders
exactly when it matters). Only the threshold **value** remains open.

---

## Content and dependencies — not code

| Item | Who |
|---|---|
| **Synonyms for the 40 top categories** | Us. The list does not exist — only one or two examples appear anywhere in the docs. Without it, keyword→category search only half works |
| **40 category images** | Us, uploaded through the admin panel — which is why A20 makes image upload on top categories a deliberate exception |
| **Real OTP delivery provider** | Client. Until then OTP prints to the terminal, dev only |
| **OpenAI key, Redis, Cloudinary** | Client |
| **Production VPS + self-hosted MongoDB** (⚠️ §A26, 2026-07-31 — **NOT Atlas**: Hostinger VPS with a local MongoDB). Needs, before go-live: auth enabled + bound to localhost, a scheduled `mongodump` backup with off-server retention, the index-sync scripts run against it, and the **C10 append-only audit grant** (app DB user = insert+find only on audit collections) — which self-hosting finally makes enforceable | Us + client (server) |
| **Girish's written sign-off** | Buyer full-access with no approval gate, and the exporter 3-product trial — both deviate from the quote |

---

## Priority

Two items matter more than the rest:

~~**F1**~~ ✅ **DONE (2026-08-01).** Both halves shipped, so a block now closes the shopfront, the
catalogue and the chats together.

~~**F6**~~ ✅ **CLOSED by decision (2026-08-01)** — no threshold; the count is shown and the admin acts.

**What is actually left**, in rough order:

1. ~~**Error-log viewer**~~ ✅ **BUILT 2026-08-01** (F5a). `GET /admin/errors` + `/admin/errors/:id`,
   read-only, gated by its own **`errorlog:read`** — owner-decided, kept separate from `audit:read`
   so a debugging grant does not also hand over the record of every KYC document and private
   conversation staff have opened. Filters: requestId · route prefix · method · statusCode (5xx
   only, enforced) · user/org · date range. **No write verb exists** — retention is the TTL's job.
   ⚠️ Building it surfaced a real leak and closed it: `err.message` / `err.stack` are the only
   persisted fields whose shape we do not control, and a Mongo driver error quotes its own
   connection string — which in production carries the DB password. `src/utils/redact.js` now
   strips known secrets **at the write site**. Plan: `build-plans/m6-finalize/backend-plan.md`.
2. ~~**Featured listings + banners**~~ ✅ **BUILT 2026-08-01** (F5b). Owner reversed the same-day
   "month 2" call — the landing page needs it now. New **`FeaturedItem`** model covering all four
   kinds (banner · product · category · supplier), public `GET /public/featured` in one call, admin
   CRUD under `/admin/featured` behind a grantable **`featured:manage`**.
   🔑 A featured row is a **pointer, never a snapshot**: the public read re-resolves every target
   through the same availability rules as the rest of the public surface, so a taken-down product
   or a **blocked company leaves the landing page on its own**. Denormalising a name or price onto
   the row would have re-opened exactly the F1 failure.
3. **F3 · the unreachable fields** — no capture form exists; identity capture is Phase 2. The M5
   screen already labels them "not captured", so nothing misleads in the meantime.
4. **The content + infrastructure list above** — mostly not code, and the production-server items
   (Mongo auth, backups, the **C10 append-only audit grant**) are go-live blockers.
