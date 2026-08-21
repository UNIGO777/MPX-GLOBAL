import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import Redis from 'ioredis';

/**
 * The GUEST AI ceiling (`guestAiAllowed` in `aiQuota.service.js`).
 *
 * This is a contractual control, not a nicety. Agreement §3.3 says the AI search
 * is "reachable by visitors as well as logged-in users, with rate limiting and
 * query controls applied", and names this one specifically: "a configurable
 * daily ceiling on total AI-assisted search usage by visitors who are not signed
 * in", whose value "is set by the Client" (§5.1) because the OpenAI cost is on
 * their account (§8.1).
 *
 * Two behaviours matter and both are asserted here:
 *  1. Over the ceiling, a guest gets ORDINARY KEYWORD RESULTS — not a 429, not
 *     an error. §3.3: "This is the designed behaviour of the cost control and is
 *     not a Defect within the meaning of Clause 9." A test that accepted an
 *     error response here would be enshrining a contract breach.
 *  2. It FAILS CLOSED. Unlike the per-org quota (which degrades to a no-op when
 *     Redis is unreachable), a spend control that cannot count must not spend.
 *
 * The ceiling is deliberately GLOBAL — one counter for all guests, not per IP.
 * CGNAT puts thousands of legitimate Indian mobile users behind one address.
 */

// Must be set before `src/config/env.js` is imported: the schema is parsed once
// at module load and the result frozen, so there is no way to change it later.
vi.hoisted(() => {
  process.env.AI_GUEST_DAILY_MAX = '3';
});

vi.mock('../src/services/otp.sender.js', () => ({ sendOtp: async () => {} }));

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { guestAiAllowed } from '../src/services/aiQuota.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { signAccessToken } from '../src/services/token.service.js';

const app = createApp();
const CEILING = 3;
let redis;
let seq = 0;

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const today = () => new Date().toISOString().slice(0, 10);
const guestKey = () => `q:ai:guest:${today()}`;

async function makeBuyer() {
  seq += 1;
  const org = await Organisation.create({
    name: `Ceiling Co ${seq}`,
    type: 'business',
    buyerSide: true,
    country: 'IN',
  });
  const number = `95${1000000 + seq}`;
  const user = await User.create({
    name: 'Ceiling Buyer',
    email: `ceiling_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'buyer',
    orgId: org._id,
    isActive: true,
  });
  return { org, token: signAccessToken(user) };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const n of mongoose.modelNames()) await mongoose.model(n).syncIndexes();
  redis = new Redis(process.env.REDIS_URL);
});

afterAll(async () => {
  await mongoose.disconnect();
  await redis.quit();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Organisation.deleteMany({})]);
  await redis.flushdb();
});

describe('guest AI ceiling — the unit', () => {
  it('counts every guest into ONE shared key, not one key per caller', async () => {
    await guestAiAllowed();
    await guestAiAllowed();

    expect(await redis.get(guestKey())).toBe('2');
    // Exactly one guest key — a per-IP design would have produced several.
    expect(await redis.keys('q:ai:guest:*')).toHaveLength(1);
  });

  it('allows exactly the ceiling and refuses the one after it', async () => {
    await redis.set(guestKey(), String(CEILING - 1));

    // The call landing exactly ON the ceiling is still allowed.
    await expect(guestAiAllowed()).resolves.toBe(true);
    // The next one is not.
    await expect(guestAiAllowed()).resolves.toBe(false);
  });

  it('stays refused for the rest of the day once passed', async () => {
    await redis.set(guestKey(), String(CEILING));
    for (let i = 0; i < 3; i += 1) {
      await expect(guestAiAllowed()).resolves.toBe(false);
    }
  });

  it('re-stamps the TTL on every call, so guests can never be locked out forever', async () => {
    await guestAiAllowed();
    await redis.persist(guestKey());
    expect(await redis.ttl(guestKey())).toBe(-1);

    await guestAiAllowed();
    expect(await redis.ttl(guestKey())).toBeGreaterThan(0);
  });

  it("is scoped per day — yesterday's exhausted ceiling does not carry over", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await redis.set(`q:ai:guest:${yesterday}`, String(CEILING * 10));

    await expect(guestAiAllowed()).resolves.toBe(true);
    expect(await redis.get(guestKey())).toBe('1');
  });

  it('🔴 FAILS CLOSED when Redis cannot be reached — never throws, just refuses', async () => {
    const { getRedisClient } = await import('../src/config/redis.js');
    const spy = vi.spyOn(await import('../src/config/redis.js'), 'getRedisClient');
    spy.mockReturnValue(null);

    // A spend control that cannot count must not spend. §3.3 covers this as
    // "the supporting infrastructure for these controls is temporarily
    // unavailable" — the visitor gets keyword results, not an error.
    await expect(guestAiAllowed()).resolves.toBe(false);

    spy.mockRestore();
    expect(typeof getRedisClient).toBe('function');
  });
});

describe('guest AI ceiling — through the endpoint', () => {
  it('🔴 over the ceiling a guest gets 200 + keyword results, NOT an error', async () => {
    await redis.set(guestKey(), String(CEILING));

    const res = await request(app).post('/search/ai').send({ query: 'cotton fabric' });

    // The whole point: degradation, not failure. A 429 here would breach §3.3.
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.products).toBeDefined();
  });

  it('🔴 a signed-in user is UNAFFECTED when the guest ceiling is exhausted', async () => {
    const { org, token } = await makeBuyer();
    await redis.set(guestKey(), String(CEILING * 100));

    const res = await request(app)
      .post('/search/ai')
      .set(bearer(token))
      .send({ query: 'cotton fabric' });

    expect(res.status).toBe(200);
    // They spent their OWN org quota, and never touched the guest counter.
    expect(await redis.get(`q:ai:${org._id.toString()}:${today()}`)).toBe('1');
    expect(await redis.get(guestKey())).toBe(String(CEILING * 100));
  });

  it('a guest under the ceiling consumes one unit of it', async () => {
    const res = await request(app).post('/search/ai').send({ query: 'cotton' });

    expect(res.status).toBe(200);
    expect(await redis.get(guestKey())).toBe('1');
  });
});
