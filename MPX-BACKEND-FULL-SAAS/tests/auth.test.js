import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import Redis from 'ioredis';

// Capture OTP codes instead of "sending" them (delivery provider is out of scope).
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
import { generateTotpSecret, generateTotp, verifyTotp } from '../src/services/twofactor.service.js';
import { hashPassword } from '../src/services/password.service.js';

const app = createApp();
let redis;

let seq = 0;
function makeBuyer() {
  seq += 1;
  const n = `${9000000000 + seq}`;
  return {
    name: 'Bob Buyer',
    email: `buyer_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: n },
    password: 'longpassword1',
    company: 'Buyer Co',
    country: 'IN',
  };
}
const e164 = (b) => `+91${b.mobile.number}`;

async function signupAndLogin(b) {
  await request(app).post('/auth/buyer/signup').send(b);
  const login = await request(app).post('/auth/login').send({ identifier: b.email, password: b.password });
  const code = otpBox.byId.get(e164(b));
  const verify = await request(app)
    .post('/auth/verify-otp')
    .send({ loginToken: login.body.loginToken, code });
  return verify.body; // { accessToken, refreshToken, user }
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
  await Promise.all([
    User.deleteMany({}),
    Organisation.deleteMany({}),
    RefreshToken.deleteMany({}),
    OtpChallenge.deleteMany({}),
  ]);
  await redis.flushdb();
  otpBox.byId.clear();
});

describe('auth', () => {
  it('buyer signup: active immediately, no gate, no secrets leaked', async () => {
    const b = makeBuyer();
    const res = await request(app).post('/auth/buyer/signup').send(b);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('buyer');
    expect(res.body.user.isActive).toBe(true);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(b.password);

    const org = await Organisation.findById(res.body.user.orgId);
    expect(org.type).toBe('buyer');
    expect(org.kycStatus).toBe('pending');
  });

  it('exporter signup: extra fields (entityType + address) stored, kyc pending', async () => {
    const b = {
      ...makeBuyer(),
      entityType: 'business',
      address: { line1: '1 Trade St', city: 'Mumbai', state: 'MH', postalCode: '400001' },
    };
    const res = await request(app).post('/auth/exporter/signup').send(b);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('exporter');
    const org = await Organisation.findById(res.body.user.orgId);
    expect(org.type).toBe('exporter');
    expect(org.kycStatus).toBe('pending');
    expect(org.entityType).toBe('business');
    expect(org.address.city).toBe('Mumbai');
  });

  it('exporter signup requires entityType', async () => {
    const res = await request(app).post('/auth/exporter/signup').send({ ...makeBuyer() }); // no entityType
    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f) => f.field)).toContain('body.entityType');
  });

  it('duplicate email is rejected', async () => {
    const b = makeBuyer();
    await request(app).post('/auth/buyer/signup').send(b);
    const dup = await request(app).post('/auth/buyer/signup').send({ ...makeBuyer(), email: b.email });
    expect(dup.status).toBe(409);
  });

  it('wrong password and unknown user return the same generic 401', async () => {
    const b = makeBuyer();
    await request(app).post('/auth/buyer/signup').send(b);
    const wrong = await request(app).post('/auth/login').send({ identifier: b.email, password: 'wrongpassword9' });
    const unknown = await request(app).post('/auth/login').send({ identifier: 'ghost@example.com', password: 'wrongpassword9' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('login → OTP → tokens, then /auth/me works', async () => {
    const b = makeBuyer();
    await request(app).post('/auth/buyer/signup').send(b);
    const login = await request(app).post('/auth/login').send({ identifier: b.email, password: b.password });
    expect(login.status).toBe(200);
    expect(login.body.method).toBe('otp');

    const code = otpBox.byId.get(e164(b));
    expect(code).toMatch(/^\d{6}$/);
    const verify = await request(app).post('/auth/verify-otp').send({ loginToken: login.body.loginToken, code });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
    expect(verify.body.refreshToken).toBeTruthy();

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${verify.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('buyer');
  });

  it('bumping tokenVersion invalidates an existing access token', async () => {
    const b = makeBuyer();
    const { accessToken, user } = await signupAndLogin(b);

    const ok = await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(ok.status).toBe(200);

    await User.updateOne({ _id: user.id ?? user._id }, { $inc: { tokenVersion: 1 } });

    const dead = await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(dead.status).toBe(401);
  });

  it('refresh rotates; reusing the old token revokes the whole family', async () => {
    const b = makeBuyer();
    const { refreshToken: rt1 } = await signupAndLogin(b);

    const r1 = await request(app).post('/auth/refresh').send({ refreshToken: rt1 });
    expect(r1.status).toBe(200);
    const rt2 = r1.body.refreshToken;
    expect(rt2).toBeTruthy();

    // Reuse of the already-rotated rt1 → theft → family revoked.
    const reuse = await request(app).post('/auth/refresh').send({ refreshToken: rt1 });
    expect(reuse.status).toBe(401);

    // rt2 was in the same family, so it is now dead too.
    const rt2after = await request(app).post('/auth/refresh').send({ refreshToken: rt2 });
    expect(rt2after.status).toBe(401);
  });

  it('superadmin-only route denies a buyer, and a body role cannot elevate', async () => {
    const b = makeBuyer();
    const { accessToken } = await signupAndLogin(b);
    const res = await request(app)
      .post('/admin/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'superadmin', name: 'X', email: 'x@example.com', mobile: { countryCode: '+91', number: '9111111111' }, password: 'longpassword1' });
    expect(res.status).toBe(403);
  });

  it('rejects a Mongo operator object in the identifier field', async () => {
    const res = await request(app).post('/auth/login').send({ identifier: { $gt: '' }, password: 'longpassword1' });
    expect(res.status).toBe(400);
  });

  // Superadmin TOTP is ON HOLD (docs/Note.md D4) — the superadmin logs in via OTP
  // like every other role for now.
  it('superadmin logs in via OTP for now (TOTP enrollment on hold — D4)', async () => {
    const org = await Organisation.create({ name: 'Platform', type: 'platform' });
    const email = `superadmin_${Date.now()}@example.com`;
    await User.create({
      name: 'Superadmin',
      email,
      mobile: { countryCode: '+91', number: '9990000001', e164: '+919990000001' },
      passwordHash: await hashPassword('adminpassword1'),
      role: 'superadmin',
      orgId: org._id,
      isActive: true,
    });

    const login = await request(app).post('/auth/login').send({ identifier: email, password: 'adminpassword1' });
    expect(login.status).toBe(200);
    expect(login.body.method).toBe('otp');

    const code = otpBox.byId.get('+919990000001');
    expect(code).toMatch(/^\d{6}$/);
    const verify = await request(app).post('/auth/verify-otp').send({ loginToken: login.body.loginToken, code });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
  });

  // TOTP machinery is kept working for when D4 is restored; guards the v13
  // verify()-returns-an-object bug.
  it('verifyTotp accepts a valid code and rejects a wrong one', async () => {
    const secret = generateTotpSecret();
    const token = await generateTotp(secret);
    expect(await verifyTotp(secret, token)).toBe(true);
    expect(await verifyTotp(secret, '000000')).toBe(false);
  });
});
