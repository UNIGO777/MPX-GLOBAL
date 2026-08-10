---
paths:
  - "web/**/*.{jsx,tsx,css}"
  - "frontend/**/*.{jsx,tsx,css}"
  - "client/**/*.{jsx,tsx,css}"
  - "**/[Pp]ages/**/*.{jsx,tsx}"
  - "**/[Cc]omponents/**/*.{jsx,tsx}"
  - "**/*.{css,scss}"
  - "**/tailwind.config.{js,ts,cjs}"
---

# Web design & UI standards

The quote sells a **"crystal-clear, high-tech, modern, confident"** product — the super-admin
dashboard is explicitly the stakeholder showcase surface. Design quality is a deliverable here,
not decoration. These are process/standard rules; brand specifics (exact palette, logo) are the
owner's call — ask before inventing a brand identity.

## Design system first — no one-off styling

- **Tailwind config is the single source of truth** for colour, spacing, typography, radius,
  shadow. Use theme tokens (`bg-primary`, `text-muted`, spacing scale) — no magic hex values
  or arbitrary `px` scattered in components. A new colour goes into the config, once.
- Build a small set of **shared primitives** (Button, Input, Card, Modal, Table, Badge,
  Toast, EmptyState, Skeleton) and reuse them. Two buttons that look different by accident is
  a bug. Don't restyle per page.
- One spacing/type scale across web. Consistency reads as "high-tech" far more than novelty.

## Responsive — desktop, tablet, mobile (quote, Module 1)

- Every page works across desktop, tablet and mobile — the quote commits to it. Design
  mobile-first, enhance up. No horizontal body scroll; wide tables/galleries scroll inside
  their own container.
- Touch targets ≥ 44px; don't hide primary actions behind hover-only affordances.

## Accessibility — WCAG AA is "done", not polish

- Semantic HTML first (`<button>`, `<nav>`, `<main>`, `<label>`); ARIA only to fill gaps.
- Every input has a real `<label>`; every image a meaningful `alt` (empty `alt=""` for
  decorative). Icon-only buttons get an accessible name.
- **Keyboard-navigable** end to end; visible focus states (never `outline: none` without a
  replacement). Modals trap focus and close on `Esc`.
- Colour contrast ≥ 4.5:1 for text. Never use colour alone to convey meaning (status,
  verified tick) — pair it with a label or icon.
- Respect `prefers-reduced-motion`.

## SEO & public pages (quote, Module 1 — "SEO-friendly")

- Landing, product and category pages are **public and must be indexable**. A pure
  client-rendered SPA won't index well — use SSR/SSG or pre-rendering for those routes.
- Per-page `<title>`, meta description, Open Graph tags, semantic headings, canonical URLs.
  Product/category pages get structured data where it fits.

## Trust signals & role UX (project-specific)

- **Verified tick, not a "not verified" badge.** Show the tick only when the server's derived
  **`verified` boolean** is true; its absence means unverified. Never gate a seller's public
  visibility behind verification in the UI — the profile is public from signup (CLAUDE.md
  Roles; `docs/scope-of-work.md`).
  🔴 **Corrected 2026-08-10 — this rule used to say "show status from `kycStatus`", and it was
  wrong in a way that could not work.** No public response contains `kycStatus`: the projection
  derives `verified` + `verifiedAt` and drops the raw status precisely so the `rejected` state can
  never leak (B7 · `Organisation.PUBLIC_DERIVED` · `m3-public-projection.md`). A screen following
  the old line would bind to a field that is never sent. **On a public surface read `verified`.**
  The owner's OWN status screens (`/buyer/verification`, `/exporter`) are the only place raw
  `kycStatus` is legitimate — that is a self-scoped read of your own organisation, not a public one.
- Verification/approval status, quotation status (sent / negotiating / accepted), enquiry
  state — always visible and unambiguous. This is a trust marketplace; ambiguity erodes it.

## Feedback & states

- **Loading, empty, error, success are designed states** on every list and action —
  skeletons over spinners for content, never a blank screen. (Enforced in `web-frontend.md`.)
- Optimistic UI where safe (chat, favourites); clear, non-technical error messages — never a
  raw server/stack message to the user.
- Destructive actions (deactivate seller, reject verification) confirm first and state the
  consequence.

## Assets & performance

- Serve images through Cloudinary with proper sizing/format; lazy-load below-the-fold media;
  always set width/height (or aspect-ratio) to avoid layout shift.
- Code-split by route; keep the initial bundle lean. Don't ship an icon set or chart lib for
  one glyph.

## Never

- Magic hex/px values instead of Tailwind theme tokens
- A bespoke one-off button/input when a shared primitive exists
- `outline: none` without a visible focus replacement
- Colour as the only signal for status or the verified state
- Gating a seller's public visibility behind verification in the UI
- A public landing/product/category page that can't be indexed (SEO is in scope)
- A blank screen where a loading, empty or error state belongs
