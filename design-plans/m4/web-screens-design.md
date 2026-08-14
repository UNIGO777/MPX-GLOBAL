# M4 · Web Screens — Design Brief (Enquiry & Chat)

> **6 screens** for the M4 (Enquiry & Chat) milestone, web only.
> This is a **design** document: what each screen contains, every field on it, and the states that
> need artwork. No API or code detail.
> Product: **MPX Global** — B2B import/export marketplace. Indian exporters, international buyers.
> Companion: `design-plans/m4/app-screens-design.md` — the two surfaces must feel like one product.
>
> **Scope rule (same as the M1 briefs):** this brief contains **only** the screens named in
> `modules-in-detailed/m4/` — `m4.md` §9 plus `screens.png`, `enquiry+chat-flow1.png`,
> `product-enquire-flow2.png`, `admin-block.png`, `Buttons-summaries.png` — read together with
> `build-plans/m4/backend-plan.md` and the **built backend**, which is the behaviour of record
> where it has already resolved a plan ambiguity. Nothing inferred, nothing added. See §10 for
> gaps.
>
> ⚠️ **Naming guard:** this is `modules-in-detailed/m4` = **Enquiry & Chat**, which is **month-1
> in scope**. The quote's "Module 4" = **Quotation & negotiation** is a different thing and is
> **deferred (Bucket A1)** — see "Do not design" in §3.

---

## 1. Design foundations

**Tone.** This is where two strangers negotiate trade across a border, with the platform visibly
in the room. Calm, neutral, procedural — the chat must feel *administered*, not casual. It is
closer to a records system with a live wire than to a consumer messenger: no playful empty
states, no emoji reactions, no read receipts beyond what exists (there are none per-message).

**Three audiences, one visual system** (same tokens as M1):

| Panel | Who | Feel |
|---|---|---|
| Buyer | international importers | simple, confidence-building |
| Exporter | Indian sellers, mobile-first | an inbox that makes replying obvious |
| Admin / Employee | moderators | dense, factual, zero ambiguity about frozen state |

**Responsive.** Every screen works at **1440 / 1024 / 768 / 375**. The chat thread at 375 is the
hardest layout in this milestone — design it first, then widen. Wide admin tables scroll inside
their own container; the page body never scrolls horizontally.

**Accessibility.** Real `<label>` on every input, visible focus states, touch targets ≥ 44px,
text contrast ≥ 4.5:1, `prefers-reduced-motion` respected. New messages arriving live must be
announced to screen readers (an `aria-live` region on the thread), and the freeze state must be
readable as text, not inferred from a disabled control.

**Every screen needs four states drawn:** loading (skeleton), empty, error, success. `m4.md` §9
names the three most often missed: **empty chat list**, **frozen thread**, **purged-product
thread**.

### 1.1 The freeze-label vocabulary — the single most important convention

**M4-19: colour never carries meaning alone. Every label pairs a colour with text.** The backend
literally returns `{ tone, text }` and the UI renders both — never a bare dot or a bare tint.
These are the exact pairs the server produces; do not invent others and do not reword them
per-screen:

| Tone | Text | When | Reversible? |
|---|---|---|---|
| *(none)* | — | normal open thread | — |
| `yellow` | **"Product under review"** | admin took the product down (M4-21) | yes — admin restore clears it |
| `red` | **"Conversation blocked by MPX Global"** | admin blocked this one chat (M4-23) | yes — admin unblock |
| `red` | **"Product no longer available"** | the product row was purged at 180 days (M4-22) | no — permanent |

⚠️ **A fourth frozen state has no list label:** when a party's **account is blocked** (the F1-B
cascade — built), the thread freezes and a system message is posted, but the server sends
`tone: none` for the list chip. Design the thread's frozen banner to carry that case from the
system message (§1.3); the list row simply shows no coloured chip. Flagged as an open question
in §10 — do not invent a label the server doesn't send.

**M4-29 — first reason wins.** A chat blocked and *then* hit by a takedown keeps the **block**
label. The UI never stacks two labels on one row; there is always exactly zero or one.

### 1.2 Identity in a thread — companies, never people

**M4-17:** every title and every attribution names a **company, never a person**. There is no
avatar of a human, no "Rahul from AgroExports". The message projection carries `senderType`
only (`buyer` / `exporter` / `system`) — the design must not require a person's name or user id
anywhere, because the server will never supply one.

