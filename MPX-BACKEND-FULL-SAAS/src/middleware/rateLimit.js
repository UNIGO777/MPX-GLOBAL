import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import { env } from '../config/env.js';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

const MINUTE = 60_000;

// A Redis-backed store keeps counts shared across processes and across restarts.
// In production its absence is fatal — a per-process memory store would silently
// weaken the limit. In dev/test we fall back to memory with a warning.
function makeStore(prefix) {
  const redis = getRedisClient();
  if (redis) {
    return new RedisStore({ prefix, sendCommand: (...args) => redis.call(...args) });
  }
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'REDIS_URL is required in production: rate limits must survive restarts and hold across processes',
    );
  }
  logger.warn({ prefix }, 'rate limiter using in-memory store (no REDIS_URL) — dev/test only');
  return undefined; // express-rate-limit falls back to its MemoryStore
}

// Surface a 429 through the central error handler for a consistent envelope.
function limitHandler(req, res, next) {
  next(
    new AppError('rate limit exceeded', {
      statusCode: 429,
      clientMessage: 'Too many requests. Please slow down and try again later.',
    }),
  );
}

function buildLimiter({ prefix, windowMs, limit, keyGenerator }) {
  const store = makeStore(prefix);
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limitHandler,
    ...(keyGenerator ? { keyGenerator } : {}),
    ...(store ? { store } : {}),
  });
}

// General API traffic.
export const generalLimiter = buildLimiter({
  prefix: 'rl:general:',
  windowMs: env.RATE_LIMIT_WINDOW_MS ?? 15 * MINUTE,
  limit: env.RATE_LIMIT_MAX ?? 300,
});

// Login / credential endpoints — strict, per IP.
export const authLimiter = buildLimiter({
  prefix: 'rl:auth:',
  windowMs: 15 * MINUTE,
  limit: 10,
});

// OTP endpoints — stricter, and keyed per identifier (email / mobile) rather
// than only per IP, so an attacker rotating IPs still can't fan out OTP requests
// against one account. Falls back to the IP when no identifier is present.
// Requires req.body to be parsed first (mount after express.json()).
function otpKeyGenerator(req) {
  const raw = req.body?.identifier ?? req.body?.email ?? req.body?.mobile?.number ?? req.body?.mobile;
  if (raw != null && String(raw).trim() !== '') {
    // A21: scope the budget by portal so a buyer and an exporter on the SAME email
    // get INDEPENDENT OTP-request budgets (one burning it must not lock the other).
    // Only /auth/login + /auth/forgot-password carry a portal; staff endpoints have
    // none, so their key is unchanged. (Mongo operators are rejected globally before
    // here, so `portal` is a plain string or absent.)
    const portal = req.body?.portal;
    const scope = portal ? `:${String(portal).trim().toLowerCase()}` : '';
    return `id:${String(raw).trim().toLowerCase()}${scope}`;
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
}

export const otpLimiter = buildLimiter({
  prefix: 'rl:otp:',
  windowMs: 10 * MINUTE,
  limit: 5,
  keyGenerator: otpKeyGenerator,
});

// A21: staff login / OTP has its OWN limiter (separate counter) so the staff
// endpoints and the buyer/exporter portal endpoints never share a rate budget.
export const staffOtpLimiter = buildLimiter({
  prefix: 'rl:staff-otp:',
  windowMs: 10 * MINUTE,
  limit: 5,
  keyGenerator: otpKeyGenerator,
});
