import { secureStorage } from '../utils/secureStorage.js';

/**
 * Token holder for the API client.
 *
 * Unlike the web (where both tokens live in memory only and a reload ends the
 * session), the app *persists* them — in `expo-secure-store`, i.e. the Android
 * Keystore / iOS Keychain (G1). That is the point of a native client: the user
 * stays signed in across launches without a token ever touching readable disk.
 *
 * The in-memory copy is a cache so the request interceptor stays synchronous;
 * `hydrate()` fills it once at launch. Secure storage remains the source of
 * truth and every write goes through to it.
 */

let accessToken = null;
let refreshToken = null;

// AuthContext registers this so an unrecoverable session clears React state
// too — the api client cannot reach React on its own.
let onSessionEnd = null;

export const tokenStore = {
  /** Reads persisted tokens into memory. Call once, before the first request. */
  async hydrate() {
    const stored = await secureStorage.getTokens();
    accessToken = stored.accessToken;
    refreshToken = stored.refreshToken;
    return { accessToken, refreshToken };
  },

  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  hasSession: () => Boolean(accessToken),

  async setTokens({ accessToken: at, refreshToken: rt }) {
    accessToken = at ?? null;
    refreshToken = rt ?? null;
    await secureStorage.setTokens({ accessToken, refreshToken });
  },

  async clear() {
    accessToken = null;
    refreshToken = null;
    await secureStorage.clearTokens();
  },

  setOnSessionEnd(fn) {
    onSessionEnd = fn;
  },

  /** The session is genuinely over: wipe the device copy and tell React. */
  async endSession() {
    await this.clear();
    onSessionEnd?.();
  },
};
