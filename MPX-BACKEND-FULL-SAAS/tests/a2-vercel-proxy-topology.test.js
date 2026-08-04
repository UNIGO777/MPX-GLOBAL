/**
 * THE DEPLOYED TOPOLOGY: web on Vercel, API on its own host, browser talking
 * only to the web origin.
 *
 * Every other cookie test calls the API directly, which is NOT how production
 * works and cannot catch the failure that actually shipped: a refresh cookie
 * scoped to `/auth` while the browser calls `/api/auth/refresh` is stored and
 * then never sent — the session dies on reload with no error anywhere.
 *
 * Vercel's rewrite `/api/:path* -> https://api…/:path*` strips the prefix before
 * the API sees it. `express().use('/api', api)` has exactly those semantics, so
 * mounting the real app under /api reproduces production without a deploy.
 *
 * `request.agent()` is the point of this file: superagent keeps a real cookie
 * jar that honours Domain/Path, so "did the browser send it back?" is answered
 * by the jar, not by us hand-attaching a header.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';

// Must be inside vi.hoisted: ESM imports hoist above plain statements, so a
// top-level assignment lands after app.js has read the env.
const { otpBox } = vi.hoisted(() => {
  process.env.REFRESH_COOKIE_PATH = '/api/auth';
  // The express stand-in below forwards every header the "browser" sent,
  // INCLUDING `Origin` — so this file models a proxy that passes Origin through.
  // Without allowlisting that origin the CORS guard answers 403 before any route
  // runs, and all four assertions fail on the wrong thing.
  //
  // ⚠️ Whether Vercel actually forwards `Origin` upstream is still unconfirmed on
  // the real deployment. If it does NOT (a rewrite is server-to-server and sends
  // none), the API sees no Origin and is allowed through by the `!origin` branch
  // — so production works either way, but only if the deployed `CORS_ORIGINS`
  // lists the web origin for the case where it IS forwarded.
  process.env.CORS_ORIGINS = 'https://mpx-global.vercel.app';
  return { otpBox: { byId: new Map() } };
});
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async ({ identifier, code }) => {
    otpBox.byId.set(identifier, code);
  },
  describeOtpTransports: () => ({}),
}));

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { signupThroughOtp } from './helpers/signupFlow.js';
import { REFRESH_COOKIE } from '../src/utils/refreshCookie.js';

const api = createApp();

/** Stands in for Vercel: same origin as the app, /api/* forwarded, prefix stripped. */
const site = express();
site.use('/api', api);

const WEB = { 'X-Client': 'web', Origin: 'https://mpx-global.vercel.app' };
const RUN = String(Date.now()).slice(-7);
let seq = 0;

const makeBuyer = () => {
  seq += 1;
  return {
    name: 'Proxy Buyer',
    email: `proxy_${RUN}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `9${RUN}${seq}` },
    password: 'longpassword1',
    company: 'Proxy Co',
    country: 'IN',
  };
};

/** Sign up + sign in THROUGH the proxy, using a browser-like cookie jar. */
async function signInThroughProxy() {
  const b = makeBuyer();
  await signupThroughOtp(api, otpBox, { ...b, role: 'buyer' });
  const agent = request.agent(site);
  const start = await agent
    .post('/api/auth/login')
    .set(WEB)
    .send({ identifier: b.email, password: b.password, portal: 'buyer' });
  const verified = await agent
    .post('/api/auth/verify-otp')
    .set(WEB)
    .send({ loginToken: start.body.loginToken, code: otpBox.byId.get(`+91${b.mobile.number}`) });
  return { agent, verified };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.connection.close();
});

describe('deployed topology · browser → web origin → API', () => {
  it('routes /api/* to the API and issues a cookie scoped to the PUBLIC path', async () => {
    const { verified } = await signInThroughProxy();
    expect(verified.status).toBe(200);

    const raw = (verified.headers['set-cookie'] ?? []).find((c) =>
      c.startsWith(`${REFRESH_COOKIE}=`),
    );
    expect(raw).toBeTruthy();
    // Scoped to what the BROWSER calls, not what the API serves.
    expect(raw).toMatch(/Path=\/api\/auth/i);
    expect(raw).toMatch(/HttpOnly/i);
    // First-party, so Lax — never None (which iOS blocks anyway).
    expect(raw).toMatch(/SameSite=Lax/i);
    // The web client must never receive the token in the body.
    expect(verified.body).not.toHaveProperty('refreshToken');
  });

  it('survives a RELOAD: the jar returns the cookie to /api/auth/refresh unaided', async () => {
    const { agent } = await signInThroughProxy();

    // No header attached by hand — if the Path were wrong the jar would withhold
    // it and this 401s, which is exactly the production bug.
    const refreshed = await agent.post('/api/auth/refresh').set(WEB).send({});
    expect(refreshed.status).toBe(200);
    expect(typeof refreshed.body.accessToken).toBe('string');
    expect(refreshed.body).not.toHaveProperty('refreshToken');
  });

  it('keeps the cookie off ordinary API calls (Path scoping intact)', async () => {
    const { agent, verified } = await signInThroughProxy();

    // A normal authenticated call goes to /api/me/*, outside the cookie's Path.
    const res = await agent
      .get('/api/me/verification')
      .set({ ...WEB, Authorization: `Bearer ${verified.body.accessToken}` });

    expect(res.status).toBe(200);
    expect(res.request._header?.cookie ?? '').not.toContain(REFRESH_COOKIE);
  });

  it('still refuses a cookie-borne refresh with no X-Client header (CSRF)', async () => {
    const { agent } = await signInThroughProxy();
    await agent.post('/api/auth/refresh').send({}).expect(403);
  });
});
