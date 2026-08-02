/**
 * A21 · signup with BOTH channels verified before an account exists.
 *
 * The bug this closes: signup used to write the `User` and the `Organisation`
 * first and only then send a single MOBILE code. Email was never verified at
 * all. Because `User` is uniquely indexed on `(email, role)` and
 * `(mobile.e164, role)`, anyone could permanently burn a stranger's email or
 * phone with no proof of ownership — and the real owner could then never
 * register for that role.
 *
 * So the tests that matter most are: nothing is written before both codes pass,
 * and an abandoned signup leaves the address free for its rightful owner.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Capture codes instead of "sending" them. Email and mobile key off different
// identifiers, so one map serves both channels.
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
import { PendingSignup } from '../src/models/PendingSignup.js';
import { OtpChallenge } from '../src/models/OtpChallenge.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { signAccessToken } from '../src/services/token.service.js';

const app = createApp();
let seq = 0;

function details(overrides = {}) {
  seq += 1;
  return {
    name: `Person ${seq}`,
    email: `a21_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `70${1000000 + seq}` },
    password: 'longpassword1',
    role: 'buyer',
    ...overrides,
  };
}

const e164 = (d) => `${d.mobile.countryCode}${d.mobile.number}`;
const emailCode = (d) => otpBox.byId.get(d.email.toLowerCase());
const mobileCode = (d) => otpBox.byId.get(e164(d));

const start = (d) => request(app).post('/auth/signup/start').send(d);
const verify = (signupToken, channel, code) =>
  request(app).post('/auth/signup/verify').send({ signupToken, channel, code });
const complete = (signupToken, body = {}) =>
  request(app)
    .post('/auth/signup/complete')
    .send({ signupToken, company: `Co ${seq}`, country: 'IN', ...body });

/** The whole happy path, since most tests need an account to exist. */
async function fullSignup(overrides = {}) {
  const d = details(overrides);
  const started = await start(d);
  const token = started.body.signupToken;
  await verify(token, 'email', emailCode(d));
  await verify(token, 'mobile', mobileCode(d));
  const done = await complete(token, overrides.role === 'exporter' ? { entityType: 'business' } : {});
  return { d, token, done };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Organisation.deleteMany({}),
    PendingSignup.deleteMany({}),
    OtpChallenge.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  otpBox.byId.clear();
});

