# MPX — FINALIZE module

A module built **last**, after M1–M5. It holds everything that cuts across modules, or that can't be closed while a dependency is still unbuilt.

**Why it exists, in the owner's words:** if something can't be finished within month 1, it moves to the next month. FINALIZE is where those items wait rather than being dropped.

**Status:** open register, as of 29 July 2026. Nothing here is built.

---

## F1 · Seller account block cascade

**The core entry.** Today an admin block stops login and nothing else — everything the seller published stays live. A buyer can still find their products, still send enquiries, and still get no reply.

### What must happen on block

| Area | Effect |
|---|---|
| Account | `isActive: false`, `tokenVersion++` — already built in M1 |
| Organisation | Also deactivated, so the public seller profile disappears from discovery |
| Catalogue | The seller's entire catalogue deactivated |
| Products | Every product goes into takedown |
| Chats | Every in-progress conversation involving that seller freezes |
| Reason | The same reason used everywhere: the account was blocked by an admin |

**Half of this is already plumbed.** The public exporter read already filters `isActive: true` on `Organisation` — but nothing ever sets that flag to false. So the "hide the public profile" part is a one-line change on the deactivate path; the query side is already correct.

### F1 open points

**1. Unblock must not blanket-restore.** Some of that seller's products may have been taken down individually *before* the account block, and some chats may have been blocked individually. Turning everything back on would silently undo those admin decisions.

The pattern already exists in this project — Category's `prevActive`. Before the cascade, store each product's and each conversation's prior state; restore from that on unblock.

**2. There is no reason field on the block.** The AuditLog only records the before/after of `isActive`. F1 needs a reason on the block itself, both to show the cascade explanation and so the audit trail says *why*.

**3. Timed suspension.** Today it's an on/off toggle with no duration or auto-expiry. Whether a 7-day or 30-day suspension is needed is undecided.

**4. Scale.** A seller with hundreds of products and chats means a large cascade. Whether it runs inline or as a background job is a build-time decision.

**5. The A21 cascade covers USERS only.** The dual-account work cascades an org block to its users (`isActive` false plus a `tokenVersion` bump), which kills sessions and login without adding a per-request lookup. It does **not** reach the catalogue, products or chats — that reach is F1's job. Any screen or copy implying a block hides the seller's listings is wrong until F1 lands.

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

**F1**, because without the cascade a blocked seller's shopfront stays open — the block looks like it worked and didn't.

**F6**, because without a threshold the only abuse control in the system has nothing to fire on.

Everything else here is an unfinished feature. Those two leave a hole in how month 1 actually behaves.
