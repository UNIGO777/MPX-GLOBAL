# Web UI — Non-operational elements ledger

> **Rule:** `.claude/rules/web-ui-notes.md` (STRICT). **Every** rendered button, link, form,
> toggle, tab, filter, menu item or control that is **not yet wired to real behaviour** MUST be
> logged here — in the same change that creates it. No exceptions, nothing too small to skip.
>
> When you wire an element up, set its **Status → Done** (or delete the row). Keep this honest.
> Prefer not shipping dead controls at all; if a placeholder must exist, make it visibly
> non-final (`disabled` / "coming soon") so no user thinks it works.

Status legend: **Pending** = renders but does nothing real · **Done** = wired to real behaviour.

| Date | Page / Component | Element (label) | What's missing / expected behaviour | Why deferred | Status |
|------|------------------|-----------------|-------------------------------------|--------------|--------|
| 2026-08-03 | `web/src/pages/auth/SignupCompany.jsx` + `app/src/screens/auth/SignupCompanyScreen.jsx` | Organisation **claim** path (A21 "we found a company registered with this email") | Offer claim-vs-create against an existing Organisation; a claimed org carries its verification over (one KYC, one tick, one public profile) | No backend endpoint — `/auth/signup/complete` always CREATES. Claim is the remaining half of A21 and was out of scope for the verification fix | Pending |
| 2026-08-01 | `web/src/App.jsx` → `pages/Placeholder.jsx` | `/` root route ("Landing — arrives in build step 7") | Renders the real landing page (`pages/public/Landing.jsx`) | Screens land per build-plan §6 order; landing is step 7 | Done (step 7 shipped; Placeholder.jsx deleted) |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` hero | Hero search bar | Real `GET /public/search` once discovery screens ship | Visibly decorative (`aria-hidden`, non-interactive spans, "Search preview — opens with the catalogue" caption) | Pending |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` categories | Category group lists + "View all categories" | Category links → real browsable catalogue tree (M2/M3 web screens) | Rendered as STATIC text (no anchors — no dead links) + "Category browsing opens with the catalogue" note | Pending |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` mobile-app section | Google Play / App Store badges | Real store links once the apps are published | Rendered `aria-disabled` with "Coming soon on" labels — not clickable | Pending |
| 2026-08-03 | `web/src/pages/auth/BuyerSignup.jsx` | "Terms of Service" / "Privacy Policy" in the closing fine print | Link to the real legal pages | Those pages do not exist; rendered as PLAIN TEXT (not links) so there is no dead anchor. Design shows them as links — restore the anchors when the pages ship | Pending |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` footer | Company / Resources / Legal columns (About, Careers, Contact, Blog, Help Center, Trade Guides, Privacy, Terms) | Real pages | Rendered as static muted text, NOT links (no dead anchors). ⚠️ Privacy Policy + Terms pages will be needed before launch | Pending |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` | Testimonials section (mockup had 6 cards) | Real customer quotes | **DELIBERATELY NOT BUILT** — the mockup's testimonials were fabricated people praising unbuilt features (escrow, shipments, analytics). Publishing fake testimonials on a live page is a trust/legal problem. Add the section back when real quotes exist | Pending (owner decision) |
| 2026-08-01 | `web/src/App.jsx` → `pages/Placeholder.jsx` | `/signin/staff` route (linked from SignIn footer "Staff sign-in") | Renders the real staff sign-in page (`pages/auth/StaffSignIn.jsx`) hitting `POST /auth/staff/login` | Staff auth pair is build-plan step 3; the party pair (step 2) shipped first | Done (step 3 shipped same day) |
| 2026-08-01 | `web/src/pages/buyer/buyerNav.js` → `layouts/PortalLayout.jsx` sidebar | "Search suppliers" item | Buyer-side M3 discovery search screen | M3 web screens are outside the M1 set; rendered disabled with a "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/buyer/buyerNav.js` → `layouts/PortalLayout.jsx` sidebar | "Enquiries" item | Buyer enquiry list (M4) | M4 web screens are outside the M1 set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/buyer/buyerNav.js` → `layouts/PortalLayout.jsx` sidebar | "Chat" item | Buyer chat threads (M4) | M4 web screens are outside the M1 set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/buyer/buyerNav.js` → `layouts/PortalLayout.jsx` sidebar | "Settings" item | Account settings (change password etc. — A22-adjacent) | No M1 mockup/screen for party settings. Design file shows Settings WITHOUT a Soon badge, so it renders dimmed + non-interactive (`disabled`) | Pending |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Dashboard" item | Exporter dashboard (later milestone) | Outside the M1 web set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Products" item | Exporter catalogue management (M2 web screens) | Outside the M1 web set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Enquiries" item | Exporter enquiry list (M4) | Outside the M1 web set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Chat" item | Exporter chat threads (M4) | Outside the M1 web set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Settings" item | Account/company settings (A22 company profile edit) | A22 endpoints unbuilt. Design shows no Soon badge → dimmed + non-interactive (`disabled`) | Pending |
| 2026-08-01 | `web/src/layouts/AdminLayout.jsx` sidebar → `pages/admin/ComingSoon.jsx` | "Dashboard" item (sidebar) | Real dashboard screen (backend GET /admin/dashboard exists — M5) | Outside the M1 web set. Per the design file this row is non-interactive with a SOON badge — it no longer links to `/admin/dashboard` (that route still renders ComingSoon if reached directly) | Pending |
| 2026-08-01 | `web/src/layouts/AdminLayout.jsx` sidebar → `pages/admin/ComingSoon.jsx` | "Audit log" item (sidebar) | Real audit viewer screen (backend GET /admin/audit exists — M5-C) | Outside the M1 web set. Design makes this row non-interactive with a SOON badge — no longer links to `/admin/audit` (route still renders ComingSoon if reached directly) | Pending |
| 2026-08-01 | `web/src/layouts/AdminLayout.jsx` sidebar → `pages/admin/ComingSoon.jsx` | "Settings" item + `/admin/settings` route | Platform settings screen (no backend yet) | Design shows Settings as a real link with no badge → it routes to the designed ComingSoon page | Pending |
| 2026-08-01 | `web/src/pages/admin/Employees.jsx` | Permissions column "—" + edit drawer opening unticked | Show the employee's CURRENT permission set after a reload | ✅ **DONE 2026-08-04** — owner approved the read; `GET /admin/users` now returns each employee's set to a superadmin, so the column fills and the drawer pre-ticks | Done |

