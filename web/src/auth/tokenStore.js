/**
 * In-memory ACCESS token holder — the only token this app ever holds (A2).
 *
 * 🔴 The refresh token is deliberately absent. The server sets it as an
 * httpOnly, SameSite=Lax cookie scoped to /auth, so JavaScript cannot read it —
 * not from storage, not from the response that created the session, not via
 * XSS. That is the whole point; do not reintroduce a field for it, and never
 * persist the access token to localStorage/sessionStorage either
 * (web-frontend.md).
 *
 * A reload therefore starts with no access token and recovers the session by
 * calling /auth/refresh, which the browser accompanies with the cookie —
 * see AuthContext's restore effect.
 */

let accessToken = null;

// AuthContext registers a listener so an expired/unrecoverable session clears
// React state too (the api client can't reach React on its own).
let onSessionEnd = null;

export const tokenStore = {
  getAccessToken: () => accessToken,
  /** Ignores anything but the access token — see the note above. */
  setTokens({ accessToken: at }) {
    accessToken = at ?? null;
  },
  clear() {
    accessToken = null;
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
