# M5 · Web Screens — Design Brief

> **13 screens** for the M5 (Super Admin — platform governance console) milestone, **web only**.
> This is a **design** document: what each screen contains, every field on it, and the states that
> need artwork. No API or code detail.
> Product: **MPX Global** — B2B import/export marketplace. Indian exporters, international buyers.
>
> **Scope rule:** this brief contains **only** the screens named in `modules-in-detailed/m5/`
> (`m5.md` §3–§7, `m5-features.md` #6–#15, the three Screenshot diagrams) plus the two admin
> surfaces the FINALIZE module has since **built and owner-approved** (`MPX-FINALIZE-Module.md`
> F5a error log · F5b featured content, both 2026-08-01). Everything is cross-checked against the
> **built backend** (`MPX-BACKEND-FULL-SAAS/src` — `admin.routes.js`, `permissions.js`,
> `adminOrg.view.js`, `dashboard.service.js`, validators) so gates, filters and fields below match
> what actually exists. Nothing inferred, nothing added. See §12 for gaps.
>
> **Companion:** `design-plans/m1/web-screens-design.md` — M5 reuses its design foundations, shared
> components and admin screens 13–16. The four M1 admin screens are **already designed and already
> built** (`web/src/pages/admin/`); this brief designs only their M5 **delta** (§10).

---

## 1. Design foundations

Everything in `design-plans/m1/web-screens-design.md` §1 applies unchanged — tone, type and spacing
scale, responsive breakpoints (1440 / 1024 / 768 / 375), accessibility bar, four drawn states per
screen, the verified-tick convention (§1.1) and the status vocabulary (§1.2). M5 adds the
following on top.

**Tone.** This is the operator's command centre and, per the quote, **the stakeholder showcase
surface** (`.claude/rules/web-design.md`). Dense, data-forward, authoritative — but never cramped:
the dashboard carries the most polish, the tables carry the most information. An investigation
(bad product → its seller → its chats → its audit trail) should feel like following a thread, not
re-searching.

**One console, permission-filtered.** There is **no separate employee panel** in month 1
(`m5.md` §3, §8). An employee signs into this same console; the sidebar and dashboard tiles filter
to their granted permissions. Every sidebar section, every dashboard tile, every table must look
right with **zero, one, or many** items visible.

**Staff-only surface — internal vocabulary is allowed here.** Unlike every public and party
screen, admin screens **may show raw `kycStatus`** (Pending / Submitted / Verified / Rejected)
and rejection reasons — reviewers need them. The one hard exception: **anywhere the console
previews a public page** (seller public profile links from screens 3 and 5), the preview renders
through the **public projection** — `verified` boolean + tick only, never `kycStatus`, never a
rejection state (`.claude/rules/m3-public-projection.md`, CLAUDE.md).

**"Admin" means superadmin-or-permitted-employee.** There is no `admin` role (`m5-rules.md` §5).
Where this brief says a control is **superadmin-only**, that is a hard role gate the UI must
mirror: the control is *absent* for an employee, not disabled. Where it says a permission string
(e.g. `product:takedown`), an employee holding it sees the control, one without it doesn't —
and the server re-checks regardless.

**404, never 403.** A record the caller can't see reads as "not found". No screen states or
implies "this exists but you can't open it".

### 1.1 Status vocabularies used across M5

Beyond the M1 verification set, M5 screens carry three more status languages — design each once:

| Vocabulary | Values | Where |
|---|---|---|
| **Product visibility** | Active (`success`) · Inactive — *seller hid it* (`muted`) · **Blocked — admin takedown** (`danger`) | monitoring list, org detail. ⚠️ Blocked reads the takedown flag, never the seller's own status — the two must stay visually distinct (`m5.md` §4) |
| **Organisation state** | Active (`success`) · **Blocked** (`danger`, with reason) | org list, org detail header |
| **Chat state** | Open (`muted`) · **Frozen** (`warning`/`danger` + reason: admin block · product taken down · **account blocked**) | conversations list, chat viewer |

**Purge countdown** is its own small component: "purges in **N** days" (`warning` under 30 days,
`danger` under 7), always paired with the blocked date. Blocked products delete automatically at
180 days (§A8) — without a visible countdown the purge happens silently (`m5.md` §4).

---

## 2. Shared components to design once

All M1 shared components (§2 of the M1 brief) are reused — admin table, status chip, verified
tick, confirmation modal (destructive variant), drawer, tabs, pagination, toast, skeleton, empty
state, layout shell with permission-driven sidebar. New for M5:

- **Stat tile** — big number · label · optional sub-line · **always a link** to its
  pre-filtered list (`m5.md` §3: "a number that cannot be clicked through is a dead end").
  States: loading, zero (a calm "nothing waiting", not an error), loaded, and **absent**
  (permission not held — the tile simply isn't rendered).
- **Cross-link row** — the small "open in…" action cluster used on product and org rows:
  product detail · chats · public profile · organisation. Icon + label, never icon-only.
- **Purge countdown chip** (§1.1).
- **Reason banner** — a `danger`/`warning` alert carrying a moderation reason verbatim (block
  reason, takedown reason, freeze reason). Give reasons room for full sentences.
- **Audit-entry row + detail drawer** — timestamp (absolute + relative), actor, action code,
  target; opening shows the full entry. Read-only by construction: this component has **no**
  edit, delete or overflow-menu affordance, ever.
- **Cursor "Load more"** — conversations and messages paginate by cursor, never page numbers
  (`m5-rules.md` §9). Design the "Load more" / infinite-scroll pattern distinct from the numbered
  pager other tables use.
- **Tree row** — category tree: expand/collapse, active/inactive state, drag-free (order is a
  number field, not drag-and-drop, unless the owner asks).
- **Attribute editor row** — name · key · input type · options · unit · required · filterable ·
  order, with add/remove.
- **"Not captured" field row** — label + a quiet em-dash and the words "Not captured" (never an
  empty input). Used on the org detail for `registrationNumber`, `website`, `taxId`,
  `establishedYear`, `authorisedSignatory` (`m5-rules.md` §13; FINALIZE F3).

**Sidebar (extends the built `AdminLayout`).** Sections, top to bottom, with what reveals them:
Dashboard (any staff) · Organisations (`organisation:read`) · Users (`user:read`) · Verification
(`buyer:approve` / `exporter:verify`) · Catalogue (`category:read` / `product:read`) ·
Conversations (`conversation:read`) · Featured (`featured:manage`) · Employees (superadmin only) ·
Audit log (`audit:read`) · Error log (`errorlog:read`). Zero-item and one-item renders must be
drawn — an employee with nothing granted lands on the calm explained empty state from the M1
brief, not a dead end.

---

## 3. Screen inventory — 13

| # | Screen | Route | Gate | Named in |
|---|---|---|---|---|
| 1 | Dashboard | `/admin/dashboard` | any staff (tiles filter by held permissions) | `m5.md` §5 · `m5-features` #12 |
| 2 | Organisation list | `/admin/orgs` | `organisation:read` | `m5.md` §7 · #14 |
| 3 | Organisation detail | `/admin/orgs/:id` | `organisation:read` | `m5.md` §7 · #15 |
| 4 | Org block / unblock modal | (within 3) | **superadmin only** | `m5.md` §7 · FINALIZE F1 |
| 5 | Product monitoring list | `/admin/products` | `product:read` | `m5.md` §4 · #8 |
| 6 | Takedown / restore modal | (within 5) | `product:takedown` | #9 |
| 7 | Category tree | `/admin/categories` | `category:read` (writes `category:manage`) | #6 |
| 8 | Sub-category editor + attributes | `/admin/categories/:id` | `category:read` / `category:manage` | #7 |
| 9 | All conversations | `/admin/conversations` | `conversation:read` | `m5.md` §3 · #10 |
| 10 | Chat viewer (read-only) | `/admin/conversations/:id` | `conversation:read` (block: `conversation:block`) | #11 |
| 11 | Audit log viewer | `/admin/audit` | `audit:read` | `m5.md` §6 · #13 |
| 12 | Error log viewer | `/admin/errors` | `errorlog:read` | FINALIZE F5a (built 2026-08-01) |
| 13 | Featured content manager | `/admin/featured` | `featured:manage` | FINALIZE F5b (built 2026-08-01) |

**Carried from M1, not redesigned here** — already in `design-plans/m1/web-screens-design.md`
(screens 13–16) and already built in `web/src/pages/admin/`: **Users** (`/admin/users`),
**Verification queue** (`/admin/verification`), **KYC viewer**, **Employees & permissions**
(`/admin/employees`). Their M5 delta — chiefly the grown permission catalogue — is §10.

### Do not design — with sources

- **TOTP / 2FA screens** — no setup, no QR, no backup codes, no extra login step. **D4 is ON
  HOLD** (`docs/Note.md`; re-raised 2026-08-01, owner said not now). Same exclusion as the M1
  brief. Raise again at project close only.
- **Per-employee dashboards & reports, ticket/query handling, enquiry routing, internal notes,
  seller directory** — the employee panel as its own surface is **month 2 / Bucket A**
  (`docs/month1-not-doing.md`; `m5.md` §8–§9). Ticket handling is additionally an undecided
  Bucket-A2 item — 🔴 alert before building any of it.
- **Notification admin controls** (per-type enable/disable, delivery tracking, in-app centre) —
  **D5 deferred** except the narrow FCM slice, which has no admin UI.
- **Platform settings screen** — moved to month 2 (`m5.md` §9). ⚠️ The built `AdminLayout`
  sidebar already shows "Settings · Soon" routed to ComingSoon — keep it visibly non-final and
  logged in `docs/UiWebNotes.md`; do not design the screen behind it.
- **Trend charts, deep analytics, saved-item/message counts on the dashboard** — later phase by
  the quote (`m5.md` §5, §9).
- **Any admin product search screen** — M3 states admin has no search screens; the monitoring
  list's filters are the whole surface (`m5.md` §9).
- **Bulk takedown** — deliberately does not exist; the org block is the answer to "many bad
  products" (`m5.md` §4).
- **Anything Phase 2** — subscriptions, trust score, escrow/payout admin, orders. Skeleton
  models stay untouched.

---

## 4. Dashboard — screen 1

Three bands, ordered by how often they are acted on. **Not a metrics wall** — only things that
ask for work (`m5.md` §5). This is also the showcase screen: it gets the most visual polish.

**Band 1 — Needs action** (largest, top). Stat tiles, each rendered **only if the viewer holds
the permission for the list it links to** (the server already omits the others — design for any
subset, including none):

| Tile | Sub-line | Links to | Shown when |
|---|---|---|---|
| Buyer verifications pending | — | org list, buyer side + submitted | `buyer:approve` |
| Exporter verifications pending | — | org list, exporter side + submitted | `exporter:verify` |
| Rejected, awaiting resubmit | — | org list, rejected | `organisation:read` |
| Blocked products | — | monitoring, Blocked | `product:read` |
| Nearing purge | "blocked 150+ of 180 days" | monitoring, nearing-purge filter | `product:read` |

**⚠️ The two verification tiles are not independent queues.** `kycStatus` is one shared value per
Organisation, so a both-sides company in review counts in **both** tiles, and whichever review
happens first verifies the whole company. The server reports that overlap (`bothSidesPending`);
design a quiet connective line between/below the two tiles — *"N companies appear in both queues —
reviewing either side verifies the whole company."* — shown only when N > 0 and only when both
tiles render. Without it the two numbers sum to more work than exists.

**Band 2 — Health** (thin strip). One figure: **"Average days to verify"** + sample size
("across N verifications"). 🔴 **Label is exactly that — never "days to decision"**: rejections
are excluded by design, so the number must not claim more than it measures (`m5.md` §10;
backend D3). Zero sample renders "No verifications yet", not "0.0 days".

**Band 3 — Totals** (smallest, bottom): Organisations by side (buyer / exporter / both) · active
products · conversations · users — each a link into its list where the viewer holds the matching
permission, a plain number where the list itself is theirs to open.

**Nearing-purge honesty:** the tile counts exactly what the purge job will delete — taken-down,
old enough, **not archived** (archived rows never purge). It links to the monitoring list's
nearing-purge filter, not to "all blocked", so the count and the list can never disagree.

**States:** loading (tile skeletons) · loaded · all-zero (a genuinely calm "all clear" —
the desired state, not an error) · partial (permission-filtered subset) · error.

**Design notes:** no graphs, no sparklines, no error tile (error log moved to FINALIZE and has
its own screen). Every number is clickable through to a pre-filtered list — a tile that reads but
doesn't link is a defect (`m5.md` §3).

---

## 5. Organisations — screens 2–4

### 2 · Organisation list — `/admin/orgs`

The company — not the user — is the unit an admin governs (A21, `m5.md` §7).

**Filters / controls**

| Control | Type | Notes |
|---|---|---|
| Search | text | **prefix match — label "Starts with…"** (same convention as `/admin/users`) |
| Side | select | Buyer · Exporter · Both · All |
| Verification | select | the four `kycStatus` values (internal vocabulary is fine here) |
| State | select | Active · Blocked · All |
| Rows per page | select | 20 / 50 (**50 is the server ceiling**) |
| Pagination | numbered pager | page numbers + total |

**Columns — five, deliberately** (`m5.md` §7: a wider table breaks on responsive; country and the
sides badge live on the detail):

| Column | Content |
|---|---|
| Company | name, with a **second line: country · slug** — company names collide, two "Global Exports" rows are otherwise indistinguishable |
| Verification | status chip (§1.2 of the M1 brief) |
| Products | live product count |
| Takedowns | cumulative count — **sorted by this, descending** (repeat offenders float to the top) |
| State | Active / **Blocked** chip |

**Row action:** open detail. That's all — every act of governance happens on the detail screen.

**States:** loading (skeleton rows) · results · no matches (names the active filters, offers to
clear) · error · empty platform (no orgs yet).

**Design notes:** the takedown count is load-bearing, not decoration — it is the only place a
repeat offender becomes visible, and account suspension is the only abuse control left (`m5.md`
§4). No automatic threshold exists or will be shown (F6 closed 2026-08-01: the console shows the
count, the admin decides). The platform's own Organisation is never in this list.

---

### 3 · Organisation detail — `/admin/orgs/:id`

The governance hub for one company. Shows **both sides' sections when the company has both**, and
only the side that exists otherwise. Long page — use a sticky header + in-page section nav, not
tabs (an investigation reads top to bottom).

**Header (always):** name · slug · sides badge (Buyer / Exporter / Both) · verified tick +
"since {date}" if verified · **Active / Blocked** state (blocked shows the reason banner:
reason, date) · created date · **Block / Unblock** button (**superadmin only — absent for
employees**, → screen 4).

**Company (always)**

| Label | Type | Notes |
|---|---|---|
| Country | read-only value | — |
| Address | read-only value | line 1/2, city, state, postal |
| Entity type | read-only value | Business / Individual |
| Logo | image | empty state: "No logo uploaded" |
| Description | read-only text | — |
| Registration number · Website · Tax ID · Year established · Authorised signatory | **"Not captured" rows** | 🔴 no form captures these (Phase 2) — label "Not captured", never render empty inputs awaiting data (`m5-rules.md` §13). `website` additionally never appears on any public surface |

**Verification (always):** status chip · submitted date · **verified by {name}** + date ·
rejection reason (verbatim, in a reason banner — internal screen, allowed) · resubmit count ·
**"Reviewed side(s): Buyer / Exporter / —"** · KYC documents entry point.

- 🔴 **Reviewed-side honesty** (`m5.md` §7): one `kycStatus` covers both sides, so a
  buyer-approved company that later claims an exporter side carries the tick with **no
  exporter-side review**. The screen must state which side was actually reviewed — "Verified
  (buyer side reviewed)" — otherwise an unreviewed exporter side reads as vetted. "—" (nothing
  reviewed yet) is a valid render.
- **KYC documents** show as a **count + "View documents" link** that appears only for viewers
  holding `kyc:view` (the documents live behind their own permission and their own audit row —
  `organisation:read` alone never sees them). Without the permission: count only, no link.

**Sides & claim history (always):** which sides are enabled, signup date · claim history list.
🔴 **Claim history is empty today** (the signup claim step isn't built yet) — render *"No claim
recorded"*, never a spinner, never copy implying the data was lost.

**Users (always):** table — name · email · role · Active/Inactive chip · last sign-in.
**No permissions column** — another user's permission set is deliberately never shown here; that
is the Employees screen's job and it is superadmin-only. Row action: open in `/admin/users`.

**Buyer account chats / Exporter account chats (per side):** two separate count-plus-link rows —
a both-sides company gets **two clean lists**, each linking to the conversations screen filtered
to that side of this org. Never merge them into one "chats" number.

**Exporter side only:** products by status — Active · Inactive · **Archived** · Blocked — plus
takedown count, a link to the monitoring list **filtered to this org**, and a link to the
**public seller profile**. ⚠️ **The Archived count is a number without a link** — the monitoring
list can never show archived rows (accepted gap, `m5.md` §4); a linked count would land on an
empty list and read as a bug. The public-profile link opens the page **as a buyer sees it**
(public projection — tick or nothing, no status).

**Buyer side only:** enquiries sent · saved items · link to conversations.

**Block cascade status (when blocked):** the block's product/chat cascade runs in the background.
Show its state alongside the block banner: **running** ("taking listings down…"), **done**
("N products taken down · N conversations frozen", with completion time), and 🔴 **failed** — a
loud `danger` state: *"The cascade did not finish — this company's listings may still be live."*
A failed cascade silently rendered as done is the worst outcome this screen can produce.

**Audit trail (always):** this organisation's full record — an embedded, read-only instance of
the audit list (screen 11) pre-filtered to this org, with a "view in audit log" link.

**States:** loading · loaded (side-count variants: buyer-only / exporter-only / both) · blocked
(banner + cascade sub-states) · not found (404 page) · error.

---

### 4 · Org block / unblock — confirmation modal — **superadmin only**

The console's most destructive action and its answer to "many bad products" (`m5.md` §4). Design
it with the weight of an account deletion.

**Block modal — fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Reason for blocking | textarea + character counter | ✔ | "Recorded in the audit log and shown with the block. Explain why." |

**Consequence copy — must state the full, real reach** (the cascade is built; the copy must
neither under- nor over-claim):

> *Blocking {Company} will immediately:*
> *· sign out and lock **all N** of its users*
> *· take down its **live products** (buyers will no longer find them)*
> *· freeze its **conversations***
> *Drafts and archived products are not affected. This is reversible — unblocking restores what
> the block switched off.*

**Unblock modal** — confirmation with the mirror consequence, plus the subtlety that prevents a
wrong promise: *"Restores the users, products and chats **this block** switched off. Anything
taken down or frozen individually beforehand stays that way."* Blanket-reactivation does not
happen and the copy must not imply it.

**States:** default · loading · success (header flips to Blocked, cascade status appears as
"running") · **already blocked / already unblocked** ("someone else got here first" + refresh) ·
error.

**Design notes:** `danger` primary on block, ordinary primary on unblock. The reason field is
mandatory with no default. The platform's own organisation can never be blocked — but it never
appears in the console at all, so no screen needs a refusal state for it.

---

## 6. Catalogue — screens 5–8

### 5 · Product monitoring list — `/admin/products`

Read-only monitoring with one destructive-ish action. **The admin cannot edit a product** — it
belongs to the seller; monitoring is read plus takedown, nothing else (`m5-rules.md` §3).

**Filters**

| Control | Type | Notes |
|---|---|---|
| Category | select | top category |
| Sub-category | select | filtered by the chosen top |
| Status | select | **exactly three options**: Active · Inactive · Blocked |
| Seller | org picker / id | — |
| Product name | text search | prefix — "Starts with…" |

🔴 **The status filter's three options are a rule, not a convenience** (`m5.md` §4): *Inactive*
means the **seller hid it**; *Blocked* means an **admin took it down** — they read different
fields and must never be merged or restyled to look alike. `draft` and seller-`archived`
products are **not shown at all** — no fourth or fifth option.

**Columns:** product name · seller company · category · status chip (§1.1) · **seller's
cumulative takedown count** · **purge countdown** (blocked rows only) · created date · row
actions.

- **Takedown count** — the repeat-offender signal (`m5.md` §4). Same number as the org list;
  clicking it opens the seller's Organisation.
- **Purge countdown** — chip per §1.1. Absent on non-blocked rows.

**Row actions (cross-link cluster + moderation):** **Take down** (or **Restore**, per state —
`product:takedown` holders only, → screen 6) · open product detail (read-only, staff view — shows
who took it down, when, and why) · view this product's chats (→ screen 9 filtered by product) ·
open the seller's **public profile** (as a buyer sees it — public projection) · open the seller's
**Organisation** (screen 3). The public profile and the Organisation detail are two different
destinations and both are needed.

**States:** loading · results · no matches (names filters) · error · row processing.

**Design notes:** no bulk selection, no bulk takedown — if that many products are wrong, the
Organisation gets blocked (screen 4). The staff product detail shows the takedown actor **by
name**; ⚠️ the *seller's* own view of a takedown shows reason and date but **never who** — that
asymmetry is deliberate and not this screen's to fix.

---

### 6 · Takedown / restore — modal within screen 5

**Take down — fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Reason | textarea + character counter | ✔ | "Shown to the seller with the takedown date. Explain what's wrong." |

**Consequence copy:** *"The product disappears from search and its public page immediately. The
seller sees this reason. It stays down until restored — and is deleted permanently if it stays
blocked for 180 days."* The 180-day line matters: it is the only warning the admin gets before
the purge clock starts.

**Restore — confirmation:** *"Returns the product to whatever state the seller left it in
(active or hidden)."* Restore does not force-publish — the seller's own status was never touched.

**States:** default · loading · success (row chip flips, countdown appears/disappears) ·
**already blocked / already restored** by someone else · error.

---

### 7 · Category tree — `/admin/categories`

The full tree: ~40 top categories, ~250 sub-categories. Read for `category:read`; every write
needs `category:manage` (controls absent otherwise).

**Controls:** search by name · Active/Inactive filter · expand/collapse all.

**Top-category rows — toggle and image only.** No create, no rename, no delete on top
categories (`m5-rules.md` §12). Row shows: name · image thumbnail (or "no image" placeholder) ·
active toggle · sub-count · expand.

- **Image upload** on a top category is the single deliberate write exception — square-ish crop,
  replace/remove, per-file progress and error. The 40 images are seeded through this control.
- **Deactivate confirmation — cascade copy:** *"Hides this category and all N of its
  sub-categories from buyers. Their current on/off states are remembered — reactivating restores
  them exactly, it doesn't switch everything on."* That restore-not-blanket behaviour is a rule;
  the copy must teach it or admins will fear the toggle.

**Sub-category rows:** name · type badge (Goods / Service) · active state · product count ·
order · open editor (→ screen 8) · delete. **Delete is blocked** when products or child
categories exist — show the refusal inline with the count that blocks it ("Can't delete — 14
products use it"), not a generic failure.

**States:** loading (tree skeleton) · loaded · search-no-match · error · row saving.

---

### 8 · Sub-category editor + attribute manager — `/admin/categories/:id`

Create and edit sub-categories, and manage the attribute set that builds the product form.

**Sub-category — fields**

| Label | Type | Required | Helper |
|---|---|---|---|
| Name | text | ✔ | — |
| Parent category | select | ✔ | top categories only |
| Type | radio: **Goods / Service** | ✔ | "Decides which product form sellers fill in" — **required on sub-categories, never set on tops** |
| Synonyms | **tags input** | ✔ | 🔴 "Words buyers might search instead — without these this category is invisible to search." **Not optional** (`m5-rules.md` §12) |
| Active | toggle | — | — |
| Order | number | ○ | — |
| Image | file upload | ○ | same component as screen 7 |

**Attribute manager — repeatable rows** (per attribute): name · key · input type (text / number
/ select / boolean) · options (select only — chips editor) · unit (number only) · required
toggle · filterable toggle · order. Add / edit / remove.

**States:** create (empty form) · edit (loaded) · saving · validation errors (a missing synonyms
list is an error, not a warning) · attribute row editing · delete-blocked refusal · error.

**Design notes:** the synonyms input needs real prominence — it is the difference between a
category buyers find and one they don't. The type radio is consequential and irreversible in
spirit (it decides the product form); give it explanation at the point of choice, like entity
type on the signup screens.

---

## 7. Conversations — screens 9–10

### 9 · All conversations — `/admin/conversations`

Every thread on the platform, for moderation. Reading any of it is **recorded** — set that
expectation on the surface itself (a discreet standing note: *"Opening a conversation is
recorded in the audit log."*).

**Filters**

| Control | Type | Notes |
|---|---|---|
| Search | text | matches **product name, buyer company, seller company** — or paste an **org id / product id** directly |
| Side + Organisation | paired filter | "as buyer" / "as exporter" for one org — this is what splits a both-sides company into two clean lists (the org-detail chat links land here pre-filled) |
| State | select | Open · Frozen · All |

**Row:** thread title as **buyer × seller × product** · last message time + one-line preview ·
**the parties' unread state** · frozen chip + reason where frozen.

- ⚠️ **Unread is the parties', not the admin's.** Admin has no read-tracking of its own; the
  signal shown is "the seller hasn't opened this" — a moderation signal, not an inbox. Label it
  so it can't be misread as "you have unread messages".

**Pagination:** **cursor — "Load more", no page numbers.** New messages re-order this list
constantly; numbered pages would repeat and skip.

**Row actions:** open viewer (→ 10) · **Block chat / Unblock chat** (`conversation:block`
holders; reason required on block; confirmation states the consequence: *"Both parties see the
conversation as frozen and can't send messages until it's unblocked."*).

**States:** loading · results · no matches · error · row processing.

---

### 10 · Chat viewer — `/admin/conversations/:id` — **read-only**

**Contains:** thread header (buyer org · seller org · product, each a cross-link) · frozen banner
+ reason when frozen (all three freeze reasons need distinct copy: admin blocked this chat ·
the product was taken down · **the seller's account is blocked**) · full message history, loading
in bundles on scroll (cursor) · the parties' identities per message · Block / Unblock action
(`conversation:block`).

🔴 **There is no composer. Design nothing that looks like one.** No input, no disabled input, no
"reply as platform" — the server rejects admin sends by role, and the UI must not suggest the
capability exists (`m5-rules.md` §10). The bottom of the screen is simply the last message,
plus the standing "views are recorded" note.

**States:** loading · loaded · older-messages loading (top spinner on scroll-up) · frozen
variants (three reasons) · not found · error.

**Design notes:** live updates are fine while open (the viewer joins only this thread's room);
never imply the admin is "in" the chat to the parties — presence indicators show buyer and
seller only.

---

## 8. Audit log viewer — screen 11

The record that protects the operator in a dispute. **Read-only and append-only — no edit, no
delete, no exceptions** (`m5.md` §6). The design must not merely omit mutation affordances — it
must have no slot where one could appear: no row overflow menu, no checkbox column, no bulk bar.

**Filters**

| Control | Type | Notes |
|---|---|---|
| Actor | user picker / id | — |
| Organisation | org id | "everything that happened to this company" — how the org-detail trail deep-links here |
| Action | **free-text input** with recent/known suggestions | ⚠️ deliberately **not a fixed dropdown** — the action list grows with every module and a stale list would hide new entries. Suggest, don't constrain |
| Target | entity type + entity id pair | id requires a type — validate the pair in the form |
| Date range | from / to date pickers | **an inverted range is a form error before submit** ("From must be before to"), never a silently empty page |
| Rows per page | 20 / 50 | 50 is the ceiling |

**List row:** timestamp (absolute + relative) · **actor name** — 🔴 a system-written entry (the
180-day purge) has **no actor: render "System"**, never a blank · actor role · action code
(monospace chip) · target (type + name where resolvable).

**Detail (drawer on row open):** the whole entry — action · actor (name, role, id) · target
(type, id) · reason where the action carried one · **before/after snapshot** rendered as a
labelled diff (changed fields only) · timestamp. Snapshots never contain document URLs, tokens
or KYC values — if a field looks like it shouldn't be there, that's a bug to report, not render.

**Zero-result honesty:** when filters match nothing, say **which filter** produced the silence —
*"No entries match action 'kyc.veiw' in this range"* — so a typo is distinguishable from genuine
absence. An empty page that looks like "no activity" is the wrong answer to give an investigator.

**States:** loading · results · filtered-empty (named filters) · detail drawer (loading /
loaded) · error.

**Coverage the design should assume** (all written today): KYC submit + view, buyer
approve/reject, exporter verify/reject, product takedown/restore, the 180-day purge, chat
block/unblock, staff chat reads, user activate/deactivate, employee permission changes, org
block/unblock. *(The organisation claim will appear once that signup step is built — no design
change needed; it's just another action code.)*

---

## 9. FINALIZE surfaces in the console — screens 12–13

Both built and owner-approved 2026-08-01 (`MPX-FINALIZE-Module.md` F5a/F5b). They live in this
console because it is their only home; they are FINALIZE work, not M5, and are labelled so here
for traceability. ⚠️ **They are also specified in `design-plans/m6-finalize/web-screens-design.md`**
(written 2026-08-02, before this brief existed) — that brief noted it had "no M5 web brief to
host" them. If the two ever disagree, reconcile rather than pick; this section is the console-
context view (sidebar placement, shared components), the M6 brief is the feature-owner view.

### 12 · Error log viewer — `/admin/errors` — `errorlog:read`

Server 5xx errors, for debugging. **Read-only** — there is no clear/delete; retention is
automatic (90-day expiry). Deliberately a **separate permission** from the audit log: chasing a
bug must not require the heaviest read on the platform.

**Filters:** request ID · route prefix · method · status code (5xx only) · user / org · date
range.

**List row:** timestamp · status code chip · method + route · request ID (copyable — it is what
a user-facing error screen shows, so support tickets arrive carrying it) · user/org where known.

**Detail (drawer):** message · stack trace (monospace, scrolls in its own container) · request
context. Secrets are redacted at write time; the UI renders what it gets.

**States:** loading · results · **empty ("No errors in this window") — here, genuinely good
news** · filtered-empty · detail drawer · error (yes, the error screen needs an error state).

### 13 · Featured content manager — `/admin/featured` — `featured:manage`

Curates the public landing page: **banners · featured products · featured categories · featured
suppliers**. Content curation, not governance — grantable, every action audited.

**List:** one table or four kind-tabs — kind badge · target (name + thumbnail) · order · active
state · created · actions (edit · remove).

**Add featured item — form**

| Label | Type | Required | Helper |
|---|---|---|---|
| Kind | select: Banner · Product · Category · Supplier | ✔ | — |
| Target | picker (product / category / supplier search) | ✔ (non-banner) | "Points at the live item — if it's taken down or blocked, it leaves the landing page by itself" |
| Banner image | file upload | ✔ (banner) | a banner without an image is not a valid row — the upload is part of create, not a second step |
| Link / order / active | text · number · toggle | ○ | — |

**Remove is a real delete** — the one admin delete in the console, deliberate (un-featuring
removes a curation slot, not a business record; the audit log keeps the history). Confirmation:
*"Removes it from the landing page. The product/category/supplier itself is not affected."*

🔴 **A featured row is a pointer, never a snapshot.** The design must not offer editable
name/price/image overrides for non-banner kinds — the landing page re-resolves the live target,
which is exactly what makes a blocked company vanish from the front page on its own. Show the
target's *current* state in the list (including a warning chip when the target is currently
unavailable: "not showing — product blocked").

**States:** loading · list · empty ("Nothing featured yet — the landing page shows its default
sections") · create form (default / uploading / errors / success) · target-unavailable warning ·
remove confirmation · error.

---

## 10. M1 admin screens — the M5 delta

The four M1 screens (Users · Verification queue · KYC viewer · Employees) are designed in the M1
brief and built. M5 changes them in exactly two places:

**1 · Employees & permissions (`/admin/employees`, superadmin only) — the permission catalogue
grew from 3 to 12 grantable strings.** The checkbox group must now be **grouped by area** to stay
readable, matching the server catalogue exactly:

| Group | Permissions |
|---|---|
| Verification | Approve buyers (`buyer:approve`) · Verify exporters (`exporter:verify`) · View KYC documents (`kyc:view`) |
| Users | View user directory (`user:read`) |
| Catalogue | View categories (`category:read`) · Manage categories (`category:manage`) · View products (`product:read`) · Take down / restore products (`product:takedown`) |
| Conversations | Read conversations (`conversation:read`) · Block / unblock chats (`conversation:block`) |
| Governance records | View organisations (`organisation:read`) · View audit log (`audit:read`) |
| Debugging & content | View error log (`errorlog:read`) · Manage featured content (`featured:manage`) |

Helper copy worth adding per the heavier grants: `conversation:read` — *"Every conversation they
open is recorded in the audit log"*; `audit:read` — *"Includes the record of every KYC document
and chat staff have viewed"*. The edit panel still **replaces** the whole set; that behaviour and
its copy are unchanged from the M1 brief.

⚠️ **Known gap carried from the build** (`docs/UiWebNotes.md`): no endpoint returns an
employee's *current* permission set, so the list shows "—" and the edit drawer opens unticked
with a "saving replaces the whole set" warning. Design both the honest degraded state and the
intended final state (pre-ticked) so nothing is re-drawn when the backend follow-up lands.

**2 · Sidebar and dashboard entries.** The built AdminLayout's "Dashboard · Soon" and "Audit log
· Soon" items go live with screens 1 and 11; the new sections (Organisations, Catalogue,
Conversations, Featured, Error log) join per §2's sidebar spec. "Settings · Soon" **stays** a
logged placeholder (month 2).

No other M1 admin screen changes. The verification queue and KYC viewer keep working exactly as
designed; the org detail (screen 3) links **into** them rather than duplicating their decisions.

---

## 11. Cross-screen checklist before handing designs over

- [ ] Every screen has loading, empty, error and success drawn
- [ ] Sidebar and dashboard drawn with zero, one and several permitted sections/tiles
- [ ] Superadmin-only controls (block/unblock, activate/deactivate, employees) **absent** — not
      disabled — for employees
- [ ] Every dashboard number links to its pre-filtered list; no dead counts anywhere
- [ ] Both-sides overlap note drawn between the two verification tiles
- [ ] Turnaround figure labelled "average days to verify", never "to decision"
- [ ] Inactive (seller hid) and Blocked (admin takedown) visually distinct on every surface
- [ ] Purge countdown on blocked products; takedown modal copy mentions the 180-day deletion
- [ ] Org block modal states the full cascade (users + live products + chats; drafts/archived
      exempt); unblock copy promises restore-what-the-block-did only
- [ ] Blocked org shows cascade status — running / done / **failed is loud**
- [ ] Reviewed-side shown wherever verification status appears on the org detail
- [ ] "Not captured" rows for the five phantom org fields — no empty inputs
- [ ] Claim history renders "No claim recorded", not an error or a spinner
- [ ] Archived product count has **no** link into the monitoring list
- [ ] Org detail user table has no permissions column
- [ ] KYC document link appears only with `kyc:view`; count shows regardless
- [ ] Chat viewer has no composer or composer-shaped element; "views are recorded" note present
- [ ] Conversations and messages paginate by cursor ("Load more"), never page numbers
- [ ] Unread on the conversations list labelled as the **parties'** unread
- [ ] Audit viewer has no mutation affordance and no slot for one; "System" actor drawn
- [ ] Audit zero-result states name the filter that produced them
- [ ] Admin previews of public pages use the public projection — tick or nothing, no status
- [ ] Prefix searches labelled "Starts with…"; page-size ceilings respected (50 on M5 lists)
- [ ] Destructive actions (block, takedown, chat block, un-feature) confirm with consequence copy
- [ ] Permission checkbox group matches the 12-string catalogue, grouped, with heavy-grant helpers
- [ ] Every panel checked at 1440 / 1024 / 768 / 375; wide tables scroll in their own container
- [ ] Any control shown but not yet functional is visibly "coming soon" **and logged in
      `docs/UiWebNotes.md`** (strict rule)

---

## 12. Decisions, and the gaps this brief leaves

### Decided (inherited or owner-recorded)

- **Design all states now, wire later** — same standing decision as M1 (owner, 2026-07-28).
  Backends for all 13 screens exist, so the wiring gap is smaller than M1's was; the UiWebNotes
  ledger rule still applies to anything shipped ahead of wiring.
- **Takedown as a modal, not a page** — `m5.md` §10 left it a frontend decision; this brief
  chooses the modal (screen 6) so the reviewer never loses list position. Same for org block.
- **Org list second line = country · slug** — `m5.md` §10 left it open; both values ship on
  every row, so this brief uses both.
- **F6 threshold: none.** The console shows the count; no automatic action, no threshold UI.
- **Screens 12–13 included** on the strength of FINALIZE F5a/F5b being built with recorded owner
  decisions (2026-08-01). If the owner prefers this brief to stay strictly M5-sourced, cutting
  §9 removes them cleanly — nothing else references them except the sidebar and checklist lines.

### Still open

1. **Brand palette** — same open item as M1; decide once for the whole product.
2. **Category ordering interaction** — this brief specifies a numeric order field. If the owner
   wants drag-to-reorder, say so before visual design; it changes the tree component.
3. **Audit "action" suggestions** — the input is free text by rule; whether it offers recent
   values as suggestions needs a cheap source. Optional polish, not scope.

### Gaps — named plainly, per the M1 brief's §11 pattern

| Gap | Source | Consequence for design |
|---|---|---|
| **Claim history is empty until the signup claim step is built** | backend plan §2b | Screen 3 must ship its "No claim recorded" state as the default, not an edge case |
| **Archived products are invisible to staff forever** | `m5.md` §4 accepted gap | The org detail shows an archived *count* with no list behind it; a dispute over a deleted listing has only the audit entry to point at. Accepted — do not design a workaround |
| **No endpoint returns an employee's current permissions** | `docs/UiWebNotes.md` follow-up #2 | Employees screen shows "—" / unticked drawer until an owner-approved backend change; both states designed (§10) |
| **The verification queue built in M1 is user-centric; M5's org list is the real queue** | backend plan §7 | Dashboard verification tiles link to the **org list** filtered to submitted — not to `/admin/verification`. The M1 queue screen keeps working for per-account review, but the counts route through orgs. If that dual surface confuses reviewers in testing, raise it — merging them is a product decision, not a design one |
| **`org.claim` / side-enabled dates derive from audit rows that partially exist** | backend plan §2b | Side "enabled since" dates may be missing for older orgs — the sides section needs a "—" render, not a fake date |
| **Platform settings sidebar item is a logged placeholder** | `m5.md` §9 · UiWebNotes | Stays "Soon" until month 2; not designed here |