### 📱 Mobile app — M1 auth screens (2026-08-02)

**Every control rendered on the seven app auth screens is wired to a real endpoint** — there
are no dead buttons to log. The rows below record controls that appeared in the approved
**mockups** but were deliberately **NOT built**, so the decisions are not lost.

| Date | Page / Component | Element (label) | What's missing / expected behaviour | Why deferred | Status |
|------|------------------|-----------------|-------------------------------------|--------------|--------|
| 2026-08-02 | `app/src/screens/auth/LoginScreen.jsx` | "SSO" button (in mockup) | Enterprise SSO sign-in | **NOT BUILT** — no SSO/OAuth in Phase 1 scope and no backend endpoint. Would be a scope change | Not built (owner decision) |
| 2026-08-02 | `app/src/screens/auth/LoginScreen.jsx` | "Biometric" button (in mockup) | Biometric sign-in | **NOT BUILT — deliberately.** `auth-app-steps.md` Step 6: biometrics gate app RE-ENTRY only and "a biometric success must never issue or extend a token on its own". A biometric button on a *fresh sign-in* screen implies exactly that. The re-entry unlock is still planned for the Profile screen | Not built (rule conflict) |
| 2026-08-02 | `app/src/screens/auth/SignupAccountScreen.jsx` | "Google" / "Apple" social signup buttons (in mockup) | Social signup | **NOT BUILT** — no social auth in Phase 1 and no backend endpoint | Not built (owner decision) |
| 2026-08-02 | `app/src/screens/auth/LoginScreen.jsx` | "Request Access" link (in mockup) | Buyer account request | **NOT BUILT** — implies a buyer approval gate. `docs/Note.md` **D3** guards against any buyer activation gate; a buyer is fully active from signup. Replaced with "Create account" | Not built (D3) |
| 2026-08-02 | `app/src/screens/auth/LoginScreen.jsx` | "Secured by MPX Global 256-bit encryption" badge (in mockup) | — | **NOT BUILT** — an unverifiable marketing security claim. TLS is already enforced (G6); a badge asserting a specific cipher strength is not something the app can honestly attest | Not built |
| 2026-08-02 | `app/src/screens/auth/SignupAccountScreen.jsx` | "I agree to the Terms of Service and Privacy Policy" checkbox (in mockup) | Record consent at signup | **NOT BUILT** — no backend field stores consent and no Terms/Privacy pages exist yet, so the checkbox would be theatre. ⚠️ **Owner decision needed before launch**: consent capture is usually a legal requirement | Pending (owner decision) |
| 2026-08-02 | `app/src/screens/auth/SignupCompanyScreen.jsx` | Screen 8 **Path A · Claim an existing company** | "We found a company registered with this email" card → claim vs create new | 🔴 **BLOCKED — no backend.** There is no organisation lookup or claim endpoint (`auth.routes.js` has neither). Separately, the path as specified is an **account-enumeration surface**: it confirms to an anonymous caller that a company is registered to a given email. Needs an owner decision on the disclosure before it is designed, let alone built. Only Path B (create new) ships | Pending (blocked + needs security decision) |

