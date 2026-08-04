/**
 * The ONE place the web app reads its environment. Nothing else touches
 * `import.meta.env` (mirrors the api/client.js rule for network calls) — so
 * every tunable is findable here and changeable in `.env` without a code edit.
 *
 * 🔴 This bundle ships to the browser. Only genuinely PUBLIC values belong in
 * `.env`: no key, token, password or connection string, ever
 * (web-frontend.md · secrets-and-hygiene.md). If a value must stay secret, it
 * belongs to the backend and reaches us through our own API.
 *
 * ⚠️ Several values below MIRROR a server rule (OTP expiry, upload cap, page
 * sizes). The server is authoritative and re-checks all of them; these only
 * drive what the user is told. Change one here and it must match the backend,
 * or the UI will state a limit the API does not enforce.
 */

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const list = (value, fallback) => {
  const parsed = String(value ?? '')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
  return parsed.length > 0 ? parsed : fallback;
};

const env = import.meta.env;

/**
 * Where the API lives: a SAME-ORIGIN path in every mode.
 *
 *   development → Vite proxies `/api` to the local backend (vite.config.js).
 *   production  → Vercel rewrites `/api/*` to the real API (vercel.json).
 *
 * 🔴 Deliberately NOT the API's own origin. The refresh token is an httpOnly
 * cookie, and a cookie from another registrable domain is a THIRD-PARTY cookie:
 * every iOS browser is WebKit and blocks those outright, so the session died on
 * reload for every iPhone user. Routing through our own origin makes the cookie
 * first-party, which is the only thing ITP accepts — and it lets the cookie stay
 * `SameSite=Lax`, keeping CSRF cover.
 *
 * Not a secret — every URL in this bundle is public. `VITE_API_BASE_URL` still
 * overrides this, which is how the app moves to a same-site custom subdomain
 * later (phase 2) with no code change.
 */
const DEFAULT_API_BASE_URL = '/api';

export const config = {
  api: {
    /** Dev: Vite proxies this to the backend (see vite.config.js). */
    baseUrl: env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
    timeoutMs: num(env.VITE_API_TIMEOUT_MS, 20000),
  },

  /** Mirrors the server's OTP policy (6 digits, 5-minute TTL — A3). */
  otp: {
    ttlSeconds: num(env.VITE_OTP_TTL_SECONDS, 300),
    resendCooldownSeconds: num(env.VITE_OTP_RESEND_COOLDOWN_SECONDS, 60),
  },

  /**
   * Mirrors the server's KYC upload allowlist + per-document size cap.
   * ONE cap for buyer AND exporter — both portals post to the same endpoint,
   * so `KYC_MAX_FILE_MB` on the server is what actually enforces it and this
   * only drives what the user is told.
   */
  kyc: {
    maxBytes: num(env.VITE_KYC_MAX_FILE_MB, 10) * 1024 * 1024,
    maxMb: num(env.VITE_KYC_MAX_FILE_MB, 10),
    accept:
      env.VITE_KYC_ACCEPT ||
      '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp',
  },

  /** Rows-per-page choices; the largest must not exceed the server's cap. */
  table: {
    pageSizes: list(env.VITE_TABLE_PAGE_SIZES, [20, 50, 100]),
  },

  /** Display formatting only — dates and thousands separators. */
  locale: {
    dates: env.VITE_LOCALE_DATES || 'en-GB',
    numbers: env.VITE_LOCALE_NUMBERS || 'en-IN',
  },
};
