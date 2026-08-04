import axios from 'axios';

import { tokenStore } from '../auth/tokenStore.js';
import { config } from '../config.js';

/**
 * The ONE API client. Components never call axios/fetch directly — endpoint
 * functions in this folder go through here (rule: web-frontend.md).
 *
 * Interceptors:
 *  - request: attach the in-memory access token.
 *  - response: on 401, refresh ONCE and retry the original request. Concurrent
 *    401s share a single in-flight refresh (never a refresh stampede). If the
 *    refresh itself fails, the session is over — clear and notify.
 */
export const apiClient = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeoutMs,
  // The refresh token lives in an httpOnly cookie (A2). `withCredentials` is
  // what makes the browser attach it, and `X-Client: web` is what tells the
  // server to issue one — plus a CSRF second layer, since a cross-site form
  // cannot set a custom header without a preflight.
  withCredentials: true,
  headers: { 'X-Client': 'web' },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshInFlight = null;

/**
 * Exchange the refresh token for a new access token.
 *
 * The refresh token travels only as the httpOnly cookie, so there is nothing to
 * send and nothing for a script to steal. This is what makes a reload
 * survivable (A2).
 */
export function refreshSession() {
  // 🔴 SINGLE-FLIGHT, and it must live here rather than at the call sites.
  // Refresh ROTATES the token: two concurrent calls mean the second presents
  // the one the first just rotated away, which the server correctly treats as
  // theft and answers by revoking the whole family (A7) — killing the session
  // it was trying to restore. React StrictMode double-invokes effects in dev,
  // so the mount-time restore hit this every single load.
  refreshInFlight = refreshInFlight ?? doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh() {
  // Raw axios on purpose: the interceptor below must never recurse into itself.
  // No body: the httpOnly cookie IS the credential, which is exactly why this
  // works on a cold page load with nothing in memory.
  const { data } = await axios.post(
    `${apiClient.defaults.baseURL}/auth/refresh`,
    {},
    {
      timeout: config.api.timeoutMs,
      withCredentials: true,
      headers: { 'X-Client': 'web' },
    },
  );
  tokenStore.setTokens(data);
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthPath = config?.url?.startsWith('/auth/');

    // Only a 401 on a normal call, with a session to refresh, is recoverable.
    // Auth endpoints answer 401 as a real answer (bad credentials, bad OTP) —
    // never retry those.
    // Gate on "do we believe a session exists", NOT on holding a refresh token:
    // once the token lives only in the httpOnly cookie there is nothing in
    // memory to check, and testing for one would disable refresh entirely.
    if (response?.status !== 401 || config?._retried || isAuthPath || !tokenStore.hasSession()) {
      return Promise.reject(error);
    }

    try {
      const accessToken = await refreshSession();

      config._retried = true;
      config.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      tokenStore.endSession(); // refresh failed → the session is genuinely over
      return Promise.reject(refreshError);
    }
  },
);