---

## 🔧 Recommended backend follow-ups (owner-approved to LOG, not build — 2026-08-01)

Neither blocks the M1 web build; both were decided during plan approval. **Do not build
either without a separate owner go-ahead** (both touch auth/permissions surfaces).

1. ✅ **DONE 2026-08-03 — Refresh-token httpOnly cookie (plan §7.1).** Built to an
   owner-approved plan in ordered phases. The refresh token is now an **httpOnly,
   SameSite=Lax, `Path=/auth` cookie** (Secure in production) and is **omitted from the
   response body for browsers**; the web app keeps only the access token in memory and
   silently restores the session on load via `POST /auth/refresh`. A hard reload no longer
   signs anyone out. 🔴 **Native clients still receive the body token** — the transport is
   deliberately dual because Expo cannot use httpOnly cookies; see `auth-sessions.md` A2 and
   `tests/a2-refresh-cookie.test.js`. Closes tracker **A2** for web.
2. ✅ **BUILT 2026-08-04 (owner-approved) — Employee current-permissions read (plan §7.2).**
   `GET /admin/users` now includes each employee's granted `permissions`, **for a SUPERADMIN
   caller only**. The role is re-checked in the controller rather than inferred from the route,
   because the route's own guard is `user:read` — a grant an employee can hold, so routing alone
   would have leaked one employee's permissions to another. The Employees screen shows the real
   set and its edit drawer opens pre-ticked; the "saving replaces the whole set" warning stays,
   because PATCH replaces rather than merges.

---

## ⚠️ API contract changes the web screens must follow

Backend response shapes that changed after the web was designed. A screen still reading the OLD
field will break silently.

### 2026-07-31 · M3 Discovery — new public endpoints the web/app can now call

All are **public** (guests included); login is needed only to save.

