# Claude Code prompt — build Module 2 (Catalogue) + Module 3 (Discovery)

> Copy everything below the line into Claude Code, with the latest plan docs in the workspace.

---

## Where the repo actually stands

An audit of `MPX-BACKEND-FULL-SAAS` found that **Modules 2 and 3 do not exist**. `Category` and `Product` are near-empty stubs, `CategoryAttribute` and `SavedItem` are absent, and there are no catalogue or discovery routes, controllers, services, validators, permissions, or tests. Only Module 1 (auth) is real and tested.

So this is a **build from scratch**, not a patch. Do not assume any prior M2/M3 work exists.

## Document versions — read this first

All the M2/M3 plan lives in the repo and is **maintained in place** — there are no separate "current" copies to fetch, and nothing here is a stale reference copy. Every correction so far (A16–A21, the §A13 buyer-only reversal, the public `verified`-boolean fix, the `slug` / Category-`image` whitelist additions) was applied **directly to these files**. Use them by their actual repo paths:

**Module 2 (Catalogue)** — the spec is **split across three files, all current**:
- `modules-in-detailed/m2-max-3to6days/M2.md`
- `modules-in-detailed/m2-max-3to6days/Models.md`
- `modules-in-detailed/m2-max-3to6days/Category.md`

**Module 3 (Discovery · Search · SavedItem · SEO):**
- `modules-in-detailed/m3-search-filter-3-4days-max/m3.md`
- `modules-in-detailed/m3-search-filter-3-4days-max/Search.md`
- `modules-in-detailed/m3-search-filter-3-4days-max/Saved-item.md`
- `modules-in-detailed/m3-search-filter-3-4days-max/m3-seo-rules.md`
- `docs/MPX-Module3-COMPLETE-MEMO.md`

**Cross-module brain** (Atlas-Search lock, full ranking order, AI system prompt — Part B depends on it):
- `docs/MPX-COMPLETE-BRAIN.md`

**Precedence — TWO levels, highest first:**
1. **Part A of this document** — the decisions that override the plan docs.
2. **The plan docs listed above** — the maintained, current M2/M3 specification.

Where Part A contradicts any plan doc, **Part A wins**. Those contradictions are deliberate; they are decisions taken after the docs were written.

## Rules of engagement

1. **Do not invent decisions.** If something is unspecified, stop and ask. Do not pick a "reasonable default" and keep going — an invented rule buried in code is worse than a blocked task.
2. **Do not touch Module 1's auth flow.** Signup, login, OTP, tokens, refresh rotation, and the verification endpoints are built and tested. The only permitted change is described in A2.
3. **Do not touch the Phase-2 skeleton models:** `Escrow`, `Contract`, `Order`, `Shipment`, `PayoutAccount`, `PayoutRequest`, `Milestone`, `TrustScore`, `Investment`, `Incentive`, `Subscription`, `PremiumApplication`. Leave them exactly as they are — no deletes, no edits, no "cleanup".
4. **Tests are part of the work, not a follow-up.** Every rule in Part A that can be violated should have a test that fails when it is violated.
5. Work module by module in the order given in Part C. Do not start M3 until M2's tests pass.

---

# Part A — Decisions that override the plan docs

## A1. Product status

`status` is an enum with exactly four values: `draft`, `active`, `inactive`, `archived`.

| Value | Meaning | Set by |
|---|---|---|
| `draft` | Created, never published. Default on create. | seller |
| `active` | Published and live in discovery | seller |
| `inactive` | Was live, seller hid it. May return. | seller |
| `archived` | Seller deleted it | seller (via delete) |

- **`draft` is one-way.** Once a product has been published it can never return to `draft`. Reject any transition back to `draft` at the service layer, not just in the UI.
- Because of that rule, `status === 'draft'` is a reliable test for "never published".
- **Do not add `isActive` to Product.** The base scope mixin injects it on every model; Product and Category are exceptions. Product's lifecycle lives entirely in `status`.

