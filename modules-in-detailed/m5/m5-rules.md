# M5 Admin Console — controller rules

For `.claude/rules/`. Auto-load on any admin controller, service, route or validator, and on anything touching takedown, audit logging or organisation state.

These are hard rules. Where one conflicts with a plan doc, the rule wins — and stop and ask rather than picking.

---

## 1 · Admin never deletes

**No admin endpoint hard-deletes a product, an organisation, a user, or an audit row.** Ever.

- Products: takedown only. Sets `takedown{isDown, reason, byUserId, at}`
- Organisations: block only. Sets state; the row stays
- Users: deactivate only
- AuditLog: append-only. No update, no delete, no bulk clear

The **only** deletion in the system is the automated 180-day purge of a blocked product (A8) — a scheduled job, never a user action, never reachable from a controller.

If a task asks for an admin delete endpoint: 🔴 stop and ask.

## 2 · Takedown never touches `status`

`status` is the seller's field. The admin block lives in a separate object.

```
takedown.isDown = true          ← admin action
status                          ← untouched, whatever the seller left it as
```

Never write `status` from an admin controller. Never read `status: 'inactive'` as "blocked".

Reason: merging them would let a seller unblock themselves by republishing, would lose the prior state on restore, and would break M4's chat labels which distinguish a seller hiding a product from an admin taking it down.

**Reason is required on takedown.** No default, no empty string, no "N/A". Validate it.

## 3 · Admin cannot edit seller content

Under B6 the product belongs to the seller. Admin monitoring is **read plus takedown**, nothing else.

No admin endpoint may write a product's name, description, images, price, attributes or category. Same for an organisation's company profile — that is the seller's own screen (A22).

## 4 · Everything an admin does is audited

Every state change writes an `AuditLog` row. So do these **reads**, because they are access to private data:

- KYC document view → `kyc.view`
- Any admin or employee read of a conversation

Every row carries the **actor's userId**, never just a role. Include a reason where the action has one.

**Audit snapshots must never contain:** KYC document values or URLs, tokens, passwords or hashes, OTP values, full request bodies, or seller contact details. Snapshot the fields that changed, not the whole document.

For the 180-day purge, the audit row must snapshot the **product name and seller company name** — the row it refers to is about to stop existing.

## 5 · Governance is role-gated, never grantable

Two tiers, and they do not blur:

| Tier | Gate |
|---|---|
| **Reads** — lists, details, viewers | Grantable permission |
| **State-changing governance** — user activate/deactivate, employee create, permission assignment, organisation block/unblock | Hard `requireRole('superadmin')` |

A grantable `user:manage`-style permission is a privilege-escalation path: an employee holding it could deactivate a superadmin, or reactivate itself. It must not exist in the catalogue.

**There is no `admin` role.** Four roles only: `buyer`, `exporter`, `employee`, `superadmin`. Never write `requireRole('admin', ...)`. The `/admin/*` URL prefix is a route namespace, not a role.

## 6 · Every route declares its gate

The boot route-guard refuses to start if a route declares neither a permission nor `publicRoute`. No admin route is ever public.

**Do not invent permission strings inline.** The catalogue currently holds four grantable permissions: `buyer:approve`, `exporter:verify`, `user:read`, `kyc:view`. New screens need new ones — propose the list, get it confirmed, add it to the catalogue, then use it. A permission that exists only in a route file is invisible to the assignment screen.

## 7 · Staff reads are RBAC-scoped, not org-owned

An admin is not the owner of the rows they read, so ownership scoping does not apply. Fetch by id and type:

```
findOne({ _id, type })      → missing returns 404, never 403
```

404 rather than 403 on a missing or wrong-type target — a 403 confirms the row exists.

## 8 · Never return a raw document

Every admin response is a curated projection. Never `res.json(user)` or `res.json(org)`.

Never in any admin response: `passwordHash` · another user's `permissions` · `kycDocuments` or their storage keys · tokens.

