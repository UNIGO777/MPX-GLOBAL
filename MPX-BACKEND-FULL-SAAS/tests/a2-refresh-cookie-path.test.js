/**
 * REFRESH_COOKIE_PATH — the refresh cookie must be scoped to the PUBLIC path.
 *
 * Its own file on purpose: the value is read at module load, so it has to be set
 * before `app.js` (and the Mongoose models) are imported. Doing it inside the
 * main cookie suite with `vi.resetModules()` recompiles every model and throws
 * `OverwriteModelError`.
 *
 * Why it matters: behind the Vercel rewrite the browser calls
 * `/api/auth/refresh`. A cookie scoped to `/auth` is stored and then NEVER sent,
 * so the session silently fails to survive a reload.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Set INSIDE vi.hoisted: ESM imports are hoisted above plain statements, so a
// top-level assignment runs after app.js has already read the env.
const { otpBox } = vi.hoisted(() => {
  process.env.REFRESH_COOKIE_PATH = '/api/auth';
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

const app = createApp();
const WEB = { 'X-Client': 'web', Origin: 'http://localhost:5173' };
const RUN = String(Date.now()).slice(-7);

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.connection.close();
});

describe('REFRESH_COOKIE_PATH', () => {
  it('scopes the cookie to the configured public path, not the API path', async () => {
    const b = {
      name: 'Path Buyer',
      email: `path_${RUN}@example.com`,
      mobile: { countryCode: '+91', number: `9${RUN}1` },
      password: 'longpassword1',
      company: 'Path Co',
      country: 'IN',
    };
    await signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });

    const start = await request(app)
      .post('/auth/login')
      .set(WEB)
      .send({ identifier: b.email, password: b.password, portal: 'buyer' });
    const verified = await request(app)
      .post('/auth/verify-otp')
      .set(WEB)
      .send({ loginToken: start.body.loginToken, code: otpBox.byId.get(`+91${b.mobile.number}`) });

    const raw = (verified.headers['set-cookie'] ?? []).find((c) =>
      c.startsWith(`${REFRESH_COOKIE}=`),
    );
    expect(raw).toBeTruthy();
    expect(raw).toMatch(/Path=\/api\/auth/i);
    // Still first-party-safe: Lax, never None.
    expect(raw).toMatch(/SameSite=Lax/i);
  });
});
