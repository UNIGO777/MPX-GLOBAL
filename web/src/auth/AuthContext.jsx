import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authApi } from '../api/auth.js';
import { tokenStore } from './tokenStore.js';

/**
 * Auth state for the whole app.
 *
 * `user` merges two server sources and nothing else:
 *   - identity from verify-otp's curated view ({id, name, email, mobile, role,
 *     orgId, isActive, mustChangePassword})
 *   - authorisation from GET /auth/me ({permissions, mustChangePassword}) —
 *     me() returns no name/email, so both calls are needed.
 *
 * Permissions are presentation-only here: the sidebar renders from them, but
 * every request is re-authorised server-side (web-frontend.md trust boundary).
 *
 * Tokens live in tokenStore (in-memory interim — see that file). No session
 * survives a reload, so there is no restore path: state starts anonymous.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

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
  const completeSignIn = useCallback(async ({ accessToken, refreshToken, user: identity }) => {
    tokenStore.setTokens({ accessToken, refreshToken });
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
  const applyNewTokens = useCallback(({ accessToken, refreshToken }) => {
    tokenStore.setTokens({ accessToken, refreshToken });
    setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    tokenStore.clear();
    setUser(null);
    if (refreshToken) {
      try {
        await authApi.logout({ refreshToken });
      } catch {
        // Local sign-out already happened; a network failure changes nothing.
      }
    }
  }, []);

  const value = useMemo(
    () => ({ user, sessionNote, completeSignIn, applyNewTokens, signOut }),
    [user, sessionNote, completeSignIn, applyNewTokens, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
