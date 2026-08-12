# Prompt — MPX Global web · Navbar category mega-menu (M2 · `PublicHeader` "Categories")

> Copy everything below into your design tool (v0 / Lovable / Galileo / Figma AI / Claude /
> Stitch). This designs a **hover mega-menu on the "Categories" nav item** — hover it, all 40 top
> categories appear (with their photos); hover any ONE of those, and ITS sub-categories cascade
> open beside it. The goal: reach any sub-category from anywhere on the site in two hovers,
> without a page visit in between.
> Sources of truth: live tokens `web/tailwind.config.js` · current header
> `web/src/components/public/PublicHeader.jsx` · current categories page
> `web/src/pages/public/Categories.jsx` (same data, same photos — this menu is a faster DOOR into
> the same content, not a replacement of it — see §1's framing note) · `.claude/rules/web-design.md`.

---

## ⛔ COLOUR — hard rules, checked by arithmetic, before anything else

**The brand is a deep ROYAL BLUE / NAVY. Not purple, not violet, not indigo, not pastel.**
This has been mis-produced before (`#8069BF`, a lavender) — see the rejected table below.

```
#1A2E8F   navy  — accent use, FLAT fill, no gradient
#2A4DE0   blue  — links, the active/hovered row, primary actions
```

Every colour must satisfy both, arithmetically:

- **Hue 226–232°.** The brand pair sit at 230° and 228°.
- **Saturation ≥ 65%.** The brand pair are 69% and 75%.

| Rejected | Hue | Sat | Why |
|---|---|---|---|
| `#8069BF` | 256° | 40% | lavender — actually produced once, 26° too violet, half the saturation |
| `#4f46e5` | 243° | 75% | indigo — a stale draft once listed it; never shipped |
| `#6366f1` | 239° | 84% | indigo |

Also rejected: any purple/violet at any opacity · desaturated/pastel blue (use `#EAEEFF` for
"light," never a washed-out mid-tone) · Tailwind default `gray/slate/zinc` (ours is the
blue-cast `ink` scale below) · a coloured/tinted "no image" placeholder (the standard is a quiet
neutral grey + icon) · a heavy scrim/overlay/backdrop-blur behind the panel — a mega-menu is a
functional tool, not a marketing moment; keep it on plain white with a hairline border and the
existing shadow system.

**Full token set — use only hex values that appear verbatim in this document:**

```
primary-50   #EAEEFF     ink-50   #F7F8FB     surface  #FFFFFF
primary-100  #DEE1FF     ink-100  #F2F4F7     border   #C5C6CF
primary-600  #2A4DE0     ink-400  #98A2B3
primary-700  #2340C4     ink-600  #5A6B85 (= "muted")
primary-800  #1A2E8F     ink-900  #000517
```

Two shadow levels exist, never more: `shadow-card` (resting) and `shadow-lift` (one step deeper —
the open panel itself). Don't invent a third.

**Before delivering, list every hex you used and confirm each one is in here.**

---

## ⛔ RESTRAINT — 40 items is a lot; don't let it look like a dump

A mega-menu with 40 photo tiles is the classic way a navbar starts to look cheap. Apply the same
discipline as any other premium surface on this site:

- **A clear scan pattern.** A tidy grid (columns that align, consistent tile size) or a clean
  alphabetical/grouped list — never a loosely wrapped cloud of mismatched tile sizes.
- **Generous spacing over density.** Resist cramming all 40 into the smallest possible panel —
  a panel that scrolls gracefully, or spans wider with real breathing room, beats a tight grid
  that feels like a spreadsheet.
- **Photography stays quiet.** Small, consistent-crop thumbnails — this is a navigation aid, not
  a gallery. The photo helps recognition at a glance; it shouldn't compete with the text for
  attention.
- **One clear hierarchy per panel.** In the level-2 flyout, the parent category name should read
  as unmistakably "you are here," and the sub-category list beneath it as the actual choices —
  never two lists that look like visual peers.

---

## 1 · What you are designing

**A two-level hover cascade on the "Categories" item in the main nav bar** (desktop, `≥lg`):

- **Hover "Categories"** → a full-width (or wide, centred) panel drops open beneath the nav bar,
  showing all 40 top categories as small photo + name tiles, in a scannable grid.
- **Hover any ONE top-category tile inside that open panel** → without closing the first panel,
  that top's real sub-categories appear — either as a flyout beside/beneath the hovered tile, or
  as a second panel column, showing each sub's name (and photo, where one exists — most
  sub-categories don't have one yet, so design that as the common case, not rare).
- **Click any tile at either level** → navigates straight to that category's real page
  (`/category/:slug`) — same destination the current `/categories` page's cards already link to.
  **Clicking "Categories" itself still navigates to `/categories`** too — hovering is a shortcut
  layered ON TOP of a real, clickable nav link, never a replacement for one.

**🔑 Framing note — read before designing:** "don't make this a separate page" is read here as
*"don't make a visitor have to LEAVE the page and land on a separate page just to start
browsing"* — not as "delete `/categories`." That page keeps existing, because: (a) it's the real
destination `/category/:slug` and the mega-menu itself both point to, (b) it's this site's only
mobile/touch equivalent (there is no hover on a phone — see §4), and (c) it's the crawlable,
indexable page search engines index (m3-seo.md — a hover-only, JS-revealed panel is not a
reliable substitute for a real page for SEO purposes). If that reading is wrong and the page
genuinely should be removed, that's a bigger call than this prompt makes on its own — flag it
back rather than deciding it here.

**Propose at least 2 layout treatments** for the open panel itself (e.g. one wide single panel
with an inline flyout per hovered tile, vs. a fixed two-column "browse app"-style panel — tops on
the left, subs of whichever is hovered on the right, always visible once the menu is open). Name
each and say which fits 40 items + up to ~10 subs each more gracefully.

---

## 2 · Content & data — the real shape, don't invent fields

Identical to `/categories`, nothing new: each top category has name · slug · an image (all 40
have real photos today) · its list of subs, each with their own name · slug · image (most subs
don't have one yet — design the fallback as the common case). Order is server-decided
(admin-curated) — **never re-sort alphabetically**, same rule as the page.

No new content exists for this menu beyond what the category tree already carries — don't invent
descriptions, counts, or "popular in this category" content that has no real data behind it.

---

## 3 · Interaction behaviour — the part that's easy to get wrong

- **Keyboard equivalence, not hover-only.** Everything reachable by hover must also open on
  keyboard focus (Tab to "Categories," Enter/Space or arrow-down opens the panel; arrow keys move
  through tiles; Escape closes and returns focus to the nav item). A mouse-only mega-menu fails
  WCAG and locks out keyboard users entirely — this isn't optional polish.
- **A grace period, not a hair-trigger.** Moving the mouse diagonally from the "Categories" link
  toward a tile inside the open panel must not snap the panel shut because the cursor briefly left
  both elements — build in a short forgiving delay before closing, the single most common
  mega-menu usability bug.
- **Only one thing open at a time.** Hovering a new top-category tile swaps the level-2 flyout
  instantly to that tile's subs — it doesn't stack or leave the previous one open.
- **Dismiss cleanly.** Escape, or a click anywhere outside the panel, closes it. It never blocks
  or dims the rest of the page (no heavy scrim — see §0).
- **Nothing about this may block or slow the click-through.** Clicking a tile before the flyout
  "settles" must still navigate correctly — don't design a state where a fast click can miss.

---

## 4 · States to design

- **Loading** — the FIRST hover on any page might arrive before the category tree has loaded
  (this menu can be triggered from any page, not just `/categories`, which already has the tree
  cached). Design a brief, graceful loading state inside the panel (skeleton tiles), not a blank
  flash or a delayed pop-in with no warning.
- **A top category with no subs yet** (rare, but real) — the flyout side should say so plainly,
  not show an empty white gap.
- **No image** — the same quiet neutral fallback used everywhere else on the site (grey panel +
  icon), for both tops (rare now) and subs (common).
- **Error** (tree fails to load) — the panel shouldn't open into a broken half-rendered state;
  either don't open, or show a minimal "couldn't load categories" line with no dead controls.
- **📱 No hover on touch/mobile — do not attempt to replicate this interaction there.** Below the
  breakpoint where the mobile hamburger menu takes over, "Categories" simply stays a normal link
  to `/categories` (already a well-built, dedicated browsing page for exactly this case) — no
  attempt at a tap-cascade mega-menu on a phone screen. Confirm this explicitly in your delivery
  rather than leaving mobile behaviour unstated.

---

## 5 · Non-negotiable constraints

- **Accessibility is not optional here — see §3 in full.** Keyboard equivalence, visible focus
  states throughout, `aria-expanded`/`aria-haspopup` semantics, Escape to close, focus returns to
  the trigger on close.
- **Every tile is a real link** (`/category/:slug`), never a click-to-reveal-only element with no
  underlying `href`.
- **No search/filter control inside the menu** — this is navigation, not Module 3's discovery
  search; keep it to "browse the tree," nothing more.
- **Mobile gets no bespoke version of this pattern** — see §4's mobile note.
- **No dead/fake data** — every tile must be a real category from the live tree.

---

## 6 · Deliverables

1. **At least 2 panel-layout treatments** (§1), each shown: closed state (just the nav bar),
   level-1 open (40 tops), level-2 open (a top hovered, its subs showing).
2. The loading state and the no-subs state from §4.
3. A visible keyboard-focus walkthrough (at minimum: focused nav item → focused first tile →
   focused sub-tile), confirming §3's keyboard path is real, not assumed.
4. Explicit confirmation of the mobile behaviour (§4) — don't leave it unstated.
5. **Self-check with delivery:** every hex used appears verbatim in the COLOUR section; no heavy
   scrim/blur behind the panel; every tile is a real `<a>`-equivalent link; the panel is reachable
   and operable by keyboard alone; nothing about the 40-tile layout reads as cramped or dumped
   (the RESTRAINT section above).

---

## Notes for whoever runs this prompt

- No new backend data — this reads the exact same `GET /categories` tree the `/categories` page
  already uses. Whether the app pre-fetches that tree on load (so the first hover is instant) or
  fetches it on first hover (simpler, but risks a loading flash — see §4) is an implementation
  call, not a design one; just design the loading state either way needs.
- `/categories` itself is explicitly OUT of scope for this prompt — don't propose changes to that
  page here; it was just redesigned (2026-08-11) and stays as-is as the mega-menu's real
  destination and the mobile fallback.
- This only touches the "Categories" nav item. The other nav items (How it Works / Platform /
  FAQ — landing-page anchors) are unaffected and out of scope.
