# M1 · Web Frontend — Step by Step Prompts

Backend ke 15 steps complete hone ke baad shuru karo. APIs ready honi chahiye,
warna frontend guess karke banayega.

**Shuru karne se pehle:** backend chalu rakho aur `/api/auth/me` ka response ek baar
dekh lo — permissions kaise aa rahe hain, wahi frontend ka menu chalayega.

---

## Step 1 — Project setup aur folder structure

```
Set up the MPX Global web frontend. Vite + React + Tailwind, ES modules.

Create the folder structure only — no logic yet:

src/
  api/          axios client, endpoint functions
  components/   shared UI primitives
  layouts/      panel shells
  pages/        route components, grouped by role
    auth/
    buyer/
    exporter/
    employee/
    admin/
  hooks/
  context/
  utils/
  config/

Also:
- Vite config with a dev proxy to the backend
- Tailwind configured, with our colour tokens defined in the theme rather than
  scattered through the code
- .env.example with VITE_API_BASE_URL
- .gitignore covering node_modules, .env, dist
- Router set up with a public / protected split, but only a placeholder route for now

Do not install a component library — we build our own primitives.
Do not add Redux — React Context is enough for this app.

Show me the structure when done.
```

---

## Step 2 — Design tokens aur UI primitives

```
Build the shared UI layer before any screens, so everything stays consistent.

1. Define the design tokens in tailwind.config.js: one accent colour, a neutral scale,
   spacing, border radius, and font sizes. This is a B2B trade platform handling large
   transactions — restrained, professional, comfortable density. Not a consumer app.

2. Build these primitives in src/components/ui/:
   Button (primary, secondary, ghost, danger; loading and disabled states)
   Input, Select, Textarea — each with label, helper text and error state
   Checkbox, Radio, Toggle
   Card, Badge, Avatar
   Modal, Drawer
   Table with sorting and an empty state
   Tabs, Breadcrumb
   Spinner, Skeleton
   Toast / notification system
   EmptyState, ErrorState

3. Every primitive handles loading, empty, error and disabled — we will need all four
   everywhere, and retrofitting them later is painful.

Build a /styleguide route that renders every primitive in every state, so we can see
them all in one place. Keep it out of production builds.
```

**Check:** `/styleguide` khol ke dekho — sab kuch consistent lag raha hai?

---

## Step 3 — API client aur token refresh

```
Build the API layer. This is security-relevant — read .claude/rules/api-endpoints.md.

1. src/api/client.js — axios instance with the base URL from config.

2. Request interceptor: attach the access token.

3. Response interceptor with automatic refresh:
   - On 401, call the refresh endpoint ONCE and retry the original request
   - Queue any concurrent requests that 401 while a refresh is in flight, so we never
     fire multiple refresh calls
   - If refresh fails, clear the session and redirect to login with a clear message
   - Never retry more than once — an infinite refresh loop is a real bug

4. Tokens in memory plus refresh token handling that matches what the backend expects.
   Never store the access token where a script could trivially read it if we can avoid it.

5. src/api/auth.js — typed functions for every auth endpoint, so components never call
   axios directly.

6. A consistent error shape so the UI always knows how to display a failure, including
   the requestId the backend returns.

Write a test for the concurrent-401 case — that is the one that breaks in production.
```

---

## Step 4 — Auth context aur session state

```
Build the auth state layer.

src/context/AuthContext.jsx providing:
- user, organisation, role, permissions, isAuthenticated, isLoading
- login, verifyOtp, logout, refreshUser

Rules:
- On app load, call /api/auth/me to restore the session before rendering routes.
  Show a full-screen loader until that resolves — never flash the login screen at an
  already-logged-in user
- permissions come from the server and are stored as-is. Never compute or hardcode
  what a role can do on the client
- A usePermission(name) hook for conditional rendering. This is presentation only —
  the server is the real authority, and we never rely on hiding things
- On logout, clear everything and redirect

Also handle: session expiry mid-use should show a clear message and return to login,
not a blank screen or a silent failure.
```

---

## Step 5 — Login aur OTP screens

