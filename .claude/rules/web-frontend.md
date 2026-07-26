---
paths:
  - "web/**/*.{js,jsx,ts,tsx}"
  - "frontend/**/*.{js,jsx,ts,tsx}"
  - "client/**/*.{js,jsx,ts,tsx}"
  - "**/[Pp]ages/**/*.{jsx,tsx}"
  - "**/[Cc]omponents/**/*.{jsx,tsx}"
  - "**/[Hh]ooks/**/*.{js,jsx,ts,tsx}"
  - "**/*.web.{js,jsx,ts,tsx}"
---

# Web frontend (React + Tailwind)

The web app is a **UI layer over the same APIs** the mobile app uses — it never becomes a
second source of truth. The server re-checks every request; the client only *renders*.
Escrow/payments/contracts are Phase 2, but this is a payments-adjacent platform — build the
frontend to that standard from day one.

## Trust boundary — the client never decides (A5, and CLAUDE.md #5)

- **Permissions come from the server.** Render the employee panel's modules (verification,
  buyer-approval, chat-monitoring, etc.) from a server-supplied permission list. A hidden
  button is not access control — every action re-authorises server-side.
- **Role-based routing is UX, not security.** `<ProtectedRoute>` redirects for a nicer
  experience; it is never the thing that protects data. Assume any route can be hit directly.
- Never read a role or permission from client state to *grant* access — only to *hide/show*.

## Token storage (A2)

- **Access token in memory only** (a JS variable / context) — never `localStorage` or
  `sessionStorage`; an XSS then reads it.
- **Refresh token in an `httpOnly`, `Secure`, `SameSite` cookie** — JS must not be able to
  read it. This matches the quote's "secure token storage".
- On 401, the central API client attempts one silent refresh-and-retry, then logs out. No
  token, OTP, password or KYC value is ever written to state, storage, a URL or the console.

## XSS & untrusted content (new web control — tell owner for a tracker ID)

Seller descriptions, company profiles, chat messages, enquiry text are all user-generated.
- Rely on React's default escaping. **`dangerouslySetInnerHTML` is banned** — if HTML must
  render, sanitise with `DOMPurify` first, no exceptions.
- Never build a URL, redirect target or `href` from unsanitised user input (`javascript:`).
- Render user content as text; never `eval`, `new Function`, or template it into markup.

## Secrets & third-party keys (CLAUDE.md #3, secrets-and-hygiene)

- The frontend bundle is **public**. No secret, API key or private config ever ships in it.
  Only `VITE_`-prefixed, genuinely-public values (e.g. API base URL) belong in the web `.env`.
- **The OpenAI key never leaves the backend.** AI-search calls go through our own API, which
  proxies OpenAI server-side (also where the per-org quota/rate-limit lives). No LLM call from
  the browser, ever.
- Strip `console.*` and don't publicly serve sourcemaps in production builds.

## API layer — one centralised client

- A single `apiClient` (fetch/axios wrapper) with interceptors: attach the access token,
  handle 401→refresh→retry once, and funnel errors through one place. Components never call
  `fetch` directly.
- Use **TanStack Query** (React Query) for all server data — caching, retries, stale handling,
  optimistic updates. Lists like enquiries, chat, verification queue live here, not in a
  global store. (Adding React Query is a new dependency — flag it, it's the market standard.)

## State management — deliberate, not accidental

- **Server state ≠ client state.** Server data (products, enquiries, chats, verification
  status) belongs in the query cache. Only genuinely local UI state (modals, form drafts,
  toggles) lives in component state.
- Keep global client state **minimal**. Do not reach for Redux/Zustand/MobX by reflex —
  CLAUDE.md forbids adding a state manager beyond what's listed without asking first. If you
  think one is truly needed, stop and ask, with the reason.
- **No stale/duplicate sources of truth.** One piece of data has one owner. Derive, don't copy.
- Reset sensitive state on logout — the entire auth/query cache is cleared so no previous
  user's data survives in memory.

## Validation — mirror on the client, authoritative on the server (api-endpoints)

- Validate every form (signup, product add, quotation) client-side for UX. Share the same
  `zod` schema with the server where practical, but the **server validation is authoritative** —
  never assume the client validated.
- **Money is payments-adjacent even here.** Quotation amounts, unit price, currency, MOQ:
  never do float math for money, keep amounts as integer minor-units or strings, validate
  currency against an allowlist, and format for display only at the edge. This keeps Phase 2
  escrow clean.

## Real-time chat (Socket.io)

- The socket connection **authenticates on the handshake** (JWT) — the client sends the token;
  the server verifies and scopes rooms. A buyer joins only their own conversations; an employee
  joins a thread only with `chat-monitoring` permission. The client never self-selects a room
  it isn't entitled to.
- Handle reconnect and message de-duplication (mobile networks drop); pair optimistic sends
  with server acks.

## Clean, production-grade code (always — not "later")

This is the standard for *every* change, not a cleanup pass:
- **ES modules, async/await, named exports.** No `.then()` chains, no default-export sprawl,
  no callback style. One responsibility per file; feature-folders (`features/auth`,
  `features/catalogue`, `features/chat`, …).
- **No dead code, no commented-out blocks, no `console.log`** in committed code — use a proper
  logger/telemetry wrapper. No `TODO` left silent — either do it or tell the owner it's a gap.
- **Handle every async state**: loading, empty, and error are designed states, not blank
  screens or unhandled rejections. Never swallow an error with an empty `catch {}`.
- **Accessibility and types are part of "done"**, not polish — see `web-design.md`.
- Prefer the **smallest change that works**; don't refactor adjacent code unless asked
  (CLAUDE.md). Match the surrounding file's style, naming and structure.
- **No new dependency without telling the owner first** and saying why.
- Keep components small and composable; extract a hook when logic repeats. Don't prematurely
  abstract — duplicate twice before you generalise.

## Never

- A token, OTP, password or KYC value in `localStorage`, state, a URL, or the console
- `dangerouslySetInnerHTML` (sanitised or not — banned) or `eval`/`new Function`
- Any secret or the OpenAI key in the frontend bundle or a browser-side API call
- A permission/role decision that *grants* access from client state
- `fetch` scattered in components instead of the central API client
- A new state manager (Redux/Zustand/…) added without asking the owner
- Server data copied into a second store as its own source of truth
- An `empty catch {}`, a committed `console.log`, or a route/list with no loading & error state
