import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies the API base path -> backend. The backend mounts routes at
// root (/auth, /employee, ...), so the base path is stripped on the way through.
// This keeps a clean /api namespace inside the app and avoids CORS in dev.
//
// Everything here comes from .env — `loadEnv` is needed because this file runs
// in Node, where import.meta.env does not exist. Keys: see .env.example.
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
