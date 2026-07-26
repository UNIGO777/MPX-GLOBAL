---
paths:
  - "web/**/*.{jsx,tsx}"
  - "frontend/**/*.{jsx,tsx}"
  - "client/**/*.{jsx,tsx}"
  - "**/[Pp]ages/**/*.{jsx,tsx}"
  - "**/[Cc]omponents/**/*.{jsx,tsx}"
---

# 🔴 Non-operational UI must be logged — STRICT, no exceptions

Every interactive element that is rendered but **not yet wired to real behaviour** MUST be
recorded in **`docs/UiWebNotes.md`** in the same change that creates it. This is a hard rule,
not a suggestion. **Every** — no element is too small to skip.

## What counts as non-operational (log ALL of these)

- A **button** with no handler, a no-op handler, a `TODO`, an `alert('coming soon')`, or one
  that only does something cosmetic (opens a modal that itself does nothing).
- A **link / `<a>` / `<Link>`** pointing to `#`, `/`, a dead route, a `void(0)`, or a page
  that doesn't exist yet.
- A **form / input / toggle / dropdown / tab / filter / menu item / icon-button** that renders
  but doesn't perform its real action, doesn't submit, or isn't connected to an API.
- Anything visually present that a user could reasonably click/tap expecting an effect and
  **nothing real happens**.

If you are unsure whether something is "operational enough" — **log it.** Over-logging is fine;
a silently dead control is not.

## The rule when you build UI

1. Prefer to **not ship dead controls** at all — build the behaviour, or don't render the
   element yet.
2. If a placeholder control genuinely must exist (scope/dependency not ready), then **in the
   same commit**:
   - Add a row to `docs/UiWebNotes.md` (format below), and
   - Make it visibly non-final in the UI (e.g. `disabled` or a "coming soon" state) so no user
     thinks it works — never a live-looking button that silently does nothing.
3. When you later wire it up, **update that row** (set Status → Done, or remove it). Keep the
   ledger honest.

## `docs/UiWebNotes.md` row format

One row per non-operational element:

| Date | Page / Component | Element (label) | What's missing / expected behaviour | Why deferred | Status |

- **Page / Component** — file path + component, e.g. `web/features/catalogue/ProductCard.jsx`.
- **Element** — the visible label, e.g. `"Save supplier" button`.
- **Expected behaviour** — what it should do when done.
- **Status** — `Pending` until wired, then `Done` (or delete the row).

## Also tell the owner

When you leave any control non-operational, **say so plainly in your reply** (list them) — a
silent gap is worse than a known one (CLAUDE.md). The `docs/UiWebNotes.md` entry is the record;
the reply is the heads-up.

## Never

- A rendered button/link/control that does nothing and is **not** in `docs/UiWebNotes.md`
- A live-looking control that silently no-ops (must be `disabled` / clearly "coming soon")
- Marking a row `Done` when the behaviour isn't actually wired to the real API
