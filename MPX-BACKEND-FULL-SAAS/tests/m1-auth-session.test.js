import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import Redis from 'ioredis';

/**
 * Session-lifecycle coverage for the four auth endpoints the suite never
 * exercised: `/auth/logout`, `/auth/staff/forgot-password`,
 * `/auth/staff/reset-password`, and the full behaviour of
 * `/auth/change-password` (which only had the must-change-password path).
 *
 * These are session-termination controls (auth-sessions A2/A7), so the point of
 * each test is not that the endpoint answers 200 — it is that the session it
 * claims to end is actually dead afterwards.
 */

// Capture OTP codes rather than "sending" them (no provider in tests).
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
import { OtpChallenge } from '../src/models/OtpChallenge.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { hashPassword, verifyPassword } from '../src/services/password.service.js';

const app = createApp();
let redis;
let seq = 0;

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

function makeBuyer() {
  seq += 1;
  return {
    name: 'Session Buyer',
    email: `sess_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `96${1000000 + seq}` },
    password: 'longpassword1',
    company: 'Session Co',
    country: 'IN',
  };
}
const e164 = (b) => `+91${b.mobile.number}`;

/** signup → login → verify-otp. Returns { accessToken, refreshToken, user }. */
async function signupAndLogin(b) {
  await request(app).post('/auth/buyer/signup').send(b);
  const login = await request(app)
    .post('/auth/login')
    .send({ identifier: b.email, password: b.password, portal: 'buyer' });
  const verify = await request(app)
    .post('/auth/verify-otp')
    .send({ loginToken: login.body.loginToken, code: otpBox.byId.get(e164(b)) });
  return verify.body;
}

/** A staff account with a known password, on the platform org. */
async function makeStaff({ role = 'employee', password = 'staffpassword1' } = {}) {
  seq += 1;
  const org =
    (await Organisation.findOne({ type: 'platform' })) ??
    (await Organisation.create({ name: 'MPX Platform', type: 'platform' }));
  const email = `staff_${Date.now()}_${seq}@example.com`;
  const number = `95${2000000 + seq}`;
  const user = await User.create({
    name: 'Staff Member',
    email,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword(password),
    role,
    orgId: org._id,
    isActive: true,
    mustChangePassword: false,
  });
  return { user, email, password, e164: `+91${number}` };
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
  await Promise.all([
    User.deleteMany({}),
    Organisation.deleteMany({}),
    RefreshToken.deleteMany({}),
    OtpChallenge.deleteMany({}),
    // AuditLog is append-only at the model layer — clean via the raw driver.
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  await redis.flushdb();
  otpBox.byId.clear();
});

// ---------------------------------------------------------------------------

describe('POST /auth/logout', () => {
  it('revokes the presented refresh token — it can never be exchanged again', async () => {
    const b = makeBuyer();
    const { refreshToken } = await signupAndLogin(b);

    // It works before logout.
    const before = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(before.status).toBe(200);
    const rotated = before.body.refreshToken;

    const out = await request(app).post('/auth/logout').send({ refreshToken: rotated });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ ok: true });

    const after = await request(app).post('/auth/refresh').send({ refreshToken: rotated });
    expect(after.status).toBe(401);
    // Generic message — never "this token was revoked at 14:02 by a logout".
    expect(after.body.error.message).toMatch(/sign in again/i);

    const row = await RefreshToken.findOne({ userId: (await User.findOne({ email: b.email }))._id })
      .sort({ createdAt: -1 })
      .lean();
    expect(row.status).toBe('revoked');
    expect(row.revokedAt).toBeTruthy();
  });

  it('is idempotent, and an unknown token is not an oracle', async () => {
    const b = makeBuyer();
    const { refreshToken } = await signupAndLogin(b);

    const first = await request(app).post('/auth/logout').send({ refreshToken });
    const second = await request(app).post('/auth/logout').send({ refreshToken });
    expect(first.status).toBe(200);
    // A second logout must not report "already logged out" — that would confirm
    // the token existed. Same answer either way.
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);

    const bogus = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: 'not-a-real-token-but-long-enough-to-pass-zod' });
    expect(bogus.status).toBe(200);
    expect(bogus.body).toEqual({ ok: true });
  });

  it('validates the body — a missing or non-string token is a 400', async () => {
    expect((await request(app).post('/auth/logout').send({})).status).toBe(400);
    expect((await request(app).post('/auth/logout').send({ refreshToken: 'short' })).status).toBe(400);
    // zString refuses an operator object outright.
    expect(
      (await request(app).post('/auth/logout').send({ refreshToken: { $ne: null } })).status,
    ).toBe(400);
  });

  it('only revokes the token presented — a second device stays signed in', async () => {
    const b = makeBuyer();
    const one = await signupAndLogin(b);

    // A second login = a second refresh family (a second device).
    const login2 = await request(app)
      .post('/auth/login')
      .send({ identifier: b.email, password: b.password, portal: 'buyer' });
    const two = (
      await request(app)
        .post('/auth/verify-otp')
        .send({ loginToken: login2.body.loginToken, code: otpBox.byId.get(e164(b)) })
    ).body;

    await request(app).post('/auth/logout').send({ refreshToken: one.refreshToken });

    // Device two is untouched — logout is per-session, not global.
    const stillGood = await request(app).post('/auth/refresh').send({ refreshToken: two.refreshToken });
    expect(stillGood.status).toBe(200);
  });

  /**
   * ⚠️ KNOWN GAP, pinned deliberately so closing it is a conscious act.
   *
   * `auth-sessions.md` A7 says `tokenVersion` is incremented on "password
   * change, role change, deactivation and logout", and `M1-01-backend-steps.md`
   * step 11 says logout "increments tokenVersion, revokes the refresh family".
   * The shipped `logout()` does NEITHER — it revokes only the presented refresh
   * token. So after logging out, the ACCESS token keeps working until it
   * expires (up to 15 minutes).
   *
   * This test records the behaviour as it actually is. If someone implements
   * the documented control, this test fails — which is the intended signal to
   * update it rather than a regression.
   */
  it('KNOWN GAP: logout does NOT kill the access token (A7 says it should)', async () => {
    const b = makeBuyer();
    const { accessToken, refreshToken } = await signupAndLogin(b);

    await request(app).post('/auth/logout').send({ refreshToken });

    const me = await request(app).get('/auth/me').set(bearer(accessToken));
    expect(me.status).toBe(200); // ← documented control says this should be 401

    const user = await User.findOne({ email: b.email });
    expect(user.tokenVersion).toBe(0); // ← A7 says logout should have bumped this
  });
});

// ---------------------------------------------------------------------------

describe('POST /auth/change-password', () => {
  it('rejects a wrong current password and leaves the stored hash untouched', async () => {
    const b = makeBuyer();
    const { accessToken } = await signupAndLogin(b);

    const res = await request(app)
      .post('/auth/change-password')
      .set(bearer(accessToken))
      .send({ currentPassword: 'thewrongpassword', newPassword: 'brandnewpass1' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/current password is incorrect/i);

    const user = await User.findOne({ email: b.email }).select('+passwordHash');
    expect(await verifyPassword(user.passwordHash, b.password)).toBe(true);
    expect(await verifyPassword(user.passwordHash, 'brandnewpass1')).toBe(false);
  });

  it('kills every existing session: old access token AND old refresh token die', async () => {
    const b = makeBuyer();
    const { accessToken, refreshToken } = await signupAndLogin(b);

    const changed = await request(app)
      .post('/auth/change-password')
      .set(bearer(accessToken))
      .send({ currentPassword: b.password, newPassword: 'brandnewpass1' });
    expect(changed.status).toBe(200);

    // tokenVersion bumped → the old access token is dead (A7).
    const oldAccess = await request(app).get('/auth/me').set(bearer(accessToken));
    expect(oldAccess.status).toBe(401);
    expect(oldAccess.body.error.message).toMatch(/session expired|not authenticated/i);

    // Every refresh token revoked, not just the current one.
    const oldRefresh = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(oldRefresh.status).toBe(401);

    // The freshly-issued pair works.
    const newMe = await request(app).get('/auth/me').set(bearer(changed.body.accessToken));
    expect(newMe.status).toBe(200);
    const newRefresh = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: changed.body.refreshToken });
    expect(newRefresh.status).toBe(200);
  });

  it('the new password is the one that works at the next login', async () => {
    const b = makeBuyer();
    const { accessToken } = await signupAndLogin(b);
    await request(app)
      .post('/auth/change-password')
      .set(bearer(accessToken))
      .send({ currentPassword: b.password, newPassword: 'brandnewpass1' });

    const oldPw = await request(app)
      .post('/auth/login')
      .send({ identifier: b.email, password: b.password, portal: 'buyer' });
    expect(oldPw.status).toBe(401);

    const newPw = await request(app)
      .post('/auth/login')
      .send({ identifier: b.email, password: 'brandnewpass1', portal: 'buyer' });
    expect(newPw.status).toBe(200);
  });

  it('writes an append-only audit row carrying no password material', async () => {
    const b = makeBuyer();
    const { accessToken } = await signupAndLogin(b);
    await request(app)
      .post('/auth/change-password')
      .set(bearer(accessToken))
      .send({ currentPassword: b.password, newPassword: 'brandnewpass1' });

    const row = await AuditLog.findOne({ action: 'auth.password_change' }).lean();
    expect(row).toBeTruthy();
    expect(row.actorId).toBeTruthy();
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain(b.password);
    expect(serialised).not.toContain('brandnewpass1');
    expect(serialised).not.toMatch(/\$argon2/);
  });

  it('requires authentication, and enforces the password policy', async () => {
    const b = makeBuyer();
    const { accessToken } = await signupAndLogin(b);

    const guest = await request(app)
      .post('/auth/change-password')
      .send({ currentPassword: b.password, newPassword: 'brandnewpass1' });
    expect(guest.status).toBe(401);

    const tooShort = await request(app)
      .post('/auth/change-password')
      .set(bearer(accessToken))
      .send({ currentPassword: b.password, newPassword: 'short' });
    expect(tooShort.status).toBe(400);

    const operator = await request(app)
      .post('/auth/change-password')
      .set(bearer(accessToken))
      .send({ currentPassword: { $ne: null }, newPassword: 'brandnewpass1' });
    expect(operator.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe('POST /auth/resend-otp', () => {
  it('issues a NEW code and retires the previous one', async () => {
    const b = makeBuyer();
    await request(app).post('/auth/buyer/signup').send(b);
    otpBox.byId.clear();

    const login = await request(app)
      .post('/auth/login')
      .send({ identifier: b.email, password: b.password, portal: 'buyer' });
    const firstCode = otpBox.byId.get(e164(b));

    const resend = await request(app)
      .post('/auth/resend-otp')
      .send({ loginToken: login.body.loginToken });
    expect(resend.status).toBe(200);
    const secondCode = otpBox.byId.get(e164(b));
    expect(secondCode).toBeTruthy();

    // The superseded code must not still open a session.
    const withOld = await request(app)
      .post('/auth/verify-otp')
      .send({ loginToken: login.body.loginToken, code: firstCode });
    expect(withOld.status).toBe(401);

    const withNew = await request(app)
      .post('/auth/verify-otp')
      .send({ loginToken: login.body.loginToken, code: secondCode });
    expect(withNew.status).toBe(200);
  });

  it('refuses a malformed or unknown login token without revealing anything', async () => {
    const short = await request(app).post('/auth/resend-otp').send({ loginToken: 'nope' });
    expect(short.status).toBe(400);

    const forged = await request(app)
      .post('/auth/resend-otp')
      .send({ loginToken: 'aaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccc' });
    expect(forged.status).toBe(401);
    expect(forged.body.error.message).toMatch(/sign in again/i);
  });

  it('cannot be used to reset a locked OTP challenge (the A3 durable lock)', async () => {
    const b = makeBuyer();
    await request(app).post('/auth/buyer/signup').send(b);
    const login = await request(app)
      .post('/auth/login')
      .send({ identifier: b.email, password: b.password, portal: 'buyer' });

    // Burn the 5 attempts (OTP_MAX_ATTEMPTS) with wrong codes.
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/auth/verify-otp')
        .send({ loginToken: login.body.loginToken, code: '000000' });
    }

    const resend = await request(app)
      .post('/auth/resend-otp')
      .send({ loginToken: login.body.loginToken });
    expect(resend.status).toBe(401);
    expect(resend.body.error.message).toMatch(/too many attempts/i);
  });
});

// ---------------------------------------------------------------------------

describe('staff password reset (A21 — the staff portal has its own pair)', () => {
  it('forgot-password is generic whether or not the staff account exists', async () => {
    const staff = await makeStaff();

    const known = await request(app)
      .post('/auth/staff/forgot-password')
      .send({ identifier: staff.email });
    const unknown = await request(app)
      .post('/auth/staff/forgot-password')
      .send({ identifier: 'nobody@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(known.body.message).toMatch(/if an account exists/i);
  });

  it('resets the password end to end and kills every live staff session', async () => {
    const staff = await makeStaff();

    const login = await request(app)
      .post('/auth/staff/login')
      .send({ identifier: staff.email, password: staff.password });
    const session = (
      await request(app)
        .post('/auth/verify-otp')
        .send({ loginToken: login.body.loginToken, code: otpBox.byId.get(staff.e164) })
    ).body;
    expect(session.accessToken).toBeTruthy();

    otpBox.byId.clear();
    await request(app).post('/auth/staff/forgot-password').send({ identifier: staff.email });
    const code = otpBox.byId.get(staff.e164);
    expect(code).toBeTruthy();

    const reset = await request(app)
      .post('/auth/staff/reset-password')
      .send({ identifier: staff.email, code, newPassword: 'newstaffpass1' });
    expect(reset.status).toBe(200);

    // The session from before the reset is dead (tokenVersion bumped).
    const dead = await request(app).get('/auth/me').set(bearer(session.accessToken));
    expect(dead.status).toBe(401);
    const deadRefresh = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(deadRefresh.status).toBe(401);

    // Old password gone, new one works.
    const oldPw = await request(app)
      .post('/auth/staff/login')
      .send({ identifier: staff.email, password: staff.password });
    expect(oldPw.status).toBe(401);
    const newPw = await request(app)
      .post('/auth/staff/login')
      .send({ identifier: staff.email, password: 'newstaffpass1' });
    expect(newPw.status).toBe(200);
  });

  it('the staff reset code is single-use', async () => {
    const staff = await makeStaff();
    await request(app).post('/auth/staff/forgot-password').send({ identifier: staff.email });
    const code = otpBox.byId.get(staff.e164);

    const first = await request(app)
      .post('/auth/staff/reset-password')
      .send({ identifier: staff.email, code, newPassword: 'newstaffpass1' });
    expect(first.status).toBe(200);

    const replay = await request(app)
      .post('/auth/staff/reset-password')
      .send({ identifier: staff.email, code, newPassword: 'anotherpass123' });
    expect(replay.status).toBe(401);
    expect(replay.body.error.message).toMatch(/invalid or expired/i);
  });

  it('🔴 the two portals do not cross: a buyer cannot reset through the staff pair', async () => {
    const b = makeBuyer();
    await request(app).post('/auth/buyer/signup').send(b);
    otpBox.byId.clear();

    // The staff endpoint must not issue a code for a party account…
    const staffForgot = await request(app)
      .post('/auth/staff/forgot-password')
      .send({ identifier: b.email });
    expect(staffForgot.status).toBe(200); // generic, as always
    expect(otpBox.byId.get(e164(b))).toBeUndefined(); // …but nothing was sent

    // …and even with a real code from the PARTY flow, the staff reset refuses.
    await request(app).post('/auth/forgot-password').send({ identifier: b.email, portal: 'buyer' });
    const partyCode = otpBox.byId.get(e164(b));
    expect(partyCode).toBeTruthy();

    const crossed = await request(app)
      .post('/auth/staff/reset-password')
      .send({ identifier: b.email, code: partyCode, newPassword: 'newbuyerpass1' });
    expect(crossed.status).toBe(401);

    // The buyer's own password is untouched by the attempt.
    const user = await User.findOne({ email: b.email }).select('+passwordHash');
    expect(await verifyPassword(user.passwordHash, b.password)).toBe(true);
  });

  it('🔴 and a staff account cannot reset through the party pair', async () => {
    const staff = await makeStaff();
    otpBox.byId.clear();

    const partyForgot = await request(app)
      .post('/auth/forgot-password')
      .send({ identifier: staff.email, portal: 'buyer' });
    expect(partyForgot.status).toBe(200);
    expect(otpBox.byId.get(staff.e164)).toBeUndefined();

    await request(app).post('/auth/staff/forgot-password').send({ identifier: staff.email });
    const staffCode = otpBox.byId.get(staff.e164);

    const crossed = await request(app)
      .post('/auth/reset-password')
      .send({ identifier: staff.email, code: staffCode, newPassword: 'hijackedpass1', portal: 'buyer' });
    expect(crossed.status).toBe(401);
  });

  it('the staff endpoints take no `portal` — a staff email is exclusive', async () => {
    const staff = await makeStaff();
    // Unknown keys are stripped by zod, so sending one is harmless rather than a
    // 400 — what matters is that it changes nothing about the outcome.
    const res = await request(app)
      .post('/auth/staff/forgot-password')
      .send({ identifier: staff.email, portal: 'buyer' });
    expect(res.status).toBe(200);

    // The party endpoints, by contrast, REQUIRE it.
    const missingPortal = await request(app)
      .post('/auth/forgot-password')
      .send({ identifier: staff.email });
    expect(missingPortal.status).toBe(400);
  });
});
