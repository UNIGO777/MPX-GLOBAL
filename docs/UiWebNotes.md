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
| 2026-08-07 | `web/src/pages/public/Categories.jsx` | Category cards (all 40) | Each card links to `/category/:slug` | — | Done (2026-08-09, shipped with screen 2: cards are `<Link>`, the "coming shortly" line is gone) |
| 2026-08-09 | `web/src/pages/public/CategoryListing.jsx` | Product cards on the category grid | Each card links to `/product/:slug` | — | Done (same day, shipped with screen 3) |
| 2026-08-03 | `web/src/pages/auth/SignupCompany.jsx` + `app/src/screens/auth/SignupCompanyScreen.jsx` | Organisation **claim** path (A21 "we found a company registered with this email") | Offer claim-vs-create against an existing Organisation; a claimed org carries its verification over (one KYC, one tick, one public profile) | No backend endpoint — `/auth/signup/complete` always CREATES. Claim is the remaining half of A21 and was out of scope for the verification fix | Pending |
| 2026-08-01 | `web/src/App.jsx` → `pages/Placeholder.jsx` | `/` root route ("Landing — arrives in build step 7") | Renders the real landing page (`pages/public/Landing.jsx`) | Screens land per build-plan §6 order; landing is step 7 | Done (step 7 shipped; Placeholder.jsx deleted) |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` hero | Hero search bar | Real `GET /public/search` once discovery screens ship | 2026-08-11: now a REAL link to `/categories` (quick-find lives there); full search UI still arrives with M3 web screens. 2026-08-16: superseded — now opens `AiSearchModal` directly (owner: click should go straight to AI search, not to a link); "Browse 40 categories →" split into its own separate real `Link` below the button. 2026-08-16 (later): superseded again — hero is now a real `Link` to `/search` (owner: "click the search in home hero, it lifts up and url to /search"); the sparkle badge stays as the button visual. 2026-08-16 (latest): AI search is now a dedicated PAGE — `/search`'s AI Search pill is a real `Link` to `/ai-search` (`AiSearch.jsx`; the `AiSearchModal` overlay was deleted) | Done |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` categories | Category group lists + "View all categories" | Category links → real browsable catalogue tree | — | Done (2026-08-09). ⚠️ The old groupings ("Raw Materials", "Consumer Goods") and their items were **invented** — not our taxonomy. Replaced with the 9 real top categories from `GET /categories`, each linking to `/category/:slug`, plus a "Browse all categories" button |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` mobile-app section | Google Play / App Store badges | Real store links once the apps are published | Rendered `aria-disabled` with "Coming soon on" labels — not clickable | Pending |
| 2026-08-03 | `web/src/pages/auth/BuyerSignup.jsx` | "Terms of Service" / "Privacy Policy" in the closing fine print | Link to the real legal pages | Those pages do not exist; rendered as PLAIN TEXT (not links) so there is no dead anchor. Design shows them as links — restore the anchors when the pages ship | Pending |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` footer | Company / Resources / Legal columns (About, Careers, Contact, Blog, Help Center, Trade Guides, Privacy, Terms) | Real pages | Rendered as static muted text, NOT links (no dead anchors). ⚠️ Privacy Policy + Terms pages will be needed before launch | Pending |
| 2026-08-01 | `web/src/pages/public/Landing.jsx` | Testimonials section (mockup had 6 cards) | Real customer quotes | **DELIBERATELY NOT BUILT** — the mockup's testimonials were fabricated people praising unbuilt features (escrow, shipments, analytics). Publishing fake testimonials on a live page is a trust/legal problem. Add the section back when real quotes exist | Pending (owner decision) |
| 2026-08-01 | `web/src/App.jsx` → `pages/Placeholder.jsx` | `/signin/staff` route (linked from SignIn footer "Staff sign-in") | Renders the real staff sign-in page (`pages/auth/StaffSignIn.jsx`) hitting `POST /auth/staff/login` | Staff auth pair is build-plan step 3; the party pair (step 2) shipped first | Done (step 3 shipped same day) |
| 2026-08-01 | `web/src/pages/buyer/buyerNav.js` → `layouts/PortalLayout.jsx` sidebar | "Search suppliers" item | Buyer-side M3 discovery search screen | M3 web screens are outside the M1 set; rendered disabled with a "Soon" chip | **Done 2026-08-16** — M3 Phase 5: wired to `/saved` via the shared `SaveButton` (buyer toggles optimistically; guest/non-buyer get the gate modal). Buyer nav now links to real `/search` + `/saved` routes |
| 2026-08-01 | `web/src/pages/buyer/buyerNav.js` → `layouts/PortalLayout.jsx` sidebar | "Enquiries" item | Buyer enquiry list (M4) | M4 web screens are outside the M1 set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/buyer/buyerNav.js` → `layouts/PortalLayout.jsx` sidebar | "Chat" item | Buyer chat threads (M4) | M4 web screens are outside the M1 set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/buyer/buyerNav.js` → `layouts/PortalLayout.jsx` sidebar | "Settings" item | Account settings | — | Done (2026-08-10 — became the live **"Company profile"** item → `/buyer/company` (A22 screen), which also carries the change-password entry point) |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Dashboard" item | Exporter dashboard (later milestone) | Outside the M1 web set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Products" item | Exporter catalogue management (M2 web screens) | — | Done (2026-08-09, links to `/exporter/products`) |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Enquiries" item | Exporter enquiry list (M4) | Outside the M1 web set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Chat" item | Exporter chat threads (M4) | Outside the M1 web set; disabled "Soon" chip | Pending |
| 2026-08-01 | `web/src/pages/exporter/exporterNav.js` → `layouts/PortalLayout.jsx` sidebar | "Settings" item | Account/company settings (A22 company profile edit) | — | Done (2026-08-10 — became the live **"Company profile"** item → `/exporter/company`: registered details with lock/demotion, logo + description capture, live public preview, change-password entry) |
| 2026-08-01 | `web/src/layouts/AdminLayout.jsx` sidebar → `pages/admin/ComingSoon.jsx` | "Dashboard" item (sidebar) | Real dashboard screen (backend GET /admin/dashboard exists — M5) | Outside the M1 web set. Per the design file this row is non-interactive with a SOON badge — it no longer links to `/admin/dashboard` (that route still renders ComingSoon if reached directly) | Pending |
| 2026-08-01 | `web/src/layouts/AdminLayout.jsx` sidebar → `pages/admin/ComingSoon.jsx` | "Audit log" item (sidebar) | Real audit viewer screen | — | Done (2026-08-09, M2 screen 11 — links to `/admin/audit`, permission-filtered on `audit:read`) |
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

