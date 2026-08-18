# M4 · Web Frontend — Build & Verification Plan (Enquiry & Chat)

> **Scope:** build the six M4 web screens against the **already-built, already-tested** M4
> backend. Web only — the app has its own brief (`design-plans/m4/app-screens-design.md`) and is
> behind; nothing here touches it. **Written:** 2026-08-17.
>
> **Sources of truth (precedence):**
> 1. `CLAUDE.md` + `.claude/rules/` — contractual; outrank every plan doc below.
> 2. **The built backend** (`src/routes/conversation.routes.js`, `inquiry.routes.js`,
>    `src/views/conversation.view.js`, `src/realtime/socket.js`) — behaviour of record wherever a
>    plan doc and the code disagree.
> 3. `design-plans/m4/web-screens-design.md` — the screen spec, already corrected to as-built.
> 4. `modules-in-detailed/m4/m4.md` — the locked M4-1…M4-39 decisions.
> 5. `docs/History.md` 2026-08-01 (M4-A…H) and 2026-08-11 → 08-17 (the shipped public pages).
>
> **Scope status:** ✅ 100% month-1 in scope. `modules-in-detailed/m4` = **Enquiry & Chat** =
> the quote's **Module 3 (chat half)**. The quote's "Module 4" (Quotation) is Bucket A1 and is
> **not** this. No Bucket-A/B or D-item trigger anywhere in this plan.
>
> **Legend:** ✅ shipped · 🔨 build · 🔎 verify · 🧱 owner decision gates the step

---

## 0. Ground rules (restated so nobody re-derives them)

- **The client never decides.** Every list, thread and action re-authorises server-side; hiding a
  control is presentation only. A non-party thread is a **plain 404** — never 403, never a
  redirect that reveals it exists.
- **Companies, never people (M4-17/G2).** No person name, no user id, no avatar of a human
  anywhere. The message projection carries `senderType` only — the server will never supply more.
- **Colour never alone (M4-19).** Every freeze label renders the server's `{tone, text}` pair.
  Exactly **zero or one** chip per row — labels never stack (M4-29).
- **Reason yes, actor never (M4-25/G1).** Both parties see the block reason verbatim;
  `blockedBy` / `blockedAt` are staff-screen-only.
- **Reading always works (M4-22).** Freeze kills the composer, never the transcript.
- **No dead controls** (`web-ui-notes.md`): anything rendered-but-unwired is `disabled` + a
  `docs/UiWebNotes.md` row in the same change. This plan **flips 5 existing Pending rows** and
  must update the ledger as it does.
- **Server copy is verbatim.** Welcome, freeze, unfreeze, self-enquiry refusal and frozen-send
  refusal are server-authored and locked — display them, never paraphrase.
- **Cursor pagination only.** Never a page number on a conversation list or a thread.
- **Design system:** existing tokens + primitives (`Button`, `Field`, `Input`, `Select`,
  `Combobox`, `CountrySelect`, `Modal`, `Drawer`, `EmptyState`, `ErrorState`, `Skeleton`,
  `StatusChip`, `VerifiedTick`, `Spinner`). No one-off styling; chat primitives are new shared
  components, not page-local.
- **Five drawn states on every screen:** skeleton · empty · error (requestId + retry) · success ·
  plus the three `m4.md` §9 names: **empty chat list**, **frozen thread**, **purged-product thread**.

---

## 1. The contract (verified against `src/routes/` 2026-08-17)

