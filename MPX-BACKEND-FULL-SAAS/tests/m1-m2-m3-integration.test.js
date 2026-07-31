import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import Redis from 'ioredis';

// End-to-end journeys that cross ALL THREE modules over real HTTP: M1 identity,
// M2 catalogue, M3 discovery. No service shortcuts where a real endpoint exists.

const { otpBox } = vi.hoisted(() => ({ otpBox: { byId: new Map() } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async ({ identifier, code }) => {
    otpBox.byId.set(identifier, code);
  },
}));
vi.mock('../src/services/image.storage.service.js', () => ({
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(async ({ folder }) => ({
    url: `https://res.cloudinary.com/fake/${folder}/p.jpg`,
    publicId: `${folder}/p_${Math.random().toString(16).slice(2, 8)}`,
  })),
  deletePublicImage: vi.fn(async () => {}),
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
const { invalidateDidYouMeanCache } = await import('../src/services/didYouMean.service.js');
const { invalidateSitemapCache } = await import('../src/services/seo.service.js');
const { purgeBlockedProducts } = await import('../src/jobs/purgeBlockedProducts.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;
// These journeys perform many REAL signups from one IP, so the auth limiter
// (10 / 15 min) would fire mid-suite. Flushing between cases resets it —
// the same pattern M1's auth tests use. The limiter itself is proven in
// auth.test.js; here it must not mask the behaviour under test.
let redis;

let top;
let leaf;

async function seedTree() {
  top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({
    name: 'Cotton fabric',
    parentId: top._id,
    type: 'goods',
    synonyms: ['kapda'],
  });
  await CategoryAttribute.create({
    categoryId: leaf._id,
    name: 'GSM',
    key: 'gsm',
    inputType: 'number',
    filterable: true,
  });
}

// Real M1 signup + OTP exchange — no token shortcuts.
async function signupAndLogin(role, extra = {}) {
  seq += 1;
  const number = `9${(700000000 + seq).toString()}`;
  const body = {
    name: `${role} User`,
    email: `int_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number },
    password: 'longpassword1',
    company: extra.company ?? `${role} Company ${seq}`,
    country: 'IN',
    ...(role === 'exporter' ? { entityType: 'business' } : {}),
  };
  const signup = await request(app).post(`/auth/${role}/signup`).send(body);
  expect(signup.status).toBe(201);

  const code = otpBox.byId.get(`+91${number}`);
  const verify = await request(app).post('/auth/verify-otp').send({ loginToken: signup.body.loginToken, code });
  expect(verify.status).toBe(200);
  return { token: verify.body.accessToken, user: verify.body.user, orgId: verify.body.user.orgId };
}

async function makeStaff(role, permissions = []) {
  seq += 1;
  const org = await Organisation.create({ name: `Platform ${seq}`, type: 'platform' });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `stf_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `76${1000000 + seq}`, e164: `+9176${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return signAccessToken(user);
}

async function publishProduct(token, orgId, name = 'Cotton Fabric Roll') {
  const created = await request(app)
    .post('/products')
    .set(bearer(token))
    .send({
      name,
      categoryId: String(leaf._id),
      price: { mode: 'fixed', min: 250, currency: 'INR' },
      attributes: [{ key: 'gsm', value: 140 }],
      moq: 100,
      unit: 'meter',
    });
  expect(created.status).toBe(201);
  const published = await request(app)
    .patch(`/products/${created.body.product.id}/status`)
    .set(bearer(token))
    .send({ status: 'active' });
  expect(published.status).toBe(200);
  return created.body.product.id;
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
    Category.deleteMany({}),
    CategoryAttribute.deleteMany({}),
    Product.deleteMany({}),
    SavedItem.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  await redis.flushdb();
  otpBox.byId.clear();
  invalidateLeafCache();
  invalidateDidYouMeanCache();
  invalidateSitemapCache();
  await seedTree();
});

describe('the whole platform, one journey (M1 → M2 → M3)', () => {
  it('seller signs up, lists, publishes; buyer signs up, searches, saves; verification lights the tick everywhere', async () => {
    // --- M1: both sides sign up for real -----------------------------------
    const seller = await signupAndLogin('exporter', { company: 'TextileHub Exports' });
    const buyer = await signupAndLogin('buyer');

    // --- M2: list + publish -------------------------------------------------
    const productId = await publishProduct(seller.token, seller.orgId);

    // --- M3: discoverable by keyword, synonym, category, facet, sitemap -----
    const byName = await request(app).get('/public/search').query({ q: 'cotton' });
    expect(byName.body.total).toBe(1);
    expect((await request(app).get('/public/search').query({ q: 'kapda' })).body.total).toBe(1);
    expect((await request(app).get('/public/search').query({ q: 'TextileHub' })).body.total).toBe(1);
    expect((await request(app).get('/public/search').query({ category: 'textiles' })).body.total).toBe(1);

    const facets = await request(app).get('/public/facets').query({ category: 'cotton-fabric' });
    expect(facets.body.facets.attributes.find((a) => a.key === 'gsm').bounds).toEqual({ min: 140, max: 140 });

    invalidateSitemapCache();
    expect((await request(app).get('/sitemap.xml')).text).toContain('/product/cotton-fabric-roll');

    // seller is unverified for now — present, but no tick
    expect(byName.body.products[0].seller.verified).toBe(false);
    expect((await request(app).get('/public/search').query({ verifiedOnly: 'true' })).body.total).toBe(0);

    // --- M3: buyer saves both the product and the supplier ------------------
    const savedProduct = await request(app)
      .post('/saved')
      .set(bearer(buyer.token))
      .send({ targetType: 'product', targetId: productId });
    expect(savedProduct.status).toBe(201);
    await request(app)
      .post('/saved')
      .set(bearer(buyer.token))
      .send({ targetType: 'supplier', targetId: seller.orgId });

    const savedList = await request(app).get('/saved').set(bearer(buyer.token));
    expect(savedList.body.total).toBe(2);
    expect(savedList.body.items.every((i) => i.available)).toBe(true);

    // --- M1: employee verifies the seller → M3 tick flips instantly ---------
    await Organisation.updateOne({ _id: seller.orgId }, { $set: { kycStatus: 'submitted' } });
    const reviewer = await makeStaff('employee', ['exporter:verify']);
    expect((await request(app).post(`/employee/exporters/${seller.orgId}/verify`).set(bearer(reviewer))).status).toBe(200);

    const afterVerify = await request(app).get('/public/search').query({ q: 'cotton' });
    expect(afterVerify.body.products[0].seller.verified).toBe(true);
    expect((await request(app).get('/public/search').query({ verifiedOnly: 'true' })).body.total).toBe(1);
    expect((await request(app).get(`/exporters/${seller.orgId}`)).body.exporter.productCount).toBe(1);

    // raw status never surfaces anywhere in that journey
    expect(JSON.stringify(afterVerify.body)).not.toContain('kycStatus');
  });
});

describe('admin actions ripple correctly into discovery', () => {
  it('takedown hides it from search AND flags the buyer\'s saved copy — restore reverses both', async () => {
    const seller = await signupAndLogin('exporter');
    const buyer = await signupAndLogin('buyer');
    const productId = await publishProduct(seller.token, seller.orgId);
    await request(app).post('/saved').set(bearer(buyer.token)).send({ targetType: 'product', targetId: productId });

    const sa = await makeStaff('superadmin');
    await request(app)
      .post(`/admin/products/${productId}/takedown`)
      .set(bearer(sa))
      .send({ reason: 'counterfeit listing' });

    expect((await request(app).get('/public/search')).body.total).toBe(0);
    let saved = await request(app).get('/saved').set(bearer(buyer.token));
    expect(saved.body.items).toHaveLength(1); // STAYS — temporary, not permanent
    expect(saved.body.items[0].available).toBe(false);

    await request(app).post(`/admin/products/${productId}/restore`).set(bearer(sa));
    expect((await request(app).get('/public/search')).body.total).toBe(1);
    saved = await request(app).get('/saved').set(bearer(buyer.token));
    expect(saved.body.items[0].available).toBe(true);
  });

  it('a category rename keeps everything findable under the NEW name (§A26 sync)', async () => {
    const seller = await signupAndLogin('exporter');
    await publishProduct(seller.token, seller.orgId);

    const manager = await makeStaff('employee', ['category:manage']);
    await request(app)
      .patch(`/admin/categories/${leaf._id}`)
      .set(bearer(manager))
      .send({ name: 'Woven textiles', synonyms: ['bunai'] });

    expect((await request(app).get('/public/search').query({ q: 'woven' })).body.total).toBe(1);
    expect((await request(app).get('/public/search').query({ q: 'bunai' })).body.total).toBe(1);
    expect((await request(app).get('/public/search').query({ q: 'kapda' })).body.total).toBe(0); // old synonym gone
  });

  it('F1-A org block: profile 404s and sessions die, but products stay searchable (the known F1-B gap)', async () => {
    const seller = await signupAndLogin('exporter');
    await publishProduct(seller.token, seller.orgId);

    const sa = await makeStaff('superadmin');
    expect(
      (await request(app).post(`/admin/orgs/${seller.orgId}/block`).set(bearer(sa)).send({ reason: 'fraud review' }))
        .status,
    ).toBe(200);

    expect((await request(app).get('/products/mine').set(bearer(seller.token))).status).toBe(401); // session dead
    expect((await request(app).get(`/exporters/${seller.orgId}`)).status).toBe(404); // profile hidden
    // Documented, accepted until F1-B lands — pinned so its closure is deliberate:
    expect((await request(app).get('/public/search')).body.total).toBe(1);
    // …though the seller no longer appears in the SUPPLIERS results (isActive filter)
    expect((await request(app).get('/public/search').query({ type: 'supplier' })).body.total).toBe(0);
  });
});

describe('lifecycle end-states clean up across modules', () => {
  it('seller delete (archive) removes it from search, sitemap AND every saved list', async () => {
    const seller = await signupAndLogin('exporter');
    const buyer = await signupAndLogin('buyer');
    const productId = await publishProduct(seller.token, seller.orgId);
    await request(app).post('/saved').set(bearer(buyer.token)).send({ targetType: 'product', targetId: productId });

    expect((await request(app).delete(`/products/${productId}`).set(bearer(seller.token))).status).toBe(200);

    expect((await request(app).get('/public/search')).body.total).toBe(0);
    expect((await request(app).get('/saved').set(bearer(buyer.token))).body.items).toEqual([]);
    invalidateSitemapCache();
    expect((await request(app).get('/sitemap.xml')).text).not.toContain('cotton-fabric-roll');
    expect(await SavedItem.countDocuments({})).toBe(0);
  });

  it('the A8 purge removes a long-blocked product from the DB and from saved lists', async () => {
    const seller = await signupAndLogin('exporter');
    const buyer = await signupAndLogin('buyer');
    const productId = await publishProduct(seller.token, seller.orgId);
    await request(app).post('/saved').set(bearer(buyer.token)).send({ targetType: 'product', targetId: productId });

    const sa = await makeStaff('superadmin');
    await request(app).post(`/admin/products/${productId}/takedown`).set(bearer(sa)).send({ reason: 'illegal goods' });
    await Product.updateOne({ _id: productId }, { $set: { 'takedown.at': new Date('2026-01-01') } });

    const { purged } = await purgeBlockedProducts({ now: new Date('2026-07-31') });
    expect(purged).toBe(1);
    expect(await Product.findById(productId)).toBeNull();
    expect(await SavedItem.countDocuments({})).toBe(0);
    expect((await request(app).get('/saved').set(bearer(buyer.token))).body.items).toEqual([]);
  });

  it('D1 cap and discovery agree: only the 3 live listings of an unverified seller are searchable', async () => {
    const seller = await signupAndLogin('exporter');
    for (let i = 0; i < 3; i += 1) await publishProduct(seller.token, seller.orgId, `Cotton Item ${i}`);

    // the 4th publish is blocked by the cap…
    const extra = await request(app)
      .post('/products')
      .set(bearer(seller.token))
      .send({
        name: 'Cotton Item 4',
        categoryId: String(leaf._id),
        price: { mode: 'on_request' },
        attributes: [{ key: 'gsm', value: 100 }],
      });
    const blocked = await request(app)
      .patch(`/products/${extra.body.product.id}/status`)
      .set(bearer(seller.token))
      .send({ status: 'active' });
    expect(blocked.status).toBe(409);

    // …and discovery shows exactly the three that are live.
    expect((await request(app).get('/public/search').query({ q: 'cotton' })).body.total).toBe(3);
    expect((await request(app).get(`/exporters/${seller.orgId}`)).body.exporter.productCount).toBe(3);
  });
});

describe('cross-account isolation across all three modules', () => {
  it('two sellers and two buyers never see or touch each other\'s data', async () => {
    const sellerA = await signupAndLogin('exporter', { company: 'Alpha Exports' });
    const sellerB = await signupAndLogin('exporter', { company: 'Beta Exports' });
    const buyerA = await signupAndLogin('buyer');
    const buyerB = await signupAndLogin('buyer');

    const productA = await publishProduct(sellerA.token, sellerA.orgId, 'Alpha Cotton');
    await publishProduct(sellerB.token, sellerB.orgId, 'Beta Cotton');

    // M2: seller B cannot touch seller A's product
    expect((await request(app).patch(`/products/${productA}`).set(bearer(sellerB.token)).send({ name: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/products/${productA}`).set(bearer(sellerB.token))).status).toBe(404);

    // M2: /products/mine is strictly own
    const mineB = await request(app).get('/products/mine').set(bearer(sellerB.token));
    expect(mineB.body.products).toHaveLength(1);
    expect(mineB.body.products[0].name).toBe('Beta Cotton');

    // M3: buyer B cannot unsave buyer A's row
    const saved = await request(app)
      .post('/saved')
      .set(bearer(buyerA.token))
      .send({ targetType: 'product', targetId: productA });
    expect((await request(app).delete(`/saved/${saved.body.saved.id}`).set(bearer(buyerB.token))).status).toBe(404);
    expect((await request(app).get('/saved').set(bearer(buyerB.token))).body.total).toBe(0);

    // M3: public search shows both sellers' products (that IS the marketplace)
    expect((await request(app).get('/public/search').query({ q: 'cotton' })).body.total).toBe(2);

    // M3: the seller filter scopes to one company
    const onlyAlpha = await request(app).get('/public/search').query({ seller: sellerA.orgId });
    expect(onlyAlpha.body.total).toBe(1);
    expect(onlyAlpha.body.products[0].name).toBe('Alpha Cotton');
  });
});
