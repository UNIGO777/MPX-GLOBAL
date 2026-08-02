import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import Redis from 'ioredis';

/**
 * The per-organisation daily AI quota (`aiQuota.service.js`).
 *
 * `.claude/rules/api-endpoints.md` states it in as many words: "AI endpoints
 * also need a per-organisation quota — an unbounded GPT endpoint is a billing
 * incident waiting to happen." The rate limiter smooths bursts; THIS caps a
 * day's spend per company, and it was the one control in M3's own definition of
 * done with no test behind it.
 *
 * Everything here is exercised against real Redis, because the whole control IS
 * the Redis counter — mocking it would test nothing.
 */

vi.mock('../src/services/otp.sender.js', () => ({ sendOtp: async () => {} }));

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { OtpChallenge } from '../src/models/OtpChallenge.js';
import { consumeAiQuota, AI_DAILY_LIMIT } from '../src/services/aiQuota.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { signAccessToken } from '../src/services/token.service.js';

const app = createApp();
let redis;
let seq = 0;

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const today = () => new Date().toISOString().slice(0, 10);
const quotaKey = (orgId) => `q:ai:${orgId}:${today()}`;

async function makeBuyer() {
  seq += 1;
  const org = await Organisation.create({
    name: `Quota Co ${seq}`,
    type: 'business',
    buyerSide: true,
    country: 'IN',
  });
  const number = `94${1000000 + seq}`;
  const user = await User.create({
    name: 'Quota Buyer',
    email: `quota_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'buyer',
    orgId: org._id,
    isActive: true,
  });
  return { org, user, token: signAccessToken(user) };
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
  await Promise.all([User.deleteMany({}), Organisation.deleteMany({}), OtpChallenge.deleteMany({})]);
  await redis.flushdb();
});

describe('per-organisation daily AI quota — the unit', () => {
  it('counts one call per use, against a date-stamped per-org key', async () => {
    const orgId = new mongoose.Types.ObjectId().toString();

    await consumeAiQuota(orgId);
    await consumeAiQuota(orgId);
    await consumeAiQuota(orgId);

    expect(await redis.get(quotaKey(orgId))).toBe('3');
  });

  it('allows exactly the daily limit and refuses the one after it', async () => {
    const orgId = new mongoose.Types.ObjectId().toString();
    // Seed the counter to one below the cap rather than looping 100 times.
    await redis.set(quotaKey(orgId), String(AI_DAILY_LIMIT - 1));

    // The call that lands exactly ON the limit still goes through.
    await expect(consumeAiQuota(orgId)).resolves.toBeUndefined();
    expect(await redis.get(quotaKey(orgId))).toBe(String(AI_DAILY_LIMIT));

    // The next one is refused.
    await expect(consumeAiQuota(orgId)).rejects.toMatchObject({
      statusCode: 429,
      clientMessage: expect.stringMatching(/daily ai search limit/i),
    });
  });

  it('stays refused for the rest of the day once the cap is passed', async () => {
    const orgId = new mongoose.Types.ObjectId().toString();
    await redis.set(quotaKey(orgId), String(AI_DAILY_LIMIT));

    for (let i = 0; i < 3; i += 1) {
      await expect(consumeAiQuota(orgId)).rejects.toMatchObject({ statusCode: 429 });
    }
  });

  it('🔴 re-stamps the TTL on EVERY call, so a company can never be locked out forever', async () => {
    const orgId = new mongoose.Types.ObjectId().toString();

    await consumeAiQuota(orgId);
    const firstTtl = await redis.ttl(quotaKey(orgId));
    expect(firstTtl).toBeGreaterThan(0);
    expect(firstTtl).toBeLessThanOrEqual(24 * 60 * 60);

    // Simulate the failure this guards against: a crash between INCR and EXPIRE
    // leaving a key with no expiry at all.
    await redis.persist(quotaKey(orgId));
    expect(await redis.ttl(quotaKey(orgId))).toBe(-1); // -1 = no TTL

    await consumeAiQuota(orgId);
    expect(await redis.ttl(quotaKey(orgId))).toBeGreaterThan(0); // repaired
  });

  it('is scoped per organisation — one company exhausting it does not touch another', async () => {
    const a = new mongoose.Types.ObjectId().toString();
    const b = new mongoose.Types.ObjectId().toString();

    await redis.set(quotaKey(a), String(AI_DAILY_LIMIT));
    await expect(consumeAiQuota(a)).rejects.toMatchObject({ statusCode: 429 });

    await expect(consumeAiQuota(b)).resolves.toBeUndefined();
    expect(await redis.get(quotaKey(b))).toBe('1');
  });

  it('is scoped per day — yesterday\'s exhausted counter does not carry over', async () => {
    const orgId = new mongoose.Types.ObjectId().toString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await redis.set(`q:ai:${orgId}:${yesterday}`, String(AI_DAILY_LIMIT * 5));

    await expect(consumeAiQuota(orgId)).resolves.toBeUndefined();
    expect(await redis.get(quotaKey(orgId))).toBe('1');
  });

  it('a guest has no organisation, so nothing is counted (the per-IP limiter covers them)', async () => {
    await expect(consumeAiQuota(undefined)).resolves.toBeUndefined();
    await expect(consumeAiQuota(null)).resolves.toBeUndefined();
    await expect(consumeAiQuota('')).resolves.toBeUndefined();

    const keys = await redis.keys('q:ai:*');
    expect(keys).toEqual([]);
  });
});

describe('per-organisation daily AI quota — through the endpoint', () => {
  it('🔴 refuses POST /search/ai once the company is out for the day', async () => {
    const { org, token } = await makeBuyer();
    await redis.set(quotaKey(org._id.toString()), String(AI_DAILY_LIMIT));

    const res = await request(app)
      .post('/search/ai')
      .set(bearer(token))
      .send({ query: 'cotton fabric in bulk' });

    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/daily ai search limit/i);
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('a signed-in caller consumes their own org quota; the response is unaffected below the cap', async () => {
    const { org, token } = await makeBuyer();

    const res = await request(app)
      .post('/search/ai')
      .set(bearer(token))
      .send({ query: 'cotton fabric' });

    // No OpenAI key in tests → the documented keyword fallback, never a 5xx.
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(await redis.get(quotaKey(org._id.toString()))).toBe('1');
  });

  it('two companies searching in the same day keep separate budgets', async () => {
    const a = await makeBuyer();
    const b = await makeBuyer();

    await request(app).post('/search/ai').set(bearer(a.token)).send({ query: 'cotton' });
    await request(app).post('/search/ai').set(bearer(a.token)).send({ query: 'silk' });
    await request(app).post('/search/ai').set(bearer(b.token)).send({ query: 'cotton' });

    expect(await redis.get(quotaKey(a.org._id.toString()))).toBe('2');
    expect(await redis.get(quotaKey(b.org._id.toString()))).toBe('1');
  });

  it('a guest may still search — no org, so no quota key is created', async () => {
    const res = await request(app).post('/search/ai').send({ query: 'cotton fabric' });
    expect(res.status).toBe(200);
    expect(await redis.keys('q:ai:*')).toEqual([]);
  });

  it('the quota is a SEPARATE control from the rate limiter — it fires on its own', async () => {
    const { org, token } = await makeBuyer();
    // Well under the aiLimiter's 20-per-10-minutes, but out of daily quota.
    await redis.set(quotaKey(org._id.toString()), String(AI_DAILY_LIMIT + 5));

    const res = await request(app).post('/search/ai').set(bearer(token)).send({ query: 'cotton' });

    expect(res.status).toBe(429);
    // The limiter's message is different — this must be the QUOTA's.
    expect(res.body.error.message).toMatch(/daily ai search limit/i);
    expect(res.body.error.message).not.toMatch(/slow down/i);
  });
});
