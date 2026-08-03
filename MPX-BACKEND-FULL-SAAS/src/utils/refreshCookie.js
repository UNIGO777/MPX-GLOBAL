import { env } from '../config/env.js';

/**
 * The refresh token as an httpOnly cookie — so a browser session survives a
 * reload without any token ever being readable by JavaScript (tracker A2).
 *
 * 🔴 DUAL TRANSPORT, on purpose. The same endpoints serve the Expo app, which
 * cannot use httpOnly cookies. So:
 *   - browser (see `isWebClient`) → cookie
 *   - every other caller → the refresh token in the response body, unchanged
 * Refresh and logout accept the token from EITHER, preferring the cookie.
 * Do not "simplify" this to cookie-only: it silently breaks the mobile app.
 *
 * Attributes:
 *   httpOnly — JS can never read it, which is the entire point.
 *   sameSite 'lax' — production is same-site (API under the web origin), so Lax
 *     both works and blocks cross-site POSTs, i.e. CSRF cover for free. If the
 *     topology ever becomes genuinely cross-site this must become
 *     'none' + secure, and the X-Client header below becomes load-bearing.
 *   secure — production only; a Secure cookie is not stored over plain http,
 *     which would break local dev against http://localhost.
 *   path '/auth' — sent only to refresh/logout, never on ordinary API calls.
 *   maxAge — the refresh token's own lifetime; rotation does not extend it.
 */
export const REFRESH_COOKIE = 'mpx_rt';

const COOKIE_PATH = '/auth';

/**
 * A browser we are willing to set a cookie for: the web client announces itself
 * with `X-Client: web` AND the request carries an allow-listed Origin (CORS has
 * already refused anything else). The custom header cannot be sent by a
 * cross-site form post without a preflight, so it is a second CSRF layer on top
 * of SameSite — free insurance if the topology ever changes.
 */
export function isWebClient(req) {
  return req.get('x-client') === 'web' && Boolean(req.get('origin'));
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Must mirror the set options exactly or the browser keeps the old cookie. */
export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: COOKIE_PATH,
  });
}

/** Cookie first, body second — a stale body token must never win over the cookie. */
export function readRefreshToken(req) {
  return req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken || null;
}

/**
 * Spread into a token response: `{ ...refreshTokenForBody(req, token) }`.
 *
 * For a browser this is EMPTY — the refresh token exists only in the httpOnly
 * cookie, so no JavaScript on the page can read it even via the response that
 * created the session. That omission is the actual security win of A2; the
 * cookie alone achieves nothing while a copy still ships in the body.
 *
 * For every other client it is `{ refreshToken }`, exactly as before.
 */
export function refreshTokenForBody(req, refreshToken) {
  return isWebClient(req) ? {} : { refreshToken };
}
