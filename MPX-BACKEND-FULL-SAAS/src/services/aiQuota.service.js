import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

// api-endpoints rule: "AI endpoints also need a per-organisation quota — an
// unbounded GPT endpoint is a billing incident waiting to happen." The rate
// limiter smooths bursts; THIS caps a day's spend per company.
//
// Guests have no organisation, so they are covered by the per-IP limiter alone.
const DAILY_LIMIT = 100;

function todayKey(orgId) {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `q:ai:${orgId}:${day}`;
}

/**
 * Consume one unit. Throws 429 when the org is out for the day.
 * Redis-absent (dev) degrades to a no-op — the same behaviour the rate limiters
 * already accept — never a hard failure.
 */
export async function consumeAiQuota(orgId) {
  if (!orgId) return;
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const key = todayKey(orgId);
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, 24 * 60 * 60);
    if (used > DAILY_LIMIT) {
      throw AppError.tooManyRequests(
        'ai quota exceeded',
        'Your organisation has reached its daily AI search limit. Please try again tomorrow.',
      );
    }
  } catch (err) {
    if (err?.statusCode === 429) throw err;
    // A Redis hiccup must not take the feature down.
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'ai quota check skipped');
  }
}

export const AI_DAILY_LIMIT = DAILY_LIMIT;