## A2. Ownership field names

Follow the plan naming, not the current generic `orgId` convention:

- `Product.exporterOrgId`
- `SavedItem.buyerOrgId` (see A13 — saving is **buyer-only**; an exporter buys from a separate buyer account per §A21)
- Two-party models in M4 (`Inquiry`, `Conversation`, `Message`) keep `buyerOrgId` + `exporterOrgId` + `parties[]` as already planned

`scoping.js` must be taught these field names. **This is the one permitted change to M1 infrastructure.** After changing it:

- Re-run Module 1's 24 tests and confirm all still pass.
- Add ownership-scoping tests for `Product` and `SavedItem` covering the cross-org case: org A must never be able to read, edit, or delete org B's document, and the attempt must return 404, not 403.

This layer is where a silent bug lets one seller edit another seller's listing. Treat it accordingly.

## A3. Public output is a whitelist

The base `toJSON` transform is a blacklist — it returns the whole document minus `select:false` paths. **Do not use it for public routes.**

Instead:

- Define a `PUBLIC_FIELDS` list on each model that has a public surface (`Product`, `Category`, `Organisation`).
- Write **one** shared `toPublic()` helper.
- **Every** public route serialises through that helper. No route builds its own field list.

The point is that a newly added field is private by default. If someone adds `internalNotes` to Product tomorrow and touches nothing else, it must not reach a buyer.

Never allow these onto a public response: `takedown` in any form, raw `exporterOrgId` or other internal ObjectIds, KYC documents, seller phone/email, exact street address, `draft`/`inactive`/`archived` products, inactive categories.

## A4. Category on/off

Category uses `active` and `prevActive` — **not** the base mixin's `isActive`.

Cascade behaviour: deactivating a top category writes each sub-category's current `active` value into `prevActive`, then sets all of them inactive. Reactivating the top category restores each sub from its `prevActive`, so a sub the admin had deliberately switched off stays off.

## A5. Delete is always soft

There is **no hard delete** for products — not for drafts, not for anything. A seller deleting a product does exactly one thing:

```
status = 'archived'
```

No branching, no "was it published" test, no reference lookup. The UI still shows a single "Delete" action.

The one exception is A8 (the blocked-product purge), which is an admin-side cleanup job, not a user action.

## A6. Slugs

`Product`, `Category`, and `Organisation` each get a unique, indexed `slug`. Generation rules are in `modules-in-detailed/m3-search-filter-3-4days-max/m3-seo-rules.md` §1 (lowercase, hyphens, strip specials, short unique suffix on clash, immutable once set).

**On archive**, append an archive marker to the product's slug (for example `cotton-fabric-roll` becomes `cotton-fabric-roll--archived-a1b2`). This frees the clean slug so the seller can list the same product name again without hitting the unique index. Archived products have no public page, so nothing breaks by changing their slug.

## A7. Archived products are never auto-cleaned

Archived products keep their database row **and** their Cloudinary images, indefinitely. No purge job, no expiry. The seller chose to keep the account; their data stays.

## A8. Blocked products are purged after 180 days

If a product has been taken down (`takedown.isDown === true`) continuously for **more than 180 days**, a cleanup job:

1. Deletes the product row
2. Deletes its Cloudinary images
3. Writes an `AuditLog` entry recording the purge

That AuditLog entry must **snapshot the product name and the seller's company name**, alongside the takedown reason, the acting admin, and timestamps. An entry holding only a product ObjectId is useless once the row is gone.

## A9. What the seller sees when blocked

On their **own** listing, the owning seller sees `takedown.reason` and the takedown date.

The seller never sees `takedown.byUserId` — which admin acted stays internal. Nothing from `takedown` appears on any public route (A3 already covers this).

## A10. Taken-down products and the 3-active cap