### 📱 Mobile app — Home screens (2026-08-10)

`BuyerHomeScreen.jsx` / `ExporterHomeScreen.jsx` (design brief `design-plans/m1/app-screens-design.md`
§9/§13) replace the `BuyerHome`/`ExporterHome` tab placeholders. Everything on both screens is wired
to a real endpoint (`/me/organisation`, `/me/verification`) **except** the "Coming soon" module cards
below — plain `View`s, no `Pressable`, no chevron, an explicit "Coming soon" chip baked in, so nothing
reads as tappable.

| Date | Page / Component | Element (label) | What's missing / expected behaviour | Why deferred | Status |
|------|------------------|-----------------|-------------------------------------|--------------|--------|
| 2026-08-10 | `app/src/screens/BuyerHomeScreen.jsx` | "Search suppliers" / "Enquiries" / "Chat" **module cards** | Open search / enquiry list / chat | ⚠️ **Superseded 2026-08-17** — these three cards no longer exist; Buyer Home was rebuilt to the owner's mockup. Their successors are the two rows below | Superseded |
| 2026-08-10 | `app/src/screens/ExporterHomeScreen.jsx` | "Catalogue" / "Enquiries" / "Chat" **module cards** | Open My products / enquiry list / chat | ⚠️ **Superseded 2026-08-18** — these three cards no longer exist; Exporter Home was rebuilt to the owner's mockup. Its enquiries card now really navigates to the Enquiries tab; the rest are the rows below | Superseded |
| 2026-08-17 | `app/src/screens/BuyerHomeScreen.jsx` | Search bar + filter button (header row) | Open M3 app search | M3 app search isn't built — both are real `Pressable`s showing a "Coming soon" notice. Wire to `CategoryProducts`' existing `query` mode when the Search tab ships | Pending |
| 2026-08-17 | `app/src/screens/BuyerHomeScreen.jsx` | "Register as Exporter" button | Start exporter signup | No in-app path exists from a signed-in buyer session to exporter signup (that flow lives only on the logged-out screens) — shows a "Coming soon" notice | Pending |
| 2026-08-18 | `app/src/screens/ExporterHomeScreen.jsx` | "+ Add product" | Opens the add-product flow (M2 app screens 6 → 7) | ✅ Done 2026-08-18 (later) — screens 5–7 shipped; navigates to `ProductCategoryPicker` → `ProductForm` | Done |
| 2026-08-18 | `app/src/screens/ExporterHomeScreen.jsx` | "View all" + every product card tap | Open "My products" (screen 5) / the product editor (screen 7) | ✅ Done 2026-08-18 (later) — "View all" → the live Catalogue tab (`MyProductsScreen`); card tap → `ProductForm` edit | Done |
| 2026-08-10 | `app/src/screens/BuyerHomeScreen.jsx` | "Browse categories" card | Opens M2 app screen 1 (category browse) | — | Done (2026-08-11, links to `CategoryBrowse` — see the section below) |
| 2026-08-11 | `web/src/components/catalogue/ProductListCard.jsx` (`/category/:slug`) | Heart/save icon on every card | Adds the product to the buyer's saved list | The real endpoint exists (`POST`/`DELETE /saved`, buyer-only) but auth-gating + optimistic UI wasn't part of this pass — shown in the exact mockup position, `disabled`, not hidden and not fake-wired | **Done 2026-08-16** — M3 Phase 5: wired to `/saved` via the shared `SaveButton` (buyer toggles optimistically; guest/non-buyer get the gate modal). Buyer nav now links to real `/search` + `/saved` routes |
| 2026-08-11 | `web/src/components/catalogue/ProductListCard.jsx` (`/category/:slug`) | "Inquiry" button on every card | Opens an enquiry/contact flow to the seller | Module 4 (enquiry/chat), not built — every other product surface in this codebase withholds this entirely; shown here `disabled` because the owner asked twice more for exact mockup fidelity after the first pass omitted it  🔎 M3 Phase 6 sweep 2026-08-16: still inert & still `disabled`; owner ruling 2026-08-14 — the card Inquiry stays DEACTIVATED, the product page's "Send Enquiry" is the one door M4 wires. | Pending |
| 2026-08-12 | `web/src/pages/public/ProductDetail.jsx` (`/product/:slug`) | "Send Enquiry" button (buy panel, below trade specifications) | Opens an enquiry/contact flow to the seller for this product | Same story as the row above — the backend `Inquiry`/M4 API exists, but no create-enquiry flow is wired on the web client yet. Owner's reference mockup for this page's redesign shows the button in this exact position, so it's shown, `disabled`, not fake-wired  🔎 M3 Phase 6 sweep 2026-08-16: still inert & still `disabled`; owner ruling 2026-08-14 — THIS is the single enquiry entry point M4 will wire. | Pending |
| 2026-08-14 | `web/src/pages/public/ProductDetail.jsx` (`/product/:slug`) | Heart/save icon on the gallery (top-right) | Adds the product to the buyer's saved list | Added at owner request during the M3 Phase-1 review (the page had no save affordance; the list card already had its placeholder). Same endpoint story: `POST`/`DELETE /saved` (buyer-only) exist; wiring + the owner's non-buyer gate modal land with M3 screen 8 (`design-plans/m3/web-build-plan.md` Phase 5). `disabled`, not fake-wired | **Done 2026-08-16** — M3 Phase 5: wired to `/saved` via the shared `SaveButton` (buyer toggles optimistically; guest/non-buyer get the gate modal). Buyer nav now links to real `/search` + `/saved` routes |
| 2026-08-13 | `web/src/pages/public/SupplierProfile.jsx` (`/supplier/:slug`) | "Start Conversation" button (identity block, next to the company name) | Opens a chat/conversation with this supplier | Same story as the two rows above — the M4 backend (`Inquiry`/`Conversation`/`Message`, real and tested) exists, but no create-conversation flow is wired on the web client yet. Owner-requested directly (not from a mockup this time); shown in a sensible position, `disabled`, not fake-wired  🔎 M3 Phase 6 sweep 2026-08-16: still inert & still `disabled`; owner ruling 2026-08-14 — company-level conversation DEFERRED, keep disabled until decided. | Pending |

