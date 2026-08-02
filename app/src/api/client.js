import axios from 'axios';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { tokenStore } from './tokenStore.js';

/**
 * The ONE API client. Screens never call axios or fetch directly — endpoint
 * modules in this folder go through here.
 *
 * Interceptors:
 *  - request: attach the access token from secure storage's in-memory mirror.
 *  - response: on a recoverable 401, refresh ONCE and retry the original call.
 *
 * 🔴 Why single-flight matters more here than on web: the backend rotates the
 * refresh token on every use and treats reuse of an already-rotated token as
 * theft — it revokes the whole token family. Two concurrent refreshes with the
 * same token would therefore sign the user out of every device. Every caller
 * must share one in-flight refresh promise.
 */
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20000,
});

/**
 * Endpoints where a 401 is a real answer, not an expired session: bad
 * credentials, a wrong OTP, an invalid reset code. Retrying those would be
 * meaningless and would burn an OTP attempt.
 *
 * Deliberately a list, not a `/auth/` prefix test — `/auth/me` and
 * `/auth/change-password` are ordinary authenticated calls and MUST be able to
 * refresh, which is exactly how a session is restored at launch.
 */
const NO_REFRESH_PATHS = new Set([
  '/auth/login',
  '/auth/staff/login',
  '/auth/verify-otp',
  '/auth/resend-otp',
  '/auth/refresh',
  '/auth/logout',
  // A21 signup — all four steps are pre-session by definition (there is no
  // account yet, and the last one is what creates it), so none may trigger a
  // refresh-and-retry.
  '/auth/signup/start',
  '/auth/signup/verify',
  '/auth/signup/resend',
  '/auth/signup/complete',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/staff/forgot-password',
  '/auth/staff/reset-password',
]);

function isRefreshable(config) {
  const path = (config?.url ?? '').split('?')[0].replace(/\/+$/, '');
  return !NO_REFRESH_PATHS.has(path);
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshInFlight = null;

async function performRefresh() {
  const currentRefreshToken = tokenStore.getRefreshToken();
  if (!currentRefreshToken) throw new Error('no refresh token');

  // Raw axios on purpose: this call must never recurse back into the
  // interceptor below.
  const { data } = await axios.post(
    `${env.apiBaseUrl}/auth/refresh`,
    { refreshToken: currentRefreshToken },
    { timeout: 20000 },
  );

  await tokenStore.setTokens(data);
  return data.accessToken;
}

/**
 * Shared, de-duplicated refresh. The promise is cleared only once it settles,
 * so every 401 that arrives while a refresh is in flight awaits the same one.
 */
function refreshSession() {
  refreshInFlight =
    refreshInFlight ??
    performRefresh().finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    const recoverable =
      response?.status === 401 &&
      config != null &&
      !config._retried &&
      isRefreshable(config) &&
      Boolean(tokenStore.getRefreshToken());

    if (!recoverable) return Promise.reject(error);

    try {
      const accessToken = await refreshSession();

      // Set before the retry so a second 401 on the same request falls straight
      // through instead of looping.
      config._retried = true;
      config.headers.Authorization = `Bearer ${accessToken}`;
      return await apiClient(config);
    } catch (refreshError) {
      // The refresh itself failed — the session is over. Wipe the device copy
      // and let AuthContext return the user to sign-in with a message.
      logger.warn('session refresh failed; ending session');
      await tokenStore.endSession();
      return Promise.reject(refreshError);
    }
  },
);