Rule D1 caps unverified exporters at 3 active products. **Taken-down products are excluded from that count** — the cap query must filter out `takedown.isDown: true`.

This is deliberate and needs explicit code; without the exclusion a blocked product would occupy a slot, since takedown does not change `status`.

Consequence to handle: because a block frees a slot, a bad actor could keep re-listing. Track a per-seller takedown count so the existing "repeat offenders get their account suspended" rule can actually be applied. That rule is now the only guardrail here.

## A11. Category image

`Category` gets an optional `image` field (Cloudinary URL) so category cards can render a picture. Expected to be filled for the 40 top categories; optional on sub-categories, with a sensible fallback when empty.

## A12. Synonyms are editable by admin

`Category.synonyms: [String]` is seeded for the 40 top categories, **and** the admin sub-category create/edit form exposes it as a tags input.

Reason: admin creates sub-categories at runtime. Without this, every admin-created category is invisible to synonym search and nobody ever notices.

## A13. Saving is buyer-only

**Reversed — saving is buyer-only.** Only a **buyer account** saves products and suppliers. `SavedItem` uses **`buyerOrgId`** (not `orgId`): unique compound index on `(buyerOrgId, targetType, targetId)`, index on `buyerOrgId`, ownership-scoped reads and deletes (`findOne({ _id, buyerOrgId })`). Everything else about the model is unchanged (polymorphic `targetType`/`targetId`).

Under **§A21** this is clean: an exporter who wants to buy has a **separate buyer account** and saves from that one — so "buyer-only" means the buyer **account**, not the buyer company. Nothing is lost.

Search itself was **never a permission**: it is a **public page open even to guests**. Do **not** read this as a promise that exporters can buy — M3 grants no buying flow.

## A14. "Other" (#40) gets two typed sub-categories

Seed two sub-categories under "Other":

- **Other goods** — `type: 'goods'`
- **Other services** — `type: 'service'`

This keeps the rule that products always map to a leaf category, and it means the product type is derived from the category exactly like everywhere else.

Two consequences, both intended:

- The seller **never** manually picks goods vs service. Remove that exception entirely.
- **`resolvedType` is not needed on Product.** Do not add it.

## A15. Draft cap

Unverified sellers: **10** drafts maximum, alongside the D1 cap of 3 active products. Enforce both on create and on status change.

A known loophole is accepted for MVP: a seller can delete drafts to free slots, leaving permanently archived rows behind. Do not add extra limits to close it — account suspension is the intended remedy.

## A16. Category type lives on the leaf

- The `type` enum is `'goods' | 'service'`. `either` is removed.
- `type` is **required on sub-categories** (`parentId` set).
- `type` is **not set on top categories** (`parentId` null). No default, no optional-but-populated — absent.
- A product always maps to a sub-category, so form fields always resolve from the leaf. A top category's own type was never read during product creation.
- Browse screens derive a top category's goods/services grouping from its **children's** types, computed at read time, never stored. A top category with mixed children appears under both. This is what makes A14's "Other" work without an exception.
- Seed data must not set `type` on any of the 40 top categories.

## A17. "Other" has fixed fields, not free-form

"Other goods" and "Other services" are ordinary categories. They get a small, fixed set of `CategoryAttribute` fields, defined the same way as every other category.

There is **no free-form, seller-defined spec mechanism anywhere in the system.** Earlier drafts described one for "Other"; it is cancelled. Do not build it and do not leave it as a future note.

## A18. Purge window

Superseded into A8 above: the blocked-product purge window is **180 days**, not 90. If you find a 90-day figure anywhere in the plan docs or rules, it is stale.

## A19. Logging — AuditLog and a separate error log

**`Product.createdBy` is dropped.** It exists in the code, appears in no plan doc, and is superseded by the AuditLog.

**AuditLog holds important business actions only.** Append-only, never edited or deleted. At minimum:

