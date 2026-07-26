import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api -> backend (default :3000). The backend mounts routes at root
// (/auth, /employee, ...), so we strip the /api prefix on the way through. This keeps a clean
// /api namespace inside the app and avoids CORS in development. Change `target` if the
// backend PORT differs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
