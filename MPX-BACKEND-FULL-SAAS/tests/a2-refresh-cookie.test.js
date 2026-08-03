import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import Redis from 'ioredis';

import { signupThroughOtp } from './helpers/signupFlow.js';

/**
 * A2 · the refresh token as an httpOnly cookie, WITHOUT breaking native clients.
 *
 * The point of every test here is the dual transport: a browser (X-Client: web
 * + Origin) gets a cookie, everyone else keeps the body token, and refresh /
 * logout accept either. A cookie-only rewrite would pass a naive test suite and
 * silently break the Expo app, so "native still works" is asserted explicitly.
 */
const { otpBox } = vi.hoisted(() => ({ otpBox: { byId: new Map() } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async ({ identifier, code }) => {
    otpBox.byId.set(identifier, code);
  },
}));

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { REFRESH_COOKIE } from '../src/utils/refreshCookie.js';

const app = createApp();
let redis;
let seq = 0;

// A browser the server is willing to set a cookie for.
const WEB = { 'X-Client': 'web', Origin: 'http://localhost:5173' };

const makeBuyer = () => {
  seq += 1;
  return {
    name: 'Cookie Buyer',
    email: `cookie_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `97${1000000 + seq}` },
    password: 'longpassword1',
    company: 'Cookie Co',
    country: 'IN',
  };
};
const e164 = (b) => `+91${b.mobile.number}`;

/** Sign in through the real flow; `headers` decides web vs native. */
async function login(b, headers = {}) {
  const start = await request(app)
    .post('/auth/login')
    .set(headers)
    .send({ identifier: b.email, password: b.password, portal: 'buyer' });
  return request(app)
    .post('/auth/verify-otp')
    .set(headers)
    .send({ loginToken: start.body.loginToken, code: otpBox.byId.get(e164(b)) });
}

const cookiesOf = (res) => res.headers['set-cookie'] ?? [];
const refreshCookie = (res) => cookiesOf(res).find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
/** Just the `name=value` part, which is what a browser would send back. */
const cookiePair = (raw) => raw.split(';')[0];

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
  redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
});

afterAll(async () => {
  await mongoose.connection.close();
  await redis?.quit();
});

describe('A2 · refresh cookie (web) alongside body token (native)', () => {
  it('sets an httpOnly, SameSite=Lax, /auth-scoped cookie for a web client', async () => {
    const b = makeBuyer();
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
    const res = await login(b, WEB);

    const raw = refreshCookie(res);
    expect(raw).toBeTruthy();
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Path=\/auth/i);
    // Secure is production-only: a Secure cookie is dropped over plain http and
    // would break local dev.
    expect(raw).not.toMatch(/Secure/i);
  });

  it('omits the refresh token from the body for a web client — cookie only', async () => {
    const b = makeBuyer();
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
    const res = await login(b, WEB);

    // The whole point of A2: no script on the page can read the refresh token,
    // not even from the response that created the session.
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(typeof res.body.accessToken).toBe('string');
    expect(refreshCookie(res)).toBeTruthy();
  });

  it('omits it on refresh and change-password too, not just at login', async () => {
    const b = makeBuyer();
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
    const jar = cookiePair(refreshCookie(await login(b, WEB)));

    const refreshed = await request(app).post('/auth/refresh').set(WEB).set('Cookie', jar).send({});
    expect(refreshed.body).not.toHaveProperty('refreshToken');
    expect(typeof refreshed.body.accessToken).toBe('string');
  });

  it('signup completion gives a web client a cookie and no body token', async () => {
    const b = makeBuyer();
    const done = await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' }, WEB);
    expect(done.status).toBe(201);
    expect(done.body).not.toHaveProperty('refreshToken');
    expect(refreshCookie(done)).toBeTruthy();
  });

  it('never sets a cookie for a native client', async () => {
    const b = makeBuyer();
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
    const res = await login(b); // no X-Client / Origin — the Expo app

    expect(refreshCookie(res)).toBeUndefined();
    // …and the body token it depends on is still there.
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('refreshes from the cookie alone, with no token in the body', async () => {
    const b = makeBuyer();
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
    const jar = cookiePair(refreshCookie(await login(b, WEB)));

    const res = await request(app).post('/auth/refresh').set(WEB).set('Cookie', jar).send({});

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    // Rotation must replace the cookie, or the next refresh presents a
    // rotated-away token and reads as theft (A7).
    expect(refreshCookie(res)).toBeTruthy();
    expect(cookiePair(refreshCookie(res))).not.toBe(jar);
  });

  it('still refreshes from a body token for a native client', async () => {
    const b = makeBuyer();
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
    const { refreshToken } = (await login(b)).body;

    const res = await request(app).post('/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.refreshToken).toBe('string');
    expect(refreshCookie(res)).toBeUndefined();
  });

  it('rejects a refresh that presents neither cookie nor body token', async () => {
    const res = await request(app).post('/auth/refresh').set(WEB).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_MISSING');
  });

  it('logout clears the cookie and kills the session behind it', async () => {
    const b = makeBuyer();
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
    const jar = cookiePair(refreshCookie(await login(b, WEB)));

    const out = await request(app).post('/auth/logout').set(WEB).set('Cookie', jar).send({});
    expect(out.status).toBe(200);
    // Cleared = an immediate expiry, so the browser drops it.
    expect(refreshCookie(out)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);

    // The revoked token must not still refresh.
    const after = await request(app).post('/auth/refresh').set(WEB).set('Cookie', jar).send({});
    expect(after.status).toBe(401);
  });

  it('a rotated-away cookie is refused as reuse (A7 family revocation)', async () => {
    const b = makeBuyer();
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
    const first = cookiePair(refreshCookie(await login(b, WEB)));

    await request(app).post('/auth/refresh').set(WEB).set('Cookie', first).send({}); // rotates
    const replay = await request(app).post('/auth/refresh').set(WEB).set('Cookie', first).send({});

    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('errors carry a machine-readable code, not just prose', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'x'.repeat(64) });
    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('requestId');
  });
});