- Product: create, publish, unpublish, archive (delete), takedown, restore, 180-day purge
- Category: create, edit, activate/deactivate, delete; attribute create/edit/delete
- Org/user: KYC verify, KYC reject, employee create, permission change, account suspend

Each entry carries the actor, the target, a timestamp, and a reason where one applies. The purge entry additionally snapshots the product name and seller company name, per A8. It does **not** record reads, searches, or page views.

**Because `createdBy` is being dropped, product create and edit must write AuditLog entries.** Otherwise, in an org with several users, there is no way to tell who listed what. This is the replacement for the removed field, not an optional extra.

**A separate error log is required.** It holds errors and nothing else — not a general application log, not a second audit trail.

- Each entry: timestamp, severity, message, stack trace, route and method, request ID, and the acting user/org where known.
- It must **never** contain KYC documents or their URLs, tokens, passwords or hashes, OTP values, full request bodies, or seller contact details. Errors get logged; the data that caused them does not.
- Its storage location and retention are not yet decided — propose and confirm before building.

## A20. Admin uploads category images

A11 gives Category an optional `image` field. The 40 top-category images are uploaded by the team through the admin panel, not seeded from files.

So the **admin category edit screen needs an image upload field — on top categories as well as sub-categories.** Top categories are otherwise activate/deactivate-only under the B-rules; image upload is a narrow, deliberate exception. Write it as such so a later session doesn't "fix" it by removing the field.

## A21. Dual accounts, two-step signup, Organisation claim

This **reverses** the earlier "one shared login page for all four roles" decision. Wherever a plan doc still describes one shared login, or a single per-role signup that creates User + Organisation together, **this section wins**.

**Accounts**
- Buyer and exporter are **separate accounts on separate portals**, each with its own login page.
- The same email and the same mobile may each hold **one buyer account and one exporter account** — never two of the same role.
- Credentials are **independent**: no password syncing between them, and each account keeps its own OTP lock. This is deliberate — record it so nobody "fixes" it later by merging them.

**Login**
- `POST /auth/login` serves buyer and exporter and takes a **`portal`** field, because the same email may hold both.
- `POST /auth/staff/login` serves employee and superadmin and needs **no** portal — a staff email is exclusive and may not also be a buyer or exporter account.
- A wrong portal returns the **same "Invalid credentials"** as a wrong password. Never reveal that the account exists under another portal.

**Signup — two steps**
- **Step 1** is one shared form for both sides: name, email, phone, password. Nothing about the company.
- **OTP verification** sits between the two steps.
- **Step 2** shows whether an Organisation already exists for that email or phone, and offers **claim** or **create-new**. No match goes straight to create-new.
- Company fields (name, country; exporter also `entityType` + address) move to **step 2** and appear only on the create-new path.
- Because step 2 is behind OTP, the existing company's **name may be shown** on the claim screen. That is safe here and better UX.

**Organisation**
- One company, one Organisation. A **claimed** Organisation carries its verification over — no second KYC, one tick, one public profile.
- **Declining** creates a fresh Organisation that verifies separately.
- An Organisation can have a buyer side, an exporter side, or both. Note explicitly that **`Organisation.type` can no longer express this** — a later session must not treat `type` as the single buyer/exporter discriminator.
- An admin block acts on the **Organisation** and takes **both sides** down.

**Docs A21 supersedes** (correct them wherever they still appear): m1.md §7 + the M1 screens brief (one shared login for all four roles); m1.md's single per-role signup that creates the User and Organisation together (now two steps with OTP between); the "one email = one account" assumption anywhere signup or login is described.

**Edit path:** A21 captures the company fields at signup. **§A22 governs viewing and editing the same data afterwards** — Organisation data is not write-once. Keep the two field sets identical.

## A22. Company profile — Organisation view and edit (M1)

Neither buyer nor exporter has ever had a way to view or edit their own `Organisation`. m1.md describes four areas — auth, KYC documents, verification, user management — and company profile is in none of them; its screen table has no row for it either. This section adds it as **M1 work**.

