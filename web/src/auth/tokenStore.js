/**
 * In-memory token holder — the ONLY place tokens live.
 *
 * 🔴 Deliberate interim (owner decision 2026-08-01, plan §7.1): the backend
 * returns the refresh token in the response body and sets no cookie, and
 * `web-frontend.md` forbids any token in localStorage/sessionStorage. So both
 * tokens are held in memory only, which means a hard reload ends the session
 * and returns the user to sign-in. The proper fix — an httpOnly cookie set by
 * the backend — is logged in docs/UiWebNotes.md as a follow-up and must not be
 * worked around here by persisting a token anywhere a script can read.
 */

let accessToken = null;
let refreshToken = null;

// AuthContext registers a listener so an expired/unrecoverable session clears
// React state too (the api client can't reach React on its own).
let onSessionEnd = null;

export const tokenStore = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  setTokens({ accessToken: at, refreshToken: rt }) {
    accessToken = at ?? null;
    refreshToken = rt ?? null;
  },
  clear() {
    accessToken = null;
    refreshToken = null;
  },
  hasSession: () => Boolean(accessToken),
  setOnSessionEnd(fn) {
    onSessionEnd = fn;
  },
  endSession() {
    this.clear();
    onSessionEnd?.();
  },
};
