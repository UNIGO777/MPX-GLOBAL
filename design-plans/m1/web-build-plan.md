# M1 · Web Frontend — Build Plan (screens → React)

> **Sources, in precedence order:**
> 1. The shipped backend (`MPX-BACKEND-FULL-SAAS/src/routes|validators|controllers`) — field
>    names, enums, routes and response shapes come from HERE, nowhere else.
> 2. `design-plans/m1/m1-webscreens/` — 19 HTML mockups (each carrying 2–5 state copies) + 3
>    DESIGN.md briefs. These are the visual truth: layout, copy, states.
> 3. `design-plans/m1/web-screens-design.md` — content/state reference only. Its auth model
>    (one shared login for all four roles) is **stale against §A21** and superseded by the
>    owner's instruction: party portal pair + separate staff portal.
>
> **Owner instruction (2026-08-01):** auth screens ship as TWO pairs — **buyer + exporter
> share one screen** (portal as a field change) and **admin + employee share one screen**
> (the staff portal). Admin stays fully separate — its own routes, layout and entry point,
> no shared auth state wiring with the party side beyond the api client.
>
> 🧭 **S1 satisfied:** this plan IS the backend-contract alignment S1 demands. Everything
> below names the exact endpoint + fields each screen wires to.

---

## 0 · Design system (from the mockups, not the briefs alone)

Three DESIGN.md briefs exist; the markup of every screen actually uses the **royal-blue
"MPX Global Precision"** tokens (History 1.13: client moved the landing blue to the royal
family — this is that):

| Token | Value | Use |
|---|---|---|
| `navy` | `#1A2E8F` | brand surfaces, sidebar, hero panels |
| `accent` | `#2A4DE0` | primary actions, focus rings, links |
| `accent-strong` | `#2340C4` | primary hover |
| `canvas` | `#EAEEFF` | page background behind cards |
| `card` | `#FFFFFF` | cards / panels |
| `ink` | `#000517` | headings, primary text |
| `subtext` | `#5A6B85` | secondary text |
| `border` | `#C5C6CF` | hairlines, input borders |
| `success` | `#12B76A` | verified tick, approvals |
| `warning` | `#F79009` | "In review" (locked token — owner, 2026-08-01) |
| `danger` | `#D92D20` | rejections, destructive |

Type: **Inter only** (the Playfair loads in some exports are Stitch leftovers — no markup
uses it outside the dark-theme drafts). Buttons: **pill**. Inputs/cards: **8px radius**,
1px `border`, 2px `accent` focus ring. Icons: Material Symbols Outlined (add package or
inline SVG — decide at build: **inline SVG subset**, no icon-font network dependency).
These replace the current placeholder tokens in `web/tailwind.config.js` (same token-name
contract, new values + additions).

## 1 · Folder structure (extends the existing `web/` scaffold)

```
web/src/
  api/            client.js (exists) · auth.js · kyc.js · admin.js · orgs.js
  auth/           AuthContext.jsx · useAuth.js · tokenStore.js · RequireAuth.jsx · RequireRole.jsx
  components/ui/  Button · Input · PasswordInput · MobileInput · Select · Checkbox ·
                  OtpInput · FileDropRow · StatusChip · VerifiedTick · Alert · Modal ·
                  Drawer · Spinner · Skeleton · EmptyState · ErrorState(ref code) ·
                  Pagination · CountrySelect · StrengthMeter
  layouts/        AuthLayout.jsx (split-pane: navy narrative left, card right)
                  PortalLayout.jsx (party sidebar shell — buyer/exporter variants)
                  AdminLayout.jsx  (staff sidebar shell — permission-filtered)
  pages/
    public/       Landing.jsx
    auth/         SignIn.jsx (party, portal toggle) · StaffSignIn.jsx ·
                  Otp.jsx (serves both flows) · Forgot.jsx · Reset.jsx ·
                  ChangePassword.jsx (staff must-change gate) ·
                  BuyerSignup.jsx · ExporterSignup.jsx (3 steps, one route + step state)
    buyer/        VerificationStatus.jsx · KycUpload.jsx
    exporter/     VerificationStatus.jsx · KycUpload.jsx (upload + resubmit are ONE page,
                  banner varies — matches the resubmit mockup)
    admin/        Users.jsx · VerificationQueue.jsx · KycViewer.jsx · Employees.jsx ·
                  ComingSoon.jsx (Dashboard / Audit log / Settings)
  lib/            countries.js (ISO alpha-2 + dial codes) · kycDocTypes.js (mirror of
                  backend KYC_DOCS_BY_ENTITY) · format.js (dates, masking)
```

No Redux, no component library, no TanStack Query for M1 (small surface; add later with a
flag to the owner if list caching starts to hurt — web-frontend.md requires asking first).
Server data through small hooks per page over the one `apiClient`.

