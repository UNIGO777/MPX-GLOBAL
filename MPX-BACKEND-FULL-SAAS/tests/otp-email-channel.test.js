import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { otpBox } = vi.hoisted(() => ({ otpBox: { sent: [] } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async (args) => {
    otpBox.sent.push(args);
  },
  describeOtpTransports: () => ({}),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { OtpChallenge } = await import('../src/models/OtpChallenge.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { hashPassword } = await import('../src/services/password.service.js');

/**
 * 2026-09-23 (owner) · "someone who does not have their phone at that time can
 * still sign in". A buyer or seller may take the sign-in or reset code by EMAIL
 * instead. Staff stay phone-only.
 *
 * 🔴 What these pin: the email code goes ONLY to the account's own stored
 * address (never one from the request — A3); switching channel never resets
 * the A3 lock; forgot-password stays identical for real and unknown accounts.
 */
const app = createApp();
const PASSWORD = 'longpassword1';
let seq = 0;

async function makeUser(role) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    buyerSide: role === 'buyer',
    exporterSide: role === 'exporter',
  });
  return User.create({
    name: `${role}-${seq}`,
    email: `ch_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `82${1000000 + seq}`, e164: `+9182${1000000 + seq}` },
    passwordHash: await hashPassword(PASSWORD),
    role,
    orgId: org._id,
  });
}

const last = () => otpBox.sent[otpBox.sent.length - 1];

async function signIn(user) {
  const path = user.role === 'employee' || user.role === 'superadmin' ? '/auth/staff/login' : '/auth/login';
  const res = await request(app)
    .post(path)
    .send({
      identifier: user.email,
      password: PASSWORD,
      ...(path === '/auth/login' ? { portal: user.role } : {}),
    })
    .expect(200);
  return res.body.loginToken;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});
beforeEach(async () => {
  otpBox.sent.length = 0;
  await Promise.all([User.deleteMany({}), Organisation.deleteMany({}), OtpChallenge.deleteMany({})]);
});

describe('sign-in · "send the code to my email instead"', () => {
  it('sends a fresh code to the account\'s OWN email, and that code signs in', async () => {
    const user = await makeUser('buyer');
    const loginToken = await signIn(user);
    const phoneCode = last().code;
    expect(last().channel).toBe('mobile');

    const res = await request(app)
      .post('/auth/resend-otp')
      .send({ loginToken, channel: 'email' })
      .expect(200);
    expect(res.body.sentTo).toMatch(/\*/);
    expect(last().channel).toBe('email');
    expect(last().identifier).toBe(user.email);

    // The phone code was replaced — only the email code works now.
    if (phoneCode !== last().code) {
      await request(app).post('/auth/verify-otp').send({ loginToken, code: phoneCode }).expect(401);
    }
    await request(app).post('/auth/verify-otp').send({ loginToken, code: last().code }).expect(200);

    const audit = await AuditLog.findOne({ action: 'auth.login', entityId: user._id });
    expect(audit.after.otpChannel).toBe('email');
  });

  it('🔴 never sends to an address carried in the request', async () => {
    const user = await makeUser('exporter');
    const loginToken = await signIn(user);
    await request(app)
      .post('/auth/resend-otp')
      .send({ loginToken, channel: 'email', email: 'attacker@evil.test', identifier: 'attacker@evil.test' })
      .expect(200);
    expect(last().identifier).toBe(user.email);
    expect(otpBox.sent.some((s) => s.identifier === 'attacker@evil.test')).toBe(false);
  });

  it('🔴 switching channel does not reset the A3 lock', async () => {
    const user = await makeUser('buyer');
    const loginToken = await signIn(user);
    await OtpChallenge.updateMany(
      { userId: user._id, purpose: 'login' },
      { $set: { lockedUntil: new Date(Date.now() + 10 * 60 * 1000) } },
    );
    const res = await request(app).post('/auth/resend-otp').send({ loginToken, channel: 'email' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_LOCKED');
    expect(otpBox.sent.filter((s) => s.channel === 'email')).toHaveLength(0);
  });

  it('staff stay phone-only', async () => {
    const staff = await makeUser('employee');
    const loginToken = await signIn(staff);
    await request(app).post('/auth/resend-otp').send({ loginToken, channel: 'email' }).expect(400);
    expect(otpBox.sent.filter((s) => s.channel === 'email')).toHaveLength(0);
  });

  it('an unknown channel is rejected by validation', async () => {
    const user = await makeUser('buyer');
    const loginToken = await signIn(user);
    await request(app).post('/auth/resend-otp').send({ loginToken, channel: 'whatsapp' }).expect(400);
  });
});

describe('reset · "send the reset code to my email instead"', () => {
  it('sends the reset code to the account\'s own email, and it resets the password', async () => {
    const user = await makeUser('buyer');
    await request(app)
      .post('/auth/forgot-password')
      .send({ identifier: user.email, portal: 'buyer', channel: 'email' })
      .expect(200);
    expect(last().channel).toBe('email');
    expect(last().identifier).toBe(user.email);

    await request(app)
      .post('/auth/reset-password')
      .send({ identifier: user.email, code: last().code, newPassword: 'brandnewpass2', portal: 'buyer' })
      .expect(200);
  });

  it('🔴 the response is identical for a real and an unknown account', async () => {
    const user = await makeUser('exporter');
    const real = await request(app)
      .post('/auth/forgot-password')
      .send({ identifier: user.email, portal: 'exporter', channel: 'email' });
    const fake = await request(app)
      .post('/auth/forgot-password')
      .send({ identifier: 'nobody@example.com', portal: 'exporter', channel: 'email' });
    expect(real.status).toBe(fake.status);
    expect(real.body).toEqual(fake.body);
  });

  it('the staff reset route ignores a channel — staff codes stay on the phone', async () => {
    const staff = await makeUser('employee');
    await request(app)
      .post('/auth/staff/forgot-password')
      .send({ identifier: staff.email, channel: 'email' })
      .expect(200);
    expect(last().channel).toBe('mobile');
  });
});