| Endpoint | Auth | Used by |
|---|---|---|
| `POST /inquiries` `{productId, note, fields}` → `{conversationId, inquiry}` · **201 new / 200 existing** | buyer role + buyer-side org | screen 2 |
| `GET /conversations/by-product/:productId` → `{conversationId}` · **404 = no thread** | party | screen 1 |
| `GET /conversations?q&cursor&limit` → `{conversations[], nextCursor}` | party | screen 3 |
| `GET /conversations/unread-count` → `{unread}` | party | nav badge |
| `GET /conversations/:id` → `{conversation}` | party (404 if not) | screen 4 |
| `GET /conversations/:id/messages?before&limit` → `{messages[], nextBefore}` · oldest-first | party | screen 4 |
| `POST /conversations/:id/messages` `{body}` → `{message}` | party, **60/min** | screen 4 |
| `POST /conversations/:id/read` → `{readAt}` | party | screen 4 |
| `GET /admin/conversations?q&productId&orgId&side&cursor&limit` | `conversation:read` | screen 5 |
| `GET /admin/conversations/:id` · `/:id/messages` | `conversation:read` · **audited** | screen 6 |
| `POST /admin/conversations/:id/block` `{reason 3–500}` | `conversation:block` | screen 6 |
| `POST /admin/conversations/:id/unblock` `{reason?}` | `conversation:block` | screen 6 |

**Socket** (`/` namespace, JWT in `auth.token`): → `message:send` · `conversation:read` ·
`conversation:open` (staff) · `conversation:resync {conversationId, lastMessageId}` ;
← `message:new` · `conversation:frozen {reason}` · `conversation:unfrozen` · `conversation:updated`.

**Party payload** — `{id, title, product{id,slug,name}, counterparty{name}, participants[3],
lastMessageAt, lastMessagePreview, unread(bool), frozen, frozenLabel{tone,text}, blockedReason,
createdAt}`. **Staff payload** adds `buyerOrg{id,name}`, `exporterOrg{id,name}`, `frozenReason`,
`blockedBy`, `blockedAt`, and `unread{buyer,exporter}`.
**Message** — `{id, senderType, body, createdAt}`. Nothing else exists; do not design around more.

**Limits to draw states for:** enquiry **20/hour** · message **60/min** · user message body
**200 chars** (the composed first message and system notices are exempt and run long) · list page
max 50 · message page max 50.

**Enquiry field sets** (locked; validated server-side against the leaf's `type`, which
`/public/products/:slug` already returns as `category.type`):
*goods* — `quantity` · `unit` · `targetPrice` · `currency` · `deliveryCountry` (ISO-2) ·
`deliveryTimeline`. *service* — `engagementType` · `budget` · `currency` · `timeline` ·
`deliveryModel`. All optional; **`note` (1–200) is required**; an amount without a currency is a
400 with the exact message *"Please choose a currency for the amount you entered."*
**Unknown keys are rejected, not stripped** — send only the set for the leaf's type.

---

## 2. 🧱 Decision gates (raised 2026-08-17; each blocks only its own step)

| # | Decision | Blocks | My recommendation |
|---|---|---|---|
| **D-a** | **`socket.io-client` is a new dependency.** | Phase 5 only | **Add it.** Everything else is REST and works without it; live delivery is the module's point. Phases 1–4 and 6 build REST-first and stay correct if you say no. |
| **D-b** | Buyer + exporter sidebars carry **both "Enquiries" and "Chat"**; M4-35 says there is no enquiry inbox. | Phase 1 nav | **Keep "Chat", delete "Enquiries"** in both portals. Changes the M1-approved nav set, hence the ask. |
| **D-c** | A thread frozen by an **account block** returns `tone: none` — the list row looks normal until opened. | nothing (cosmetic) | **Leave as-is** for now. Changing it is a backend `frozenLabel` change; the thread itself explains via system message + banner. |
| **D-d** | **No `verified` tick inside chat** — the conversation payload carries a counterparty *name* only. | nothing | **Leave as-is.** The enquiry form header can show the tick (it sits on the public product surface). Adding it to conversations widens a projection — red-alert first. |

