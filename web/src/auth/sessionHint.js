/**
 * Whether this browser was last seen signed IN — only so a reload knows if the
 * silent restore is worth trying. Without it every guest page view fired
 * `POST /auth/refresh`, which fails (no cookie) and puts a red 401 in the
 * console, and counts against the refresh rate limit.
 *
 * 🔴 It is a hint, never a credential. It holds '1' or '0' and nothing else —
 * no token, id or role (`web-frontend.md`: nothing sensitive in storage). It
 * grants nothing: the httpOnly cookie is still the session and the server still
 * decides. Getting it wrong costs one extra request or one "please sign in".
 *
 * Missing (first visit, cleared storage, a session from before this existed)
 * means "try" — so nobody already signed in is ever signed out by it.
 */
const KEY = 'mpx_session_hint';

export function shouldTryRestore() {
  try {
    return window.localStorage.getItem(KEY) !== '0';
  } catch {
    // Storage blocked (private mode, policy): fall back to always trying.
    return true;
  }
}

export function markSignedIn() {
  write('1');
}

export function markSignedOut() {
  write('0');
}

function write(value) {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Storage blocked: the restore just keeps trying on every load, as before.
  }
}
