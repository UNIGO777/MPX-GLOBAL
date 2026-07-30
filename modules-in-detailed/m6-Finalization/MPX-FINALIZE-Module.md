# MPX — FINALIZE module

A module built **last**, after M1–M5. It holds everything that cuts across modules, or that can't be closed while a dependency is still unbuilt.

**Why it exists, in the owner's words:** if something can't be finished within month 1, it moves to the next month. FINALIZE is where those items wait rather than being dropped.

**Status:** open register, as of 29 July 2026. Nothing here is built **except F1-A (the org block cascade), which shipped 2026-07-30** — see F1 below. Everything else is still open.

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

**F1-B · FINALIZE-half — blocked on other modules.** Cannot start until its dependencies exist:

- **products into takedown** — needs **M2**. `Product` is still a 2-field stub: no `exporterOrgId` (§A2), no `status`, no `takedown` object
- **chats freeze** — needs **M4**. `Conversation` does not appear anywhere in `src/` yet
- each needs its **own `prevActive` design**, so an unblock does not reinstate a product or a conversation that an admin had taken down individually *beforehand*

> ⚠️ **Do not stage F1-B inside F1-A as commented-out or dormant code.** A half-written products/chats cascade — one without `prevActive` and without the `takedown` object — must not be sitting in the block path waiting for M2 to make it live. When B is built it gets written deliberately, not woken up.

### What must happen on block

| Area | Effect | Status |
|---|---|---|
| Account | `isActive: false`, `tokenVersion++` on **every user of the org** | ✅ **BUILT (F1-A, 2026-07-30)** — cascades from `POST /admin/orgs/:id/block` |
| Organisation | Also deactivated, so the public seller profile disappears from discovery | ✅ **BUILT (F1-A)** — the writer now exists; the read side already filtered `isActive` |
| Catalogue | The seller's entire catalogue deactivated | TO BUILD (F1-B — needs M2) |
| Products | Every product goes into takedown | TO BUILD (F1-B — needs M2) |
| Chats | Every in-progress conversation involving that seller freezes | TO BUILD (F1-B — needs M4) |
| Reason | The same reason used everywhere: the account was blocked by an admin | ✅ **BUILT (F1-A)** — required on block, stored + audited |

**The read side was already plumbed** — the public exporter read filters `isActive: true` on `Organisation` (`getPublicExporter`), and A21 indexed `{ exporterSide: 1, isActive: 1 }` for it. So the profile hides **the moment that flag flips**.

**The writer now exists (F1-A, 2026-07-30).** `blockOrganisation()` in `services/orgBlock.service.js` is the only thing that sets `Organisation.isActive = false`; before it, the flag was permanently `true` for every org and the filter guarded a state nothing could produce. The query side needed no change, exactly as predicted.

### F1 open points

**1. Unblock must not blanket-restore.** Some of that seller's products may have been taken down individually *before* the account block, and some chats may have been blocked individually. Turning everything back on would silently undo those admin decisions.

The pattern already exists in this project — Category's `prevActive`. Before the cascade, store each product's and each conversation's prior state; restore from that on unblock.

**2. There is no reason field on the block.** The AuditLog only records the before/after of `isActive`. F1 needs a reason on the block itself, both to show the cascade explanation and so the audit trail says *why*.

**3. Timed suspension.** Today it's an on/off toggle with no duration or auto-expiry. Whether a 7-day or 30-day suspension is needed is undecided.

**4. Scale.** A seller with hundreds of products and chats means a large cascade. Whether it runs inline or as a background job is a build-time decision.

**5. ⚠️ Corrected — there is NO org-level cascade today.** An earlier version of this point said the dual-account work "cascades an org block to its users". **It does not.** A21's **Step 5 (org block) was never started** — steps 1–4a shipped, 4b and 5 did not. What M1 actually shipped is `setUserActive()`: a superadmin toggle that sets `isActive: false` and bumps `tokenVersion` for **one named user**, killing that user's sessions and login. There is no org-level block, and no cascade of any kind.

The design intent behind it still holds and should be kept when F1-A is built: cascade the flag + `tokenVersion` bump **onto the user rows**, so a block kills sessions and login **without** adding a per-request Organisation lookup to `authenticate`. Note this cuts the other way too — because `authenticate` never reads the org, setting `Organisation.isActive = false` **alone would not log anyone out**; the org's users would keep working, with only the public profile going dark. The user cascade is not optional.