Also standing (already ruled 2026-08-14, restated so this plan doesn't re-open them):
product-page **"Send Enquiry" is the one door** · category-card **"Inquiry" stays deactivated** ·
supplier **"Start Conversation" stays visible-but-disabled**, decision deferred.

---

## Phase 1 · 🔨 Foundation — API layer, keys, nav, primitives

**Files:** `src/api/conversations.js` (new) · `src/api/inquiries.js` (new) ·
`src/components/chat/` (new folder) · `src/pages/buyer/buyerNav.js` · `src/pages/exporter/exporterNav.js` ·
`src/layouts/AdminLayout.jsx` · `src/App.jsx`.

1. **API modules** in the house style (`saved.js` is the template): thin functions over
   `apiClient`, a documented shape comment, and a `conversationKeys` factory —
   `list(params)` · `detail(id)` · `messages(id)` · `unread()` · `byProduct(productId)` ·
   `admin.list(params)` · `admin.detail(id)` · `admin.messages(id)`.
2. **`useUnreadCount()`** hook — one query, `staleTime` ~30s, invalidated by any thread read and
   by `conversation:updated`. Feeds the nav badge. **Threads, not messages** — there is no
   per-thread count and one must never be faked.
3. **Nav** (🧱 D-b): buyer + exporter get a real **Chat** item → `/buyer/chat` · `/exporter/chat`
   with the unread badge; "Enquiries" removed. Admin gets **Conversations** → `/admin/conversations`
   gated `perms: ['conversation:read']` in `AdminLayout`'s NAV (the existing `can()` filter already
   does the right thing — an employee with neither grant never sees the row).
4. **Routes** in `App.jsx`: `/buyer/chat`, `/buyer/chat/:id` under the buyer `RequireRole`;
   `/exporter/chat`, `/exporter/chat/:id` under the exporter one; `/admin/conversations`,
   `/admin/conversations/:id` **lazy** inside the existing admin Suspense block (the console is a
   separate bundle — keep it that way).
5. **Chat primitives** (`src/components/chat/`), designed once, used by screens 4 and 6:
   `MessageBubble` (mine / theirs / **system notice** — centred, full-width, never a party bubble;
   must carry a ~10-line composed enquiry gracefully) · `DateSeparator` · `Composer` (growing
   textarea, 200 counter appearing from ~160, Enter sends / Shift+Enter newline) ·
   `FreezeBanner` (yellow/red/neutral variants; replaces the composer, never greys it out) ·
   `FreezeChip` (`{tone,text}` — never colour-only) · `ConversationRow` (+ skeleton) ·
   `ParticipantsLine` (Buyer Co · Seller Co · **MPX Global** with the brand glyph) ·
   `ThreadSkeleton`.

**🔎 Verify:** nav renders for all four roles including an employee with only `conversation:read`;
badge shows 0 without a request storm; admin chunk still lazy (network tab: no chat code on a
public page load).

---

## Phase 2 · 🔨 Buyer entry — screens 1 & 2

**Files:** `src/pages/public/ProductDetail.jsx` (existing) · `src/components/chat/EnquiryModal.jsx` (new).

**Screen 1 — the button** replaces the **existing disabled "Send Enquiry"** in its exact position
(buy panel, under the trade-facts card). State table:

| Viewer | Control |
|---|---|
| Guest | "Create enquiry" → `/signin?next=…`, intent preserved, returns and reopens the form |
| Buyer, no thread (`by-product` 404) | "Create enquiry" → opens screen 2 |
| Buyer, thread exists | **"Open chat"** (secondary + chat icon) → `/buyer/chat/:id`, with the one-line hint "You've already enquired about this product" |
| Exporter-portal account | **nothing rendered** |
| Buyer viewing own company's product | **nothing rendered** (F4 guard would refuse it anyway) |

`by-product` runs only for a signed-in buyer, and the button shows a brief skeleton while it
resolves — **never a visible flip** from "Create enquiry" to "Open chat". On error, fall back to
"Create enquiry" (the server safely returns the existing thread).

**Screen 2 — the enquiry form**, a `Modal` over the product page (`Drawer` at <640px):
context header (thumbnail · name · seller + tick) → the goods **or** service field set chosen from
`product.category.type` → required note with a live 200 counter → "Send enquiry".
On success **navigate straight into the thread** (M4-35) — no confirmation modal, and never any
copy implying email or phone follow-up. Optional: a small live preview of the composed first
message under the form.

**States:** default (both field sets) · loading · currency-missing inline error · **rate-limited**
(20/hr) · self-enquiry refusal shown verbatim if a stale UI fires it · duplicate race → resolves
silently into the existing thread (200) · error.

