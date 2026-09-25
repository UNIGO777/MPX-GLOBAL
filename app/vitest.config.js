import { defineConfig } from 'vitest/config';

// App logic tests (2026-09-25): plain-JS modules only, run in Node. Anything
// that imports react-native is mocked at the test, never rendered here —
// screens need a device or an emulator.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
});
