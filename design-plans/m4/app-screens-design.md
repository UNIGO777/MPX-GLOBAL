# M4 · Mobile App Screens — Design Brief (Enquiry & Chat)

> **5 screens** for the M4 (Enquiry & Chat) milestone, **mobile app only** (React Native / Expo,
> iOS + Android).
> This is a **design** document: what each screen contains, every field on it, and the states
> that need artwork. No API or code detail.
> Companion: `design-plans/m4/web-screens-design.md` — shared vocabulary (freeze labels, system-voice
> copy, company-only identity) is defined there in §1 and **applies verbatim here**; this brief
> repeats only what the phone changes.
>
> **Scope rule:** only the surfaces named in `modules-in-detailed/m4/` — `m4.md` §9 ("Mobile
> carries screens 2 and 3 in WhatsApp-style form", M4-37) plus the enquiry entry the flows
> require (§9.1, `product-enquire-flow2.png`, `Buttons-summaries.png`) and the **approved FCM
> slice** (owner, 2026-07-31): push on exactly two events, permission ask, and the tap→thread
> landing. Nothing else. Gaps in §9.
>
> ⚠️ **Naming guard:** `modules-in-detailed/m4` = **Enquiry & Chat**, month-1 in scope. The
> quote's "Module 4" = **Quotation & negotiation** is deferred (Bucket A1) — see "Do not design".

---

## 1. What the app carries — and what it never will

**Two roles only: Buyer and Exporter.** The admin moderation surfaces (all-conversations, chat
viewer, block/unblock) are **web only** (`m4.md` §9: "Admin screens are web only"). Nothing in
the app hints at moderation tooling — no block action, no staff view, ever.

**Buyer and seller behave identically on web and mobile (M4-36).** Same thread rules, same
freeze behaviour, same one-thread-per-product. The app is not a lighter chat; it is the same
chat with native mechanics: WhatsApp-style list (M4-37), inverted scrolling thread, keyboard-
aware composer, push notifications.

**Where the app is genuinely better than web:** the exporter's side. A seller only learns of an
enquiry by being told (there is no email in month 1) — the app with push **is** the seller's
inbox. Design the exporter experience as the primary one on mobile.

### 1.1 Foundations carried from the M1 app brief — unchanged

Same tokens, same platform conventions (iOS back-swipe / Android hardware back), safe areas,
touch targets ≥ 44px, two device sizes (~375pt and ~430pt), dark-mode decision inherited,
**offline is a state to draw on every data screen**. Keyboard handling is a design requirement
— nowhere more than in the chat thread (§5).

### 1.2 Vocabulary carried from the web brief — verbatim

- **Freeze labels** are server-supplied `{tone, text}` pairs — yellow "Product under review",
  red "Conversation blocked by MPX Global", red "Product no longer available"; the account
  freeze has **no list label** (see web brief §1.1 and its gap 1). Colour never alone (M4-19).
- **First reason wins** — zero or one label per row, never two (M4-29).
- **Company names, never person names** (M4-17); message attribution is `senderType` only; no
  person's name or avatar exists anywhere in the data.
- **The platform is in the room** (M4-1) — participants row shows Buyer Co · Seller Co ·
  **MPX Global** in every thread.
- **System-voice copy is server-authored and locked** — welcome, freeze, restore, block,
  unblock, account notices render verbatim (web brief §1.3 lists all seven).
- **Both parties see a block reason; neither ever sees who blocked** (M4-25 / G1).
- **Unread is a boolean per thread + one thread-count** for the tab badge — no per-thread
  message counts exist (G7).

### 1.3 Push — the approved slice, and only the approved slice

Owner-approved into month 1 (2026-07-31), **narrow**: device push on **two events** — *new
enquiry → seller* and *new message → counterparty* — plus token registration and the tap
landing. Everything else in the notification layer is **D5, still deferred**: no in-app
notification centre, no notification list screen, no per-type settings, no email/WhatsApp
mentions anywhere in copy.

**🔴 The push payload never contains the message text (D-N1).** Server-built, fixed shapes:

| Event | Title | Body |
|---|---|---|
| New enquiry | "New enquiry" | "{Buyer Co} enquired about {Product}" |
| New message | "New message" | "{Company} — {Product}" |

Design the notification appearance around those exact strings — there is no rich preview to
mock up, deliberately: a push lands on a lock screen anyone can read.

**Suppression the design should expect:** the sender never gets a push; a user whose app is
open and connected gets the live message instead of a push. On iOS/Android quirks (briefly
backgrounded socket), a user may occasionally get neither a push nor a live update until they
reopen — the resync flow (§5) covers it.

### 1.4 Sensitive-surface note

Chat content is commercial negotiation. It is **not** covered by the M1 KYC blur rule, but keep
one habit: message text never appears in the app switcher requirement is *not* imposed here —
however, message text must never leak into push (server-guaranteed) or into any log/analytics
event the client emits.

---

## 2. Shared components to design once

- **Message bubble** — mine / theirs / **system notice** (centred, platform-voiced, visually
  unmistakable from a party). Long first-message variant (label: value lines + note). Date
  separators. Timestamp per bubble.
- **Composer bar** — pinned above the keyboard: growing text input (200-char limit, counter
  visible from ~160), send button with pending state. **No paperclip** (M4-14 — don't reserve
  space for one).
- **Freeze banner** — replaces the composer when frozen; four reason variants (web brief §5,
  screen 4 table). Reading always stays available.
- **Conversation row** — WhatsApp-style: title (role-aware, M4-17), preview line, relative
  time, unread bold + dot, freeze chip trailing. Skeleton variant. **No swipe actions** — there
  is nothing to archive (M4-31), nothing to delete (M4-13), nothing to mute (no notification
  controls in month 1).
- **Freeze chip** — the `{tone, text}` pair, small, always worded.
- **Participants row** — collapsible header line: "Buyer Co · Seller Co · MPX Global".
- **Tab badge** — unread *thread* count on the Chats tab.
- **Connection pill** — "Reconnecting…" over the thread; hidden / reconnecting /
  reconnected-flash.
- **"New messages" jump pill** — for messages arriving while scrolled into history.
- **Enquiry form inputs** — reuse the M1 kit: number pad inputs, short text, **currency picker
  (searchable sheet)**, **country picker (searchable sheet)**, textarea with counter.
- **Pre-permission sheet** — the in-app explanation shown *before* the OS notification prompt
  (§6). One design, two contexts (buyer post-enquiry, exporter post-login).

---

## 3. Screen inventory — 5

| # | Screen | Role | Named in |
|---|---|---|---|
| 1 | Product detail — enquiry entry *(app surface **not yet built** — see §9 gap 1)* | buyer | `m4.md` §9.1 · `Buttons-summaries.png` |
| 2 | Enquiry form | buyer | `m4.md` §9.1 · `product-enquire-flow2.png` |
| 3 | Chat list — "Chats" tab | buyer + exporter | `m4.md` §9.2 · M4-37 |
| 4 | Chat thread | buyer + exporter | `m4.md` §9.3 · `enquiry+chat-flow1.png` |
| 5 | Push permission ask + notification tap landing | both | approved FCM slice (owner 2026-07-31) |

Screens 3 and 4 are **one design each, two instances** — buyer and exporter differ only in
title composition and empty-state copy.

**Tab bar impact.** The M1 app brief's placeholder tabs listed buyer *Enquiries* + *Messages*
and exporter *Enquiries* separately. M4-35 (one role-aware chat list, **no enquiry inbox**)
collapses those: this milestone lights up **one "Chats" tab per portal**, with the unread badge.
Recommendation carried to the owner: buyer tabs become Home · Search · **Chats** · Profile;
exporter tabs Home · Catalogue · **Chats** · Profile. Flagged in §8 — it amends the M1 brief's
tab table.

> **Update 2026-08-14:** the placeholder tabs became real **Home screens** (shipped 2026-08-10),
> which carry separate **"Enquiries"** and **"Chat"** coming-soon module cards
> (`docs/UiWebNotes.md`). The consolidation above applies to those cards too: wiring M4 should
> collapse both into **one "Chats" card** per Home screen, same reasoning, same owner sign-off.

### Do not design — with sources

- **🔴 Quotation & negotiation** (quote Module 4 — Bucket A1, `docs/month1-not-doing.md`): no
  quote/offer bubbles, no price negotiation UI, no accept/decline, no "request quotation"
  button. `targetPrice` on the enquiry form is a buyer's stated ask, not an offer flow.
- **🔴 Notification centre / settings (D5,** `docs/Note.md`**)**: no notification list screen,
  no bell, no per-event toggles, no email/WhatsApp settings. The Profile screen's M1
  "Notifications — placeholder" row stays a placeholder. The **only** designed notification
  surfaces are screen 5's two moments.
- **Attachments (M4-14)** — no camera/gallery/file affordance in the composer, no image
  bubbles. (Yes, on a phone this feels unnatural — it is a deliberate month-1 decision;
  document exchange waits for the Quotation module.)
- **Typing indicators · online/last-seen · per-message read receipts** — `m4.md` §1 out of
  scope. No double ticks; the only delivery signal is the bubble's own pending→sent state.
- **Message edit/delete (M4-13)** — long-press offers **Copy** only.
- **Message-content search (M4-32)** — list search only; no in-thread search.
- **Contact-detail warnings (M4-15)** · **report conversation** (`m4.md` §13) · **enquiry
  status chips** (lifecycle undriven, not surfaced).
- **Admin/staff anything** — web only, and never in the app in any milestone.

---

## 4. Enquiry entry (screens 1–2) — buyer

### 1 · Product detail — enquiry entry *(app surface not yet built)*

> ⚠️ **Reality check (2026-08-14):** the app's product-detail screen does **not exist yet**. Its
> design brief does — `design-plans/m2/app-screens-design.md` §4 screen 3 — but only category
> browse (M2 app screen 1) has shipped; sub-category taps currently open a coming-soon screen.
> This section designs the enquiry entry **against that M2 brief**, to be applied when the
> screen is built. (On web the equivalent door already exists as a disabled "Send Enquiry"
> placeholder — see the web brief §4.)

The app's public product view gains the same single door as web (`Buttons-summaries.png`):

| Viewer | CTA | Behaviour |
|---|---|---|
| Signed-out browser | **"Create enquiry"** — sticky bottom CTA | → buyer sign-in, return with intent preserved |
| Buyer, no thread | **"Create enquiry"** — sticky bottom CTA | opens screen 2 (full-screen) |
| Buyer, thread exists | **"Open chat"** — secondary, chat icon, with hint "You've already enquired about this product" | → screen 4 (M4-5: a second enquiry never opens a second thread) |
| Exporter account | no enquiry CTA | enquiring is buyer-only |
| Buyer viewing own company's product | no enquiry CTA | self-enquiry is rejected server-side (M4-39); don't render the door |

**States:** per row above · resolving (skeleton CTA — never a visible label flip) · guard fired
anyway → server copy verbatim: *"This product belongs to your own company, so you cannot
enquire on it."*

**Design note:** the sticky CTA must clear the home indicator and never overlap content. A
product that is hidden/taken down has no public page on the app either — no special enquiry
state needed here; existing chats are reached from the Chats tab only.

---

### 2 · Enquiry form — full-screen, buyer

Structured form (M4-7); field set follows the sub-category's `type` (M4-9). Same fields,
requirements and helper copy as the web brief §4 screen 2 — goods (quantity · unit · target
price · currency · deliver-to · delivery timeline · **note ✔ 200**) and services (engagement
type · budget · currency · timeline · delivery model · **note ✔ 200**). Currency becomes
required the moment an amount is entered.

**Mobile-specific design:**
- Full-screen pushed route with the product context (thumbnail + name + seller company +
  verified tick if verified) pinned at top.
- Correct keyboard per field: number pad for quantity/price/budget, default for text; currency
  and country open **searchable sheets**, never wheel pickers over ~20 entries.
- Submit pinned above the keyboard; the note field must stay visible while typing.
- Preserve a half-filled form if the app backgrounds mid-entry.

**States:** default (per category type) · loading · field errors (currency-missing is the live
one) · rate-limited (*"You've sent a lot of enquiries — please try again in a while"*) ·
**success → straight into the chat thread** (screen 4) with enquiry as message #1 and platform
welcome as message #2 (M4-10 — the OLX drop-in, M4-35) · duplicate race (silently lands in the
existing thread) · offline (block submit with a clear retry; never lose the typed note).

