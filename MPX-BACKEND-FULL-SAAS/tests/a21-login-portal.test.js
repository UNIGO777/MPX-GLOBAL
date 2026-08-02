import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

import { signupThroughOtp } from './helpers/signupFlow.js';
import mongoose from 'mongoose';
import Redis from 'ioredis';

// A21 signup needs the real codes for BOTH channels.
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
import { hashPassword } from '../src/services/password.service.js';

// A21 · Step 2 — login portal split (/auth/login + portal · /auth/staff/login).
const app = createApp();
let seq = 0;
let redis;
const uniq = () => {
  seq += 1;
  return `${Date.now()}_${seq}`;
};

const buyerPayload = ({ email, number }) => ({
  name: 'Buyer',
  email,
  mobile: { countryCode: '+91', number },
  password: 'longpassword1',
  company: 'Buyer Co',
  country: 'IN',
  role: 'buyer',
});
const exporterPayload = ({ email, number }) => ({
  ...buyerPayload({ email, number }),
  name: 'Exporter',
  company: 'Exp Co',
  entityType: 'business',
  role: 'exporter',
});

async function makeStaffAccount(role = 'superadmin') {
  const org = await Organisation.create({ name: 'Platform', type: 'platform' });
  const email = `staff_${uniq()}@example.com`;
  await User.create({
    name: 'Staff',
    email,
    mobile: { countryCode: '+91', number: '7000000101', e164: '+917000000101' },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    isActive: true,
  });
  return { email };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
  redis = new Redis(process.env.REDIS_URL);
});
afterAll(async () => {
  await mongoose.disconnect();
  await redis.quit();
});
beforeEach(async () => {
  await User.deleteMany({});
  await Organisation.deleteMany({});
  await redis.flushdb();
});

const login = (body) => request(app).post('/auth/login').send(body);
const staffLogin = (body) => request(app).post('/auth/staff/login').send(body);

describe('A21 · login portals', () => {
  it('a dual account: the portal selects which account logs in', async () => {
    const email = `dual_${uniq()}@example.com`;
    await signupThroughOtp(app, otpBox, buyerPayload({ email, number: '9810000101' }));
    await signupThroughOtp(app, otpBox, exporterPayload({ email, number: '9820000102' }));

    expect((await login({ identifier: email, password: 'longpassword1', portal: 'buyer' })).status).toBe(200);
    expect((await login({ identifier: email, password: 'longpassword1', portal: 'exporter' })).status).toBe(200);
  });

  it('wrong portal returns the SAME "Invalid credentials" as a wrong password (no oracle)', async () => {
    const email = `buyeronly_${uniq()}@example.com`;
    await signupThroughOtp(app, otpBox, buyerPayload({ email, number: '9810000111' }));

    expect((await login({ identifier: email, password: 'longpassword1', portal: 'buyer' })).status).toBe(200);

    const wrongPortal = await login({ identifier: email, password: 'longpassword1', portal: 'exporter' });
    const wrongPass = await login({ identifier: email, password: 'wrongpassword9', portal: 'buyer' });
    expect(wrongPortal.status).toBe(401);
    expect(wrongPass.status).toBe(401);
    // Identical client message — a wrong portal must not reveal the account exists.
    expect(wrongPortal.body.error.message).toBe(wrongPass.body.error.message);
    expect(wrongPortal.body.error.message).toMatch(/invalid credentials/i);
  });

  it('a missing portal on /auth/login is a 400 validation error', async () => {
    const email = `np_${uniq()}@example.com`;
    await signupThroughOtp(app, otpBox, buyerPayload({ email, number: '9810000121' }));
    expect((await login({ identifier: email, password: 'longpassword1' })).status).toBe(400);
  });

  it('staff log in ONLY on /auth/staff/login; a party portal cannot serve them', async () => {
    const sa = await makeStaffAccount('superadmin');
    expect((await staffLogin({ identifier: sa.email, password: 'longpassword1' })).status).toBe(200);
    // superadmin cannot come through the buyer/exporter portal endpoint
    expect((await login({ identifier: sa.email, password: 'longpassword1', portal: 'buyer' })).status).toBe(401);
  });

  it('a buyer/exporter cannot use the staff login endpoint', async () => {
    const email = `b_${uniq()}@example.com`;
    await signupThroughOtp(app, otpBox, buyerPayload({ email, number: '9810000131' }));
    expect((await staffLogin({ identifier: email, password: 'longpassword1' })).status).toBe(401);
  });

  it('the OTP budget is portal-scoped: a buyer burning it does not lock the exporter on the same email', async () => {
    const email = `shared_${uniq()}@example.com`;
    await signupThroughOtp(app, otpBox, buyerPayload({ email, number: '9810000201' }));
    await signupThroughOtp(app, otpBox, exporterPayload({ email, number: '9820000202' }));

    // otpLimiter is 5 / 10min. Hit the buyer portal 6× → the 6th is 429 (budget spent).
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = await login({ identifier: email, password: 'longpassword1', portal: 'buyer' });
    }
    expect(last.status).toBe(429);

    // The exporter on the SAME email has its own budget → still works.
    const exporter = await login({ identifier: email, password: 'longpassword1', portal: 'exporter' });
    expect(exporter.status).toBe(200);
  });
});