### 📱 Mobile app — Category browse (2026-08-11)

`CategoryBrowseScreen.jsx` (M2 app screen 1, design brief `design-plans/m2/app-screens-design.md`
§4) is fully wired — real 40-category tree, real sections + chips, real chunked loading. As of
2026-08-17 a category tap lands on the REAL product listing (`CategoryProductsScreen.jsx`, M2 app
screen 2 — `CategoryComingSoonScreen.jsx` deleted). The listing's own remaining gap is the row
below.

| Date | Page / Component | Element (label) | What's missing / expected behaviour | Why deferred | Status |
|------|------------------|-----------------|-------------------------------------|--------------|--------|
| 2026-08-11 | `app/src/screens/CategoryBrowseScreen.jsx` → `CategoryComingSoonScreen.jsx` | Every sub-category row (all ~260 of them) | Should open the category's real product listing | ✅ Done 2026-08-17 — opens `CategoryProductsScreen` (M2 app screen 2), real paginated products | Done |
| 2026-08-17 | `app/src/screens/CategoryProductsScreen.jsx` | Every product card | Should open the product detail page (M2 app screen 3) | ✅ Done 2026-08-18 — `ProductDetailScreen.jsx` shipped; cards on the listing AND Home both navigate to it | Done |
| 2026-08-18 | `app/src/screens/ProductDetailScreen.jsx` | Seller card | Should open the supplier profile (M2 app screen 4) | ✅ Done 2026-08-18 — `SupplierProfileScreen.jsx` shipped; detail's seller card AND Home's supplier cards both navigate to it | Done |

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

### 🔑 Owner decision — 2026-08-09: forward links inside a module ship LIVE

A control whose destination is a screen **later in the same build plan** is built as a real
`<Link>`, not disabled and not omitted. The owner's call: *"let these be built because the screens
will be built eventually."*

This is a deliberate, bounded exception to the dead-control rule above. It applies only to
**in-module forward references** where the target screen is already scheduled — screen 5's
"+ Add product" and its row-menu "Edit" pointed at screens 6 and 7, one step away. The shared 404
page covers the window in between.

It does **not** relax anything else. A control pointing at work that is **deferred, unscheduled or
in another milestone** (M3 search, M4 enquiry, the legal pages, store badges) still must not be a
live link — those stay static or visibly "coming soon" and stay logged in the table above.