**🔴 Copy constraints:** identical to web — the thread is the confirmation (no "seller will
contact you" toast), and nothing ever implies email/phone follow-up; the thread is the only
channel that exists.

---

## 5. Chat (screens 3–4)

### 3 · Chat list — "Chats" tab — WhatsApp-style (M4-37), one design, two instances

**Contains:** large title "Chats" · search field (collapsible on scroll) · conversation rows ·
infinite scroll (cursor) · pull-to-refresh.

**Row:** role-aware title — buyer: *Product × Seller Co*; exporter: *Product × Buyer Co* —
preview line, relative time, unread bold + dot, freeze chip trailing (§2). **No swipe actions,
no long-press menu** — there is genuinely nothing to do to a row but open it (M4-31, M4-13,
M4-26's two-level enforcement is admin-side).

**Search:** matches product and company names, **whole words only** (native `$text` — no typo
tolerance, no partials). Placeholder "Search by product or company". Debounced filter, not an
instant-suggestions dropdown that would imply fuzziness. Never labelled "search messages"
(M4-32).

**States:** loading (skeleton rows) · **empty** — buyer: *"When you enquire about a product,
the conversation appears here"* + browse CTA; exporter: *"When a buyer enquires about one of
your products, it appears here"* (no CTA — sellers cannot start conversations, and the empty
state must not suggest they can) · results · no matches (names the query, clear affordance) ·
**offline** (render last-fetched list + a quiet stale banner and retry; never a blank screen) ·
error.

**Live behaviour:** new message → row jumps to top, unread turns on, tab badge increments;
freeze event → chip flips in place; all without pull-to-refresh. Honour
`prefers-reduced-motion`.

---

### 4 · Chat thread — the app's hardest screen

**Layout:** header · inverted message list · composer bar (or freeze banner).

**Header:** back · role-aware title (M4-17) · product sub-line — tappable to the product while
it exists; **plain text from the snapshot, not tappable, once purged** (M4-22) · a compact
participants disclosure ("with {Counterparty Co} · MPX Global") expanding to the full
three-party row (M4-1). No call icon, no video icon, no counterparty profile avatar of a person
— company identity only.

**Message list:**
- Inverted (newest at bottom), scroll-up loads earlier bundles of ~30 with an inline header
  spinner (M4-16). Never "load more" buttons, never page numbers.
- Message #1 = the composed enquiry (long, multi-line); message #2 = the system welcome. Every
  thread's history ends at this pair — design the top of scrollback around them.
- System notices centred, platform-voiced, rendered verbatim (§1.2).
- Long-press on a bubble → **Copy** only.
- "New messages" jump pill when live messages arrive while scrolled up.
- New incoming messages announced to screen readers.

**Composer:** §2 bar, pinned above the keyboard (keyboard-avoiding is non-negotiable — the
composer and the last message must both stay visible while typing). Send is optimistic: bubble
appears with a subtle pending state, confirms on ack; on failure the bubble gets **"Not sent —
tap to retry"** in place. Multi-line growth capped at ~5 lines, then internal scroll.

**Frozen thread:** the composer is **replaced** by the freeze banner — reason-appropriate copy
per the web brief §5 table:

| Reason | Banner |
|---|---|
| takedown | yellow · "Product under review" · messaging paused while MPX Global reviews the product |
| blocked | red · "Conversation blocked by MPX Global" · the admin's reason, verbatim, with room for sentences (M4-25 — and never who blocked, G1) |
| purged | red · "Product no longer available" · conversation closed for new messages; history stays readable |
| account | muted · the system line: the other party's account is currently unavailable |

**Reading never freezes.** Full history remains scrollable in every frozen state (M4-22).

**Reconnect & offline — states that must be drawn, not hoped away:**
- **Reconnecting:** connection pill on; the user can still type and send (sends fall back to the
  ordinary request path); only live receipt pauses. Do not disable the composer for a socket
  drop.
- **Resynced:** on reconnect the thread requests what it missed; missed messages slot in
  chronologically with the jump pill if the user is scrolled up. If too much was missed, the
  thread silently reloads its latest window — no error, no user action.
- **Fully offline:** banner ("You're offline — messages will not send"), composer stays typable,
  send disabled with the reason visible; drafts survive backgrounding.
- **Freeze arrives live:** composer swaps to the banner mid-session (pushed, §7.4); a typed
  draft stays visible above the banner rather than vanishing. **Unfreeze arrives live:** banner
  swaps back; the system message explains.
- **Rate-limited send:** inline *"You're sending very fast — give it a moment."*
- **Frozen-send refusal (stale composer):** server copy verbatim — *"This conversation is
  closed for new messages."*
- **Not found:** a thread the account isn't a party to shows the generic not-found screen —
  never "no access".

**Opening the thread marks it read** — list row and tab badge clear immediately on entry, not
on next refresh.

---

## 6. Push (screen 5) — the approved slice only

### 5a · Pre-permission ask

Never fire the OS permission dialog cold on first launch — earn it at the moment of relevance,
once per context, with a system-sheet explanation the user can decline without penalty:

| Context | Trigger | Copy direction |
|---|---|---|
| **Exporter** (the side that needs it) | first login on a device, or first visit to the Chats tab | *"Know the moment a buyer enquires. We'll notify you about new enquiries and replies — nothing else."* |
| **Buyer** | right after sending their first enquiry | *"Get notified when {Seller Co} replies."* |

Actions: **"Turn on notifications"** (→ OS prompt) · **"Not now"** (quiet dismissal; re-askable
later from the same trigger points, never nagging on every open).

**States:** sheet · OS prompt granted (token registers silently — no success toast needed) ·
OS prompt denied (respect it; a small inline hint on the Chats tab — *"Notifications are off —
enable them in Settings to hear about new enquiries"* — for the exporter only) · permission
revoked at OS level later (same inline hint; deep-link to system settings).

**🔴 Copy constraint:** the promise is exactly the two events. Never "stay up to date with
offers, tips and news" — no other notification type exists or is allowed to be implied (D5).

### 5b · Notification tap → thread landing

Both push types carry the conversation; tapping one lands **directly in that chat thread**
(screen 4), on all three app states:

- **Foreground:** no system banner needed for the open thread (the message arrives live); for
  other threads, an unobtrusive in-app banner (title + company — never message text, mirroring
  D-N1) that taps through to the thread.
- **Background:** system notification → tap → thread, with back leading to the Chats tab (a
  sensible stack, not a dead end).
- **Cold start:** splash → session restore → **straight into the thread** — never Home first,
  never re-login if the session is restorable; if the session is dead, sign-in then the thread.
- **Edge states:** thread since frozen (land normally — banner explains) · thread not found /
  account signed out of that portal (land on the Chats tab with a neutral toast, *"That
  conversation isn't available"*) · notification for the portal the user isn't currently signed
  into (same neutral handling — never reveal cross-portal detail).

**Sign-out behaviour:** signing out unregisters this device's token — no push for an account
the phone no longer holds. Nothing to design beyond: no notifications after sign-out is the
expectation, and violating it is a bug.

---

## 7. Cross-screen checklist before handing designs over

- [ ] Every screen has loading, empty, error **and offline** drawn — plus `m4.md` §9's three:
      empty chat list, frozen thread, purged-product thread
- [ ] Freeze labels always tone **+ text**; zero or one chip per row (M4-19, M4-29)
- [ ] All four frozen-thread banners drawn, including the label-less account variant
- [ ] Composer replaced (not greyed) when frozen; live freeze/unfreeze transitions drawn; a
      typed draft survives a live freeze
- [ ] Frozen threads keep scrollable history in every variant (M4-22)
- [ ] Purged thread: snapshot title, product line not tappable (M4-22)
- [ ] Company names only — no person names, avatars, or user ids anywhere (M4-17/G2)
- [ ] Block reason shown to both parties; who/when blocked appears nowhere in the app (G1)
- [ ] MPX Global visible in every thread's participants disclosure (M4-1)
- [ ] System notices rendered verbatim and visually distinct from party bubbles
- [ ] No attachments UI, no typing/online indicators, no read receipts, no edit/delete (Copy only)
- [ ] No quotation UI (Bucket A1); no notification centre, list, or settings (D5)
- [ ] Push copy promises only the two events; payload mockups never show message text (D-N1)
- [ ] Notification tap lands in the thread from foreground, background and cold start
- [ ] Exporter empty state does not imply sellers can start conversations
- [ ] Search labelled for whole-word list search; never "search messages" (M4-32)
- [ ] Unread: bold + dot per row, thread-count on the tab badge, no per-thread counts
- [ ] Reconnecting pill never blocks the composer; offline banner does, visibly
- [ ] Enquiry form: note required (200), currency required with an amount, keyboard types correct
- [ ] Keyboard never covers the composer, the send button, or the focused field
- [ ] Checked on ~375pt and ~430pt; safe areas correct; sticky CTAs clear the home indicator
- [ ] No admin/staff surface anywhere in the app

---

## 8. Decisions

### ✅ Backend is built — design to actual behaviour

The M4 backend (models, REST, socket, FCM) exists and is tested; wordings and label pairs in
this brief are the server's own. Do not "improve" locked copy (welcome, freeze notices, push
templates) in artwork — it renders verbatim. *(Precision, 2026-08-14: "built" means the
**server** side — `firebase-admin`, `DeviceToken`, the two send events. The app client's token
registration and notification handling are not yet wired; screen 5 designs ahead of that
build.)*

### Recommendation — tab consolidation (needs owner sign-off)

Replace the M1 brief's separate *Enquiries* and *Messages* placeholder tabs with **one "Chats"
tab** per portal (M4-35: no enquiry inbox exists). This amends the M1 app brief §8 tab table;
say the word and I'll update that brief in the same pass.

### Still open

1. **Brand palette / dark mode** — unchanged carriers from the M1 brief; both decisions apply
   to these screens too (a chat thread in dark mode is the highest-value dark surface in the
   app — worth deciding before artwork).
2. **Re-ask cadence for a declined permission** — trigger points are defined (§6); how often to
   re-show the pre-permission sheet after "Not now" needs an owner call (recommendation: next
   qualifying trigger, max once per week).

---

## 9. Scope: gaps and uncertainties

| # | Gap | Detail |
|---|---|---|
| 1 | **App product-detail screen is briefed but not built** *(updated 2026-08-14)* | The brief now exists — `design-plans/m2/app-screens-design.md` §4 screen 3 — but the screen itself is unbuilt: only category browse (M2 app screen 1) shipped, and its sub-category taps open a coming-soon screen until the listing + product screens land. Screen 1 here designs only the enquiry entry to apply on top of that M2 design when it is built. |
| 2 | **Account-freeze has no list chip** | Server behaviour (`tone: none`): the row looks normal; only the opened thread explains. Same open question as the web brief gap 1 — ask the owner if a list cue is wanted; do not invent one. |
| 3 | **No verified tick inside chat surfaces** | The conversation payload carries the counterparty's name only. The tick appears on screen 2's product/seller context (public projection), not in the list or thread. Adding it there is a backend projection change — flag before designing it in. |
| 4 | **No attachments on a camera-first device** | M4-14 is deliberate; users will ask. The composer design should not visually reserve a paperclip slot that ships dead — add it when the Quotation module lands. |
| 5 | **A seller without the app or with push declined learns of enquiries only by opening the app** | No email in month 1 (`m4.md` §13's named largest gap). The exporter pre-permission ask (§6) is the only mitigation this milestone owns — which is why its copy matters. |
| 6 | **No in-app account switcher** | A user holding both portals gets pushes only for accounts signed in on the device; cross-portal notification taps resolve neutrally (§6b). Unchanged M1 posture. |