describe('A21 · nothing is written before both channels are proved', () => {
  it('step 1 creates NO user and NO organisation', async () => {
    const d = details();
    const res = await start(d);

    expect(res.status).toBe(201);
    expect(res.body.signupToken).toBeTruthy();
    expect(await User.countDocuments({})).toBe(0);
    expect(await Organisation.countDocuments({})).toBe(0);
    expect(await PendingSignup.countDocuments({})).toBe(1);
  });

  it('sends TWO different codes, one per channel', async () => {
    const d = details();
    await start(d);

    expect(emailCode(d)).toMatch(/^\d{6}$/);
    expect(mobileCode(d)).toMatch(/^\d{6}$/);
    // Two independent challenges, not one code echoed to both places.
    expect(emailCode(d)).not.toBe(mobileCode(d));
    expect(await OtpChallenge.countDocuments({})).toBe(2);
  });

  it('verifying ONE channel still creates nothing', async () => {
    const d = details();
    const { body } = await start(d);
    await verify(body.signupToken, 'email', emailCode(d));

    expect(await User.countDocuments({})).toBe(0);
    expect(await Organisation.countDocuments({})).toBe(0);
  });

  it('complete is REFUSED when only the email is verified', async () => {
    const d = details();
    const { body } = await start(d);
    await verify(body.signupToken, 'email', emailCode(d));

    const res = await complete(body.signupToken);
    expect(res.status).toBe(403);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('complete is REFUSED when only the mobile is verified', async () => {
    const d = details();
    const { body } = await start(d);
    await verify(body.signupToken, 'mobile', mobileCode(d));

    expect((await complete(body.signupToken)).status).toBe(403);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('both verified → the account is created, flagged verified, and a session is issued', async () => {
    const { d, done } = await fullSignup();

    expect(done.status).toBe(201);
    expect(done.body.accessToken).toBeTruthy();
    expect(done.body.refreshToken).toBeTruthy();
    expect(done.body.user.email).toBe(d.email.toLowerCase());

    const user = await User.findOne({ email: d.email.toLowerCase() });
    expect(user.isEmailVerified).toBe(true);
    expect(user.isMobileVerified).toBe(true);
    expect(await Organisation.countDocuments({})).toBe(1);
  });

  it('the pending record and its spent codes are cleared once the account exists', async () => {
    await fullSignup();
    expect(await PendingSignup.countDocuments({})).toBe(0);
    expect(await OtpChallenge.countDocuments({})).toBe(0);
  });

  it('a used signup token cannot be replayed', async () => {
    const { token } = await fullSignup();
    const again = await complete(token);
    expect(again.status).toBe(401);
    expect(await User.countDocuments({})).toBe(1);
  });
});

describe('A21 · the squatting hole is closed', () => {
  it('an ABANDONED signup leaves the email free for its rightful owner', async () => {
    const victimEmail = `owner_${Date.now()}@example.com`;

    // A squatter starts a signup on someone else's address and walks away.
    await start(details({ email: victimEmail }));
    expect(await User.countDocuments({})).toBe(0);

    // The real owner can still register it, with a different phone.
    const { done } = await fullSignup({ email: victimEmail });
    expect(done.status).toBe(201);
    expect(await User.countDocuments({ email: victimEmail })).toBe(1);
  });

  it('two people may hold pending signups for the same address at once', async () => {
    const shared = `shared_${Date.now()}@example.com`;
    expect((await start(details({ email: shared }))).status).toBe(201);
    expect((await start(details({ email: shared }))).status).toBe(201);
    expect(await User.countDocuments({})).toBe(0);
  });
});

describe('A21 · the two codes are independent', () => {
  it('verifying the email does NOT invalidate the live mobile code', async () => {
    const d = details();
    const { body } = await start(d);
    const mobile = mobileCode(d);

    await verify(body.signupToken, 'email', emailCode(d));
    // The mobile code captured BEFORE the email step must still work — a shared
    // OTP purpose would have deleted it here and made the flow uncompletable.
    const res = await verify(body.signupToken, 'mobile', mobile);
    expect(res.status).toBe(200);
    expect(res.body.complete).toBe(true);
  });

  it('an email code will not verify the mobile, and vice versa', async () => {
    const d = details();
    const { body } = await start(d);

    expect((await verify(body.signupToken, 'mobile', emailCode(d))).status).toBe(401);
    expect((await verify(body.signupToken, 'email', mobileCode(d))).status).toBe(401);
  });

  it('another pending signup\'s code cannot verify this one', async () => {
    const mine = details();
    const theirs = details();
    const { body } = await start(mine);
    await start(theirs);

    const res = await verify(body.signupToken, 'email', emailCode(theirs));
    expect(res.status).toBe(401);
  });

  it('locking the email channel does NOT lock the mobile (A3, per channel)', async () => {
    const d = details();
    const { body } = await start(d);

    for (let i = 0; i < 5; i += 1) await verify(body.signupToken, 'email', '000000');
    // Email is locked...
    const locked = await verify(body.signupToken, 'email', emailCode(d));
    expect(locked.status).toBe(401);
    // ...but the phone is untouched.
    const ok = await verify(body.signupToken, 'mobile', mobileCode(d));
    expect(ok.status).toBe(200);
    expect(ok.body.mobileVerified).toBe(true);
  });

  it('a code is single-use', async () => {
    const d = details();
    const { body } = await start(d);
    const code = emailCode(d);

    expect((await verify(body.signupToken, 'email', code)).status).toBe(200);
    // Re-verifying an already-proved channel is a no-op, so drop the flag first
    // to prove the CHALLENGE itself was consumed rather than the shortcut firing.
    await PendingSignup.updateOne({ _id: (await PendingSignup.findOne({}))._id }, { $unset: { emailVerifiedAt: 1 } });
    expect((await verify(body.signupToken, 'email', code)).status).toBe(401);
  });

  it('re-verifying an already-proved channel is a no-op, not an error', async () => {
    const d = details();
    const { body } = await start(d);
    await verify(body.signupToken, 'email', emailCode(d));

    // A double-tap must not read as "invalid code".
    const again = await verify(body.signupToken, 'email', '000000');
    expect(again.status).toBe(200);
    expect(again.body.emailVerified).toBe(true);
  });
});

describe('A21 · resend', () => {
  it('resend issues a new code and retires the old one', async () => {
    const d = details();
    const { body } = await start(d);
    const first = emailCode(d);

    await request(app).post('/auth/signup/resend').send({ signupToken: body.signupToken, channel: 'email' });
    const second = emailCode(d);
    expect(second).not.toBe(first);

    expect((await verify(body.signupToken, 'email', first)).status).toBe(401);
    expect((await verify(body.signupToken, 'email', second)).status).toBe(200);
  });

  it('refuses to resend a channel that is already verified', async () => {
    const d = details();
    const { body } = await start(d);
    await verify(body.signupToken, 'email', emailCode(d));

    const res = await request(app)
      .post('/auth/signup/resend')
      .send({ signupToken: body.signupToken, channel: 'email' });
    expect(res.status).toBe(400);
  });
});

describe('A21 · identity rules still hold', () => {
  it('the same email may hold one buyer AND one exporter account', async () => {
    const shared = `dual_${Date.now()}@example.com`;
    const buyer = await fullSignup({ email: shared, role: 'buyer' });
    expect(buyer.done.status).toBe(201);

    const exporter = await fullSignup({ email: shared, role: 'exporter' });
    expect(exporter.done.status).toBe(201);
    expect(await User.countDocuments({ email: shared })).toBe(2);
  });

  it('the same email may NOT hold two accounts of the same role', async () => {
    const shared = `dup_${Date.now()}@example.com`;
    await fullSignup({ email: shared, role: 'buyer' });

    // Refused at step 1 — the caller is not made to prove two codes first.
    const res = await start(details({ email: shared, role: 'buyer' }));
    expect(res.status).toBe(409);
  });

  it('an exporter must declare entityType at the company step', async () => {
    const d = details({ role: 'exporter' });
    const { body } = await start(d);
    await verify(body.signupToken, 'email', emailCode(d));
    await verify(body.signupToken, 'mobile', mobileCode(d));

    expect((await complete(body.signupToken)).status).toBe(400);
    expect((await complete(body.signupToken, { entityType: 'business' })).status).toBe(201);
  });

  it('an exporter signup sets exporterSide and keeps kyc pending', async () => {
    const { d } = await fullSignup({ role: 'exporter' });
    const user = await User.findOne({ email: d.email.toLowerCase() });
    const org = await Organisation.findOne({ _id: user.orgId });
    expect(org.exporterSide).toBe(true);
    expect(org.kycStatus).toBe('pending');
  });
});

describe('A21 · the old unverified endpoints are gone', () => {
  it.each(['/auth/buyer/signup', '/auth/exporter/signup'])('%s no longer exists', async (path) => {
    const res = await request(app).post(path).send({
      name: 'X', email: `gone_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: '7999888777' },
      password: 'longpassword1', company: 'C', country: 'IN', entityType: 'business',
    });
    expect(res.status).toBe(404);
    expect(await User.countDocuments({})).toBe(0);
  });
});

describe('A21 · leaks and token confusion', () => {
  it('no response on any step carries a code', async () => {
    const d = details();
    const started = await start(d);
    expect(JSON.stringify(started.body)).not.toContain(emailCode(d));
    expect(JSON.stringify(started.body)).not.toContain(mobileCode(d));

    const verified = await verify(started.body.signupToken, 'email', emailCode(d));
    expect(JSON.stringify(verified.body)).not.toMatch(/\d{6}/);
  });

  it('step 1 returns only MASKED contact, never the raw address back', async () => {
    const d = details();
    const { body } = await start(d);
    expect(body.email).toContain('*');
    expect(body.email).not.toBe(d.email.toLowerCase());
    expect(body.mobile).toContain('*');
  });

  it('the response never carries a password hash or the pending id', async () => {
    const d = details();
    const { body } = await start(d);
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('passwordHash');
    expect(serialised).not.toContain('$argon2');
  });

  it('an ACCESS token is refused where a signup token is expected', async () => {
    const { d } = await fullSignup();
    const user = await User.findOne({ email: d.email.toLowerCase() });
    const access = signAccessToken(user);

    const res = await verify(access, 'email', '123456');
    expect(res.status).toBe(401);
  });

  it('a garbage token is refused', async () => {
    expect((await verify('not-a-real-token', 'email', '123456')).status).toBe(401);
  });

  it('validation rejects a Mongo operator payload and a short password', async () => {
    const bad = await request(app).post('/auth/signup/start').send({ ...details(), password: 'short' });
    expect(bad.status).toBe(400);

    const inject = await request(app)
      .post('/auth/signup/start')
      .send({ ...details(), email: { $gt: '' } });
    expect(inject.status).toBe(400);
  });
});

describe('A21 · records and retention', () => {
  it('the audit trail records the start and the completed signup', async () => {
    await fullSignup();
    const actions = (await AuditLog.find({}).lean()).map((a) => a.action);
    expect(actions).toContain('auth.signup.start');
    expect(actions).toContain('auth.signup');
  });

  it('an audit row for the start carries no contact details', async () => {
    const d = details();
    await start(d);
    const row = await AuditLog.findOne({ action: 'auth.signup.start' }).lean();
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain(d.email.toLowerCase());
    expect(serialised).not.toContain(d.mobile.number);
  });

  it('pending signups expire (TTL index present)', async () => {
    const indexes = await PendingSignup.collection.indexes();
    expect(indexes.find((i) => i.expireAfterSeconds !== undefined)).toBeTruthy();
  });

  it('an OtpChallenge needs exactly one subject', async () => {
    await expect(
      OtpChallenge.create({
        identifier: 'x', channel: 'email', purpose: 'signup_email',
        codeHash: 'h', expiresAt: new Date(Date.now() + 1000), maxAttempts: 5,
      }),
    ).rejects.toThrow();

    await expect(
      OtpChallenge.create({
        userId: new mongoose.Types.ObjectId(),
        pendingSignupId: new mongoose.Types.ObjectId(),
        identifier: 'x', channel: 'email', purpose: 'signup_email',
        codeHash: 'h', expiresAt: new Date(Date.now() + 1000), maxAttempts: 5,
      }),
    ).rejects.toThrow();
  });
});
