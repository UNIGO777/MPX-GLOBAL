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
 *   sameSite 'lax' — the web app reaches this API through its OWN origin (a
 *     Vercel rewrite today, a same-site subdomain later), so the cookie is
 *     FIRST-PARTY and Lax is both sufficient and safer: it blocks cross-site
 *     POSTs, i.e. CSRF cover for free.
 *     🔴 Do NOT "fix" a cross-site setup by switching this to 'none'. That was
 *     tried (2026-08-04) and only helps desktop Chrome — every iOS browser is
 *     WebKit and blocks third-party cookies outright, whatever SameSite says.
 *     The fix is always to make the cookie first-party, never to loosen this.
 *   secure — production only; a Secure cookie is not stored over plain http,
 *     which would break local dev against http://localhost.
 *   path — REFRESH_COOKIE_PATH, default '/auth': sent only to refresh/logout,
 *     never on ordinary API calls. It is configurable because a proxy prefixes
 *     the public path (Vercel serves /api/auth/refresh), and a cookie scoped to
 *     '/auth' would then be stored and never sent. Set it to the PUBLIC path.
 *   maxAge — the refresh token's own lifetime; rotation does not extend it.
 */
export const REFRESH_COOKIE = 'mpx_rt';

const COOKIE_PATH = env.REFRESH_COOKIE_PATH;

/** One source of truth — clearCookie must mirror setCookie exactly. */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: COOKIE_PATH,
  };
}

/**
 * A browser we are willing to set a cookie for: it announces itself with
 * `X-Client: web`. A cross-site request cannot set a custom header without a
 * preflight, and CORS refuses that for any origin off the allow-list — so this
 * header is the CSRF control, layered on top of SameSite=Lax.
 *
 * 🔴 Origin is deliberately NOT required. The web app now reaches us through its
 * own origin (a Vercel rewrite), so the browser may omit Origin entirely and the
 * API sees the call from the proxy's edge. Requiring it meant no cookie was ever
 * issued — the session silently failed to persist.
 */
export function isWebClient(req) {
  return req.get('x-client') === 'web';
}

/**
 * CSRF guard for the cookie-bearing endpoints (refresh / logout).
 *
 * With SameSite=None the browser attaches the refresh cookie to a cross-site
 * POST, so a drive-by page could otherwise force a rotation — it could not read
 * the response (CORS), but rotation alone logs the victim out and can trip the
 * reuse-detection that revokes the whole token family. A custom header cannot
 * ride on a simple cross-site request: it forces a preflight, and the preflight
 * is refused for any origin not on the allow-list.
 *
 * Only applies when the credential IS the cookie. A mobile client sends the
 * token in the body, carries no cookie, and is unaffected.
 */
export function requireWebClientForCookie(req) {
  const hasCookie = Boolean(req.cookies?.[REFRESH_COOKIE]);
  return !hasCookie || isWebClient(req);
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Must mirror the set options exactly or the browser keeps the old cookie. */
export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
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