`kycDocuments` is `select:false` **and** the base `toJSON` strips it even when explicitly selected — so read it as a document property and build a fresh array. Return signed URLs, never `storageKey`.

## 9 · Lists are capped and search is escaped

- Page size is hard-capped. A client-supplied `pageSize` is validated, never trusted
- Sort includes a tiebreaker (`createdAt` plus `_id`), or rows repeat and skip across pages
- Search input is **regex-escaped** and anchored as a prefix. `rejectMongoOperators` blocks operator objects, not regex metacharacters inside a string
- Conversation and message lists use **cursor pagination**, never page numbers — new rows arriving mid-scroll shift page boundaries

## 10 · The chat viewer has no composer

Admin is present in every conversation but **read-only**.

Enforce it **server-side by role**. Hiding the input is not enforcement — a socket message can be sent directly. Reject an admin send with an error, not a silent drop.

Admin joins a conversation's socket room only when a thread is opened. Never subscribe an admin to all rooms.

## 11 · Organisation block — what it does and does not do

Today a block acts on the Organisation and cascades to its **users**: `isActive` false plus a `tokenVersion` bump, which kills live sessions and login without adding a per-request lookup to `authenticate`.

Three holes that must stay closed:

1. **A claim onto a blocked org is refused.** Otherwise the claim creates an active user under a blocked company
2. **Per-user activate refuses while the user's Organisation is blocked.** `POST /admin/users/:id/activate` still exists
3. **Unblock never blanket-reactivates.** Store each user's prior `isActive` before the cascade and restore from it — the same pattern as Category's `prevActive`. A user individually deactivated before the org block must stay deactivated

**The cascade does NOT reach the catalogue, products or chats.** F1 in the FINALIZE module specifies that and it is unbuilt. Do not implement it here, and do not let any screen or copy imply a block hides the seller's listings — it does not.

## 12 · Category rules the admin screens must respect

- **Top categories: activate/deactivate only.** No create, no edit, no delete. Image upload is the single deliberate exception (A20) — do not remove it as a rule violation
- **Deactivating a top category writes each sub's current `active` into `prevActive` first**, then deactivates the subs. Reactivating restores each from `prevActive`, so a sub the admin deliberately switched off stays off
- **Sub-category delete is blocked** when products or child categories exist
- **`type` is required on sub-categories and not set on top categories** (A16). A top's goods/services grouping is derived from its children at read time, never stored
- **The synonyms tags input is not optional.** Without it, admin-created categories are invisible to synonym search

## 13 · Two things to display honestly

**`kycStatus` is one shared value per Organisation**, across both the buyer and exporter sides. Whichever side is reviewed first verifies the whole company. Where a screen shows verification, show **which side was actually reviewed** — otherwise an unreviewed exporter side reads as verified.

**Some fields never get filled.** `registrationNumber`, `website`, `taxId`, `establishedYear`, `authorisedSignatory` exist on `Organisation` but no form captures them. Hide them or label them "not captured". Do not render them as empty inputs awaiting data, and do not invent a form for them — identity capture is Phase 2.

## 14 · M5 introduces no new models

Everything M5 shows already exists in `User`, `Organisation`, `AuditLog`, `Category`, `CategoryAttribute`, `Product`, `Inquiry`, `Conversation`, `Message`.

If a task appears to need a new collection or a new persisted field to make an M5 screen work: 🔴 **stop and ask.** That is the signal that the feature belongs elsewhere — it is exactly why featured content and the settings document were both moved out of this module.

## 15 · Stop and ask

🔴 Raise a red alert and wait, rather than choosing, when:

- A task asks for an admin delete endpoint
- A task asks to write `status` from an admin controller
- A permission string is needed that is not in the catalogue
- A task needs a new model or persisted field for an M5 screen
- A task asks to widen what an admin response returns
- Something contradicts a rule above