That cascade is **F1-A (M1-core)**, buildable now. It still does **not** reach the catalogue, products or chats — that reach is **F1-B**, blocked on M2 and M4. Any screen or copy implying a block hides the seller's listings is wrong until F1-B lands.

---

## F2 · Purge of archived products

**Decided 29 July, reversing A7.** Archived products were to be kept forever on the reasoning that the seller was choosing to keep them. They will now also be purged at 180 days.

**Upside:** one purge job with two triggers — admin block, and seller archive — rather than two mechanisms.

**Open point — the chat label.** M4's red chat label reads *"Product deleted by admin"*. That is wrong for a seller-archived purge, where the admin did nothing. It needs different text, or no label in that case.

**Accepted cost:** archived products are already hidden from the admin monitoring list. Once they're purged too, a later *"this seller listed it then deleted it"* dispute has nothing at all to show.

---

## F3 · The fields nobody can fill

These exist on the `Organisation` model but no form anywhere captures them, so they are unreachable:

`registrationNumber` · `website` · `taxId` · `establishedYear` · `authorisedSignatory`

`registrationNumber` is the notable one: it carries a unique partial index on `(registrationNumber, country)`, and verification is exactly the moment an admin would match it against the certificate. That index has never had anything to enforce.

Until this closes, the Organisation detail screen must **hide these or label them "not captured"** — not render them as empty inputs awaiting data.

---

## F4 · Self-enquiry guard

Now that one Organisation can hold both a buyer and an exporter side (A21), a company's buyer account can enquire on its own exporter listing, making `buyerOrgId === exporterOrgId`.

In that case the chat shows in both portals, the company gets notified about itself, and enquiry counts skew. A guard on enquiry creation closes it.

**Until it exists:** the same conversation can appear under both the buyer-account and exporter-account sections of the admin Organisation screen.

---

## F5 · M5 pieces moved out

| Item | Note |
|---|---|
| **Featured listings + banners** | Confirmed in scope by the quote — Module 5 "Content — banners, featured listings" and Module 1 "Featured categories and highlighted suppliers". So it is Phase-1 work, just not month 1. It also needs storage, which would break M5's no-new-models property |
| **Error log + the dashboard's error tile** | Moving these out also collapsed a planned two-tab "Logs" screen back into the audit log viewer alone |

The error log, when built: errors only, its own collection separate from `AuditLog`, a 90-day TTL (AuditLog stays permanent, no TTL), and a strict exclusion list — never KYC documents or their URLs, tokens, passwords or hashes, OTP values, full request bodies, or seller contact details.

---

## F6 · The number that is still undefined

**The repeat-offender suspension threshold** — how many takedowns before an account is suspended.

This matters more than it looks. Under A10 a taken-down product no longer occupies a slot in the D1 three-active cap, so blocking a product *frees* a slot. Account suspension is therefore the **only real abuse control left**, and it has no trigger value.

The platform settings screen would have given it a home, but that screen moved to month 2. So the number has to be chosen as a constant in code.

---

## Content and dependencies — not code

| Item | Who |
|---|---|
| **Synonyms for the 40 top categories** | Us. The list does not exist — only one or two examples appear anywhere in the docs. Without it, keyword→category search only half works |
| **40 category images** | Us, uploaded through the admin panel — which is why A20 makes image upload on top categories a deliberate exception |
| **Real OTP delivery provider** | Client. Until then OTP prints to the terminal, dev only |
| **OpenAI key, production Atlas, Redis, Cloudinary** | Client |
| **Girish's written sign-off** | Buyer full-access with no approval gate, and the exporter 3-product trial — both deviate from the quote |

---

## Priority

Two items matter more than the rest:

**F1**, because without the cascade a blocked seller's shopfront stays open — the block looks like it worked and didn't. Note **F1-A (M1-core) is buildable now** and does not have to wait for FINALIZE: today there is no org-level block *at all*, so the gap is worse than "the cascade is incomplete".

**F6**, because without a threshold the only abuse control in the system has nothing to fire on.

Everything else here is an unfinished feature. Those two leave a hole in how month 1 actually behaves.
