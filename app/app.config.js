/**
 * Expo app config.
 *
 * Dynamic (not app.json) on purpose: the API base URL comes from the
 * environment, so it must be read at config-evaluation time and handed to the
 * runtime through `extra`. Expo CLI loads `.env` into `process.env` before this
 * file is evaluated — see `.env.example` for the variable names.
 *
 * 🔒 No secret ever belongs in here. Everything in this file ships inside the
 * app bundle and is readable by anyone who unpacks the IPA/APK. Only genuinely
 * public values (an API base URL) go in `extra`.
 */

const BUNDLE_ID = 'com.mpxglobal.app';

export default ({ config }) => ({
  ...config,
  name: 'MPX Global',
  slug: 'mpx-global',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Deep-link scheme — needed now so M4's notification taps have a target
  // (auth-app-steps.md Step 8) and so the OAuth-style redirect surface is fixed
  // before store submission rather than after.
  scheme: 'mpxglobal',
  // Locked to light. A half-done dark mode is worse than none
  // (design-plans/m1/app-screens-design.md §1.1) — revisit deliberately, not by drift.
  userInterfaceStyle: 'light',
  newArchEnabled: true,

  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },

  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    infoPlist: {
      // G6 — HTTPS only. App Transport Security stays fully on: no arbitrary
      // loads, no per-domain exception. A cleartext base URL therefore cannot
      // work in an iOS build even if one is mis-configured.
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsArbitraryLoadsInWebContent: false,
      },
      // G8 — biometrics gate re-entry only; they never replace server auth.
      NSFaceIDUsageDescription:
        'Use Face ID to unlock MPX Global when you return to the app.',
    },
  },

  android: {
    package: BUNDLE_ID,
    // M4-H · FCM. Firebase matches this file to the app by package name, so it
    // is only valid while `BUNDLE_ID` stays `com.mpxglobal.app` — change the
    // package and push goes silently dead rather than erroring.
    //
    // 🔒 Not a secret. This file ships inside the APK and anyone who unpacks it
    // can read the values; that is by design for a client config. The SECRET
    // half is the backend's `FIREBASE_SERVICE_ACCOUNT_JSON`, which never leaves
    // the server — and which `docs/Note.md` already flags for rotation before
    // production, since the current key passed through a chat transcript.
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#EAEEFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Deep links for M4 notification taps.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: false,
        data: [{ scheme: 'mpxglobal' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  plugins: [
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          // G6 — the Android half of "no cleartext fallback". Without this the
          // generated manifest permits HTTP; with it, a plain-HTTP request
          // fails at the platform layer in every build, debug included.
          usesCleartextTraffic: false,
        },
      },
    ],
  ],

  extra: {
    // Public config only. Read through `src/config/env.js`, which refuses a
    // non-HTTPS URL outside a local dev build.
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    // The public website origin — used to open Terms and Privacy, which the
    // app links out to rather than duplicating.
    webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '',
  },
});
