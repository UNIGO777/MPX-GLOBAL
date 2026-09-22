# MPX Global — project map

What this project is, what was built, and **where each thing lives**. Written to
be the file a new developer (or a fresh session) opens first.

Companion documents: `History.md` is the dated log of *why* things changed;
`scope-of-work.md` is the contracted scope; this file is the *where*.

---

## 1 · What it is

A B2B import/export **discovery marketplace** — international buyers find verified
Indian exporters, browse their catalogue, send enquiries and chat with them.

**Phase 1 is discovery and trust. No money moves through the platform.** Escrow,
payouts and contracts are Phase 2 and are deliberately not built; their models
exist only as untouched placeholders.

One backend serves three clients: a public website, a buyer/exporter web portal
with an admin console, and a mobile app.

---

## 2 · Repo layout

| Path | What it holds |
|---|---|
| `MPX-BACKEND-FULL-SAAS/` | The API — Node + Express + MongoDB. 178 files, ~18,800 lines |
| `web/` | The web client — React + Vite + Tailwind. 154 files, ~33,400 lines |
| `app/` | The mobile app — React Native + Expo. 101 files, ~19,300 lines |
| `docs/` | Plans, decisions, guards, history (§7) |
| `.claude/rules/` | Standing engineering rules, auto-loaded per area (§8) |
| `build-plans/` · `modules-in-detailed/` | Per-milestone build specs, m1 → m6 |
| `design-plans/` | Design briefs, mockups and the brand assets |

---

## 3 · Backend — `MPX-BACKEND-FULL-SAAS/src`

**111 endpoints across 10 route files. 1,026 automated tests in 71 files.**

### Layers, in request order

| Folder | Files | Responsibility |
|---|---|---|
| `routes/` | 10 | URL → middleware → controller. Every route declares its permission |
| `middleware/` | 9 | `authenticate`, `authorize`, validation, rate limits, Mongo-operator rejection, error handler |
| `validators/` | 19 | zod schemas. Unknown keys stripped, never passed through |
| `controllers/` | 23 | Thin — unpack the request, call a service, shape the response |
| `services/` | 48 | All the business logic (§3.2) |
| `models/` | 39 | Mongoose schemas + `enums.js`, the single source for every status list |
| `views/` | 6 | Public/admin projections — what a response is *allowed* to contain |
| `config/` | 6 | `env.js` (validated at boot), `permissions.js` (the grantable catalogue) |
| `realtime/` | 1 | `socket.js` — Socket.io rooms, chat delivery, push suppression |
| `seed/` | 4 | `superadmin.js`, `catalogue.js`, `test-accounts.js` |
| `jobs/` | 1 | Scheduled cleanup |
| `utils/` | 10 | `AppError`, `errorCodes`, logger, slug, masking, `toPublic` |

### Services worth knowing by name

- **Auth** — `auth.service` · `otp.service` · `otp.sender` (SMS/email routing) ·
  `token.service` · `password.service` · `twofactor.service` (built, on hold)
- **Verification / KYC** — `kyc.service` · `kyc.storage.service` (private, signed
  URLs) · `verification.service` · `organisation.service`
- **Catalogue** — `product.service` · `category.service` · `image.storage.service`
- **Search** — `search.service` · `search.query` · `facets.service` ·
  `aiSearch.service` · `ai.client` · `aiQuota.service` · `didYouMean.service` ·
  `searchSync.service` · `seo.service`
- **Enquiry & chat** — `inquiry.service` · `conversation.service` ·
  `message.service` · `conversationFreeze.service` · `conversationSearch`
- **Notifications** — `push.service` · `push.client` (FCM) ·
  `emailNotifications.service` · `email.provider` · `sms.provider`
- **Admin** — `adminOrgs` · `adminProducts` · `adminConversations` ·
  `userManagement` · `orgBlock` + `orgBlockCascade` · `dashboard` ·
  `audit.service` + `auditViewer` · `errorLogViewer` · `featured.service`

### The five files that carry the most weight

| File | Why |
|---|---|
| `config/env.js` | Every setting, validated at boot. A bad config fails to start rather than misbehaving |
| `config/permissions.js` | The grantable permission catalogue. Governance actions are deliberately absent — they are role-gated, never grantable |
| `models/enums.js` | Every status list. Change a status here or nowhere |
| `utils/toPublic.js` + `views/` | What the public is allowed to see. The guard against leaking KYC, contact details or internal state |
| `realtime/socket.js` | Live chat, room membership, and the "who is watching" signal push suppression depends on |

---

## 4 · Web — `web/src`

**46 pages, 55 routes.** `App.jsx` is the route map; the admin console is a
separately loaded bundle so a public visitor never downloads it.

| Area | Pages | Where |
|---|---|---|
| **Public** | Landing, Categories, Category listing, Product, Supplier profile, Search, AI search, Legal (terms + privacy), 404 | `pages/public/` |
| **Auth** | Sign in, staff sign in, buyer/exporter signup, OTP, signup verify, signup company, forgot, reset, change password | `pages/auth/` |
| **Buyer** | Verification status, KYC upload, saved items | `pages/buyer/` |
| **Exporter** | Products, product form, verification status, KYC upload | `pages/exporter/` |
| **Shared** | Company profile (both sides, one file) | `pages/account/` |
| **Chat** | Inbox + the dock | `pages/chat/`, `chat/` |
| **Admin** | Users, employees, organisations + detail, verification queue, KYC viewer, categories, attributes, product monitoring, conversations + viewer, audit log, error log, featured, dashboard | `pages/admin/` |

