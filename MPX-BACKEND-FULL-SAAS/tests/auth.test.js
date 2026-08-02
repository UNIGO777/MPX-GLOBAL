import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

import { signupThroughOtp } from './helpers/signupFlow.js';
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

// A21: signup is start → verify email → verify mobile → complete. The account
// does not exist until the last call.
const signupBuyer = (b, extra = {}) => signupThroughOtp(app, otpBox, { ...b, role: 'buyer', ...extra });
const signupExporter = (b, extra = {}) =>
  signupThroughOtp(app, otpBox, { ...b, role: 'exporter', entityType: 'business', ...extra });

async function signupAndLogin(b) {
  await signupBuyer(b);
  const login = await request(app).post('/auth/login').send({ identifier: b.email, password: b.password, portal: 'buyer' });
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
    const res = await signupBuyer(b);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('buyer');
    // D3 still holds: verification proves the address, it is not an approval
    // gate — the buyer is fully active the moment the account is created.
    expect(res.body.user.isActive).toBe(true);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(b.password);

    const org = await Organisation.findById(res.body.user.orgId);
    expect(org.type).toBe('business');
    expect(org.buyerSide).toBe(true);
    expect(org.exporterSide).toBe(false);
    expect(org.kycStatus).toBe('pending');
  });

  it('exporter signup: extra fields (entityType + address) stored, kyc pending', async () => {
    const b = makeBuyer();
    const res = await signupExporter(b, {
      address: { line1: '1 Trade St', city: 'Mumbai', state: 'MH', postalCode: '400001' },
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('exporter');
    const org = await Organisation.findById(res.body.user.orgId);
    expect(org.type).toBe('business');
    expect(org.exporterSide).toBe(true);
    expect(org.buyerSide).toBe(false);
    expect(org.kycStatus).toBe('pending');
    expect(org.entityType).toBe('business');
    expect(org.address.city).toBe('Mumbai');
  });

  it('exporter signup requires entityType — enforced at the company step', async () => {
    // A21 moved the company fields to step 2, so this is now refused at
    // /complete rather than at the first call. The ROLE comes from the pending
    // record, so a client cannot dodge it by reshaping the body.
    const res = await signupExporter(makeBuyer(), { entityType: undefined });
    expect(res.status).toBe(400);
  });

  it('signup returns a CURATED user view (no tokenVersion / internal flags)', async () => {
    const res = await signupBuyer(makeBuyer());
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBeTruthy();
    expect(res.body.user).not.toHaveProperty('tokenVersion');
    expect(res.body.user).not.toHaveProperty('isEmailVerified');
    expect(res.body.user).not.toHaveProperty('permissions');
  });

  it('exporter signup does NOT accept businessProfile (A5) — same regNo twice stores nothing, no 500', async () => {
    const bp = { registrationNumber: 'REG-DUP-1', taxId: 'TAX-1', establishedYear: 2001 };
    const r1 = await signupExporter(makeBuyer(), { businessProfile: bp });
    const r2 = await signupExporter(makeBuyer(), { businessProfile: bp });
    // Both succeed: the field is stripped at the boundary, so the (regNo, country)
    // unique index can never fire on a public signup (this used to be a raw 500).
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const org = await Organisation.findById(r1.body.user.orgId);
    expect(org.businessProfile?.registrationNumber ?? undefined).toBeUndefined();
  });

  it('two orgs with the same company name sign up cleanly with distinct slugs', async () => {
    const r1 = await signupBuyer(makeBuyer(), { company: 'Same Name Traders' });
    const r2 = await signupBuyer(makeBuyer(), { company: 'Same Name Traders' });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const o1 = await Organisation.findById(r1.body.user.orgId);
    const o2 = await Organisation.findById(r2.body.user.orgId);
    expect(o1.slug).toBeTruthy();
    expect(o2.slug).toBeTruthy();
    expect(o1.slug).not.toBe(o2.slug);
  });

  it('A21: step 1 sends BOTH codes and issues NO session; complete yields the tokens', async () => {
    const b = makeBuyer();
    const started = await request(app)
      .post('/auth/signup/start')
      .send({ name: b.name, email: b.email, mobile: b.mobile, password: b.password, role: 'buyer' });

    expect(started.status).toBe(201);
    expect(started.body.signupToken).toBeTruthy();
    // No session, and no account — this is the fix: nothing exists yet.
    expect(started.body.accessToken).toBeUndefined();
    expect(started.body.refreshToken).toBeUndefined();
    expect(await Organisation.countDocuments({})).toBe(0);

    // One code per channel, and they are distinct challenges.
    expect(otpBox.byId.get(b.email.toLowerCase())).toMatch(/^\d{6}$/);
    expect(otpBox.byId.get(e164(b))).toMatch(/^\d{6}$/);

    const token = started.body.signupToken;
    await request(app).post('/auth/signup/verify')
      .send({ signupToken: token, channel: 'email', code: otpBox.byId.get(b.email.toLowerCase()) });
    await request(app).post('/auth/signup/verify')
      .send({ signupToken: token, channel: 'mobile', code: otpBox.byId.get(e164(b)) });

    const done = await request(app).post('/auth/signup/complete')
      .send({ signupToken: token, company: b.company, country: b.country });
    expect(done.status).toBe(201);
    expect(done.body.accessToken).toBeTruthy();
    expect(done.body.refreshToken).toBeTruthy();
  });

  it('duplicate email is rejected at step 1 — before the caller proves two codes', async () => {
    const b = makeBuyer();
    await signupBuyer(b);
    const dup = await request(app)
      .post('/auth/signup/start')
      .send({ ...makeBuyer(), email: b.email, role: 'buyer' });
    expect(dup.status).toBe(409);
  });

  it('wrong password and unknown user return the same generic 401', async () => {
    const b = makeBuyer();
    await signupBuyer(b);
    const wrong = await request(app).post('/auth/login').send({ identifier: b.email, password: 'wrongpassword9', portal: 'buyer' });
    const unknown = await request(app).post('/auth/login').send({ identifier: 'ghost@example.com', password: 'wrongpassword9', portal: 'buyer' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('login → OTP → tokens, then /auth/me works', async () => {
    const b = makeBuyer();
    await signupBuyer(b);
    const login = await request(app).post('/auth/login').send({ identifier: b.email, password: b.password, portal: 'buyer' });
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
    const res = await request(app).post('/auth/login').send({ identifier: { $gt: '' }, password: 'longpassword1', portal: 'buyer' });
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

    const login = await request(app).post('/auth/staff/login').send({ identifier: email, password: 'adminpassword1' });
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
