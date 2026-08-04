import Constants from 'expo-constants';

/**
 * Runtime config, read once from `app.config.js` → `extra`.
 *
 * G6 — HTTPS only. This module is the software half of that control; the
 * platform half (iOS ATS, Android `usesCleartextTraffic: false`) lives in
 * `app.config.js`. A misconfigured build fails loudly at startup here rather
 * than silently sending credentials over cleartext.
 *
 * The one exception is a *local development* build: `http://` is accepted, and
 * only against loopback or a private LAN address, because the dev backend runs
 * on the developer's machine. `__DEV__` is compiled to `false` in any release
 * build, so this branch cannot ship.
 *
 * ⚠️ The URL is parsed here rather than with `new URL()` on purpose. React
 * Native's `URL` is a partial shim: its constructor does not throw on malformed
 * input, and its accessors are regex approximations that have changed between
 * versions. That is acceptable for a display string and not acceptable for the
 * check that decides whether credentials may travel in cleartext.
 */

/**
 * 🔴 `process.env.EXPO_PUBLIC_*` FIRST, `Constants.expoConfig.extra` only as a
 * fallback. The order is the whole point (diagnosed on-device 2026-08-04):
 *
 * `extra` is resolved from app.config.js when the NATIVE APP IS BUILT and baked
 * into the APK — so after changing `.env` the app kept using the previous API
 * URL no matter how many times Metro was restarted with `--clear`, and every
 * request failed as "You're offline" against a backend that was no longer
 * running. Rebuilding the APK was the only way to move it.
 *
 * `EXPO_PUBLIC_*` is inlined by Metro at BUNDLE time instead, so a `.env` change
 * now takes effect on the next reload. The `extra` fallback is kept so a build
 * that ships without the inlined value still resolves.
 */
const extra = Constants.expoConfig?.extra ?? {};

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl;

const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '10.0.2.2', // Android emulator's alias for the host machine
]);

// RFC1918 private ranges — a developer testing on a physical device points the
// app at their machine's LAN IP.
const PRIVATE_IP = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

const SCHEME_AND_AUTHORITY = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]+)/;

/**
 * @returns {{ scheme: string, host: string } | null} null if `raw` is not a
 *   parseable absolute URL, or carries credentials.
 */
function parseBaseUrl(raw) {
  const match = SCHEME_AND_AUTHORITY.exec(raw);
  if (!match) return null;

  const scheme = match[1].toLowerCase();
  const authority = match[2];

  // Credentials in the base URL would mean a secret in config. Reject outright
  // rather than parsing past them.
  if (authority.includes('@')) return null;

  let host;
  if (authority.startsWith('[')) {
    // IPv6 literal, e.g. [::1]:3000
    const end = authority.indexOf(']');
    if (end === -1) return null;
    host = authority.slice(1, end).toLowerCase();
  } else {
    host = authority.split(':')[0].toLowerCase();
  }

  return host ? { scheme, host } : null;
}

function isLocalDevHost(host) {
  return LOOPBACK_HOSTS.has(host) || PRIVATE_IP.test(host);
}

function resolveApiBaseUrl() {
  const raw = typeof configuredBaseUrl === 'string' ? configuredBaseUrl.trim() : '';

  if (!raw) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not set. Copy app/.env.example to app/.env and fill it in.',
    );
  }

  const parsed = parseBaseUrl(raw);
  if (!parsed) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL must be an absolute URL with no embedded credentials.',
    );
  }

  // Strip a trailing slash so `${base}/auth/login` never doubles up.
  const normalised = raw.replace(/\/+$/, '');

  if (parsed.scheme === 'https') return normalised;
  if (parsed.scheme === 'http' && __DEV__ && isLocalDevHost(parsed.host)) return normalised;

  // Deliberately does not echo the URL — it can carry a host that is not ours
  // to disclose, and the developer already has the value in their .env.
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL must use https. Cleartext http is permitted only in a local development build, against localhost or a private LAN address.',
  );
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  isDev: __DEV__,
};
