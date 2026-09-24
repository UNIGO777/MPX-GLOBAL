import { createHash } from 'node:crypto';

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

// Refresh gets its OWN budget, deliberately separate from `authLimiter`.
//
// 🔴 Why: the browser now calls /auth/refresh on EVERY page load to restore the
// session from the httpOnly cookie (A2). Sharing authLimiter's 10-per-15-min
// with OTP verify, signup verify and password reset meant ordinary navigation
// starved those endpoints — signup verification failed with "Too many requests"
// after a handful of page loads, and a 429 on restore reads to the client as
// "no session", silently signing the user out. Measured in a browser, 2026-08-04.
//
// A higher ceiling is safe here: the credential is an opaque 64-char rotating
// token, not a guessable code, and theft is caught by reuse detection revoking
// the family (A7) — not by counting attempts.
export const refreshLimiter = buildLimiter({
  prefix: 'rl:refresh:',
  windowMs: 15 * MINUTE,
  limit: 60,
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

/**
 * Module 4 · confirming acceptance of a quotation (request a code, then enter it).
 *
 * 🔴 Keyed on the AUTHENTICATED USER, not the IP. `otpKeyGenerator` falls back
 * to the ip when the body carries no identifier — and these routes carry none,
 * so under it one office behind a NAT would share a single budget and colleagues
 * would lock each other out of closing their own deals. `authenticate` runs
 * before this limiter, so the user is always there.
 *
 * The budget covers both routes together: sending a code and answering it are
 * the same activity, and the OTP challenge's own 5-attempt lock (A3) is what
 * stops guessing — this only stops a mailbox being flooded.
 */
export const quotationAcceptLimiter = buildLimiter({
  prefix: 'rl:q-accept:',
  windowMs: 10 * MINUTE,
  limit: 10,
  keyGenerator: (req) => (req.user?.userId ? `u:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`),
});

// D7 rule 6 · the claim code goes to SOMEONE ELSE's inbox — the member already
// in the company. So the budget is keyed on the SIGNUP TOKEN, not the target
// address and not only the IP: one signup must not be able to flood a stranger's
// mailbox by rotating IPs, and the recipient's address is never ours to key on.
// Hashed so the token itself never lands in Redis.
function signupTokenKeyGenerator(req) {
  const token = req.body?.signupToken;
  if (typeof token === 'string' && token) {
    return `st:${createHash('sha256').update(token).digest('hex')}`;
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
}

export const claimCodeLimiter = buildLimiter({
  prefix: 'rl:claim-code:',
  windowMs: 10 * MINUTE,
  limit: 3,
  keyGenerator: signupTokenKeyGenerator,
});

// A21: staff login / OTP has its OWN limiter (separate counter) so the staff
// endpoints and the buyer/exporter portal endpoints never share a rate budget.
export const staffOtpLimiter = buildLimiter({
  prefix: 'rl:staff-otp:',
  windowMs: 10 * MINUTE,
  limit: 5,
  keyGenerator: otpKeyGenerator,
});

// M2 (§A25.3 hardening): image-upload endpoints get their OWN, much tighter
// budget — the general limit (300/15min) × 5 files × 5 MB would allow ~7.5 GB of
// orphan-able Cloudinary uploads per window (the storage-abuse class the KYC
// doc-cap closed). Keyed per authenticated user (these routes sit behind
// `authenticate`), IP as fallback.
export const uploadLimiter = buildLimiter({
  prefix: 'rl:upload:',
  windowMs: 60 * MINUTE,
  limit: 30,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`),
});

// M3: the api-endpoints rule names **search** among the endpoints that must be
// rate limited, and a `$text` + `$facet` request costs far more than the plain
// reads `generalLimiter` is sized for. `/public/products` (M2 browse) stays on
// the general limiter — it is still a cheap read.
export const searchLimiter = buildLimiter({
  prefix: 'rl:search:',
  windowMs: 5 * MINUTE,
  limit: 120,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`),
});

// M4 (G12): thread creation. M4-5 makes "one enquiry per product" the control on
// THREADS, and M4-27 deliberately accepts that a blocked buyer can still open a
// thread on another product — which makes spraying enquiries across a catalogue
// the obvious abuse path. Keyed per authenticated user (the route is behind
// `authenticate`), IP as fallback.
// Step 1b · raising a support ticket, per user. Replies use `uploadLimiter`
// (they may carry a file); this caps NEW tickets so the queue cannot be flooded.
export const ticketLimiter = buildLimiter({
  prefix: 'rl:ticket:',
  windowMs: 24 * 60 * MINUTE,
  limit: 20,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`),
});

export const enquiryLimiter = buildLimiter({
  prefix: 'rl:enquiry:',
  windowMs: 60 * MINUTE,
  limit: 20,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`),
});

// M4 (G12): message sends. M4-5 makes "one enquiry per product" the control on
// THREADS — it says nothing about how many messages may flow inside one, so
// without this a single open thread is an unbounded write endpoint. Generous
// enough that real conversation never touches it.
export const messageLimiter = buildLimiter({
  prefix: 'rl:message:',
  windowMs: MINUTE,
  limit: 60,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`),
});

// AI search is the expensive one (an external paid call per request), so it gets
// the tightest budget. Per user when signed in, per IP for guests; a separate
// per-ORGANISATION daily quota sits on top (services/aiQuota.service.js).
export const aiLimiter = buildLimiter({
  prefix: 'rl:ai:',
  windowMs: 10 * MINUTE,
  limit: 20,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`),
});
