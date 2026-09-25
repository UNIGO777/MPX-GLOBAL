import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // 60 s (was 30 s, 2026-09-25): auth tests do several deliberately slow
    // argon2 hashes each, and under a loaded machine one occasionally crossed
    // 30 s and failed with a bare timeout (seen twice that day, never
    // reproducible on its own). CI runners are slower still.
    testTimeout: 60000,
    hookTimeout: 60000,
    // Test files share one Mongo/Redis, so don't run them in parallel.
    fileParallelism: false,
  },
});