| Endpoint | Notes for the frontend |
|---|---|
| `GET /public/search` | `q` · `type=product\|supplier` · `category` · `seller` · `country` · `currency` (default INR) · `priceMin/priceMax` · `onRequest=true` · `moqMin` · `goodsOrService` · `verifiedOnly=true` · `sort=relevance\|newest\|priceAsc\|priceDesc` · `page`/`pageSize` (≤100) · **attribute filters use BRACKETS**: `attr[gsm]=140`, `attr[gsm][min]=100&attr[gsm][max]=150`, `attr[material]=Cotton,Silk` (OR within a key). ⚠️ **Dotted params like `attr.gsm` are rejected with 400** — always brackets. Response: `{ type, products[], total, page, pageSize, didYouMean }` |
| `GET /public/facets` | Takes the **same params** as search. Returns `{ category[], country[], goodsOrService[], verified[], price{min,max,currency}, moq{min,max}, attributes[] }`. Counts for a group ignore that group's own selection, so a filtered option list never collapses to zeros |
| `POST /search/ai` | Body `{ query }` (2–500 chars). Returns `{ answer, extracted, fallback, type, products[]/suppliers[], total, didYouMean }`. **`fallback: true` means the AI step failed and these are plain keyword results — render them normally, no error state.** Guests allowed |
| `GET /saved` · `POST /saved` · `DELETE /saved/:id` | **Buyer accounts only** (401 for guests, 403 for exporters/staff). `POST` body `{ targetType: 'product'\|'supplier', targetId }`; duplicate → **409**. `GET` returns `{ items[], total, page, pageSize }`, each item carrying `available` + `unavailableReason` — **an unavailable item is still listed, greyed, not removed** |
| `GET /sitemap.xml` · `GET /robots.txt` | Generated from `PUBLIC_WEB_URL`. **Deployment must reverse-proxy these two from the web domain to the API**, otherwise crawlers never see them |

**Supplier mode is narrow by design:** with `type=supplier` the product-only params
(`category`, `seller`, `priceMin/Max`, `moqMin`, `onRequest`, `goodsOrService`, `attr[...]`,
`sort=price*`) return **400**, naming the offending parameter.

### 2026-07-31 · `GET /exporters/:id` now accepts a SLUG too

The public seller endpoint takes **an ObjectId or the organisation's `slug`** —
`GET /exporters/textilehub-exports` returns exactly the same payload as `GET /exporters/<id>`.
This is what lets the SEO route `/supplier/:slug` fetch its data (product and category detail
already worked this way). **No breaking change** — existing id calls are unaffected, and the
response field set is unchanged.

### 2026-07-30 · Auth responses curated + admin sides fix (code audit fixes)

1. **`POST /auth/buyer/signup`, `/auth/exporter/signup`, `/auth/verify-otp`** — the `user` object is
   now a **curated view**: `{ id, name, email, mobile, role, orgId, isActive, mustChangePassword }`.
   Changes a screen must follow: read **`user.id`** (there is no `_id`), and **`user.mobile` is now
   the e164 string** (was the `{ countryCode, number, e164 }` object). Internal fields
   (`tokenVersion`, `isEmailVerified`, `permissions`, timestamps) are no longer returned.
2. **`POST /auth/exporter/signup` no longer accepts `businessProfile`** (registrationNumber / taxId /
   establishedYear) — the field is stripped at the boundary (A5: captured at verification, not
   signup). Do not build a signup input for it.
3. **`GET /admin/users/:id`** — `user.org.buyerSide` / `exporterSide` used to be **always `false`**
   (populate bug); they now carry real values. A screen written against the buggy shape would have
   shown every company as side-less.
4. **KYC upload (`POST /me/kyc/documents`)** — new **409** case: "Document limit reached" once an
   organisation holds 20 stored documents.

### 2026-07-30 · A21 · `organisation.type` → `buyerSide` / `exporterSide`

`Organisation.type` is no longer `buyer`/`exporter` (it is now `business`/`platform`, and NOT a
buyer-vs-exporter discriminator). Three response shapes **dropped `type` and now return two
booleans `buyerSide` + `exporterSide`** instead. Update any screen that read `org.type` to decide
buyer-vs-exporter — read the flags:

| Endpoint(s) | Object | OLD field | NEW fields |
|---|---|---|---|
| `POST /employee/buyers/:id/approve\|reject`, `POST /employee/exporters/:id/verify\|reject` | `organisation` | `type: 'buyer'\|'exporter'` | `buyerSide`, `exporterSide` (booleans) |
| `GET /admin/users`, `GET /admin/users/:id` | `user.org` | `type` | `buyerSide`, `exporterSide` |
| `GET /employee/orgs/:id/kyc/documents` | top-level | `type` | `buyerSide`, `exporterSide` |

(One company may have both sides true — a screen must not assume exactly one.)