It is also the missing **capture path for M3**. Four fields the public seller page is specified to show have no way of being entered anywhere in the system: **logo**, **description**, **business type**, and the **categories a seller works in**. (`logo` and `description` exist on the `Organisation` model but no endpoint ever sets them; business type and working categories do not exist at all.) Built as-is, `GET /public/exporters/:id` renders with a company name and a country.

**Exporter — company profile page**

Lives in the exporter panel alongside dashboard, KYC upload and resubmit. Carries:

- company name, country, address, `entityType`
- logo, description, business type, working categories
- a **preview of how the public seller page will look**

The preview renders through the **same `toPublic()` projection as the live public page** (A3). It must not build its own field list, or it will drift from what buyers actually see.

**Buyer — company profile in the profile section**

Same idea, smaller: **company name, country, address, `entityType` only.** No logo, description, business type, working categories or public preview — a buyer has no public page.

It is needed even though buyer KYC is optional: when a buyer *does* submit, `entityType` and documents arrive, and the company details have to live somewhere.

**Ownership.** The organisation is always the caller's own — read and write resolve from `req.user.orgId`, never from a body or path parameter. A seller can only ever edit their own Organisation.

### A22.1 Field locking — the part that matters

Fields that were checked against the KYC documents **lock once the organisation is verified**:

| Field | Before verification | After verification |
|---|---|---|
| company name | editable | **locked** |
| country | editable | **locked** |
| address | editable | **locked** |
| `entityType` | editable (buyer) · fixed at signup for exporters | **locked** |
| logo | editable | editable |
| description | editable | editable |
| business type | editable | editable |
| working categories | editable | editable |

Before verification everything is editable, because nothing has been checked yet. After verification those four lock.

**Why:** a seller submits a registration certificate for "TextileHub Exports", gets verified, gets the tick — then renames the company. The tick now sits on a company that was never checked. For a client whose stated first priority is liability protection, that is exactly the failure to design out.

One reconciliation, stated so nobody has to guess: `entityType` is **stricter** than the table's "before verification" column for exporters. A21 captures it at signup step 2 and it decides which KYC documents are required, so the exporter profile screen never offers it for editing at any status. For a **buyer** it arrives with the optional KYC submission, so it stays editable until verification.

### A22.2 Changing a locked field

Companies do genuinely rename and relocate. **Allow the change** — it just costs the tick:

1. Accept the edit.
2. Drop `kycStatus` back to **`submitted`**, so the organisation re-enters review.
3. The tick is withheld until an employee re-approves — automatic, because the public `verified` boolean is derived from `kycStatus` (B7), never stored.
4. Write an `AuditLog` entry (A19): actor, organisation, which locked field changed, old and new value, timestamp.

This **reuses the existing resubmit path** — same queue, same approve/reject endpoints. No new mechanism and no new status.

The demotion applies **only** when the organisation is actually `verified`. One still `pending` or `submitted` has no tick to withhold, and its edits change nothing.

### A22.3 A buyer's company name is not private

Note this in the docs so nobody assumes otherwise: M4's seller-side chat list titles each thread **"product × buyer company"**, so a buyer's company name is visible to every seller they have enquired with. Titles are **composed at read time, not stored**, so a rename changes the title on old threads too. That is why the lock-after-verify rule applies to the **buyer's** company name as well, not only the exporter's.

### A22.4 Relation to A21

A21's signup step 2 already creates the Organisation with the company fields. **A22 is the EDIT path for the same data afterwards.** Keep the field sets consistent — do not let signup capture one set and the profile screen a different one.

Precisely: **A22's set is a superset of A21's.** Signup stays lean (name, country; exporter also `entityType` + address); the profile screen adds the four public ones (logo, description, business type, working categories), which are optional and have no place in a signup form. For every field the two **share**, the name, validation and format must be identical — one `country` format, one address shape, one length limit. A change to a shared field on either side changes both.

