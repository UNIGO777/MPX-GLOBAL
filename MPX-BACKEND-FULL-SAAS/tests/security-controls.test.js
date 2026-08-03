/**
 * Direct tests for the three low-level controls the whole codebase leans on but
 * that almost nothing tested end to end: the toJSON strip guard, the central
 * error handler's leak prevention, and ownership-scope declaration.
 *
 * Coverage found these at 38% / 26% branch / 72% — they are the "second line of
 * defence" everything else assumes is there, so they get first-class tests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { OtpChallenge } from '../src/models/OtpChallenge.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { ErrorLog } from '../src/models/ErrorLog.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { SavedItem } from '../src/models/SavedItem.js';
import { Inquiry } from '../src/models/Inquiry.js';
import { DeviceToken } from '../src/models/DeviceToken.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { ownershipFilter, scopedFilter } from '../src/models/scoping.js';
import { hashPassword } from '../src/services/password.service.js';
import { signAccessToken } from '../src/services/token.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), OtpChallenge.deleteMany({}), RefreshToken.deleteMany({}),
    ErrorLog.deleteMany({}),
  ]);
});

describe('toJSON strip guard — the last line before a secret ships (baseSchema)', () => {
  // Every model that declares a select:false path, and the path that must never
  // survive serialisation.
  const CASES = [
    ['User.passwordHash', async () => {
      seq += 1;
      const org = await Organisation.create({ name: `O${seq}`, type: 'business' });
      return User.create({
        name: 'x', email: `sc_${Date.now()}_${seq}@e.com`,
        mobile: { countryCode: '+91', number: `95${1000000 + seq}`, e164: `+9195${1000000 + seq}` },
        passwordHash: await hashPassword('longpassword1'), role: 'buyer', orgId: org._id,
        twoFactorSecret: 'TOTPSECRET', twoFactorBackupCodes: [{ codeHash: 'h' }],
      });
    }, ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes', 'TOTPSECRET']],

    ['OtpChallenge.codeHash', async () => OtpChallenge.create({
      userId: new mongoose.Types.ObjectId(), identifier: '+919000000000', channel: 'mobile',
      purpose: 'login', codeHash: 'ARGON2HASHVALUE', expiresAt: new Date(Date.now() + 1000),
      maxAttempts: 5,
    }), ['codeHash', 'ARGON2HASHVALUE']],

    ['RefreshToken.tokenHash', async () => RefreshToken.create({
      userId: new mongoose.Types.ObjectId(), familyId: 'fam-1', tokenHash: `HASHED${(seq += 1)}`,
      status: 'active', expiresAt: new Date(Date.now() + 1000),
    }), ['tokenHash', 'HASHED']],

    ['Organisation.kycDocuments', async () => Organisation.create({
      name: `KYC Co ${(seq += 1)}`, type: 'business',
      kycDocuments: [{ docType: 'pan', storageKey: 'mpx/kyc/SECRETKEY', uploadedAt: new Date() }],
    }), ['kycDocuments', 'SECRETKEY']],
  ];

  for (const [label, make, forbidden] of CASES) {
    it(`${label} never survives toJSON — even when explicitly loaded`, async () => {
      const doc = await make();
      const blob = JSON.stringify(doc.toJSON());
      for (const needle of forbidden) expect(blob).not.toContain(needle);
      expect(blob).not.toContain('__v');
    });
  }

  it('strips even when the field was force-loaded with .select("+field")', async () => {
    seq += 1;
    const org = await Organisation.create({ name: `Force ${seq}`, type: 'business' });
    const user = await User.create({
      name: 'x', email: `fc_${Date.now()}_${seq}@e.com`,
      mobile: { countryCode: '+91', number: `96${1000000 + seq}`, e164: `+9196${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'), role: 'buyer', orgId: org._id,
    });

    // This is the exact situation the guard exists for: a service loads the hash
    // on purpose to verify a password, then the document is serialised anyway.
    const loaded = await User.findOne({ _id: user._id }).select('+passwordHash');
    expect(loaded.passwordHash).toBeTruthy();          // present on the document…
    expect(JSON.stringify(loaded.toJSON())).not.toContain('passwordHash'); // …gone from JSON
  });

  it('Product.searchKeywords (an internal M3 denorm) is stripped too', async () => {
    const top = await Category.create({ name: 'T', slug: `t-${(seq += 1)}` });
    const leaf = await Category.create({ name: 'L', parentId: top._id, type: 'goods' });
    const org = await Organisation.create({ name: `P Co ${seq}`, type: 'business', exporterSide: true });
    const product = await Product.create({
      exporterOrgId: org._id, categoryId: leaf._id, name: 'Roll', status: 'active',
      searchKeywords: 'INTERNALCORPUS cotton fabric',
    });
    const loaded = await Product.findOne({ _id: product._id }).select('+searchKeywords');
    expect(JSON.stringify(loaded.toJSON())).not.toContain('INTERNALCORPUS');
  });
});

describe('ownership scoping is DECLARED on every model (default-deny)', () => {
  it('every registered model declares a scope — a new one cannot be forgotten', () => {
    const user = { orgId: String(new mongoose.Types.ObjectId()), _id: new mongoose.Types.ObjectId() };
    const undeclared = [];

    for (const name of mongoose.modelNames()) {
      try {
        ownershipFilter(mongoose.model(name), user);
      } catch {
        undeclared.push(name);
      }
    }
    // If this fails, a model was added without declareScope() — which is exactly
    // the "refusing to build an unscoped query" guard doing its job.
    expect(undeclared).toEqual([]);
  });

  it('each scope kind produces the right fragment', () => {
    const orgId = String(new mongoose.Types.ObjectId());
    const userId = new mongoose.Types.ObjectId();
    const user = { orgId, _id: userId };

    expect(ownershipFilter(Conversation, user)).toEqual({ parties: orgId });   // PARTIES
    expect(ownershipFilter(SavedItem, user)).toEqual({ buyerOrgId: orgId });   // BUYER_ORG
    expect(ownershipFilter(Product, user)).toEqual({ exporterOrgId: orgId });  // EXPORTER_ORG
    expect(ownershipFilter(Organisation, user)).toEqual({ _id: orgId });       // SELF
    expect(ownershipFilter(DeviceToken, user)).toEqual({ userId });            // USER
    expect(ownershipFilter(AuditLog, user)).toEqual({});                       // PLATFORM
    expect(ownershipFilter(Inquiry, user)).toEqual({ parties: orgId });
  });

  it('scopedFilter composes the id WITH the ownership fragment, never the id alone', () => {
    const id = new mongoose.Types.ObjectId();
    const orgId = String(new mongoose.Types.ObjectId());
    expect(scopedFilter(Product, id, { orgId })).toEqual({ _id: id, exporterOrgId: orgId });
  });

  it('an undeclared model is REFUSED rather than queried unscoped', () => {
    const rogue = mongoose.model('RogueUnscoped', new mongoose.Schema({ x: String }));
    expect(() => ownershipFilter(rogue, { orgId: 'x' })).toThrow(/refusing to build an unscoped query/i);
  });

  it('Message is PLATFORM-scoped on purpose — it has no owner field of its own', () => {
    // Documented so nobody "fixes" it: a Message is reachable only through its
    // Conversation, which is where the party check happens.
    expect(ownershipFilter(Message, { orgId: 'x' })).toEqual({});
  });
});

describe('central error handler never leaks internals', () => {
  it('a body-parser failure is a clean 400, not a parser stack', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"identifier": "broken'); // malformed JSON

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid request.');
    const blob = JSON.stringify(res.body);
    for (const leak of ['JSON.parse', 'SyntaxError', 'body-parser', 'at ', 'stack']) {
      expect(blob).not.toContain(leak);
    }
  });

  it('an oversized body is 413 with a safe message', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'a'.repeat(3 * 1024 * 1024), password: 'x', portal: 'buyer' });

    expect([400, 413]).toContain(res.status);
    if (res.status === 413) expect(res.body.error.message).toBe('Payload too large.');
    expect(JSON.stringify(res.body)).not.toContain('entity.too.large');
  });

  it('every error response carries a requestId and nothing else structural', async () => {
    const res = await request(app).get('/no/such/route');
    expect(res.status).toBe(404);
    expect(Object.keys(res.body)).toEqual(['error']);
    // No `code` here: it is omitted unless a throw site set one, so the envelope
    // is unchanged for the vast majority of errors.
    expect(Object.keys(res.body.error).sort()).toEqual(['message', 'requestId']);
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('a coded error adds ONLY `code` — still no stack, no internals', async () => {
    // Refresh with nothing presented is the smallest coded error to provoke.
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(401);
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message', 'requestId']);
    // The code is a stable discriminator, never a leak of internal wording.
    expect(res.body.error.code).toBe('REFRESH_TOKEN_MISSING');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:\d+|stack/i);
  });

  it('a 4xx writes NO errorLogs row; only 5xx is persisted (A19)', async () => {
    await request(app).get('/no/such/route');
    await request(app).post('/auth/login').send({ identifier: 'x' }); // validation 400
    expect(await ErrorLog.countDocuments({})).toBe(0);
  });

  it('the requestId in the body matches the response header', async () => {
    const res = await request(app).get('/no/such/route');
    expect(res.headers['x-request-id']).toBe(res.body.error.requestId);
  });
});

describe('security headers and CORS are actually applied', () => {
  it('helmet headers are present on a public response', async () => {
    const res = await request(app).get('/categories');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeTruthy();
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['x-powered-by']).toBeUndefined(); // never advertise the stack
  });

  it('a disallowed browser Origin is refused, a no-Origin client is not', async () => {
    const blocked = await request(app).get('/categories').set('Origin', 'https://evil.example');
    expect(blocked.status).toBe(403);

    const noOrigin = await request(app).get('/categories');
    expect(noOrigin.status).toBe(200); // mobile app / server-to-server
  });
});

describe('auth surface gives the SAME answer for every failure shape', () => {
  async function makeBuyer(password = 'longpassword1') {
    seq += 1;
    const org = await Organisation.create({ name: `Auth Co ${seq}`, type: 'business', buyerSide: true });
    const user = await User.create({
      name: 'buyer', email: `au_${Date.now()}_${seq}@e.com`,
      mobile: { countryCode: '+91', number: `97${1000000 + seq}`, e164: `+9197${1000000 + seq}` },
      passwordHash: await hashPassword(password), role: 'buyer', orgId: org._id,
    });
    return { org, user };
  }

  it('wrong password, unknown user and WRONG PORTAL are indistinguishable', async () => {
    const { user } = await makeBuyer();

    const wrongPassword = await request(app).post('/auth/login')
      .send({ identifier: user.email, password: 'wrongpassword1', portal: 'buyer' });
    const unknownUser = await request(app).post('/auth/login')
      .send({ identifier: 'nobody@example.com', password: 'longpassword1', portal: 'buyer' });
    // The account exists — but on the OTHER portal. This must not be detectable.
    const wrongPortal = await request(app).post('/auth/login')
      .send({ identifier: user.email, password: 'longpassword1', portal: 'exporter' });

    for (const res of [wrongPassword, unknownUser, wrongPortal]) {
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid credentials.');
    }
  });

  it('a deactivated account looks exactly like a wrong password', async () => {
    const { user } = await makeBuyer();
    await User.updateOne({ _id: user._id }, { $set: { isActive: false } });

    const res = await request(app).post('/auth/login')
      .send({ identifier: user.email, password: 'longpassword1', portal: 'buyer' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials.');
  });

  it('forgot-password is generic whether or not the account exists', async () => {
    const { user } = await makeBuyer();
    const known = await request(app).post('/auth/forgot-password')
      .send({ identifier: user.email, portal: 'buyer' });
    const unknown = await request(app).post('/auth/forgot-password')
      .send({ identifier: 'nobody@example.com', portal: 'buyer' });

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
  });

  it('staff cannot sign in through the party portal, nor a buyer through the staff one', async () => {
    seq += 1;
    const platform = await Organisation.create({ name: `Platform ${seq}`, type: 'platform' });
    const staff = await User.create({
      name: 'sa', email: `st_${Date.now()}_${seq}@e.com`,
      mobile: { countryCode: '+91', number: `98${1000000 + seq}`, e164: `+9198${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'), role: 'superadmin', orgId: platform._id,
    });
    const { user: buyer } = await makeBuyer();

    const staffOnParty = await request(app).post('/auth/login')
      .send({ identifier: staff.email, password: 'longpassword1', portal: 'buyer' });
    expect(staffOnParty.status).toBe(401);

    const buyerOnStaff = await request(app).post('/auth/staff/login')
      .send({ identifier: buyer.email, password: 'longpassword1' });
    expect(buyerOnStaff.status).toBe(401);
  });

  it('the login response is an EXACT shape — no hash, no token version, no code', async () => {
    const { user } = await makeBuyer();
    const res = await request(app).post('/auth/login')
      .send({ identifier: user.email, password: 'longpassword1', portal: 'buyer' });
    expect(res.status).toBe(200);

    // An exact key set is the real guarantee — a substring scan for "otp" would
    // only flag `method: 'otp'`, which is the second-factor NAME the client needs
    // in order to prompt, not a code.
    expect(Object.keys(res.body).sort()).toEqual(['loginToken', 'message', 'method'].sort());
    expect(res.body.method).toBe('otp');

    const blob = JSON.stringify(res.body);
    for (const leak of ['passwordHash', 'tokenVersion', 'codeHash', 'twoFactorSecret']) {
      expect(blob).not.toContain(leak);
    }
    // …and the actual OTP code that was just issued is nowhere in the response.
    const challenge = await OtpChallenge.findOne({ userId: user._id }).select('+codeHash');
    expect(challenge).toBeTruthy();
    expect(blob).not.toContain(challenge.codeHash);

    // A login-pending token is returned — but it must not be usable as a session.
    expect(res.body.loginToken).toBeTruthy();
    expect((await request(app).get('/auth/me').set(bearer(res.body.loginToken))).status).toBe(401);
  });
});

describe('signed tokens are bound to the account they were issued for', () => {
  it('an access token stops working the moment the account is deactivated', async () => {
    seq += 1;
    const org = await Organisation.create({ name: `Deact ${seq}`, type: 'business', buyerSide: true });
    const user = await User.create({
      name: 'b', email: `dz_${Date.now()}_${seq}@e.com`,
      mobile: { countryCode: '+91', number: `99${1000000 + seq}`, e164: `+9199${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'), role: 'buyer', orgId: org._id,
    });
    const token = signAccessToken(user);
    expect((await request(app).get('/auth/me').set(bearer(token))).status).toBe(200);

    await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
    expect((await request(app).get('/auth/me').set(bearer(token))).status).toBe(401);
  });
});
