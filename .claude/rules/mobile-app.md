---
paths:
  - "app/**/*.{js,jsx,ts,tsx}"
  - "mobile/**/*.{js,jsx,ts,tsx}"
  - "**/[Ss]creens/**/*.{js,jsx,ts,tsx}"
  - "**/[Nn]avigation/**/*.{js,jsx,ts,tsx}"
  - "**/*.native.{js,jsx,ts,tsx}"
---

# Mobile app (React Native / Expo)

One app, one login, role-based experience. Buyer and Exporter. No exporter signup screen.

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