- Buyer sees the thread as *product × seller company*.
- Exporter sees *product × buyer company*.
- Admin sees *buyer company × seller company × product*.

The **verified tick** convention carries over from M1 unchanged: one badge, shown only when the
counterparty org is verified; absence is the only "unverified" signal; never a raw status.
*(Note: the M4 conversation payload itself does not carry a `verified` flag — see §10 gap 4.
Where the tick appears next to a counterparty in this milestone, it comes from the public seller
profile surface, not from the conversation.)*

### 1.3 The platform is in the room — disclosure, not surveillance

**M4-1:** every conversation is a group room of three — buyer, seller, **MPX Global**. The
platform's presence must stay visible in the **thread header or participant list**, not just in
the opening message. The server sends a `participants` array of exactly three
(`buyer` / `exporter` / `platform`, each with a company name; platform is "MPX Global"). Design
a small persistent participants row or header line. This is a trust feature: both sides know
the platform can read the thread. Do not tuck it behind an overflow menu.

**System messages are the platform's voice.** They render visually distinct from both parties —
centred or full-width notice style, never in a chat bubble that could be mistaken for a party.
They carry the welcome, freeze and unfreeze notices. Their wording is server-authored and
**locked** — the UI displays it verbatim, never paraphrases:

- Welcome (message #2 of every thread, locked 2026-07-31): *"MPX Global is part of this
  conversation. Please keep all discussion and documents here — it is how we can support you if
  anything goes wrong."*
- Takedown freeze: *"This product is under review by MPX Global, so messaging is paused here.
  You may want to explore other suppliers in the meantime."*
- Restore: *"This product is available again. You can continue the conversation."*
- Chat block: *"This conversation has been restricted by MPX Global. Reason: {reason}"*
- Unblock: *"This conversation has been reopened by MPX Global."*
- Account freeze: *"This conversation is paused because the other party's account is currently
  unavailable on MPX Global."*
- Account restore: *"This account is active again. You can continue the conversation."*

**🔴 Both parties see the block reason (M4-25) — neither ever sees who wrote it.** `blockedBy`
and `blockedAt` are staff-only. No design may show "Blocked by admin Priya" to a party.

### 1.4 Unread — derived, boolean, quiet

Unread is a **boolean per thread** (was there a message after my last read?) plus **one count in
the nav** (how many threads have that boolean true). There is **no per-thread message count** —
no "3 new messages" chip, because that number does not exist on the server and must not be
faked. Design: bold row + dot for an unread thread; a numeric badge **on the nav item only**
(count of unread *threads*). Opening a thread clears it immediately.

---

## 2. Shared components to design once

**Chat primitives:**
- **Message bubble** — two party variants (mine / theirs, aligned right / left) + the **system
  notice** variant (§1.3). Timestamp per message; date separators between days. The composed
  first enquiry message is long and line-broken (label: value per line + the note) — design the
  bubble to carry ~10 lines gracefully, not just one-liners.
- **Composer** — single-line growing textarea, **200-character limit with a live counter**
  (appearing from ~160), send button with loading state. Disabled variant for frozen threads
  (§ thread screen). Enter sends, Shift+Enter for a newline.
- **Freeze banner** — full-width strip above the composer area: label text (§1.1) + one
  explanatory sentence + the block reason when present. Yellow and red variants.
- **Conversation row** — title (role-aware), last-message preview (one line, truncated), relative
  time, unread bold+dot, optional freeze chip (§1.1). Skeleton variant.
- **Freeze chip** — the `{tone, text}` pair as a small labelled chip for list rows and the admin
  table. Never colour-only.
- **Participants line** — "Buyer Co · Seller Co · MPX Global" with the platform visually marked
  (small brand glyph). Used in the thread header and the admin viewer.
- **Unread nav badge** — count of unread threads on the "Chat" nav item, both portals.
- **Connection pill** — "Reconnecting…" indicator for the thread when the socket drops (the app
  still works over ordinary requests; this is informational, not a blocker). States:
  hidden (live) · reconnecting · reconnected-flash.
- **"New messages" jump pill** — appears when messages arrive while scrolled up in history.

**Forms (enquiry):** number input · unit text input · **currency select** (ISO list, searchable)
· **country select** (delivery country) · short text input · textarea with **200-char counter**
(the note) · inline field error. All reused from the M1/M2 form kit.

**Feedback:** toast · inline alert (info / warning / danger) · skeleton rows · empty state ·
error state with support reference · confirmation modal (destructive variant, for admin block) ·
rate-limited notice.

**Data (admin):** the M1 admin table (sticky header, row actions, cursor "Load more" — **not**
numbered pages; the backend paginates by cursor).

---

## 3. Screen inventory — 6

| # | Screen | Route | Panel | Named in |
|---|---|---|---|---|
| 1 | Product page — enquiry entry *(existing, modified)* | public product detail (M3 route) | public / buyer | `m4.md` §9.1 · `Buttons-summaries.png` · `screens.png` |
| 2 | Enquiry form | modal/panel over screen 1 | buyer | `m4.md` §9.1 · `product-enquire-flow2.png` |
| 3 | Chat list | `/buyer/chat` · `/exporter/chat` | buyer + exporter | `m4.md` §9.2 · `screens.png` |
| 4 | Chat thread | `/buyer/chat/:id` · `/exporter/chat/:id` | buyer + exporter | `m4.md` §9.3 · `screens.png` · `enquiry+chat-flow1.png` |
| 5 | Admin — all conversations | `/admin/conversations` | admin / employee (`conversation:read`) | `m4.md` §9.4 · `screens.png` |
| 6 | Admin — chat viewer + block | `/admin/conversations/:id` | admin / employee (permissioned) | `m4.md` §9.5 · `admin-block.png` |

The **unread badge** is a component, not a screen (`m4.md` §9, last row). Screens 3 and 4 are
**one design each, two instances** — buyer and seller differ only in title composition and
scope, never in layout (M4-35/M4-36: one role-aware list, no separate "enquiry inbox").

⚠️ The buyer and exporter sidebars currently carry **separate "Enquiries" and "Chat"
placeholder items** (`docs/UiWebNotes.md`). M4-35 is explicit that there is **no enquiry inbox**
— one chat list serves everyone. Recommendation: collapse to a single **"Chat"** nav item and
delete the "Enquiries" placeholder when wiring. Flagged in §9; do not design an enquiries list.

### Do not design — with the source of each exclusion

- **🔴 Quotation & negotiation — quote Module 4, Bucket A1** (`docs/month1-not-doing.md`). No
  quote forms, no price-offer bubbles, no "send quotation" button, no negotiation timeline, no
  accept/reject. The enquiry's `targetPrice` field is a buyer's *ask*, not an offer flow.
- **🔴 Notification centre / email / WhatsApp — D5** (`docs/Note.md`). No in-app notification
  list, no bell icon with a dropdown of events, no notification settings screen. The **only**
  approved notification slice is FCM push on two M4 events, and push is a **mobile** concern —
  the web brief designs nothing for it. (No web-push either — not in the approved slice.)
- **Attachments — M4-14.** No paperclip, no image/file bubbles, no drag-drop target in the
  composer. Document exchange waits for the Quotation module.
- **Typing indicators, online status, per-message read receipts, message edit/delete —**
  `m4.md` §1 out-of-scope + M4-13 (sent messages can never be edited or deleted, by anyone —
  no hover actions on a bubble beyond text selection/copy).
- **Message-content search — M4-32.** The search box on screens 3 and 5 searches the *list*
  (names + ids), never inside messages. No "search in conversation" affordance.
- **Contact-detail detection warnings — M4-15** (Phase 2). No "don't share phone numbers" nag.
- **User report / flag option** — `m4.md` §13, month 2. No "report this conversation" button.
- **Enquiry status lifecycle** — `Inquiry.status` exists but nothing drives it and it is not
  surfaced in any response (`backend-plan` §5c). No open/responded/closed chips anywhere.
- **Employee panel UI — Bucket A2.** Employees with `conversation:read`/`conversation:block`
  grants use the same screens 5–6 (permission-driven, like M1 screen 13); no separate employee
  chat dashboard. Permission *granting* stays on the existing M1 employees screen.
- **Admin composer — never.** Admin can read; admin cannot speak (§7.3). Screen 6 has no input
  at any permission level. Not "disabled" — absent.

---

## 4. Buyer entry (screens 1–2)

### 1 · Product page — enquiry entry *(existing public product page, modified)*

The only door into the whole module (M4-4: no product-less enquiries). One button whose label
depends on whether this buyer already has a thread on this product (`Buttons-summaries.png`).

> ✅ **Superseded context (2026-08-14): the entry point already exists as a placeholder.** The
> shipped product page carries a **disabled "Send Enquiry" button** (added 2026-08-12 from the
> owner's reference mockup, logged in `docs/UiWebNotes.md`) in the buy panel directly below the
> trade-specifications card. Screen 1's work is **replacing that placeholder in that exact
> position** with the state table below — not adding a new button to a page without one.
>
> Two further disabled placeholders exist that this brief predates. **Owner ruled on both,
> 2026-08-14:**
> - **`/category/:slug` list cards' "Inquiry" button — DEACTIVATED, do not wire.** The product
>   page's "Send Enquiry" is the ONE door into chat ("send inquiry will wire to chat"). At M4
>   wiring time the card button is removed (or stays visibly inert if removal is deferred) —
>   never fake-wired, and no per-card enquiry flow gets designed.
> - **`/supplier/:slug` "Start Conversation" — KEPT, disabled, decision deferred.** The owner
>   wants the company-level conversation concept preserved on the page but has not chosen how it
>   reconciles with M4-4's product-scoped threads ("we will decide it later, keep it disabled
>   till then"). It stays a visible, disabled placeholder through M4 wiring; gap 7 in §10 holds
>   the open options. Do not wire it, drop it, or design a supplier-level flow until the owner
>   rules.

**Button states:**

| Viewer | Button | Behaviour |
|---|---|---|
| Guest | **"Create enquiry"** (primary) | → buyer sign-in, then back here with intent preserved |
| Buyer, no thread yet | **"Create enquiry"** (primary) | opens screen 2 |
| Buyer, thread exists | **"Open chat"** (secondary styling, chat icon) | → screen 4 directly — a second enquiry never opens a second thread (M4-5) |
| Exporter-portal account | *no enquiry button* | enquiring is buyer-only; show nothing rather than a control that will be refused |
| Buyer viewing **their own company's** product | *no enquiry button* | the self-enquiry guard (M4-39) rejects it server-side; don't render the door |

**States:** default per row above · checking (brief skeleton on the button while thread
existence resolves — never a flash from "Create enquiry" to "Open chat") · error (fall back to
"Create enquiry"; the server safely returns the existing thread if one exists).

**🔴 Copy constraints:**
- If the self-enquiry guard fires anyway (stale UI), surface the server's message verbatim:
  *"This product belongs to your own company, so you cannot enquire on it."*
- A product that is taken down, draft, inactive or archived **is not publicly reachable** — its
  page 404s, so this screen never needs a "product unavailable" enquiry state. Existing chats
  survive independently and are reached from the chat list only (`Buttons-summaries.png`).

**Design notes:** "Open chat" should read as *continuation*, not a dead end — pair it with a
one-line hint ("You've already enquired about this product") so the missing form doesn't feel
like a bug.

---

### 2 · Enquiry form — modal or side panel over the product page

A structured **form, not a free-text box** (M4-7). The field set follows the sub-category's
`type` exactly as the product form does (M4-9); fields locked by the owner 2026-07-31. All
structured fields **optional**; the **note is the only required field** and the only free text.

**Context header:** product thumbnail + name + seller company (with verified tick if the seller
is verified) — the buyer must see what they're enquiring about.

**Fields — Goods categories**

| Label | Type | Required | Helper |
|---|---|---|---|
| Quantity | number | ○ | — |
| Unit | short text | ○ | "e.g. kg, pieces, containers" |
| Target price | number | ○ | — |
| Currency | searchable select (ISO) | ○ — **✔ if a price/budget is entered** | inline error: "Please choose a currency for the amount you entered." |
| Deliver to | country select | ○ | — |
| Delivery timeline | short text | ○ | "e.g. within 6 weeks" |
| Note | textarea, **200 chars**, counter | ✔ | "Describe what you need — this starts the conversation" |

**Fields — Service categories**

| Label | Type | Required | Helper |
|---|---|---|---|
| Engagement type | short text | ○ | "e.g. one-time project, annual contract" |
| Budget | number | ○ | — |
| Currency | searchable select | ○ — **✔ with a budget** | same rule as goods |
| Timeline | short text | ○ | — |
| Delivery model | short text | ○ | "e.g. on-site, remote" |
| Note | textarea, **200 chars**, counter | ✔ | same as goods |

**Actions:** **"Send enquiry"** primary (loading state) · Cancel.

**States:** default (per category type) · loading · field errors (currency-missing is the one
that will actually fire) · **rate-limited** (enquiry creation is capped at ~20/hour: *"You've
sent a lot of enquiries — please try again in a while"*) · success → **the buyer lands directly
in the chat thread** (screen 4), where their enquiry is message #1 and the platform welcome is
message #2 (M4-10, M4-35 "OLX-style") · duplicate race (silently resolves to the existing
thread — no error shown).

**🔴 Copy constraints:**
- The success transition is a **navigation, not a confirmation modal**. No "Enquiry sent! The
  seller will contact you" — the thread *is* the confirmation, and contact happens only here.
- Never imply email/phone follow-up. Contact details are hidden platform-wide by design
  (`m4.md` §1); the thread is the only channel.

**Design notes:** the structured fields become the thread's first message (label: value lines +
the note) — a small live preview of that composed message under the form is optional but
helpful, because it shows the buyer exactly what the seller receives. Only the note counts
against 200 characters; the composed first message will exceed 200 and that is correct.

---

## 5. Chat (screens 3–4) — buyer and exporter

### 3 · Chat list — `/buyer/chat` · `/exporter/chat` — one design, two instances

The role-aware list that serves both sides (M4-35). Sorted by latest activity; **no size limit,
no archiving** (M4-31) — the list never "fills up" and there is no archive/delete row action.

**Contains:** page title ("Chat") · **search input** · the conversation rows · cursor "load
more" on scroll.

**Row anatomy** (component, §2): role-aware title — buyer sees *Product × Seller Co*, exporter
sees *Product × Buyer Co* (M4-17) · last-message preview (one line) · relative timestamp ·
unread bold + dot · freeze chip when applicable (§1.1).

**Search**

| Control | Type | Notes |
|---|---|---|
| Search | text input | matches **product name and company names — whole words only**; pasting an org id also works. Placeholder: "Search by product or company" |

⚠️ **Whole-word matching, no partials, no typo tolerance** (native `$text`, §8.3). "Tex" will
not find "Textiles". Do not design an as-you-type instant-results dropdown that implies fuzzy
search; a plain filtered list on submit/debounce is honest. Message content is **never**
searched (M4-32) — do not label the box "Search messages".

**States:** loading (skeleton rows) · **empty — no enquiries yet** (buyer variant: *"When you
enquire about a product, the conversation appears here"* + CTA to browse products; exporter
variant: *"When a buyer enquires about one of your products, it appears here"* — no CTA, sellers
wait) · results · **no search matches** (names the query, offers clear) · error · offline/
degraded (list still renders from last fetch; a quiet stale notice).

**Live behaviour to design:** a new message moves its row to the top and sets unread —
animated re-order, `prefers-reduced-motion` honoured. A freeze event flips the row's chip
without a refresh.

**Design notes:** rows are the whole click target. The freeze chip sits at the row's trailing
edge, never replacing the timestamp. An account-frozen thread shows **no chip** (§1.1) — the
row looks normal until opened; that is current server behaviour, flagged in §10.

---

### 4 · Chat thread — `/buyer/chat/:id` · `/exporter/chat/:id` — the centrepiece

One shared component (M4-36). Three vertical zones: **header**, **message scroll**, **composer
zone** (composer *or* freeze banner).

**Header:** role-aware title (M4-17) · product line — name + link to the product page **while
the product exists**; when purged, plain text from the snapshot with **no link** (M4-22: never a
link to a page that no longer exists) · **participants line** with MPX Global (§1.3) ·
connection pill (§2).

**Message scroll:**
- Bubbles per §2; buyer's own messages right-aligned, counterparty left, system notices centred.
- **Message #1 is the composed enquiry** — long, multi-line, label: value rows + note. **Message
  #2 is the platform welcome**, a system notice. Every thread starts this way (M4-10); design
  the top of history around it.
- **Scroll-up pagination:** opening loads the newest window (~30); scrolling up fetches earlier
  bundles with a small inline loader (M4-16). Never a "Page 2" control.
- Date separators; "New messages" jump pill when live messages arrive while scrolled up.
- No hover actions on bubbles beyond text selection (M4-13 — nothing to edit, nothing to delete,
  for anyone, ever).

**Composer zone — two mutually exclusive designs:**

*Open thread:* the composer (§2). 200-char counter; Enter to send. Sending shows the message
optimistically with a subtle pending state, confirmed on ack; a failed send gets an inline
"Not sent — retry" on the bubble, never a toast that detaches the error from the message.

*Frozen thread:* the composer is **replaced** by the **freeze banner** — not greyed out with a
cursor taunting the user. Banner content per reason:

| Reason | Banner |
|---|---|
| takedown | yellow · **"Product under review"** · "Messaging is paused while MPX Global reviews this product." |
| blocked | red · **"Conversation blocked by MPX Global"** · the admin's reason, verbatim, given room for a sentence or two (M4-25) |
| purged | red · **"Product no longer available"** · "This product has been removed. The conversation is closed, but you can still read it." |
| account | neutral/muted · text from the system message: the other party's account is currently unavailable | 

**Reading always works.** Full history stays scrollable in every frozen state (M4-22) — freeze
kills the composer, never the transcript.

**States:** loading (skeleton bubbles) · open · sending / send-failed · **frozen ×4** (above) ·
**freeze arrives live** (the composer swaps to the banner mid-session, pushed not polled §7.4 —
design the transition; if the user had typed a draft, keep the text visible above the banner so
it isn't silently eaten) · **unfreeze arrives live** (banner swaps back; system message
explains) · **reconnecting** (pill on; sends still work — they fall back to the ordinary
request path; only *live receipt* pauses) · **resync after reconnect** (missed messages slot in;
if too many were missed the thread quietly reloads its latest window — no user action, no error)
· rate-limited send (~60/min: inline *"You're sending very fast — give it a moment"*) · error ·
**not found** (a thread the viewer isn't a party to is a plain 404 page — never "you don't have
access", which confirms it exists).

**🔴 Copy constraints:**
- Frozen-send refusal (belt-and-braces if a stale composer submits): *"This conversation is
  closed for new messages."* — the server's wording, verbatim.
- Attribution is company-level only. "You" / counterparty company name / "MPX Global". Never a
  person's name, never "Agent", never a user id (G2).
- Never show who blocked (G1) or when — parties get the reason only.

**Design notes:** the thread must feel inspectable-by-design — participants line always visible,
system voice clearly distinct. At 375px the header collapses to title + a tappable detail row
that reveals participants. Opening the thread marks it read (server-stamped); no extra "mark as
read" control exists.

---

## 6. Admin / Employee moderation (screens 5–6) — web only

Access is by **granted permission, not membership**: `conversation:read` for screens 5–6,
`conversation:block` additionally for block/unblock (owner decision 2026-07-31 — block is
grantable to employees from month 1). Superadmin passes everything. An employee with neither
grant never sees the nav item. **Reads of a thread are audited** (M4-34) — design a discreet
staff-facing note on screen 6: "Conversation access is recorded."

### 5 · All conversations — `/admin/conversations`

Every thread on the platform, searchable (`m4.md` §9.4).

**Controls**

| Control | Type | Notes |
|---|---|---|
| Search | text input | product name / buyer company / seller company — **whole words** — or paste an **org id** for an exact match. Placeholder: "Search names, or paste an organisation ID" |
| Load more | cursor button / infinite scroll | no page numbers |

**Table columns:** Title (*Buyer Co × Seller Co × Product*, M4-17) · Last activity · Freeze chip
(§1.1 — staff additionally see the raw reason on screen 6) · **Unread — per party**: two small
indicators, "buyer unseen" / "seller unseen" (the server derives both; it is how a moderator
spots a thread the seller never opened) · Started date · row action: **View**.

**States:** loading (skeleton rows) · results · empty platform (unlikely; still drawn) · no
matches (names the query) · error.

**Design notes:** this list is **not audited** — only opening a thread is — so browsing is
free. Density over comfort: this is a moderator's worklist. The freeze chip column is the scan
column; give it a fixed position.

---

### 6 · Chat viewer + block — `/admin/conversations/:id`

Read-only thread with the enforcement actions (`m4.md` §9.5, `admin-block.png`). **No composer
exists on this screen at any permission level** — admin can read, admin cannot speak.

**Contains:**
- The thread transcript — same bubble components as screen 4, rendered read-only, with
  scroll-up pagination.
- **Staff detail rail:** buyer org (name + id) · exporter org (name + id) · product (name +
  link while live; snapshot text when purged) · started date · frozen state with the **raw
  reason** (`takedown` / `blocked` / `account`) · when blocked: **reason, blocked-by, blocked-at**
  (staff may see the actor — parties never do) · per-party unread indicators · participants
  line.
- The audit notice: *"Conversation access is recorded."*
- **Actions** (only with `conversation:block`): **Block conversation** (danger) · **Unblock
  conversation** — one permission covers both directions.

**Block modal — the one field-bearing part**

| Label | Type | Required | Helper |
|---|---|---|---|
| Reason | textarea, character counter | ✔ · 3–500 chars | **"Both the buyer and the seller will see this reason"** — push the moderator toward a sentence, not "no" |

Confirmation copy states the consequence: *"Messaging freezes for both sides immediately. The
product stays live and its other conversations are unaffected. This is reversible."*
(`admin-block.png`.)

**Unblock modal:** optional internal reason (3–500, audit-only — say so: "For the audit record;
parties don't see this") + **the M4-30 warning designed in**: unblocking re-checks other freeze
reasons, so the honest confirmation is *"Unblock this conversation? If the product is under
review or a party's account is blocked, it will stay frozen for that reason."* Design the
post-unblock result state for **both** outcomes: reopened, and *still frozen — with the label
switching to the surviving reason* (that switch is correct behaviour, not a bug; draw it).

**States:** loading · thread (open / each frozen variant with raw reason) · block modal
(default / loading / success — chip appears, system message lands in the transcript live) ·
unblock (both outcomes) · read-only viewer for an employee **without** `conversation:block`
(no action buttons rendered — not disabled, absent) · error · not found.

**Design notes:** blocking is the module's heaviest action — `danger` styling, two clicks
minimum, reason mandatory. The system message the block posts appears in the transcript the
moderator is looking at; let them see it land (it is their confirmation). Live messages
continue to stream into an open viewer (admin joined the room read-only).

---

## 7. Role redirect & navigation

- Buyer sidebar: **Chat** (with unread badge) → screen 3. Exporter sidebar: same.
- Admin sidebar: **Conversations** appears only with `conversation:read` (permission-driven
  sidebar, as M1 established — design with zero/one/several items).
- A buyer hitting an exporter chat URL (or any non-party thread) gets the standard 404 page —
  never a 403, never a redirect that reveals the thread exists.

---

## 8. Cross-screen checklist before handing designs over

- [ ] Every screen has loading, empty, error and success drawn — plus the three from `m4.md` §9:
      empty chat list, frozen thread, purged-product thread
- [ ] Every freeze label renders **tone + text** — no colour-only dot anywhere (M4-19)
- [ ] Exactly zero or one freeze chip per row — labels never stack (M4-29)
- [ ] The platform appears in every thread's participants line, both party and admin views (M4-1)
- [ ] All attribution is company-level — no person names, no user ids, anywhere (M4-17/G2)
- [ ] Block reason visible to both parties; blocked-by/at visible **only** on the staff screen (G1)
- [ ] Frozen threads keep full readable history in every variant (M4-22)
- [ ] Composer is *replaced* by the freeze banner, and the swap is designed live both ways (§7.4)
- [ ] A typed draft survives a live freeze visibly
- [ ] Purged threads show snapshot text with **no product link** (M4-22)
- [ ] No attachments UI, no typing indicator, no online dots, no edit/delete on bubbles
- [ ] No quotation UI of any kind (Bucket A1); no notification centre or bell (D5)
- [ ] Search labelled honestly for whole-word matching; never "search messages" (M4-32)
- [ ] Unread is bold+dot per row and one thread-count badge in the nav — no per-thread counts
- [ ] Admin screens have no composer, not even disabled (§7.3)
- [ ] Employee-without-block-permission variant of screen 6 drawn (actions absent)
- [ ] Non-party thread access renders a plain 404
- [ ] Enquiry form: note required, structured fields optional, currency required with an amount
- [ ] Rate-limited states drawn for enquiry creation and message send
- [ ] Every screen checked at 1440 / 1024 / 768 / 375; thread designed at 375 first

---

## 9. Decisions

### ✅ Backend is built — design to actual behaviour

Unlike M1, the M4 backend exists and is tested. Where a diagram and the code disagree, the code
follows `m4.md`'s locked decisions and this brief follows the code. Notables a designer must
not "fix":

- `Buttons-summaries.png`'s row "product delete → red label" is **stale** — owner-confirmed
  (backend-plan C4): a seller archiving/deactivating their product changes **nothing** on the
  thread (M4-20). The red "Product no longer available" label belongs to the 180-day purge only.
- `m4.png` names an "Atlas Search index" — stale; search is native `$text`, hence the
  whole-word caveat on both search boxes.
- The welcome and freeze wordings in §1.3 are server-authored and locked — not draft copy.

### Recommendation — collapse "Enquiries" + "Chat" nav placeholders into one item

M4-35: one role-aware chat list, no enquiry inbox. The current sidebars (per `docs/UiWebNotes.md`)
carry both placeholders; wiring M4 should keep **Chat** and remove **Enquiries** in both portals.
Owner sign-off needed since it changes the M1-approved nav sets.

### Still open

1. **Brand palette** — unchanged from M1; confirm before final artwork.
2. ~~**Product-page dependency** — screen 1 modifies the public product detail page, which is an
   M3 web screen that has no design brief yet.~~ **Superseded 2026-08-14: the page is built and
   settled.** `/product/:slug` shipped and was redesigned through owner iterations
   (2026-08-11 → 14): gallery + structured buy panel, tinted price block with MOQ/supply row,
   trade-facts card, **Description and Specifications side by side at lg+** (2026-08-14), and a
   "More in {category}" row using the shared `ProductCard`. The disabled "Send Enquiry"
   placeholder already sits in screen 1's position (see §4). This brief designs only the button's
   state behaviour; the page around it exists and is not this milestone's to restyle.

---

## 10. Scope: gaps and uncertainties

| # | Gap | Detail |
|---|---|---|
| 1 | **Account-freeze has no list label** | The server returns `tone: none` for a thread frozen by an account block — the list row looks normal; only the opened thread explains (system message + frozen banner). If moderators or parties should see a list cue, that is a backend change to `frozenLabel`. Ask the owner. |
| 2 | **No web push** | The approved FCM slice is device push (mobile). On web, a seller learns of an enquiry by having the app open (live socket) or logging in. This is the module's known largest gap (`m4.md` §13) — do not paper over it with a fake bell icon. |
| 3 | **Sellers cannot start a conversation** | Only a buyer can enquire (M4-4/G4). The exporter list's empty state must not suggest otherwise. |
| 4 | **No verified tick in conversation payloads** | The counterparty in a thread is a name only; `verified` is not part of the conversation projection. The enquiry form header (screen 2) can show the tick because it sits on the public product/seller surface. If the owner wants the tick inside the chat list/thread, that is a projection change — red-flag before designing it in. |
| 5 | **Enquiry `fields` render as plain text** | The structured data lives on `Inquiry`, but the party projection of a thread does not re-expose it separately — the composed first message is the visible record. No "enquiry details" panel is designed; if month-2 quotation work wants one, it attaches to `Inquiry` then. |
| 6 | **Blocked-account counterparty wording** | M4-28's "seller is shown that the buyer is blocked" is implemented as the neutral system line ("account currently unavailable") — deliberately vaguer than the plan's wording, to avoid disclosing account status. Design follows the built copy. |
| 7 | **Supplier-page "Start Conversation" placeholder vs M4-4** *(added 2026-08-14)* | `/supplier/:slug` ships a disabled owner-requested "Start Conversation" button (2026-08-13, `docs/UiWebNotes.md`), but every M4 thread is **product-scoped** — there is no supplier-level conversation to wire it to. Options are an owner/backend call, not a design call: (a) route it to the supplier's catalogue so the buyer picks a product; (b) drop the button; (c) a backend change allowing product-less threads, which contradicts M4-4. Red-flag before designing anything for it. |
