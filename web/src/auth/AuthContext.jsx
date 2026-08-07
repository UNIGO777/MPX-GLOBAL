import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authApi } from '../api/auth.js';
import { refreshSession } from '../api/client.js';
import { clearQueryCache } from '../lib/queryClient.js';
import { tokenStore } from './tokenStore.js';

/**
 * Auth state for the whole app.
 *
 * `user` is identity + permissions, both server-sourced. GET /auth/me returns
 * the curated identity AND the permissions, so a restored session needs nothing
 * else; a fresh sign-in merges verify-otp's view with it.
 *
 * Permissions are presentation-only here: the sidebar renders from them, but
 * every request is re-authorised server-side (web-frontend.md trust boundary).
 *
 * A2 · the ACCESS token lives in memory (never storage); the REFRESH token lives
 * in an httpOnly cookie the server sets, so JS can never read it. That is what
 * lets a reload silently restore the session — see the effect below.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // A2 · silent restore. The refresh token is an httpOnly cookie, so a reload
  // can recover the session without any token having been readable by JS.
  //
  // 🔴 `restoring` exists to stop the guards racing this: RequireAuth sees
  // `user === null` for the first tick of every page load and would bounce a
  // perfectly valid session to /signin. Guards MUST wait for this to finish.
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshSession(); // cookie-only; no token needed in memory
        const me = await authApi.me(); // curated identity + permissions
        if (!cancelled) {
          setUser({ ...me, permissions: me.permissions ?? [], mustChangePassword: Boolean(me.mustChangePassword) });
        }
      } catch {
        // No cookie, expired cookie, or a logged-out visitor: this is the
        // NORMAL anonymous path, not an error. Stay signed out silently —
        // never surface a message, never leave the app spinning.
        tokenStore.clear();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The api client ends the session when a refresh fails mid-use; reflect that
  // in React state so guards redirect with a clear message.
  const [sessionNote, setSessionNote] = useState(null);
  useEffect(() => {
    tokenStore.setOnSessionEnd(() => {
      setUser(null);
      setSessionNote('Your session ended. Please sign in again.');
    });
    return () => tokenStore.setOnSessionEnd(null);
  }, []);

  /** Called with verify-otp's response. Returns the merged user for redirects. */
  const completeSignIn = useCallback(async ({ accessToken, user: identity }) => {
    // No refreshToken here on purpose — for a browser the server returns none
    // and sets the httpOnly cookie instead (A2).
    tokenStore.setTokens({ accessToken });
    let permissions = [];
    let mustChangePassword = Boolean(identity.mustChangePassword);
    try {
      const me = await authApi.me();
      permissions = me.permissions ?? [];
      mustChangePassword = Boolean(me.mustChangePassword);
    } catch {
      // me() failing must not strand a fresh login; permissions stay empty and
      // the server still enforces everything.
    }
    const merged = { ...identity, permissions, mustChangePassword };
    setUser(merged);
    setSessionNote(null);
    return merged;
  }, []);

  /** After POST /auth/change-password (returns a fresh token pair). */
  const applyNewTokens = useCallback(({ accessToken }) => {
    tokenStore.setTokens({ accessToken });
    setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
  }, []);

  const signOut = useCallback(async () => {
    tokenStore.clear();
    setUser(null);
    // Every cached server response dies with the session — otherwise the next
    // user to sign in on this browser sees the previous one's rows while their
    // own queries are still in flight (`web-frontend.md`: reset sensitive state
    // on logout).
    clearQueryCache();
    try {
      // The cookie is the session, and only this call clears it server-side —
      // so it always runs, with nothing in the body.
      await authApi.logout();
    } catch {
      // Local sign-out already happened; a network failure changes nothing.
    }
  }, []);

  const value = useMemo(
    () => ({ user, restoring, sessionNote, completeSignIn, applyNewTokens, signOut }),
    [user, restoring, sessionNote, completeSignIn, applyNewTokens, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
