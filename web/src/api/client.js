import axios from 'axios';

// The ONE API client. Components/hooks never call axios or fetch directly — they go through
// here (rule: web-frontend.md). Interceptors (attach in-memory access token; 401 -> silent
// refresh -> retry once, else logout) wire in with the auth module.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true, // refresh token travels in an httpOnly cookie
  timeout: 15000,
});

// TODO(auth): apiClient.interceptors.request — attach `Authorization: Bearer <accessToken>`
//             from the in-memory auth store (never localStorage).
// TODO(auth): apiClient.interceptors.response — on 401, refresh once then retry; else log out.