```
Build the authentication screens.

1. Login page — email or mobile, password. Clean, centred, with the MPX Global brand.
2. OTP verification — 6 boxes with auto-advance and paste support, a visible countdown,
   a resend button that only enables after the cooldown, and clear attempt feedback
   ("2 attempts remaining").
3. Buyer sign-up — name, email, mobile, password, company name, country.
4. Exporter (seller) sign-up — name, email, mobile, password, company name, country.
   In Phase 1 the exporter self-registers (this is the opposite of the old rule).
   On signup the exporter account is created with kycStatus pending; the exporter can
   log in and set up their profile/catalogue, and their profile is publicly visible
   marked not-yet-verified, gaining a verified tick once an Employee verifies it.

Rules:
- Client-side validation for a good experience, but always display server errors
  properly — the server is the authority
- Never reveal whether an account exists. Wrong password and unknown email must look
  identical to the user
- Password strength indicator on sign-up
- Loading states on every submit, and disable the button while in flight
- After successful OTP, route by role using the redirect logic from Step 7

Both buyer and exporter self-register in Phase 1. Do NOT build an employee sign-up
screen — employee accounts are created by an Admin. Do not gate the exporter's public
visibility behind verification; expose kycStatus so the frontend shows the tick.
```

---

## Step 6 — Password reset aur admin 2FA

```
1. Forgot password page — enter email or mobile, receive a reset code.
2. Reset password page — code plus new password, with confirmation and strength check.
3. TOTP screen for admin and superadmin during login: 6-digit code input, plus a
   "use a backup code" option.
4. 2FA setup page — QR code, verify the first code, then show the 10 backup codes once
   with a copy and download option and a clear warning that they are shown only once.

Rules:
- Forgot password always shows the same confirmation whether or not the account exists
- After a successful reset, tell the user that all other sessions have been logged out,
  because the backend does exactly that
```

---

## Step 7 — Protected routes aur role-based routing

```
Build the routing layer.

1. ProtectedRoute wrapper: checks authentication, then checks the required role or
   permission. A user reaching another role's route is redirected to their own
   dashboard — never shown the page, never shown a 403 screen that leaks structure.

2. Post-login redirect by role:
   buyer -> /buyer   exporter -> /exporter   employee -> /employee
   admin and superadmin -> /admin

3. Route configuration as a single data structure, so we can see the whole route map
   in one file and generate the sidebar from it.

4. A 404 page and a generic error boundary that reports the requestId.

5. Deep-link handling: an unauthenticated user hitting a protected URL logs in and
   lands where they were going.
```

---

## Step 8 — Four dashboard shells

```
Build the panel shells. Layout only — the modules themselves come in M2.

Shared AppLayout: sidebar, top bar with user name, role, organisation and logout, a
content area, and responsive behaviour with a collapsible sidebar on mobile.

Sidebar items per panel:

Buyer      Dashboard · Search Products · My Inquiries · Quotations · Orders ·
           Messages · Profile
Exporter   Dashboard · Catalogue · Inquiries · Quotations · Orders · Shipments ·
           Payout Account · Analytics · Profile
Employee   Dashboard · Exporter Leads · Verification · Buyer Leads · Payment
           Approvals · Support · Tasks · Reports
Admin      Dashboard · Buyers · Exporters · Employees · Products · Escrow Ledger ·
           Payout Register · Contracts · CMS · Settings · Audit Logs

Critical for the Employee panel: menu items render ONLY if the server granted that
permission. Employee permissions are individually assignable, so this must be driven
by the permission list from /api/auth/me — never hardcoded.

Each item renders a placeholder page naming the module that will live there and which
build-plan phase it belongs to. See docs/build-plan.md.
```

**Check:** ek employee banao sirf 2 permissions ke saath — sidebar me sirf 2 items dikhne chahiye.

---

## Step 9 — Polish aur M1 acceptance

```
Final pass on the M1 web frontend.

1. Every page has loading, empty and error states — no blank screens anywhere.
2. Responsive check at 1440, 1024, 768 and 375 px.
3. Basic accessibility: labels on inputs, focus states, keyboard navigation through
   forms, sensible tab order.
4. Consistent page titles.
5. Remove the styleguide route from the production build.

Acceptance tests:
1. A buyer navigating to /admin is redirected, never sees the page
2. An employee with only two permissions sees only two sidebar items
3. Session expiry mid-use returns to login with a clear message, not a blank screen
4. Concurrent API calls during a token refresh do not fire multiple refresh requests
5. Wrong password and unknown email produce identical feedback
6. Every form shows server-side errors properly, not just client validation

Then a handover note: what you built, what you skipped, and anything in the backend
API that made the frontend awkward. I would rather fix the API now than work around
it for three months.
```

---

# Aage

Web done hone ke baad `M1-03-app-steps.md`.
