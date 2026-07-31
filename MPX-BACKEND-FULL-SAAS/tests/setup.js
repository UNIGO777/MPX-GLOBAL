// Runs before any test module imports app/env. dotenv (loaded inside env.js)
// does not override already-set process.env, so these win over .env.
process.env.NODE_ENV = 'test';
// ⚠️ Every test file wipes these collections in `beforeEach`, so TWO test
// processes pointed at the same database will delete each other's fixtures
// mid-run. The symptom is not an obvious clash: queries simply return 0 rows,
// failures scatter across unrelated tests, and nothing errors — it reads exactly
// like a flaky search engine. Diagnosing that cost hours. If you need a second
// concurrent run (a focused file while the suite runs, CI on a shared box), set
// MONGODB_TEST_DB to a different name for it.
process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${process.env.MONGODB_TEST_DB || 'mpx_global_test'}`;
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test_access_secret_at_least_32_chars_long_000';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_at_least_32_chars_long_00';

import { beforeEach, afterAll } from 'vitest';
import Redis from 'ioredis';

/**
 * Reset the rate-limit / quota state between EVERY test, globally.
 *
 * Limiter counters live in Redis and are keyed per IP — and every test hits the
 * API from 127.0.0.1. Without this, requests accumulate across test files until
 * a limiter fires mid-suite and an unrelated assertion fails with a 429. That
 * flake is order-dependent, so it appears and disappears between runs, which is
 * exactly the kind of thing that wastes hours.
 *
 * Doing it centrally means no future test file has to remember. Limits are still
 * genuinely exercised WITHIN a test (the counters only reset between cases), so
 * this weakens no coverage — `auth.test.js` still proves the OTP/auth limits and
 * `m2` still proves the upload limit.
 */
const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
let redisUsable = true;

beforeEach(async () => {
  if (!redisUsable) return;
  try {
    if (redis.status === 'wait' || redis.status === 'end') await redis.connect();
    await redis.flushdb();
  } catch {
    // No Redis locally → limiters fall back to an in-memory store per process,
    // which is already isolated. Never fail a test for this.
    redisUsable = false;
  }
});

afterAll(async () => {
  try {
    await redis.quit();
  } catch {
    /* already closed */
  }
});
