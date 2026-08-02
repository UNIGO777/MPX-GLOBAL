import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

/**
 * `optionalAuthenticate` — the "public, but nicer if it knows you" middleware.
 *
 * It guards exactly one route today (`POST /search/ai`), and it is the only
 * auth middleware in the codebase that must NEVER throw: a bad token has to
 * downgrade the caller to a guest rather than fail the request. That is a
 * genuinely awkward contract — the failure mode is not a 401, it is silently
 * treating a REVOKED session as a trusted one — and it had no direct test.
 *
 * The per-organisation AI quota key is the observable: it is written only when
 * `req.user.orgId` was populated. So "was I authenticated?" is answerable
 * without adding a debug endpoint.
 */

vi.mock('../src/services/otp.sender.js', () => ({ sendOtp: async () => {} }));

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { hashPassword } from '../src/services/password.service.js';
import { signAccessToken, signLoginToken } from '../src/services/token.service.js';
import { env } from '../src/config/env.js';

const app = createApp();
let redis;
let seq = 0;

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const today = () => new Date().toISOString().slice(0, 10);
const quotaKey = (orgId) => `q:ai:${orgId}:${today()}`;

async function makeBuyer() {
  seq += 1;
  const org = await Organisation.create({
    name: `Opt Co ${seq}`,
    type: 'business',
    buyerSide: true,
    country: 'IN',
  });
  const number = `91${5000000 + seq}`;
  const user = await User.create({
    name: 'Opt Buyer',
    email: `opt_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'buyer',
    orgId: org._id,
    isActive: true,
  });
  return { org, user, token: signAccessToken(user) };
}

/** Did the request arrive authenticated? Only then is an org quota counted. */
const wasAuthenticated = async (orgId) => (await redis.get(quotaKey(orgId))) !== null;

const aiSearch = (headers) => {
  const req = request(app).post('/search/ai');
  if (headers) req.set(headers);
  return req.send({ query: 'cotton fabric' });
};

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

describe('optionalAuthenticate — a valid session is recognised', () => {
  it('populates the caller so the per-org quota can key on them', async () => {
    const { org, token } = await makeBuyer();

    const res = await aiSearch(bearer(token));

    expect(res.status).toBe(200);
    expect(await wasAuthenticated(org._id.toString())).toBe(true);
  });
});

describe('🔴 optionalAuthenticate — every bad token becomes a GUEST, never a 401', () => {
  const cases = [
    ['no Authorization header at all', null],
    ['an empty Authorization header', { Authorization: '' }],
    ['the wrong scheme', { Authorization: 'Basic dXNlcjpwYXNz' }],
    ['Bearer with nothing after it', { Authorization: 'Bearer' }],
    ['a garbage token', { Authorization: 'Bearer not-a-jwt-at-all' }],
    ['a structurally valid but unsigned token', { Authorization: 'Bearer aaa.bbb.ccc' }],
  ];

  for (const [label, headers] of cases) {
    it(`${label} → 200 as a guest`, async () => {
      const res = await aiSearch(headers);
      expect(res.status).toBe(200);
      // It answered the search rather than rejecting the caller.
      expect(res.body.type).toBe('product');
      expect(await redis.keys('q:ai:*')).toEqual([]);
    });
  }

  it('a token signed with the WRONG secret is a guest, not a caller', async () => {
    const { org, user } = await makeBuyer();
    const forged = jwt.sign(
      { sub: String(user._id), tv: user.tokenVersion, typ: 'access' },
      'a-different-secret-that-is-long-enough-32',
      { expiresIn: '15m' },
    );

    const res = await aiSearch(bearer(forged));

    expect(res.status).toBe(200);
    expect(await wasAuthenticated(org._id.toString())).toBe(false);
  });

  it('an EXPIRED token is a guest', async () => {
    const { org, user } = await makeBuyer();
    const expired = jwt.sign(
      { sub: String(user._id), tv: user.tokenVersion, typ: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-1m' },
    );

    const res = await aiSearch(bearer(expired));

    expect(res.status).toBe(200);
    expect(await wasAuthenticated(org._id.toString())).toBe(false);
  });

  it('🔴 a LOGIN-PENDING token cannot buy trust here either (typ confusion)', async () => {
    const { org, user } = await makeBuyer();
    const pending = signLoginToken(user, 'otp');

    const res = await aiSearch(bearer(pending));

    expect(res.status).toBe(200);
    expect(await wasAuthenticated(org._id.toString())).toBe(false);
  });

  it('a valid signature over a user who no longer exists is a guest', async () => {
    const { org, user, token } = await makeBuyer();
    await User.deleteOne({ _id: user._id });

    const res = await aiSearch(bearer(token));

    expect(res.status).toBe(200);
    expect(await wasAuthenticated(org._id.toString())).toBe(false);
  });
});

describe('🔴 optionalAuthenticate — a REVOKED session downgrades to guest', () => {
  it('a stale tokenVersion is not partially trusted', async () => {
    const { org, user, token } = await makeBuyer();

    // The same bump a password change / deactivation / org block performs.
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });

    const res = await aiSearch(bearer(token));

    expect(res.status).toBe(200);
    // The crucial assertion: the request was NOT attributed to that company.
    expect(await wasAuthenticated(org._id.toString())).toBe(false);
  });

  it('a DEACTIVATED user is not authenticated, even with a live token', async () => {
    const { org, user, token } = await makeBuyer();
    await User.updateOne({ _id: user._id }, { $set: { isActive: false } });

    const res = await aiSearch(bearer(token));

    expect(res.status).toBe(200);
    expect(await wasAuthenticated(org._id.toString())).toBe(false);
  });

  it('a user whose whole ORG was blocked is not authenticated', async () => {
    const { org, user, token } = await makeBuyer();
    // An org block cascades exactly this onto every user row (F1-A).
    await User.updateOne(
      { _id: user._id },
      { $set: { isActive: false }, $inc: { tokenVersion: 1 } },
    );
    await Organisation.updateOne({ _id: org._id }, { $set: { isActive: false } });

    const res = await aiSearch(bearer(token));

    expect(res.status).toBe(200);
    expect(await wasAuthenticated(org._id.toString())).toBe(false);
  });
});

describe('optionalAuthenticate — the route stays declared and public', () => {
  it('the boot route-guard accepts it as an access-control declaration', () => {
    // createApp() runs assertRoutesGuarded(); reaching this line means the
    // `__public` marker on optionalAuthenticate satisfied it.
    expect(createApp()).toBeTruthy();
  });

  it('a bad token never leaks WHY it was rejected — the body is a normal result', async () => {
    const res = await aiSearch({ Authorization: 'Bearer aaa.bbb.ccc' });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toMatch(/token|jwt|expired|signature/i);
  });
});
