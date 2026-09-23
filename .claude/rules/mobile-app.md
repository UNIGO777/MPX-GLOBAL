---
paths:
  - "app/**/*.{js,jsx,ts,tsx}"
  - "mobile/**/*.{js,jsx,ts,tsx}"
  - "**/[Ss]creens/**/*.{js,jsx,ts,tsx}"
  - "**/[Nn]avigation/**/*.{js,jsx,ts,tsx}"
  - "**/*.native.{js,jsx,ts,tsx}"
---

# Mobile app (React Native / Expo)

One app serving Buyer and Exporter. **⚠️ Part A §A21 reverses the old "one login / no exporter
signup" model:** buyer and exporter are **separate accounts** — the login screen selects the
**portal** (`POST /auth/login` with a `portal` field; the same email may hold one of each).
**Signup is two-step** on both sides — shared step-1 (name/email/phone/password) → OTP → step-2
(claim an existing Organisation or create-new; exporter adds `entityType` + address). The old
"no exporter signup screen" note is superseded; confirm the exact app signup surface with the
owner before building it (S1 alert still applies).

✅ **Organisation claim is BUILT in the app (2026-09-24).** `SignupCompanyScreen.jsx` is no longer
a stub; `screens/auth/ClaimOffer.jsx` is the RN twin of the web component. All of build-prompt
**§A21 "Organisation claim"** is implemented — offers list with a picker when the email and phone
reach different companies; the `claim_org_email` code to the existing member's inbox
(`POST /auth/signup/organisation/code` + `/verify`) whenever `needsOrgEmailOtp`; the company name
withheld until then; the opaque `claimChoice` on `complete` (never an org id); `CLAIM_SEAT_TAKEN`
→ swap to the create form without restarting; "set up a separate company" always available; and
rule 7 — a buyer whose company has an active exporter sees the company profile
(`CompanyProfileScreen`) and KYC (`VerificationHubScreen`) read-only.

🔴 **Keep these when touching any of it.** The web screens
(`web/src/pages/auth/SignupCompany.jsx` + `ClaimOffer.jsx`) stay the reference — do not re-derive
the rules or ship a simpler version. Two details are load-bearing and easy to "tidy" away:
`canEdit`/`canManage` are compared with **`=== false`**, so a response that omits the flag falls
through to EDITABLE (silently locking a company out of its own profile is the worse failure, and
the server refuses an unauthorised write anyway); and the offer is fetched **once**, behind a ref
guard, because a re-run that hit a transient 500 would let its `.catch` wipe the offer and hand a
person entitled to join the create form instead.

✅ **"Don't have your phone?" is already in the app** (2026-09-23): `OtpScreen.jsx` ("Use email
instead" / back to phone) and `ResetPasswordScreen.jsx` ("Send the code to my email") call
`resend-otp` / `forgot-password` with `channel: 'email'`. Keep them when touching those screens;
never send a typed address — the server uses the account's own email. Rules: `auth-sessions.md`
"the email channel" and build-prompt §A21 "OTP channel".

## Storage (G1)

Tokens and credentials go in `expo-secure-store` — Android Keystore and iOS Keychain.
**Never AsyncStorage**, never a persisted Redux store on disk, never a plain file. On a
rooted device AsyncStorage is readable text.

## Transport (G6)

HTTPS only. No cleartext fallback: App Transport Security on iOS, network security config
on Android. Consider certificate pinning for payment-related calls.

## Screens (G4, G8)

- Screenshot restriction on contract and payout screens: `FLAG_SECURE` on Android, an
  overlay or blur on iOS when the app backgrounds.
- Optional biometric re-entry via `expo-local-authentication`. Biometrics gate re-entry
  only — they never replace server-side authentication.

## Logging (G3)

Strip tokens, OTPs, bank details and PII before any Sentry or console output. Disable
verbose logging in release builds.

## Trust boundary (G9, G15)

The app renders from server-supplied permissions and **never decides its own**. Every
endpoint re-checks. There is no release or approval endpoint reachable with a mobile
client token — payment approval is web-only, enforced server-side by client type, not by
hiding a screen.

## Payout changes (G14)

Account changes made from the app follow the same verification, cooling-off and alerting
rules as web. There is no mobile shortcut.

## Never

- A role or permission decision made from app state
- A token in AsyncStorage
- An API base URL over plain HTTP, even in development builds that ship
