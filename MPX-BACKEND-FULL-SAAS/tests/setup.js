// Runs before any test module imports app/env. dotenv (loaded inside env.js)
// does not override already-set process.env, so these win over .env.
process.env.NODE_ENV = 'test';

/**
 * 🔴 ONE DATABASE PER TEST FILE. Do not collapse this back to a shared name.
 *
 * Every test file wipes Organisation / Category / Product / Conversation in its
 * `beforeEach`. When files shared a database, one file's cleanup deleted another
 * file's fixtures mid-request — and the symptom was deceptive: nothing errored,
 * queries just returned 0 rows, so failures scattered across unrelated tests and
 * read like a flaky search engine or a broken cursor. It cost hours of chasing
 * ghosts across this project, and it repeatedly hid whether a real defect
 * existed.
 *
 * Vitest gives each file its own forked process and a distinct
 * `VITEST_WORKER_ID` (verified: 0,1,2,3… never reused within a run), so that id
 * is a sound per-file key. Ids repeat across runs, which is what keeps the
 * database count bounded rather than growing forever.
 *
 * `MONGODB_TEST_DB` still overrides the base name, for a second concurrent run.
 */
const testDbBase = process.env.MONGODB_TEST_DB || 'mpx_global_test';
const workerId = process.env.VITEST_WORKER_ID ?? '0';
process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${testDbBase}_w${workerId}`;
process.env.REDIS_URL = 'redis://127.0.0.1:6379';

// 🔴 Pin the Cloudinary cloud name. `isOwnCloudinaryUrl` verifies that an image
// URL sits under `/<cloud>/`, and the fixtures build refs against `/demo/`. With
// this unset the suite fell through to whatever the developer's .env held, so a
// real cloud name silently failed 9 product tests with "untrusted image url" —
// a green suite that depended on a local file. Tests must not read it.
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test_access_secret_at_least_32_chars_long_000';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_at_least_32_chars_long_00';

// 🔴 Push OFF for the whole suite, regardless of what is in `.env`.
// Now that a real Firebase credential lives there, leaving it visible would make
// the tests behave differently on a machine that has one — and would let a test
// run reach out to Google. Tests that exercise push mock `push.client.js`
// outright; everything else must see an inert layer. Set to empty, not deleted,
// so `env.js`'s optional() check reads it as absent.
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '';

/**
 * 🔴 The SAME rule for the OpenAI key, for the same two reasons.
 *
 * A real `OPENAI_API_KEY` now lives in `.env`, and `isAiConfigured()` reads it
 * directly — so any test that reaches `POST /search/ai` WITHOUT mocking
 * `ai.client.js` makes a live, BILLABLE call to OpenAI and gets a
 * non-deterministic answer. The two existing AI test files happen to mock the
 * client, so this went unnoticed; the next one written would not have.
 *
 * Both AI suites mock `ai.client.js` outright (`isAiConfigured: () => true`),
 * so forcing this off costs no coverage — it only removes the accidental path
 * to a paid external service. Set to empty, not deleted, so `env.js`'s
 * `optional()` check reads it as absent.
 */
process.env.OPENAI_API_KEY = '';

import { beforeEach, afterAll } from 'vitest';
import Redis from 'ioredis';

/**
 * ⚠️ KNOWN, UNDERSTOOD, NOT FIXED: a rare `Parse Error: Expected HTTP/, RTSP/ or
 * ICE/` — roughly 1 full-suite run in 8. It is a supertest/OS artifact and has
 * never once corresponded to a product defect.
 *
 * Do NOT "fix" it by disabling HTTP keep-alive. That was tried twice here, and a
 * probe settled it: **supertest passes `agent: false`**, so it never touches
 * `http.globalAgent` and does no connection pooling at all. Setting
 * `globalAgent.keepAlive = false` is a pure no-op against this suite.
 *
 * The real cause is port churn: `request(app)` binds a FRESH ephemeral-port
 * server per call — ~59 in one file, thousands across the suite — so the OS
 * eventually hands a new server a port a previous connection has not finished
 * with. The real fix is one listening server per test FILE (`request(server)`
 * instead of `request(app)`), which is a deliberate refactor across every test
 * file, not a line in this one.
 */

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