**🔎 Verify:** enquire end-to-end on a goods leaf and a service leaf; confirm the composed first
message is #1 and the welcome is #2; confirm a second attempt returns the same thread and does not
create a second one; ledger rows for "Send Enquiry" → **Done**.

---

## Phase 3 · 🔨 Chat list — screen 3, one design, two instances

**Files:** `src/pages/chat/ChatList.jsx` (new, shared) mounted at both portal routes.

Rows are the whole click target: role-aware title · one-line preview · relative time · unread
bold + dot · freeze chip at the trailing edge (never replacing the timestamp). Search input labelled
**"Search by product or company"** — debounced, submit-driven, **no as-you-type dropdown**: native
`$text` is whole-word with no typo tolerance, and an instant-results affordance would promise fuzzy
matching we don't have. Pasting an org id works (exact match). **Never** labelled "search messages".

Cursor "Load more" (or infinite scroll) via `nextCursor`. **No archive, no delete, no size limit.**

**States:** skeleton · **empty** (buyer: "When you enquire about a product, the conversation appears
here" + browse CTA; exporter: "When a buyer enquires about one of your products, it appears here" —
**no CTA, sellers cannot start threads**) · results · no-matches (names the query, offers clear) ·
error · stale/offline notice.

**🔎 Verify:** buyer and exporter lists side by side on one thread — titles differ, layout identical;
unread appears for the seller and not for the buyer who just wrote; opening clears it.

---

## Phase 4 · 🔨 Chat thread — screen 4, the centrepiece · **design 375 first**

**Files:** `src/pages/chat/ChatThread.jsx` (new, shared by both portals).

Three zones: header (role-aware title · product line — **link while the product exists, plain
snapshot text with no link once purged** · participants line · connection pill) → message scroll →
composer **or** freeze banner (mutually exclusive).

- Newest window on open (~30), **scroll-up** fetches earlier bundles via `nextBefore` with an
  inline loader — never a "Page 2" control, and the scroll anchor must hold position when the
  older bundle prepends.
- Date separators; "New messages" jump pill when live messages land while scrolled up.
- **No hover actions on a bubble** beyond text selection (M4-13).
- Optimistic send with a pending state, confirmed on ack; failure renders **"Not sent — retry" on
  the bubble itself**, never a detached toast. De-duplicate by message id (the optimistic row and
  the socket echo are the same message).
- Opening marks read (server-stamped) and invalidates the unread badge. No "mark as read" control.

**Frozen banners** (composer *replaced*, not disabled): takedown → yellow "Product under review" ·
blocked → red "Conversation blocked by MPX Global" + the admin's reason verbatim, with room for a
sentence or two · purged → red "Product no longer available" · account → neutral, from the system
message. Full history stays scrollable in every one.

**States:** skeleton bubbles · open · sending / send-failed · frozen ×4 · rate-limited send (60/min)
· error · **404 for a non-party thread** (the plain NotFound page, never "you don't have access").

**🔎 Verify at 375 first, then 768 / 1024 / 1440:** no body overflow; composer reachable above the
keyboard; a 10-line composed first message renders without breaking the bubble; `aria-live` on the
scroll region announces arrivals.

---

## Phase 5 · 🔨 Live layer 🧱 (gated on D-a)

**Files:** `src/lib/socket.js` (new) · `src/hooks/useConversationSocket.js` (new).

One connection per session, created after auth, torn down on sign-out, token from the in-memory
store (never storage). Handles: `message:new` (append + dedupe by id) · `conversation:updated`
(reorder the list, refresh unread) · `conversation:frozen` / `conversation:unfrozen` (swap the
composer for the banner **live**, and **keep any typed draft visible above the banner** — it must
never be silently eaten) · reconnect → `conversation:resync` from the last known message id, and on
`truncated: true` quietly refetch the newest window instead.

Connection pill: hidden (live) · "Reconnecting…" · reconnected flash. **Sends keep working while
disconnected** — they fall back to REST; only live receipt pauses.

**🔎 Verify with two browser contexts** (buyer + seller signed in simultaneously): a message appears
on the other side without a refresh; both list rows reorder; killing the socket mid-session shows
the pill, a REST send still succeeds, and reconnect back-fills without duplicates.

