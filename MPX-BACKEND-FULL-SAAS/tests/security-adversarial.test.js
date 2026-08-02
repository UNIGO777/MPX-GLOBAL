/**
 * Cross-module adversarial pass (M1 + M2 + M3 + M4).
 *
 * These are attacks, not feature tests: each one is something a hostile client
 * would actually try, aimed at the paths where a miss costs data or integrity.
 * Anything that fails here is a real defect, not a preference.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

import { signupThroughOtp } from './helpers/signupFlow.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

vi.mock('../src/services/image.storage.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(),
  deletePublicImage: vi.fn(async () => {}),
}));

// A21 signup needs the real codes for BOTH channels.
const { otpBox } = vi.hoisted(() => ({ otpBox: { byId: new Map() } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async ({ identifier, code }) => {
    otpBox.byId.set(identifier, code);
  },
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { CategoryAttribute } = await import('../src/models/CategoryAttribute.js');
const { Product } = await import('../src/models/Product.js');
const { SavedItem } = await import('../src/models/SavedItem.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');
const { env } = await import('../src/config/env.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let leaf;
let attackerOrg;
let victimOrg;
let attacker;
let victim;
let victimProduct;

async function makeUser(role, orgFields = {}) {
  seq += 1;
  const org = await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `sec_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `71${1000000 + seq}`, e164: `+9171${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
  });
  return { org, user, token: signAccessToken(user) };
}

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  await CategoryAttribute.create({
    categoryId: leaf._id, name: 'GSM', key: 'gsm', inputType: 'number', filterable: true,
  });

  const a = await makeUser('exporter', { exporterSide: true, country: 'IN' });
  const v = await makeUser('exporter', { exporterSide: true, country: 'IN', kycStatus: 'verified' });
  attacker = a; attackerOrg = a.org;
  victim = v; victimOrg = v.org;

  victimProduct = await Product.create({
    exporterOrgId: victimOrg._id, categoryId: leaf._id, name: 'Victim Cotton Roll',
    status: 'active', sellerCountry: 'IN', sellerVerified: true,
  });
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    CategoryAttribute.deleteMany({}), Product.deleteMany({}), SavedItem.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('ATTACK · mass assignment of internal search denorms (§A23)', () => {
  // sellerVerified drives the verified BOOST in search ranking and the opt-in
  // "verified only" facet; searchKeywords IS the search corpus. If a seller can
  // write either directly, they rank for anything and wear a tick they never earned.
  // NOTE: no dotted keys here on purpose. `rejectMongoOperators` 400s any dotted
  // key before the validator runs, which would make this test pass without ever
  // exercising the stripping it is meant to prove. The dotted case is its own
  // test below.
  const FORBIDDEN = {
    sellerVerified: true,
    sellerCountry: 'US',
    searchKeywords: 'gold diamond luxury pharma cotton silk',
    categoryType: 'service',
    topCategoryId: new mongoose.Types.ObjectId().toString(),
    status: 'active', // bypass draft → active without the D1 cap check
  };

  it('CREATE strips every internal denorm — the product is stored clean', async () => {
    const res = await request(app)
      .post('/products')
      .set(bearer(attacker.token))
      .send({
        name: 'Attacker Roll',
        categoryId: String(leaf._id),
        price: { mode: 'on_request' },
        ...FORBIDDEN,
      });
    expect(res.status).toBe(201); // it succeeds — the forbidden keys are simply not honoured

    const stored = await Product.findById(res.body.product.id).lean();
    expect(stored.sellerVerified).toBe(false);
    expect(stored.sellerCountry).not.toBe('US');
    expect(stored.searchKeywords ?? '').not.toContain('diamond');
    expect(stored.categoryType).not.toBe('service');
    expect(String(stored.topCategoryId ?? '')).not.toBe(FORBIDDEN.topCategoryId);
    // §A1: a new product is ALWAYS a draft — `status` in the body cannot skip it.
    expect(stored.status).toBe('draft');
  });

  it('a dotted key is refused outright, before any handler sees it', async () => {
    const res = await request(app)
      .post('/products')
      .set(bearer(attacker.token))
      .send({
        name: 'Dotted',
        categoryId: String(leaf._id),
        price: { mode: 'on_request' },
        'takedown.isDown': false,
      });
    expect(res.status).toBe(400);
  });

  it('UPDATE cannot flip an unverified seller to verified in the search index', async () => {
    const own = await Product.create({
      exporterOrgId: attackerOrg._id, categoryId: leaf._id, name: 'Attacker Roll 2',
      status: 'active', sellerCountry: 'IN', sellerVerified: false,
    });

    await request(app)
      .patch(`/products/${own._id}`)
      .set(bearer(attacker.token))
      .send({ sellerVerified: true, searchKeywords: 'diamond gold', sellerCountry: 'US' });

    const stored = await Product.findById(own._id).lean();
    expect(stored.sellerVerified).toBe(false);
    expect(stored.sellerCountry).toBe('IN');
    expect(stored.searchKeywords ?? '').not.toContain('diamond');
  });

  it('a seller cannot lift their own takedown through the product edit path', async () => {
    const own = await Product.create({
      exporterOrgId: attackerOrg._id, categoryId: leaf._id, name: 'Blocked Roll', status: 'active',
      takedown: { isDown: true, reason: 'counterfeit', at: new Date() },
    });

    await request(app).patch(`/products/${own._id}`).set(bearer(attacker.token)).send({ takedown: { isDown: false } });
    await request(app).patch(`/products/${own._id}/status`).set(bearer(attacker.token)).send({ status: 'active' });

    expect((await Product.findById(own._id)).takedown.isDown).toBe(true);
  });
});

describe('ATTACK · cross-tenant ownership (IDOR)', () => {
  it("an exporter cannot read, edit, publish or delete another org's product", async () => {
    const id = victimProduct._id;
    const t = bearer(attacker.token);

    expect((await request(app).get(`/products/${id}`).set(t)).status).toBe(404);
    expect((await request(app).patch(`/products/${id}`).set(t).send({ name: 'Stolen' })).status).toBe(404);
    expect((await request(app).patch(`/products/${id}/status`).set(t).send({ status: 'inactive' })).status).toBe(404);
    expect((await request(app).delete(`/products/${id}`).set(t)).status).toBe(404);

    // Untouched.
    const fresh = await Product.findById(id);
    expect(fresh.name).toBe('Victim Cotton Roll');
    expect(fresh.status).toBe('active');
  });

  it('a body-supplied exporterOrgId cannot plant a product in another org', async () => {
    const res = await request(app)
      .post('/products')
      .set(bearer(attacker.token))
      .send({
        name: 'Planted',
        categoryId: String(leaf._id),
        price: { mode: 'on_request' },
        exporterOrgId: String(victimOrg._id),
      });
    expect(res.status).toBe(201);

    // Ownership comes from the TOKEN, never from the body.
    const stored = await Product.findById(res.body.product.id).lean();
    expect(String(stored.exporterOrgId)).toBe(String(attackerOrg._id));
    expect(await Product.countDocuments({ exporterOrgId: victimOrg._id })).toBe(1);
  });

  it("a buyer cannot save on another buyer's behalf, nor unsave their row", async () => {
    const b1 = await makeUser('buyer', { buyerSide: true });
    const b2 = await makeUser('buyer', { buyerSide: true });

    const saved = await request(app)
      .post('/saved')
      .set(bearer(b1.token))
      .send({ targetType: 'product', targetId: String(victimProduct._id), buyerOrgId: String(b2.org._id) });
    expect(saved.status).toBe(201);

    // The row belongs to the CALLER, never to the injected org.
    const row = await SavedItem.findById(saved.body.saved.id);
    expect(String(row.buyerOrgId)).toBe(String(b1.org._id));

    // …and b2 cannot delete it.
    expect((await request(app).delete(`/saved/${row._id}`).set(bearer(b2.token))).status).toBe(404);
  });
});

describe('ATTACK · token forgery and confusion', () => {
  it('a login-pending token cannot be used as an access token', async () => {
    const pending = jwt.sign(
      { sub: String(victim.user._id), typ: 'login_pending', method: 'otp' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' },
    );
    expect((await request(app).get('/auth/me').set(bearer(pending))).status).toBe(401);
  });

  it('an alg=none token is rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: String(victim.user._id), tv: 0, typ: 'access' }),
    ).toString('base64url');
    expect((await request(app).get('/auth/me').set(bearer(`${header}.${payload}.`))).status).toBe(401);
  });

  it('a token signed with the REFRESH secret is not an access token', async () => {
    const forged = jwt.sign(
      { sub: String(victim.user._id), tv: 0, typ: 'access' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '15m' },
    );
    expect((await request(app).get('/auth/me').set(bearer(forged))).status).toBe(401);
  });

  it('a stale tokenVersion is refused after a password change', async () => {
    const stale = signAccessToken(victim.user);
    expect((await request(app).get('/auth/me').set(bearer(stale))).status).toBe(200);

    await User.updateOne({ _id: victim.user._id }, { $inc: { tokenVersion: 1 } });
    expect((await request(app).get('/auth/me').set(bearer(stale))).status).toBe(401);
  });

  it('a valid signature over a non-existent user is refused', async () => {
    const ghost = jwt.sign(
      { sub: String(new mongoose.Types.ObjectId()), tv: 0, typ: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );
    expect((await request(app).get('/auth/me').set(bearer(ghost))).status).toBe(401);
  });

  it('an expired token is refused', async () => {
    const expired = jwt.sign(
      { sub: String(victim.user._id), tv: 0, typ: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -10 },
    );
    expect((await request(app).get('/auth/me').set(bearer(expired))).status).toBe(401);
  });
});

describe('ATTACK · privilege escalation', () => {
  it('a self-declared role in the signup body does not grant it', async () => {
    seq += 1;
    const email = `sneaky_${Date.now()}@example.com`;
    const base = {
      name: 'Sneaky',
      email,
      mobile: { countryCode: '+91', number: `72${1000000 + seq}` },
      password: 'longpassword1',
    };

    // A21 made `role` a real signup field — so it is now constrained to the two
    // party roles at the boundary. Claiming a staff role fails CLOSED at
    // validation rather than being silently downgraded.
    const escalate = await request(app)
      .post('/auth/signup/start')
      .send({ ...base, role: 'superadmin' });
    expect(escalate.status).toBe(400);
    expect(await User.countDocuments({ email })).toBe(0);

    // And a permissions array in the body is still stripped, not honoured.
    const res = await signupThroughOtp(app, otpBox, {
      ...base,
      role: 'buyer',
      company: 'Sneaky Co',
      country: 'AU',
      permissions: ['user:read', 'category:manage'],
    });
    expect(res.status).toBe(201);

    const created = await User.findOne({ email: res.body.user.email });
    expect(created.role).toBe('buyer');
    expect(created.permissions).toEqual([]);
  });

  it('an exporter cannot reach any staff surface', async () => {
    const t = bearer(attacker.token);
    for (const path of ['/admin/users', '/admin/products', '/admin/categories']) {
      const res = await request(app).get(path).set(t);
      expect([403, 404]).toContain(res.status);
    }
    expect(
      (await request(app).post('/admin/employees').set(t).send({
        name: 'X', email: 'x@example.com', mobile: { countryCode: '+91', number: '9990000001' },
        password: 'longpassword1',
      })).status,
    ).toBe(403);
  });

  it('an employee cannot grant themselves permissions', async () => {
    const emp = await makeUser('employee', { type: 'platform' });
    const res = await request(app)
      .patch(`/admin/employees/${emp.user._id}/permissions`)
      .set(bearer(emp.token))
      .send({ permissions: ['user:read', 'kyc:view', 'product:takedown'] });
    expect(res.status).toBe(403);
    expect((await User.findById(emp.user._id)).permissions).toEqual([]);
  });

  it('an employee with one permission cannot use another', async () => {
    const emp = await makeUser('employee', { type: 'platform' });
    await User.updateOne({ _id: emp.user._id }, { $set: { permissions: ['product:read'] } });

    expect((await request(app).get('/admin/products').set(bearer(emp.token))).status).toBe(200);
    expect(
      (await request(app).post(`/admin/products/${victimProduct._id}/takedown`)
        .set(bearer(emp.token)).send({ reason: 'no permission for this' })).status,
    ).toBe(403);
  });
});

describe('ATTACK · injection and pollution', () => {
  it('prototype-pollution keys are rejected everywhere they can be sent', async () => {
    const payloads = [
      { __proto__: { isAdmin: true } },
      { constructor: { prototype: { isAdmin: true } } },
      { prototype: 'x' },
    ];
    for (const body of payloads) {
      const res = await request(app).post('/saved').set(bearer(attacker.token)).send(body);
      expect([400, 403]).toContain(res.status);
    }
    expect({}.isAdmin).toBeUndefined();
  });

  it('an operator object as a password does not authenticate anyone', async () => {
    const res = await request(app).post('/auth/login').send({
      identifier: victim.user.email, password: { $ne: null }, portal: 'exporter',
    });
    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('an attribute value cannot be an object — it reaches an indexed, queried path', async () => {
    const res = await request(app).post('/products').set(bearer(attacker.token)).send({
      name: 'Objecty', categoryId: String(leaf._id),
      attributes: [{ key: 'gsm', value: { $gt: 0 } }],
    });
    expect(res.status).toBe(400);
  });

  it('duplicated query parameters cannot smuggle an array past validation', async () => {
    const res = await request(app).get('/public/search?page=1&page=99999&pageSize=20');
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) expect(Array.isArray(res.body.products)).toBe(true);
  });
});

describe('ATTACK · data exposure across every public surface', () => {
  it('no public response ever carries an internal or private field', async () => {
    await Product.updateOne({ _id: victimProduct._id }, {
      $set: { takedown: { isDown: false }, searchKeywords: 'internal corpus text' },
    });
    await Organisation.updateOne({ _id: victimOrg._id }, {
      $set: { website: 'https://private.example', kycRejectionReason: 'blurry docs' },
    });

    const responses = await Promise.all([
      request(app).get('/public/search').query({ q: 'cotton' }),
      request(app).get('/public/products'),
      request(app).get(`/public/products/${victimProduct._id}`),
      request(app).get(`/exporters/${victimOrg._id}`),
      request(app).get('/public/facets').query({ q: 'cotton' }),
    ]);

    const FORBIDDEN = [
      'kycStatus', 'kycDocuments', 'kycRejectionReason', 'website', 'passwordHash',
      'searchKeywords', 'sellerVerified', 'sellerCountry', 'takedown', 'exporterOrgId',
      'twoFactorSecret', 'tokenVersion', 'blockedBy', 'prevActive',
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      const blob = JSON.stringify(res.body);
      for (const field of FORBIDDEN) expect(blob).not.toContain(field);
    }
  });

  it('a seller sees their own takedown reason but never the admin who did it (§A9)', async () => {
    const sa = await makeUser('superadmin', { type: 'platform' });
    const own = await Product.create({
      exporterOrgId: attackerOrg._id, categoryId: leaf._id, name: 'Mine', status: 'active',
    });
    await request(app).post(`/admin/products/${own._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });

    // There is no single-product seller read — the seller's own view is the
    // `/products/mine` list, so §A9 is verified where it actually renders.
    const res = await request(app).get('/products/mine').set(bearer(attacker.token));
    expect(res.status).toBe(200);
    const row = res.body.products.find((p) => p.id === String(own._id));
    expect(row.takedown.reason).toBe('counterfeit listing');
    expect(row.takedown.at).toBeTruthy();

    const blob = JSON.stringify(res.body);
    expect(blob).not.toContain('byUserId');
    expect(blob).not.toContain(String(sa.user._id)); // the acting admin is invisible
  });

  it('auth responses never carry a hash, a 2FA secret or a token version', async () => {
    const res = await request(app).get('/auth/me').set(bearer(attacker.token));
    const blob = JSON.stringify(res.body);
    for (const field of ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes', 'tokenVersion']) {
      expect(blob).not.toContain(field);
    }
  });
});

describe('ATTACK · error handling never leaks internals', () => {
  it('a malformed id and an unknown route both return a clean shape', async () => {
    for (const res of [
      await request(app).get('/public/products/not-a-real-id'),
      await request(app).get('/no/such/route'),
      await request(app).get(`/products/${new mongoose.Types.ObjectId()}`).set(bearer(attacker.token)),
    ]) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      const blob = JSON.stringify(res.body);
      for (const leak of ['stack', 'MongoServerError', 'mongodb://', 'CastError', 'at Object.']) {
        expect(blob).not.toContain(leak);
      }
      expect(res.body.error).toHaveProperty('requestId');
    }
  });
});
