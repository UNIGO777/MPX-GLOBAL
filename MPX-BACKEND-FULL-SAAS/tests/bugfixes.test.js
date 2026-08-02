import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

import { signupThroughOtp } from './helpers/signupFlow.js';
import mongoose from 'mongoose';
import Redis from 'ioredis';

// Capture OTP dispatch (no real provider in tests). A21 signup needs the REAL
// codes for both channels, so this file can no longer swallow them.
const { otpBox } = vi.hoisted(() => ({ otpBox: { byId: new Map() } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async ({ identifier, code }) => {
    otpBox.byId.set(identifier, code);
  },
}));

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { signAccessToken, startRefreshFamily } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';

const app = createApp();
let redis;
let seq = 0;

function makeBuyer() {
  seq += 1;
  return {
    name: 'Bug Buyer',
    email: `bug_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `98${2000000 + seq}` },
    password: 'longpassword1',
    company: 'Bug Co',
    country: 'IN',
  };
}
const e164 = (b) => `+91${b.mobile.number}`;
// A21: signup is start → verify both channels → complete.
const signupBuyer = (b) => signupThroughOtp(app, otpBox, { ...b, role: 'buyer' });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

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
  await Promise.all([User.deleteMany({}), Organisation.deleteMany({}), RefreshToken.deleteMany({})]);
  await mongoose.connection.db.collection('otpchallenges').deleteMany({});
  await mongoose.connection.db.collection('auditlogs').deleteMany({});
  await redis.flushdb();
});

describe('bug fixes', () => {
  it('BUG-1: OTP lock survives a new login attempt (no reset)', async () => {
    const b = makeBuyer();
    await signupBuyer(b);
    const login = await request(app).post('/auth/login').send({ identifier: b.email, password: b.password, portal: 'buyer' });
    const { loginToken } = login.body;

    // Exhaust the 5 attempts with wrong codes → challenge locks.
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/auth/verify-otp').send({ loginToken, code: '000000' });
    }
    // A fresh login must NOT reset the lock — requestOtp refuses.
    const relogin = await request(app).post('/auth/login').send({ identifier: b.email, password: b.password, portal: 'buyer' });
    expect(relogin.status).toBe(401);
    expect(relogin.body.error.message).toMatch(/too many attempts/i);
  });

  it('BUG-3: login by mobile digits (with country code, no "+") works', async () => {
    const b = makeBuyer();
    await signupBuyer(b);
    const digits = e164(b).replace('+', ''); // "919800000..."
    const res = await request(app).post('/auth/login').send({ identifier: digits, password: b.password, portal: 'buyer' });
    expect(res.status).toBe(200);
    expect(res.body.method).toBe('otp');
  });

  it('BUG-4: reset-password is refused on a deactivated account', async () => {
    const b = makeBuyer();
    const signup = await signupBuyer(b);
    await User.updateOne({ _id: signup.body.user.id ?? signup.body.user._id }, { $set: { isActive: false } });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ identifier: b.email, code: '000000', newPassword: 'anotherpass1', portal: 'buyer' });
    expect(res.status).toBe(401);
  });

  it('BUG-7: refresh for a deactivated user 401s and revokes the family', async () => {
    const b = makeBuyer();
    const signup = await signupBuyer(b);
    const userId = signup.body.user.id ?? signup.body.user._id;

    // A real, active refresh token, then deactivate the user.
    const { raw, doc } = await startRefreshFamily({ userId, ip: '1.1.1.1', userAgent: 'test' });
    await User.updateOne({ _id: userId }, { $set: { isActive: false } });

    const res = await request(app).post('/auth/refresh').send({ refreshToken: raw });
    expect(res.status).toBe(401);

    // Scoped to THIS family: A21's /signup/complete now issues a session of its
    // own (both channels were just proved), so the user legitimately holds a
    // second, untouched family. The guarantee under test is that the presented
    // token's family dies — not that the user has no tokens anywhere.
    const tokens = await RefreshToken.find({ userId, familyId: doc.familyId });
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((t) => t.status === 'revoked')).toBe(true);
  });

  it('AUDIT: signup writes an auth.signup AuditLog row', async () => {
    const b = makeBuyer();
    const signup = await signupBuyer(b);
    const userId = signup.body.user.id ?? signup.body.user._id;
    const row = await AuditLog.findOne({ action: 'auth.signup', entityId: userId });
    expect(row).toBeTruthy();
    expect(String(row.actorId)).toBe(String(userId));
  });

  it('AUDIT: refresh-token reuse writes an auth.refresh.reuse row', async () => {
    const b = makeBuyer();
    const signup = await signupBuyer(b);
    const userId = signup.body.user.id ?? signup.body.user._id;
    const { raw: rt1 } = await startRefreshFamily({ userId, ip: '1.1.1.1', userAgent: 'test' });

    await request(app).post('/auth/refresh').send({ refreshToken: rt1 }); // rotate → rt2
    const reuse = await request(app).post('/auth/refresh').send({ refreshToken: rt1 }); // reuse
    expect(reuse.status).toBe(401);

    const row = await AuditLog.findOne({ action: 'auth.refresh.reuse', entityId: userId });
    expect(row).toBeTruthy();
  });

  it('RESEND: resend-otp works with just the login token (no password)', async () => {
    const b = makeBuyer();
    await signupBuyer(b);
    const login = await request(app).post('/auth/login').send({ identifier: b.email, password: b.password, portal: 'buyer' });
    const res = await request(app).post('/auth/resend-otp').send({ loginToken: login.body.loginToken });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/otp/i);
  });

  it('BUG-8: inbound X-Request-Id is NOT trusted (TRUST_PROXY unset)', async () => {
    const res = await request(app).get('/health').set('X-Request-Id', 'attacker-injected-id');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).not.toBe('attacker-injected-id');
  });

  it('BUG-5: mustChangePassword blocks privileged actions until changed', async () => {
    const org = await Organisation.create({ name: 'Platform', type: 'platform' });
    seq += 1;
    const emp = await User.create({
      name: 'Emp',
      email: `emp_${Date.now()}_${seq}@example.com`,
      mobile: { countryCode: '+91', number: `97${3000000 + seq}`, e164: `+9197${3000000 + seq}` },
      passwordHash: await hashPassword('oldpassword1'),
      role: 'employee',
      orgId: org._id,
      permissions: ['buyer:approve'],
      isActive: true,
      mustChangePassword: true,
    });
    const token = signAccessToken(emp);
    const buyerOrg = await Organisation.create({ name: 'B', type: 'business', buyerSide: true, kycStatus: 'submitted' });

    // Blocked until password changed.
    const blocked = await request(app).post(`/employee/buyers/${buyerOrg._id}/approve`).set(bearer(token)).send({});
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.message).toMatch(/change your password/i);

    // Change password → fresh tokens.
    const changed = await request(app)
      .post('/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: 'oldpassword1', newPassword: 'brandnewpass1' });
    expect(changed.status).toBe(200);
    expect(changed.body.accessToken).toBeTruthy();

    // Now the action succeeds with the new token.
    const ok = await request(app)
      .post(`/employee/buyers/${buyerOrg._id}/approve`)
      .set(bearer(changed.body.accessToken))
      .send({});
    expect(ok.status).toBe(200);
    expect(ok.body.organisation.kycStatus).toBe('verified');
  });
});