---

## Phase 6 · 🔨 Admin moderation — screens 5 & 6 (lazy chunk)

**Files:** `src/pages/admin/Conversations.jsx` · `src/pages/admin/ConversationViewer.jsx` (both new,
both lazy) · `src/api/conversations.js` (admin half).

**Screen 5** — the M1 admin table: Title (*Buyer × Seller × Product*) · Last activity · Freeze chip
(fixed scan column) · **two unread indicators, "buyer unseen" / "seller unseen"** · Started ·
**View**. Search placeholder "Search names, or paste an organisation ID". Cursor "Load more", never
page numbers — this list reorders under a moderator as messages land anywhere on the platform.
Density over comfort. Browsing the list is **not** audited.

**Screen 6** — read-only transcript (same bubble primitives) + a staff detail rail: both orgs with
ids · product (link while live, snapshot text when purged) · started · frozen state with the **raw
reason** · when blocked, **reason + blocked-by + blocked-at** · per-party unread · participants ·
the notice **"Conversation access is recorded."** **No composer exists at any permission level —
absent, not disabled.**

Actions render only with `conversation:block`: **Block** (danger, reason required 3–500, helper
"Both the buyer and the seller will see this reason", confirmation stating the consequence) and
**Unblock** (optional audit-only reason, and the honest M4-30 warning — *"If the product is under
review or a party's account is blocked, it will stay frozen for that reason."*).

**Both unblock outcomes must be drawn:** reopened, and **still frozen with the label switching to
the surviving reason** — that switch is correct behaviour, not a bug. The system message the action
posts should land visibly in the transcript the moderator is watching.

**🔎 Verify:** block from staff, watch both party threads freeze live and the reason render
identically on both; takedown-then-block keeps the **block** label; unblock a thread whose product
is still down and confirm it stays frozen with the takedown label; an employee with `conversation:read`
only sees no action buttons at all; every thread open writes an AuditLog row (check `/admin/audit`).

---

## Phase 7 · 🔎 Close-out

- Walk the design brief's §8 checklist (18 rows) against the running app, not the code.
- Playwright pass: 390 / 768 / 1024 / 1440, zero body overflow, real touch context for the thread.
- `docs/UiWebNotes.md`: flip **"Send Enquiry"**, buyer **"Chat"**, exporter **"Chat"** → Done;
  delete or re-word the two **"Enquiries"** rows per D-b; leave the category-card "Inquiry" and the
  supplier "Start Conversation" rows **Pending** with their rulings intact.
- `docs/History.md` entry per phase; `design-plans/m4/web-screens-design.md` corrected to as-built
  where an owner iteration moves it; **app parity captured** the way M3's §0 was, so the app build
  inherits every decision instead of re-deriving it.

---

## 3. Known traps (each has already bitten this codebase or its backend)

1. **socket.io drops events sent before a listener exists** — the backend hit this and fixed it by
   registering listeners synchronously. Client side: attach handlers before emitting anything.
2. **Optimistic + echo = duplicates.** Dedupe by server message id, not by body+timestamp.
3. **Unread is a strict `>`.** A read landing in the same millisecond as a message counts as read —
   don't "fix" it into `>=`.
4. **Cursor, never offset.** `lastMessageAt` reorders constantly; `skip` shows one thread twice and
   hides another.
5. **404 not 403** everywhere on the party surface, including a thread the viewer merely mistyped.
6. **The composed first message exceeds 200 chars by design.** Only the composer enforces 200.
7. **React reconciliation by position** — conditional siblings (composer vs banner) need stable
   `key`s or the swap remounts and eats a draft.
8. **Don't widen the projection.** No `verified`, no `senderUserId`, no `blockedBy` on a party
   screen — if a design wants one, red-alert first.

## 4. What this plan does NOT build

Quotation UI of any kind (Bucket A1) · notification centre / bell / email / WhatsApp (D5 — the
approved push slice is mobile-only, and there is **no web push**) · attachments · typing indicators
· online status · per-message read receipts · edit/delete · message-content search · report/flag ·
enquiry status chips · a supplier-level conversation flow · any admin composer.
