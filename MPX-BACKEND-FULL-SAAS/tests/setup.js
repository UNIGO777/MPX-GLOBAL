// Runs before any test module imports app/env. dotenv (loaded inside env.js)
// does not override already-set process.env, so these win over .env.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mpx_global_test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test_access_secret_at_least_32_chars_long_000';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_at_least_32_chars_long_00';
