import { env } from '../config/env.js';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

// api-endpoints rule: "AI endpoints also need a per-organisation quota — an
// unbounded GPT endpoint is a billing incident waiting to happen." The rate
// limiter smooths bursts; THIS caps a day's spend.
//
// Two separate controls live here, and they behave DIFFERENTLY on purpose:
//   · Signed-in orgs  → `consumeAiQuota`  — throws 429 when out.
//   · Guests          → `guestAiAllowed`  — never throws; returns false and the
//                        caller degrades to keyword results (agreement §3.3).
const DAILY_LIMIT = 100;

// 🔴 Reset boundary: `toISOString()` is UTC, so every counter here rolls over at
// UTC midnight — 05:30 IST. Agreement §3.3 says the fallback lasts "for the
// remainder of that period" without defining the period, so this is the
// definition. Documented in `.env.example` too: a later "why did the ceiling
// reset at half five in the morning" question needs an answer on record.
function dayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function todayKey(orgId) {
  return `q:ai:${orgId}:${dayStamp()}`;
}

// ONE key for every unauthenticated visitor combined — deliberately not per IP.
// CGNAT puts thousands of legitimate Indian mobile users behind a single
// address, so a per-IP daily cap would lock out real users while an abuser just
// rotates addresses. The Client's OpenAI bill is a global quantity, so the cap
// that protects it is global too. Burst abuse is still handled per-IP by
// `aiLimiter` in `rateLimit.js`.
function guestTodayKey() {
  return `q:ai:guest:${dayStamp()}`;
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
    // Set the TTL on EVERY call, not just the first (review fix): a crash or a
    // dropped connection between INCR and EXPIRE would otherwise leave a
    // never-expiring counter, permanently locking that company out of AI search.
    // Re-setting it is harmless — the key is date-stamped, so it is replaced at
    // midnight regardless of when the TTL was last touched.
    await redis.expire(key, 24 * 60 * 60);
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

/**
 * Guest ceiling — agreement §3.3 / §5.1.
 *
 * Returns `true` if an unauthenticated visitor may spend an AI call right now.
 * NEVER throws and never produces an error response: when it returns false the
 * caller runs the ordinary keyword search and flags it `fallback: true`, which
 * §3.3 records as "the designed behaviour of the cost control and … not a
 * Defect within the meaning of Clause 9".
 *
 * 🔴 FAIL-CLOSED, unlike `consumeAiQuota` above. This is a spend control, so the
 * safe direction when it cannot be evaluated is "don't spend". If Redis is
 * unreachable we cannot count, and failing open would mean the one day the
 * counter breaks is the day billing runs unbounded. §3.3 covers this explicitly:
 * "or where the supporting infrastructure for these controls is temporarily
 * unavailable". Signed-in users are unaffected either way.
 */
export async function guestAiAllowed() {
  const limit = env.AI_GUEST_DAILY_MAX;
  // Unset is only reachable outside production — `env.js` refuses to boot a
  // production process without it. There, no ceiling is configured, so no
  // ceiling applies.
  if (limit == null) return true;

  const redis = getRedisClient();
  if (!redis) {
    logger.warn('guest ai ceiling: no redis — refusing AI for guests (fail-closed)');
    return false;
  }

  try {
    const key = guestTodayKey();
    const used = await redis.incr(key);
    // TTL on every call, same reasoning as the org counter: a crash between
    // INCR and EXPIRE would otherwise leave a counter that never resets.
    await redis.expire(key, 24 * 60 * 60);
    return used <= limit;
  } catch (err) {
    logger.warn(
      { err: { name: err?.name, message: err?.message } },
      'guest ai ceiling check failed — refusing AI for guests (fail-closed)',
    );
    return false;
  }
}

export const AI_DAILY_LIMIT = DAILY_LIMIT;
