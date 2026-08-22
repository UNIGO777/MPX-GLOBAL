import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { authApi } from '../api/auth.js';
import { mergeUser, normalizeUser } from '../api/normalizeUser.js';
import { tokenStore } from '../api/tokenStore.js';
import { useToast } from '../components/Toast.jsx';
import { registerForPush, unregisterFromPush } from '../push/push.js';
import { logger } from '../utils/logger.js';
import { toAppError } from '../utils/errors.js';

/**
 * Session state for the whole app.
 *
 * 🔴 Trust boundary (CLAUDE.md #5, G9/G15): everything here — role, permissions —
 * is what the SERVER said, held for RENDERING only. The app never decides its
 * own permissions and never grants itself access from this state. Every request
 * is re-checked server-side, so a tampered client gains nothing but a
 * misleading screen.
 *
 * Scope: session state and the operations that MUTATE it (login, verify, logout).
 * The stateless flows — signup, forgot, reset, resend — go through `authApi`
 * directly from their screens; routing them through here would add a layer that
 * holds no state.
 *
 * Note what is absent: no staff login, and no payment-release or approval
 * capability of any kind. Approval is web-only and enforced server-side by
 * client type, not by hiding a screen here.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // `restoreError` is set ONLY when the launch restore could not reach the
  // server. It is not a failed session — see the restore effect below.
  const [state, setState] = useState({ user: null, isLoading: true, restoreError: null });
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const toast = useToast();

  // Guards against a state update after unmount during the launch restore.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyUser = useCallback((user) => {
    if (mountedRef.current) setState({ user, isLoading: false, restoreError: null });
  }, []);

  const clearSession = useCallback(async () => {
    await tokenStore.clear();
    if (mountedRef.current) setState({ user: null, isLoading: false, restoreError: null });
  }, []);

  // The api client cannot reach React, so it calls this when a refresh fails.
  useEffect(() => {
    tokenStore.setOnSessionEnd(() => {
      if (mountedRef.current) setState({ user: null, isLoading: false, restoreError: null });
      toast.show('Your session expired. Please sign in again.');
    });
    return () => tokenStore.setOnSessionEnd(null);
  }, [toast]);

  // Launch restore: read the persisted token, then ask the server who this is.
  // `/auth/me` is refresh-eligible, so an expired access token is repaired here
  // rather than bouncing the user to sign-in.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { accessToken } = await tokenStore.hydrate();
      if (cancelled) return;

      if (!accessToken) {
        applyUser(null);
        return;
      }

      try {
        const user = await authApi.me();
        if (!cancelled) applyUser(normalizeUser(user));
        // M4-H · re-register on every launch, not only at login. FCM rotates
        // tokens (reinstall, restore-to-new-device, app-data clear) and most
        // users sign in once and never again — registering only at login would
        // leave those devices silently unreachable. Server-side it is an
        // upsert, so repeating it is free.
        if (!cancelled) registerForPush();
      } catch (error) {
        if (cancelled) return;
        const appError = toAppError(error);
        logger.warn('session restore failed', { kind: appError.kind });

        // 🔴 Being offline is NOT a failed session. Wiping the tokens here
        // would sign a valid user out permanently because their train went
        // through a tunnel — the stored refresh token is still good, and the
        // only honest answer is "we couldn't reach the server, retry".
        if (appError.kind === 'offline' || appError.kind === 'timeout') {
          setState({ user: null, isLoading: false, restoreError: appError });
          return;
        }

        // The server answered and refused. Never trust a stale local copy of
        // the user: if the server will not confirm the session, there is none.
        await clearSession();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyUser, clearSession, restoreAttempt]);

  /** Re-runs the launch restore after an offline failure. */
  const retryRestore = useCallback(() => {
    setState((s) => ({ ...s, isLoading: true, restoreError: null }));
    setRestoreAttempt((n) => n + 1);
  }, []);

  /**
   * Step 1 of sign-in. Returns the OTP challenge — deliberately NOT a session.
   * @returns {{ loginToken: string, method: string }}
   */
  const login = useCallback(async ({ identifier, password, portal }) => {
    // `sentTo` is the server's MASK of where the code actually went (the mobile,
    // always). Passed straight through so the OTP screen never has to infer the
    // destination from what the user typed.
    const { loginToken, method, sentTo } = await authApi.login({ identifier, password, portal });
    return { loginToken, method, sentTo };
  }, []);

  /**
   * Step 2. Exchanges the OTP for tokens and establishes the session.
   *
   * Follows up with `/auth/me` because verify-otp's user view carries the name
   * and email but no permissions — see `normalizeUser.js`. A failure there is
   * not fatal: the session is already valid, so fall back to the partial view
   * rather than stranding a signed-in user.
   */
  /**
   * Turn an issued token pair into a live session. Shared by the OTP exchange
   * and by A21 signup completion — both end with the same `{ accessToken,
   * refreshToken, user }` payload, and duplicating this is how the two paths
   * would drift on what a freshly signed-in user looks like.
   */
  const completeSignIn = useCallback(
    async (data) => {
      await tokenStore.setTokens(data);

      let user = normalizeUser(data.user);
      try {
        user = mergeUser(data.user, await authApi.me());
      } catch (error) {
        logger.warn('post-login /auth/me failed; using the issued user view', {
          kind: toAppError(error).kind,
        });
      }

      applyUser(user);
      // M4-H · register this device for push. Deliberately NOT awaited: it
      // prompts for a permission and hits the network, and a login must not
      // wait on either. It is fire-and-forget by construction (see `push.js`),
      // so nothing here can reject.
      registerForPush();
      return user;
    },
    [applyUser],
  );

  const verifyOtp = useCallback(
    async ({ loginToken, code }) => completeSignIn(await authApi.verifyOtp({ loginToken, code })),
    [completeSignIn],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    // 🔴 BEFORE the session is torn down — the unregister call needs the access
    // token that `clearSession` is about to wipe. Awaited (unlike registration)
    // so the next person to sign in on this device cannot inherit the previous
    // account's enquiries; it swallows its own failures, so it cannot block
    // logout either.
    await unregisterFromPush();
    try {
      // Tell the server first so the refresh family is revoked; a failure here
      // must still clear the device, or the user stays signed in locally.
      if (refreshToken) await authApi.logout({ refreshToken });
    } catch (error) {
      logger.warn('server logout failed; clearing device session anyway', {
        kind: toAppError(error).kind,
      });
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  /** Re-reads the user — e.g. after an Employee verifies the organisation. */
  const refreshUser = useCallback(async () => {
    const user = mergeUser(state.user, await authApi.me());
    applyUser(user);
    return user;
  }, [applyUser, state.user]);

  const value = useMemo(() => {
    const { user, isLoading, restoreError } = state;
    return {
      user,
      isLoading,
      restoreError,
      isAuthenticated: Boolean(user),
      role: user?.role ?? null,
      // Server-supplied, render-only. Never consulted to grant access.
      permissions: user?.permissions ?? [],
      login,
      verifyOtp,
      // A21 signup ends with a real session rather than a third code.
      completeSignIn,
      logout,
      refreshUser,
      retryRestore,
    };
  }, [state, login, verifyOtp, completeSignIn, logout, refreshUser, retryRestore]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