Supporting: `components/ui/` (the design primitives), `components/catalogue/`
(product cards, price line, filters), `components/public/` (header, footer,
mega-menu), `auth/` (context, route guards, `roleHome`), `api/` (one client per
domain), `lib/` (seo, countries, formatting).

---

## 5 · Mobile app — `app/src`

**34 screens.** `navigation/` decides what a signed-in role sees:
`RootNavigator` → `AuthNavigator` or `BuyerNavigator` / `ExporterNavigator`.

| Area | Screens |
|---|---|
| **Auth** | Splash, Welcome, Login, Signup (account → verify → company), OTP, Forgot, Reset |
| **Buyer** | Home, Search, Category browse + products, Product detail, Supplier profile, Saved, AI search, Enquiry form |
| **Exporter** | Home, My products, Product form, Category picker |
| **Chat** | List, Thread |
| **KYC** | Verification hub, prompt, entity type, document type, capture |
| **Profile** | Profile, Company profile, Change password |

Supporting: `api/` (mirrors the web's clients), `realtime/socket.js`,
`push/push.js` (FCM registration), `context/AuthContext.jsx`, `theme/`,
`components/`, `config/env.js` (refuses a non-HTTPS URL outside local dev).

---

## 6 · What was built, milestone by milestone

| Milestone | Delivered | Notes |
|---|---|---|
| **M1 · Auth** | Separate buyer/exporter portals, two-step signup with **both** email and mobile verified, OTP, staff login, password reset, company profile, KYC upload + review | Organisation **claim** is not built — see §9 |
| **M2 · Catalogue** | Categories + attributes, product CRUD, images, the 3-active/10-draft cap for unverified sellers, moderation takedown/restore | |
| **M3 · Search** | Native `$text` search, facets, filters, SEO surfaces, **AI search** with per-org quota and a guest ceiling, saved items | Atlas `$search` is not available — the DB is self-hosted |
| **M4 · Enquiry & chat** | Enquiries, real-time chat over Socket.io, freeze/unfreeze, admin monitoring, **FCM push** | Quotation is **not** part of this — it is deferred |
| **M5 · Admin** | Users, employees + permissions, organisations, verification queue, KYC viewer, product monitoring, conversation viewer, audit log | |
| **M6 · Finalize** | Dashboard, featured landing content, error log viewer | Platform settings still pending — §9 |
| **Verification redesign** | Pending profile changes, document rounds, staff document requests, revocation | Web first, app brought to parity later |

---

## 7 · Documents — which file answers which question

| Question | File |
|---|---|
| What are we contracted to build? | `docs/scope-of-work.md` |
| What is deliberately **not** in month 1? | `docs/month1-not-doing.md` |
| What is guarded / on hold, and why? | `docs/Note.md` (the D-items) |
| What changed, when, and what broke? | `docs/History.md` |
| What is rendered but not wired up? | `docs/UiWebNotes.md` |
| How do I deploy this? | `docs/Deployment.md` |
| How do I test it by hand? | `docs/Testing-App.md`, `docs/Testing.md` |
| What do we need from the client? | `docs/Client-Requests.md` |
| What logins do I give the client? | `docs/Demo-Accounts.md` |
| What was the original build spec? | `docs/MPX-M2-M3-Build-Prompt.md`, `build-plans/`, `modules-in-detailed/` |
| Which security control has which ID? | `docs/security-tracker.xlsx` |

---

## 8 · Engineering rules — `.claude/rules/`

Five load in **every** session: `scope-guard.md` (do not build deferred or
out-of-scope work), `remind.md` (the D-item guard), `security-baseline.md`,
`secrets-and-hygiene.md`, `history-log.md`.

The rest load when the matching files are touched: `auth-sessions.md`,
`api-endpoints.md`, `m3-public-projection.md`, `m3-seo.md`, `mobile-app.md`,
`web-frontend.md`, `web-design.md`, `web-ui-notes.md`, `payments-escrow.md`,
`contracts-esign.md`.

`CLAUDE.md` sits above all of them and outranks any plan document.

---

## 9 · What is **not** built — and that is deliberate

| Item | Status | Where it is recorded |
|---|---|---|
| Escrow, payouts, contracts, orders, shipments | **Phase 2** — models are untouched placeholders | `month1-not-doing.md` Bucket B |
| Quotation & negotiation | Deferred past month 1 | Bucket A1 |
| Organisation **claim** at signup | Deferred — one company signing up twice gets two orgs today | `Note.md` **D7** |
| Platform settings screen | Deferred to month 2 — still `<ComingSoon>` | `Note.md` **D8** |
| Super admin TOTP 2FA | Built but on hold; staff use OTP (still two-factor) | `Note.md` **D4** |
| WhatsApp, in-app notification centre, admin notification controls | Deferred; FCM push and a defined set of emails were carved in | `Note.md` **D5** |
| Employee-only pieces — tickets, enquiry routing, internal notes | Deferred; the ticket decision is still open | Bucket A2 |
| Automated KYC document checking | Deferred — verification is a person reading documents | Bucket A6 |

---

## 10 · Running it locally

```
Backend   cd MPX-BACKEND-FULL-SAAS && npm run dev        # needs Mongo + Redis
Web       cd web && npm run dev                          # proxies /api → :3000
App       cd app && npx expo start
Tests     cd MPX-BACKEND-FULL-SAAS && npm test           # 1,026 tests
Seed      npm run seed · npm run seed:catalogue · npm run seed:test-accounts
Indexes   npm run indexes:sync                           # required on every deploy
```

Demo logins for all four panels: `docs/Demo-Accounts.md`.