## 2 · Routes & redirects

```
/                      Landing (public)
/signin                Party sign-in (portal toggle buyer|exporter)
/signin/staff          Staff sign-in (no portal)
/otp                   OTP step (state from login; guards against direct hits)
/forgot  /reset        Party recovery (portal carried through) — staff variants via ?staff=1
/signup/buyer          Buyer signup
/signup/exporter       Exporter signup (3 steps, internal state)
/change-password       Blocking gate when user.mustChangePassword (staff temp password)
/buyer/verification    /buyer/kyc
/exporter              (= verification status home)   /exporter/kyc
/admin/users  /admin/verification  /admin/verification/:orgId/kyc  /admin/employees
/admin/dashboard /admin/audit /admin/settings   → ComingSoon (logged in UiWebNotes)
```

Post-login redirect: `buyer → /buyer/verification` · `exporter → /exporter` ·
`employee → first permitted admin screen (users → verification → employees order)` ·
`superadmin → /admin/users`. Wrong-role hits redirect to own home (never a 403 page).
`mustChangePassword` intercepts everything except `/change-password` (mirrors the
backend's authorize gate).

## 3 · Auth layer (the contract as shipped — not as the old docs describe)

- `POST /auth/login` `{identifier, password, portal}` → `{loginToken, method}` → `/otp`
- `POST /auth/staff/login` `{identifier, password}` → same shape
- `POST /auth/verify-otp` `{loginToken, code}` → `{accessToken, refreshToken, user}` —
  `user` = curated view `{id,name,email,mobile(e164 string),role,orgId,isActive,mustChangePassword}`
- `POST /auth/resend-otp` `{loginToken}` · OTP box UX: 6 digits, paste-across, countdown
  (5 min TTL), resend cooldown 60s client-side; masked destination composed CLIENT-side
  from the identifier the user typed (the API never returns it)
- `POST /auth/refresh` `{refreshToken}` (body, rotating) · `POST /auth/logout` `{refreshToken}`
- `GET /auth/me` → `{userId, orgId, role, permissions, mustChangePassword}` — note: **no
  name/email**; identity display comes from the verify-otp `user`, held in auth state
- Party forgot/reset: `{identifier, portal}` / `{identifier, code, newPassword, portal}` —
  **the mockup has no portal field; the built screen adds the same buyer/exporter toggle
  as sign-in** (backend 400s without it). Staff pair: `/auth/staff/forgot-password`,
  `/auth/staff/reset-password` (no portal).
- `POST /auth/change-password` `{currentPassword, newPassword}` → fresh tokens. No mockup
  exists; composed from the reset-password card. Required — without it a created employee
  is unusable (web-screens-design §11 said exactly this).

**🔴 Token storage — owner decision needed, interim is deliberate.**
`web-frontend.md` mandates access token in memory + refresh token in an **httpOnly
cookie**; the shipped backend returns the refresh token **in the JSON body** and never
sets a cookie. Storing it in localStorage is on the rule's Never list. Interim (built):
both tokens **in memory only** → a hard reload ends the session and returns to sign-in.
Compliant, safe, and forward-compatible. The clean fix is a small backend change
(httpOnly cookie on verify-otp/refresh + cookie read) — that touches auth, so it ships
only after owner approval. Flagged in UiWebNotes + here.

## 4 · Screens ↔ mockups ↔ endpoints (all states from the copies)

### Pair 1 — party auth (buyer + exporter share code; portal = field change)

| Screen | Mockup | States built | Contract notes |
|---|---|---|---|
| Sign-in | `sign_in_default_loading_states` | default · loading · invalid credentials · rate-limited (429 → "try again in 15 minutes") | ⚠️ mockup line "Buyers, exporters and staff all sign in here" is pre-A21 — replaced by a Buyer/Exporter portal toggle + "Staff sign-in" link. Same generic error for every failure |
| OTP | `otp_verification_states` | default · wrong code · expired · locked (15 min) · resend cooldown/sent · loading | serves party AND staff flows (loginToken is flow-agnostic). No attempts counter |
| Forgot | `password_recovery_page` | default · sent (generic copy) · rate-limited | + portal toggle (party) / staff variant |
| Reset | `password_reset_alignment_fixed` | default · expired code · mismatch · strength meter · success ("signed out everywhere") | code boxes = same OtpInput |
| Buyer signup | `buyer_registration` | default · field errors · duplicate (409 + "Sign in instead") · success ("You're in.") | POST `/auth/buyer/signup` `{name,email,mobile{countryCode,number},password,company,country}` → then straight into the OTP screen with the returned loginToken (A21 §4a — signup returns NO session) |
| Exporter signup | 3 × `exporter_registration_step_*` | per-step errors · back/forward keeps input · duplicate · success | POST `/auth/exporter/signup` `{…, entityType, country, address?}`. 🔴 Step-2's **Registration number / Tax ID / Year established are DROPPED from the build** — the backend strips `businessProfile` at signup by owner decision (2026-07-30, A5: captured at verification). Step 2 = business name, country, entity type cards. Step 3 = address, skippable |

### Pair 2 — staff auth (admin + employee share code; separate page, no entanglement)

Staff sign-in reuses the AuthLayout + form internals but is its own route/page hitting
`/auth/staff/login`; then OTP; then (if `mustChangePassword`) the blocking
change-password screen. No portal control anywhere on it.

### Buyer panel

| Screen | Mockup | States | Contract |
|---|---|---|---|
| Verification status | `buyer_verification_states_separated` | not submitted · in review (+ doc metadata list) · verified (tick + date) · needs attention (reason verbatim + resubmit CTA) · loading/error | GET `/me/verification` → `{kycStatus, entityType, verifiedAt, kycRejectionReason, kycSubmittedAt, documents[{docType,uploadedAt}]}`. Status→label map: pending=Not submitted · submitted=In review · verified=Verified · rejected=Needs attention |
| KYC upload | `buyer_document_upload_banner_added` | optional banner · entity choice (buyer chooses) · rows: empty/selected/uploading/per-file error · already-verified short-circuit · submitted confirmation | POST `/me/kyc/documents` multipart: file field **`document`**, text `docType`, `entityType` (buyer first upload sets it). One file per request → multi-row UI submits sequentially with per-row progress. **docType options come from the backend enum only**: business → Company registration(`registration`) · GST / tax document(`gst`) · Certificate(`certificate`) · Other(`other`); individual → PAN(`pan`) · Aadhaar(`aadhaar`) · Passport(`passport`) · Other(`other`). The mockups' "VAT / Tax Certificate / Export License / Bank Reference Letter / Driving License" lists are invalid against the enum and are NOT built. Client caps: PDF/JPG/PNG/WEBP, 10 MB (mirrors server); 20-doc 409 surfaced |

### Exporter panel

| Screen | Mockup | States | Contract |
|---|---|---|---|
| Verification status (home) | `exporter_verification_all_states_stacked` | not submitted (+ 3-active-products callout) · in review · verified (limit-removed copy) · needs attention | same GET `/me/verification`. Header company/country: from `GET /exporters/:orgId` (public read, own orgId) — the only self-org source until A22 |
| KYC upload + resubmit | `exporter_verification_stacked_states` + `exporter_verification_resubmit_state` | first submission · business vs individual doc lists (entityType READ-ONLY from signup) · uploading/per-file error · in-review panel replaces form · verified short-circuit · **rejected → same page with reason banner** · "Back in review" confirmation | same upload endpoint; exporter never sends `entityType` (server uses signup value; mismatch 400s). Resubmit = the same POST (rejected→submitted, reason cleared server-side) |

### Admin console (staff; sidebar filtered by permissions)

| Screen | Mockup | States | Contract |
|---|---|---|---|
| Users | `admin_user_management_updated_data` + `_no_matches_state_added` | table · no-matches (names active filters) · error (requestId ref + retry) · loading skeleton · deactivate confirm modal · employee-variant (read-only, fewer sidebar items) · pagination 20/50/100 | GET `/admin/users?role&kycStatus&q&page&pageSize` (`user:read`). Filters use backend enums: Role = All/Buyer/Exporter/Employee/Super Admin (mockup's single "Staff" can't map to one enum value — split); Verification = All/Not submitted(pending)/In review(submitted)/Verified/Needs attention(rejected) — mockup omitted pending; added. Search labelled "Starts with…" (prefix). Activate/Deactivate POST `/admin/users/:id/(de)activate` — superadmin-only: buttons hidden for employees AND the server refusals (self, superadmin target, org-blocked) surfaced as inline messages |
| Verification queue | `admin_verification_queue_stacked_with_modal` | two tabs (Exporters / Buyers) with counts · cards · reject modal (reason 3–500, counter, "shown to the applicant") · empty "Nothing to review" · already-decided (409 → "no longer awaiting review" + refresh) · row processing | List: GET `/admin/orgs?side=exporter|buyer&verification=submitted` (`organisation:read`) — org-centric, the queue M5 names as correct (the users list would duplicate multi-user orgs). ⚠️ list sorts by takedownCount then createdAt — "oldest first" is approximated; noted. Card detail (entityType · submitted date · doc count) from GET `/admin/orgs/:id` on expand. Actions: POST `/employee/exporters/:id/verify|reject` (`exporter:verify`), `/employee/buyers/:id/approve|reject` (`buyer:approve`) — :id is the ORG id |
| KYC viewer | `admin_kyc_document_viewer_states_fixed` | doc list + preview · **preview expired → Reload** (signed URLs live 120s) · unsupported format → open-in-tab · no documents · loading/error · reject modal in place | GET `/employee/orgs/:id/kyc/documents` (`kyc:view`) → `{documents[{docType, uploadedAt, verifiedAt, signedUrl, expiresAt}], entityType, kycStatus, buyerSide, exporterSide}`. Access-is-recorded note kept (it is — `kyc.view` audit). Verify/Reject buttons same employee endpoints |
| Employees | `admin_employees_edit_permissions_drawer_added` | table · add drawer (temp password + Generate) · created-once password modal ("only time it's shown") · edit-permissions drawer ("replaces the set") · saved toast ("effective immediately — no re-sign-in") | Create: POST `/admin/employees` `{name,email,mobile{cc,number},password,permissions[]}` (superadmin). Edit: PATCH `/admin/employees/:id/permissions`. Permission checkboxes driven by the server catalogue (14 strings — grouped; M1 trio shown first, the rest under "Other areas"). 🔴 **Backend gap:** no GET returns an employee's CURRENT permissions (list rows omit them; V2 keeps them out of org detail). The table's permissions column and the drawer's pre-ticked state cannot be populated after a reload. Built: column shows the set when known from a create/edit response this session, else "—"; drawer opens UNTICKED with a visible warning that saving replaces the whole set. Flagged for a small backend addition (superadmin-only read) — needs owner decision, not built unilaterally |
| Dashboard · Audit log · Settings | sidebar "Soon" chips | ComingSoon page | backend for audit/dashboard exists (M5) but these screens are outside the M1 set — kept Soon per mockups, rows in `docs/UiWebNotes.md` |

### Public

| Screen | Mockup | Notes |
|---|---|---|
| Landing | `royal_blue_premium_landing_page` | Full royal-blue page: announcement bar · nav · hero (headline + mock search visual) · trust strip · categories · how-it-works tabs · platform tabs · trust cards · mobile-app section · testimonials · FAQ (accordion) · CTA · footer. All section links are in-page anchors. **Sign In / Get Started / Join as Buyer / Join as Seller** route to real auth pages. The hero search input, category links, Resources/Company/Legal footer links and store badges are **non-operational** → visibly decorative/"coming soon" and each logged in `docs/UiWebNotes.md` (STRICT rule) |

## 5 · Shared behaviours (every screen)

- Loading = skeletons (lists) / button spinners (actions); empty, error (+requestId ref
  code from the error envelope `{error:{message, requestId}}`), success — all designed.
- Status vocabulary + tick: one `StatusChip` + one `VerifiedTick`; **no "not verified"
  badge anywhere**; raw `kycStatus` never rendered on anything public-facing.
- Generic auth errors verbatim from the server; never per-field attribution on login.
- 429 handling: the copy the mockups carry ("Try again in 15 minutes").
- a11y: real labels, focus rings (accent 2px), 44px targets, `prefers-reduced-motion`,
  colour never alone (chips carry words).
- Responsive: 1440/1024/768/375; sidebars collapse to drawers <1024; tables scroll in
  their own container.

## 6 · Build order

1. **Foundation** — tokens into `tailwind.config.js`, ui primitives, AuthLayout,
   api modules, auth context + guards + role redirect (in-memory tokens).
2. **Party auth pair** — SignIn, Otp, Forgot, Reset, BuyerSignup, ExporterSignup.
3. **Staff auth pair** — StaffSignIn (+ shared Otp), ChangePassword gate.
4. **Buyer panel** — layout shell, VerificationStatus, KycUpload.
5. **Exporter panel** — shell, VerificationStatus, KycUpload/resubmit.
6. **Admin console** — AdminLayout (permission sidebar, zero/one/many states), Users,
   VerificationQueue, KycViewer, Employees, ComingSoon.
7. **Landing** last (biggest, zero contract risk), then a full pass: states, responsive,
   UiWebNotes ledger, `npm run build` clean.

Each step ends with the dev proxy against the running backend and a UiWebNotes update in
the same change. History.md entry per meaningful step.

## 7 · Decisions surfaced (not invented)

1. 🔴 **Refresh-token persistence** — cookie change on the backend (recommended) vs
   re-login on reload (built interim). Auth-touching; awaiting owner.
2. 🔴 **Employee permissions read** — no endpoint returns them; Employees screen degrades
   honestly. Small superadmin-only backend read recommended; awaiting owner.
3. Queue ordering — `/admin/orgs` can't sort oldest-first; accepted as-is, noted.
4. Buyer's own company name after re-login — unfetchable until A22; buyer headers show
   the person, not the company, when state is cold. Noted, resolves itself with A22.