Slug consequence: `Organisation.slug` is generated from the company name once and is **immutable** (A6). A rename therefore does **not** change `/supplier/:slug` — the public URL keeps the old name. That is deliberate (indexed links must not break), but it must be visible on the rename screen so it is not later read as a bug.

### A22.5 Do not invent

**"Business type" is undefined.** It appears in M3's public seller projection and has never been specified anywhere. It is **NOT** `entityType` (`business` / `individual`, which drives the KYC document path). Leave it as an **open item and flag it** — do not guess a value set, do not quietly alias it to `entityType`, and do not ship a free-text box in its place.

Open, to be confirmed before this is built:

- **Business type** — its value list (above).
- **Working categories** — references to `Category` documents or free tags; seller-entered or derived from the products they list.
- **Which other `Organisation` fields the screen exposes.** `website`, `businessProfile` (registrationNumber / taxId / establishedYear) and `authorisedSignatory` exist on the model, appear in neither A21's nor A22's field list, and have no capture path either. Adding them silently invents scope; leaving them silently is another A22-shaped gap.
- **`verifiedAt` / `verifiedBy` on demotion** — cleared, or kept as the record of the previous approval — and whether `kycSubmittedAt` is re-stamped so the review queue orders correctly.
- **`businessProfile.registrationNumber` + `country` carry a unique partial index.** A country change on a verified organisation can collide with another organisation's registration number. Decide the behaviour before allowing that edit.
- **Employee / superadmin editing an organisation's company fields** — not covered here. A22 is the owner's own edit path only.

---

# Part B — Rules carried over unchanged

These are already in the plan docs and are **not** modified by Part A. Implement them as written.

- **B6** — products have no approval workflow. The seller owns the listing and controls `status`. Admin can take down, never delete (except A8).
- **B7** — all sellers and products appear in public results regardless of KYC. `kycStatus` is returned so the frontend can render the verified tick; it is **never** used as a filter.
- **D1** — unverified exporters capped at 3 active products; verification lifts the cap.
- **Admin category rights** — top categories: activate/deactivate only, no create/edit/delete. Sub-categories: full CRUD, plus CRUD on their `CategoryAttribute` fields.
- **Sub-category delete is blocked** when products or child categories exist.
- **Query-level exclusion** — draft, inactive, archived, taken-down, and deactivated-category products are excluded **in the query**, not filtered out of the response after fetching.
- **Attributes** — `Product.attributes` is an array of `{ attributeId, key, value }` with `value` as a Mixed type, indexed on `attributes.key` and `attributes.value` so numeric range filters work.
- **Search** — Atlas Search. The index covers product text plus category `name` and `synonyms` plus seller company name. Facets come from `CategoryAttribute` where `filterable: true`. OR within a facet group, AND across groups.
- **Ranking** — text relevance, then a boost for verified sellers, then recency, then listing completeness. Verified is a **boost, never a filter**.
- **AI search** — one OpenAI call per request, JSON validated against real categories and attributes with unknown keys dropped, fallback to plain keyword search on failure or timeout, per-user rate limit, explicit timeout, `temperature: 0`, key from environment only. The live category, synonym, and attribute list is injected at runtime. Full system prompt in `modules-in-detailed/m3-search-filter-3-4days-max/Search.md` §11.
- **SavedItem availability** — temporarily unavailable items (inactive, taken-down, category deactivated) stay in the saved list flagged "currently unavailable". Archived items are removed from saved lists.
- **SEO** — slug URLs, canonical tags, `noindex` on filtered and search URLs, dynamic sitemap of active entities only, JSON-LD with no private data. Full rules in `modules-in-detailed/m3-search-filter-3-4days-max/m3-seo-rules.md`.

---

# Part C — Build order

