# M1 · Mobile App — Step by Step Prompts

Backend aur web done hone ke baad. App repo root pe apne folder me rahegi (`app/`),
taaki `mobile-app.md` rule uspe load ho.

**Yaad rakho:** app me kabhi bhi, kisi bhi milestone me, payment release ya approval
screen nahi banegi. Wo web-only hai aur server pe enforce hota hai.

---

## Step 1 — Expo setup aur folder structure

```
Set up the MPX Global mobile app. React Native with Expo, in an app/ folder at the
repo root. Read .claude/rules/mobile-app.md first.

Create the structure only — no logic yet:

app/
  src/
    screens/
      auth/
      buyer/
      exporter/
    navigation/
    components/
    api/
    context/
    hooks/
    theme/
    utils/

Install: expo-secure-store, expo-local-authentication, axios,
@react-navigation/native, @react-navigation/native-stack,
@react-navigation/bottom-tabs, react-native-safe-area-context, react-native-screens.

Configure:
- app.json with the app name, slug, bundle identifiers for iOS and Android, and icons
- HTTPS enforced: App Transport Security on iOS, network security config on Android.
  No cleartext traffic in any build that ships
- .env handling via expo-constants, with .env gitignored
- Metro and babel config as needed

Confirm the app builds and runs on both an iOS and an Android simulator before we
go further.
```

**Check:** dono simulators pe blank app chal rahi hai?

---

## Step 2 — Theme aur UI primitives

```
Build the shared UI layer before any screens.

1. src/theme/ — colours, spacing, typography, radii. Match the web frontend's tokens
   so the two surfaces feel like one product.

2. Primitives in src/components/:
   Button (primary, secondary, ghost; loading and disabled)
   Input with label, helper text and error state
   OtpInput — 6 boxes, auto-advance, paste support
   Card, Badge, Divider
   Spinner, Skeleton
   EmptyState, ErrorState
   Toast
   ScreenContainer handling safe areas and keyboard avoidance

3. Every primitive covers loading, empty, error and disabled states.

Keyboard handling matters more on mobile than web — get ScreenContainer right now so
every form screen inherits it.
```

---

## Step 3 — Secure storage aur API client

```
Build the storage and network layer. This is security-critical.

1. src/utils/secureStorage.js — a thin wrapper over expo-secure-store for tokens and
   any credential. NEVER AsyncStorage, never a persisted store written to disk. On a
   rooted or jailbroken device, AsyncStorage is readable plain text.

2. src/api/client.js — axios instance, base URL from config.

3. Request interceptor attaches the access token.

4. Response interceptor with refresh, matching the web behaviour:
   - On 401, refresh once and retry
   - Queue concurrent requests during an in-flight refresh
   - On refresh failure, clear secure storage and return to login
   - Never loop

5. src/utils/logger.js — strips tokens, OTPs, passwords, bank fields and PII before
   anything reaches the console or a crash report. Verbose logging disabled in release
   builds.

6. Network error handling: offline detection with a clear message rather than a silent
   failure or an infinite spinner.

Confirm after building: inspect app storage on a simulator and show me that no token
is readable.
```

---

## Step 4 — Auth context aur navigation skeleton

```
Build auth state and the navigation shell.

1. src/context/AuthContext.jsx — user, organisation, role, permissions,
   isAuthenticated, isLoading, plus login, verifyOtp, logout, refreshUser.

2. On app launch: read the token from secure storage, call /api/auth/me, and restore
   the session. Show a splash screen until that resolves — never flash the login
   screen at a logged-in user.

3. src/navigation/RootNavigator.jsx — switches between:
   - AuthNavigator when logged out
   - BuyerNavigator when role is buyer
   - ExporterNavigator when role is exporter
   Both role navigators are empty stubs for now.

4. Permissions come from the server and are stored as received. The app renders from
   them but never treats them as authority — the server re-checks every request.

5. Session expiry mid-use returns to login with a clear message.
```

---

## Step 5 — Auth screens

```
Build the authentication screens.

1. Login — email or mobile, password. Clean, branded, keyboard-aware.
2. OTP verification — the OtpInput primitive, visible countdown, resend after cooldown,
   attempt feedback.
3. Buyer sign-up — name, email, mobile, password, company name, country.
4. Exporter (seller) sign-up — name, email, mobile, password, company name, country.
   In Phase 1 the exporter self-registers. Account created with kycStatus pending; the
   exporter can log in and set up their catalogue, profile is publicly visible marked
   not-yet-verified, verified tick added once an Employee verifies.

Rules:
- Client validation for experience, but always show server errors properly
- Wrong password and unknown email look identical
- Loading state on every submit, button disabled while in flight
- Auto-focus and correct keyboard types (email, phone, numeric for OTP)

Both buyer and exporter self-register in Phase 1. There is no employee sign-up in the
app (employees are web-only, created by an Admin). Do not gate the exporter's public
visibility behind verification.
```

---

## Step 6 — Password reset aur biometric unlock

```
1. Forgot password — enter email or mobile, receive a code.
2. Reset password — code plus new password with confirmation.
   Same rule as web: always the same confirmation whether or not the account exists.

3. Biometric unlock with expo-local-authentication:
   - Optional, toggled in the profile screen
   - Prompts on app re-entry from background after a configurable timeout
   - Fallback to device passcode
   - Handles the case where the device has no biometrics enrolled
   - Biometrics gate RE-ENTRY ONLY. They never replace server authentication, and a
     biometric success must never issue or extend a token on its own

4. On reset success, tell the user other sessions were logged out.
```

---

## Step 7 — Role-based navigators

```
Build the two role experiences as navigational shells. Placeholder screens only —
modules come in M2.

Buyer tabs:     Home · Search · Inquiries · Orders · Messages · Profile
Exporter tabs:  Home · Catalogue · Inquiries · Quotations · Orders · Profile

Each tab renders a placeholder naming the module and its build-plan phase.
See docs/build-plan.md.

Profile tab for both roles:
- Name, role, organisation, verification status
- Biometric unlock toggle
- Notification preferences placeholder
- Change password
- Logout with confirmation
- App version

Tab icons, correct labels, and consistent header treatment across both navigators.
```

---

## Step 8 — Device testing aur M1 acceptance

```
Final pass on the M1 mobile app.

1. Test on a small phone and a large phone, both platforms. Nothing clipped, nothing
   unreachable behind the keyboard.
2. Safe areas correct on notched devices.
3. Dark mode either supported properly or explicitly locked to light — not half done.
4. No blank screens: loading, empty and error states everywhere.
5. Deep link scheme configured for M2's notification taps.

Acceptance tests:
1. Tokens are in secure store — show me they are not readable in app storage
2. Both buyer and exporter self-signup paths work; exporter lands in kycStatus pending
3. Session expiry returns to login with a message, not a blank screen
4. Concurrent requests during refresh fire only one refresh call
5. A crash report contains no token, OTP or PII
6. Biometric unlock gates re-entry but cannot create a session on its own
7. The app builds cleanly for both platforms

Then a handover note: what you built, what you skipped, which security tracker IDs
this covers (expect G1, G3, G5, G6, G9), and anything the backend should change to
make M2 mobile work easier.
```

---

# M1 complete

Teeno done ho gaye to:

1. Security tracker me A1–A8, G1, G3, G5, G6, G9 ka evidence bhar do
2. Client ko staging demo do
3. **M2 ka ₹3,00,000 maango — M2 shuru karne se pehle**
