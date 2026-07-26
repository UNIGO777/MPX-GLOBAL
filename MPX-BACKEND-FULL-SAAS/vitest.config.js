import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Test files share one Mongo/Redis, so don't run them in parallel.
    fileParallelism: false,
  },
});
