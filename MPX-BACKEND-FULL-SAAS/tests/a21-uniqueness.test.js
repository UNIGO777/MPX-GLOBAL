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
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';

// A21 · Step 1 — compound (email|mobile, role) uniqueness + staff exclusivity.
const app = createApp();
let seq = 0;
let redis;

const uniq = () => {
  seq += 1;
  return `${Date.now()}_${seq}`;
};

const buyerPayload = ({ email, cc = '+91', number }) => ({
  name: 'Buyer',
  email,
  mobile: { countryCode: cc, number },
  password: 'longpassword1',
  company: 'Buyer Co',
  country: 'IN',
  role: 'buyer',
});
const exporterPayload = ({ email, cc = '+91', number }) => ({
  name: 'Exporter',
  email,
  mobile: { countryCode: cc, number },
  password: 'longpassword1',
  company: 'Exp Co',
  country: 'IN',
  entityType: 'business',
  role: 'exporter',
});

async function makeSuperadmin() {
  const org = await Organisation.create({ name: 'Platform', type: 'platform' });
  const u = await User.create({
    name: 'SA',
    email: `sa_${uniq()}@example.com`,
    mobile: { countryCode: '+91', number: '7000000001', e164: '+917000000001' },
    passwordHash: await hashPassword('longpassword1'),
    role: 'superadmin',
    orgId: org._id,
    isActive: true,
  });
  return { user: u, token: signAccessToken(u) };
}
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const employeePayload = ({ email, number }) => ({
  name: 'Emp',
  email,
  mobile: { countryCode: '+91', number },
  password: 'longpassword1',
});

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

describe('A21 · uniqueness (compound email/mobile + role; staff exclusive)', () => {
  it('the same email may register a buyer AND an exporter account', async () => {
    const email = `dual_${uniq()}@example.com`;
    const b = await signupThroughOtp(app, otpBox, buyerPayload({ email, number: '9810000001' }));
    expect(b.status).toBe(201);
    const e = await signupThroughOtp(app, otpBox, exporterPayload({ email, number: '9820000002' }));
    expect(e.status).toBe(201);
    expect(await User.countDocuments({ email })).toBe(2);
  });

  it('the same email may NOT register two accounts of the same role', async () => {
    const email = `same_${uniq()}@example.com`;
    const b1 = await signupThroughOtp(app, otpBox, buyerPayload({ email, number: '9810000011' }));
    expect(b1.status).toBe(201);
    const b2 = await signupThroughOtp(app, otpBox, buyerPayload({ email, number: '9810000012' }));
    expect(b2.status).toBe(409);
  });

  it('the same mobile may hold buyer + exporter, but not two of the same role', async () => {
    const number = '9830000021';
    // buyer + exporter share the mobile → ok
    const b = await signupThroughOtp(app, otpBox, buyerPayload({ email: `m1_${uniq()}@example.com`, number }));
    expect(b.status).toBe(201);
    const e = await signupThroughOtp(app, otpBox, exporterPayload({ email: `m2_${uniq()}@example.com`, number }));
    expect(e.status).toBe(201);
    // second buyer with the same mobile → conflict
    const b2 = await signupThroughOtp(app, otpBox, buyerPayload({ email: `m3_${uniq()}@example.com`, number }));
    expect(b2.status).toBe(409);
  });

  it('a staff email/mobile cannot also be a buyer/exporter — and vice versa', async () => {
    const sa = await makeSuperadmin();

    // party first → staff reuse of that email OR mobile is rejected.
    const partyEmail = `party_${uniq()}@example.com`;
    const partyNumber = '9840000031';
    expect(
      (await signupThroughOtp(app, otpBox, buyerPayload({ email: partyEmail, number: partyNumber })))
        .status,
    ).toBe(201);

    const staffReuseEmail = await request(app)
      .post('/admin/employees')
      .set(bearer(sa.token))
      .send(employeePayload({ email: partyEmail, number: '9850000032' }));
    expect(staffReuseEmail.status).toBe(409);

    const staffReuseMobile = await request(app)
      .post('/admin/employees')
      .set(bearer(sa.token))
      .send(employeePayload({ email: `newemp_${uniq()}@example.com`, number: partyNumber }));
    expect(staffReuseMobile.status).toBe(409);

    // staff first → party reuse of that email OR mobile is rejected.
    const empEmail = `emp_${uniq()}@example.com`;
    const empNumber = '9860000041';
    const emp = await request(app)
      .post('/admin/employees')
      .set(bearer(sa.token))
      .send(employeePayload({ email: empEmail, number: empNumber }));
    expect(emp.status).toBe(201);

    const buyerReuseStaffEmail = await signupThroughOtp(app, otpBox, buyerPayload({ email: empEmail, number: '9870000042' }));
    expect(buyerReuseStaffEmail.status).toBe(409);

    const exporterReuseStaffMobile = await signupThroughOtp(app, otpBox, exporterPayload({ email: `x_${uniq()}@example.com`, number: empNumber }));
    expect(exporterReuseStaffMobile.status).toBe(409);
  });
});
