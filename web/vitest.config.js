import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Web tests (2026-09-25). Kept apart from vite.config.js so the dev-server
// proxy setup never runs under test. jsdom stands in for the browser.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
  },
});
