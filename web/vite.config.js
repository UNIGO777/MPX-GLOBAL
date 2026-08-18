import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies the API base path -> backend. The backend mounts routes at
// root (/auth, /employee, ...), so the base path is stripped on the way through.
// This keeps a clean /api namespace inside the app and avoids CORS in dev.
//
// Everything here comes from .env — `loadEnv` is needed because this file runs
// in Node, where import.meta.env does not exist. Keys: see .env.example.
//
// 🔴 Both dev scripts MUST keep the proxy: `npm run dev` targets localhost:3000,
// `npm run dev:live` targets the live API — but in BOTH the browser only ever
// talks to localhost:5173, so the refresh cookie stays FIRST-PARTY. `dev:live`
// used to set VITE_API_BASE_URL to the live origin instead, which switched the
// proxy off (see the `startsWith('/')` guard below) and made every call
// cross-site: a SameSite=Lax cookie is not sent on a cross-site XHR, so the
// session silently died on every reload. Point dev:live at a different TARGET,
// never at a different BASE PATH.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const basePath = env.VITE_API_BASE_URL || '/api';
  const target = env.VITE_DEV_API_PROXY || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      proxy: {
        // Only a same-origin base path can be proxied; an absolute
        // VITE_API_BASE_URL means the app talks to the API directly (CORS).
        ...(basePath.startsWith('/')
          ? {
              [basePath]: {
                target,
                changeOrigin: true,
                // M4 (2026-08-17): the chat socket rides this same prefix
                // (`/api/socket.io`) so it stays SAME-ORIGIN in dev, exactly as
                // the XHR calls do. Without `ws: true` the upgrade request is
                // served by Vite instead of being forwarded, and the client
                // retries forever showing "Reconnecting…".
                ws: true,
                rewrite: (path) => path.replace(new RegExp(`^${basePath}`), ''),
                // 🔴 The refresh cookie is scoped `Path=/auth` by the server, but
                // through this proxy the browser calls `/api/auth/refresh` — a
                // path mismatch means the cookie is stored and then NEVER sent,
                // so silent restore would fail in dev only, with no error to see.
                // Rewrite the Set-Cookie path to match the proxied prefix.
                cookiePathRewrite: { '/auth': `${basePath}/auth` },
              },
            }
          : {}),
      },
    },
  };
});
