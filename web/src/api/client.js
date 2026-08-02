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
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshInFlight = null;

async function refreshSession() {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) throw new Error('no refresh token');
  // Raw axios on purpose: the interceptor below must never recurse into itself.
  const { data } = await axios.post(
    `${apiClient.defaults.baseURL}/auth/refresh`,
    { refreshToken },
    { timeout: config.api.timeoutMs },
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
    if (response?.status !== 401 || config?._retried || isAuthPath || !tokenStore.getRefreshToken()) {
      return Promise.reject(error);
    }

    try {
      refreshInFlight = refreshInFlight ?? refreshSession();
      const accessToken = await refreshInFlight;
      refreshInFlight = null;

      config._retried = true;
      config.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      refreshInFlight = null;
      tokenStore.endSession(); // refresh failed → the session is genuinely over
      return Promise.reject(refreshError);
    }
  },
);