## Prerequisite — Organisation / company profile (**now scoped: §A22**)

The `Organisation` model exists and is created at signup, but the backend has **no endpoints for it** — only the `auth`, `employee`, and `admin` routers are mounted. A seller cannot view or edit their company profile.

This blocks M3: `GET /public/exporters/:id` is the public seller profile and reads from `Organisation`. Without these endpoints that page renders effectively empty — just the company name captured at signup.

**This is no longer an open question.** §A22 scopes it as **M1 work**: exporter + buyer company profile screens, the four M3 fields that had no capture path (logo, description, business type, working categories), field locking after verification, and re-review on a locked-field change. Build it to A22 — not to your own design. It must land before step 10 (public surfaces) is meaningful.

A22's own **open items are still open** (business type's value list, the shape of working categories, the other `Organisation` fields). Raise those rather than guessing.

## Order

1. **Reconcile the base layer first.** Teach `scoping.js` the new ownership field names (A2). Build the `toPublic()` helper and the `PUBLIC_FIELDS` convention (A3). Re-run M1's 24 tests. Nothing else starts until these pass.
2. **M2 models** — `Category`, `CategoryAttribute`, `Product`, with all indexes, validation, and ownership scoping.
3. **M2 seed** — 40 top categories including "Other" with its two typed subs (A14), sub-category starter set, synonyms on the top 40, `CategoryAttribute` definitions.
4. **M2 category endpoints** — public reads, then admin toggle/CRUD/attribute management, with cascade and `prevActive` (A4).
5. **M2 product endpoints** — seller CRUD, status transitions with both caps enforced (A15, D1), Cloudinary upload, admin takedown/restore.
6. **M2 tests** — cap enforcement, one-way draft, cascade restore, ownership isolation, takedown does not alter `status`.
7. **M3 SavedItem** — model, indexes, endpoints, availability rules.
8. **M3 search** — Atlas Search index, `GET /public/search`, `GET /public/facets`, ranking.
9. **M3 AI search** — `POST /search/ai` with all guardrails.
10. **M3 public surfaces** — product detail, public seller profile, category browse, all through `toPublic()`.
11. **Cleanup job** — the 90-day blocked-product purge (A8).
12. **M3 tests** — especially the projection tests below.

---

# Part D — Definition of done

- Every public route's response has a test asserting it contains **only** its `PUBLIC_FIELDS`, and explicitly asserting the absence of `takedown`, internal IDs, and seller contact details.
- A seller cannot read, edit, or delete another seller's product; the attempt returns 404.
- An unverified seller cannot publish a 4th active product, and cannot create an 11th draft.
- A published product cannot be moved back to `draft`.
- Deactivating a top category hides its products; reactivating restores sub-categories to their previous state, including subs that were already off.
- Taking down a product leaves `status` untouched and frees a cap slot.
- A search query for a synonym ("medicines", "kapda") returns the mapped category's products.
- Archived, draft, inactive, taken-down, and deactivated-category products never appear in any public result — verified by query inspection, not just response inspection.
- M1's 24 tests still pass.

---

# Part E — Ask, do not guess

Stop and ask if you hit any of these:

- Anything in Part A conflicts with something in the code you cannot reconcile.
- A plan doc specifies behaviour that Part A does not cover and that you would otherwise have to invent.
- Changing `scoping.js` would require altering M1's auth flow beyond field naming.
- A rule in Part B cannot be implemented as written given the current architecture.

Two open items are deliberately **not** decided and must not be invented:

1. Whether the "Other" categories support free-form, seller-defined spec fields. Build "Other goods" and "Other services" as ordinary categories with normal `CategoryAttribute` fields, and raise the question rather than building a free-form mechanism.
2. **"Business type"** on the seller profile (§A22.5) — it has never been defined, and it is **not** `entityType`. Raise it; do not guess a value set and do not alias it to `entityType`. The same applies to the shape of a seller's **working categories**.
