import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Adversarial / boundary cases for M3 that the per-phase suites do not cover:
// injection shapes, unicode, empty worlds, pagination edges, cross-module
// interference, and the security invariants that must hold on EVERY surface.

vi.mock('../src/services/image.storage.service.js', () => ({
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(),
  deletePublicImage: vi.fn(async () => {}),
}));
const { aiBox } = vi.hoisted(() => ({ aiBox: { reply: null, error: null } }));
vi.mock('../src/services/ai.client.js', () => ({
  isAiConfigured: () => true,
  completeJson: vi.fn(async () => {
    if (aiBox.error) throw aiBox.error;
    return aiBox.reply;
  }),
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
const { rebuildAll } = await import('../src/services/searchSync.service.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let top;
let leaf;
let org;

async function seedWorld() {
  top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods', synonyms: ['kapda'] });
  await CategoryAttribute.create({
    categoryId: leaf._id,
    name: 'GSM',
    key: 'gsm',
    inputType: 'number',
    filterable: true,
  });
  org = await Organisation.create({
    name: 'Seller Co',
    type: 'business',
    exporterSide: true,
    country: 'IN',
    kycStatus: 'verified',
  });
}

async function makeProduct(extra = {}) {
  seq += 1;
  const p = await Product.create({
    exporterOrgId: org._id,
    categoryId: leaf._id,
    name: `Cotton Roll ${seq}`,
    status: 'active',
    sellerCountry: 'IN',
    sellerVerified: true,
    ...extra,
  });
  await rebuildAll();
  return p;
}

async function makeBuyer() {
  seq += 1;
  const bOrg = await Organisation.create({ name: `Buyer ${seq}`, type: 'business', buyerSide: true });
  const user = await User.create({
    name: `buyer-${seq}`,
    email: `edge_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `81${1000000 + seq}`, e164: `+9181${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'buyer',
    orgId: bOrg._id,
  });
  return signAccessToken(user);
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
    Category.deleteMany({}),
    CategoryAttribute.deleteMany({}),
    Product.deleteMany({}),
    SavedItem.deleteMany({}),
  ]);
  invalidateLeafCache();
  invalidateDidYouMeanCache();
  invalidateSitemapCache();
  aiBox.reply = null;
  aiBox.error = null;
  await seedWorld();
});

describe('injection + hostile input on every M3 surface', () => {
  it('rejects Mongo operator payloads in search, facets, AI and saved', async () => {
    const cases = [
      request(app).get('/public/search').query({ q: { $ne: '' } }),
      request(app).get('/public/search').query({ category: { $gt: '' } }),
      request(app).get('/public/facets').query({ country: { $ne: null } }),
      request(app).post('/search/ai').send({ query: { $ne: '' } }),
    ];
    for (const call of cases) {
      const res = await call;
      expect(res.status).toBe(400);
    }
  });

  it('a regex-shaped query is treated as text, never compiled', async () => {
    await makeProduct({ name: 'Cotton Roll' });
    const res = await request(app).get('/public/search').query({ q: '.*' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0); // matched literally, so nothing
  });

  it('handles unicode, emoji and very long queries without erroring', async () => {
    await makeProduct();
    for (const q of ['कपड़ा', '🧵🧵', 'a'.repeat(200)]) {
      const res = await request(app).get('/public/search').query({ q });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.products)).toBe(true);
    }
    expect((await request(app).get('/public/search').query({ q: 'a'.repeat(500) })).status).toBe(400);
  });

  it('bad ids and unknown slugs are clean 4xx, never 500', async () => {
    expect((await request(app).get('/public/search').query({ category: 'no-such-cat' })).body.total).toBe(0);
    expect((await request(app).get('/public/search').query({ seller: 'no-such-seller' })).body.total).toBe(0);
    expect((await request(app).get('/public/products/not-a-real-slug')).status).toBe(404);
    expect((await request(app).get('/exporters/not-a-real-slug')).status).toBe(404);

    const buyer = await makeBuyer();
    const res = await request(app)
      .post('/saved')
      .set(bearer(buyer))
      .send({ targetType: 'product', targetId: 'zzz' });
    expect(res.status).toBe(400);
  });
});

describe('empty-world and boundary behaviour', () => {
  it('every public surface answers sanely with no data at all', async () => {
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Organisation.deleteMany({});
    invalidateLeafCache();
    invalidateDidYouMeanCache();
    invalidateSitemapCache();

    const search = await request(app).get('/public/search').query({ q: 'anything' });
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(0);
    expect(search.body.didYouMean).toBeNull();

    const facets = await request(app).get('/public/facets');
    expect(facets.status).toBe(200);
    expect(facets.body.facets.category).toEqual([]);
    expect(facets.body.facets.price).toBeNull();

    const sitemap = await request(app).get('/sitemap.xml');
    expect(sitemap.status).toBe(200);
    expect(sitemap.text).toContain('<urlset');
  });

  it('paging past the end returns an empty page, not an error', async () => {
    await makeProduct();
    const res = await request(app).get('/public/search').query({ page: 99, pageSize: 10 });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products).toEqual([]);
  });

  it('page/pageSize boundaries are enforced', async () => {
    for (const query of [{ page: 0 }, { page: -1 }, { pageSize: 0 }, { pageSize: 101 }]) {
      expect((await request(app).get('/public/search').query(query)).status).toBe(400);
    }
    expect((await request(app).get('/public/search').query({ pageSize: 100 })).status).toBe(200);
  });

  it('a price range with min > max is rejected', async () => {
    const res = await request(app).get('/public/search').query({ priceMin: 500, priceMax: 100 });
    expect(res.status).toBe(400);
  });
});

describe('M3 respects M2/M1 state transitions live', () => {
  it('publish → searchable, unpublish → gone, takedown → gone, restore → back', async () => {
    seq += 1;
    const seller = await User.create({
      name: 'seller',
      email: `flow_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `80${1000000 + seq}`, e164: `+9180${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'exporter',
      orgId: org._id,
    });
    const sellerToken = signAccessToken(seller);
    const p = await makeProduct({ status: 'draft' });

    const found = () =>
      request(app)
        .get('/public/search')
        .query({ q: 'cotton' })
        .then((r) => r.body.total);

    expect(await found()).toBe(0); // draft
    await request(app).patch(`/products/${p._id}/status`).set(bearer(sellerToken)).send({ status: 'active' });
    expect(await found()).toBe(1);

    await request(app).patch(`/products/${p._id}/status`).set(bearer(sellerToken)).send({ status: 'inactive' });
    expect(await found()).toBe(0);

    await request(app).patch(`/products/${p._id}/status`).set(bearer(sellerToken)).send({ status: 'active' });
    expect(await found()).toBe(1);

    // admin takedown removes it from discovery; restore brings it back
    seq += 1;
    const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
    const sa = await User.create({
      name: 'root',
      email: `roo_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `79${1000000 + seq}`, e164: `+9179${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'superadmin',
      orgId: platform._id,
    });
    await request(app)
      .post(`/admin/products/${p._id}/takedown`)
      .set(bearer(signAccessToken(sa)))
      .send({ reason: 'reported listing' });
    expect(await found()).toBe(0);

    await request(app).post(`/admin/products/${p._id}/restore`).set(bearer(signAccessToken(sa)));
    expect(await found()).toBe(1);
  });

  it('a category toggle immediately hides/【restores】 its products from search and facets', async () => {
    await makeProduct();
    seq += 1;
    const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
    const manager = await User.create({
      name: 'mgr',
      email: `mgr_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `78${1000000 + seq}`, e164: `+9178${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'employee',
      orgId: platform._id,
      permissions: ['category:manage'],
    });
    const token = signAccessToken(manager);

    await request(app).patch(`/admin/categories/${top._id}/toggle`).set(bearer(token));
    expect((await request(app).get('/public/search')).body.total).toBe(0);
    expect((await request(app).get('/public/facets')).body.facets.category).toEqual([]);

    await request(app).patch(`/admin/categories/${top._id}/toggle`).set(bearer(token));
    expect((await request(app).get('/public/search')).body.total).toBe(1);
  });

  it('verifying a seller flips the tick on EVERY M3 surface at once', async () => {
    await Organisation.updateOne({ _id: org._id }, { $set: { kycStatus: 'submitted' } });
    await Product.updateMany({}, { $set: { sellerVerified: false } });
    await makeProduct();

    seq += 1;
    const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
    const reviewer = await User.create({
      name: 'rev',
      email: `rv_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `77${1000000 + seq}`, e164: `+9177${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'employee',
      orgId: platform._id,
      permissions: ['exporter:verify'],
    });
    await request(app).post(`/employee/exporters/${org._id}/verify`).set(bearer(signAccessToken(reviewer)));

    const search = await request(app).get('/public/search');
    expect(search.body.products[0].seller.verified).toBe(true);
    const suppliers = await request(app).get('/public/search').query({ type: 'supplier' });
    expect(suppliers.body.suppliers[0].verified).toBe(true);
    const onlyVerified = await request(app).get('/public/search').query({ verifiedOnly: 'true' });
    expect(onlyVerified.body.total).toBe(1);
  });
});

describe('security invariants hold on EVERY M3 surface', () => {
  it('no surface ever leaks kycStatus, KYC docs, contact, takedown or the denorms', async () => {
    await Organisation.updateOne(
      { _id: org._id },
      { $set: { website: 'https://secret.example', kycRejectionReason: 'blurry', address: { line1: '1 Secret St' } } },
    );
    const p = await makeProduct({ takedown: { isDown: false, reason: 'old reason' } });
    const buyer = await makeBuyer();
    await request(app).post('/saved').set(bearer(buyer)).send({ targetType: 'product', targetId: String(p._id) });
    aiBox.reply = JSON.stringify({ target: 'product', keywords: ['cotton'] });

    const responses = await Promise.all([
      request(app).get('/public/search').query({ q: 'cotton' }),
      request(app).get('/public/search').query({ type: 'supplier' }),
      request(app).get('/public/facets'),
      request(app).get('/public/products'),
      request(app).get(`/public/products/${p._id}`),
      request(app).get(`/exporters/${org._id}`),
      request(app).get('/saved').set(bearer(buyer)),
      request(app).post('/search/ai').send({ query: 'cotton fabric' }),
      request(app).get('/sitemap.xml'),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(200);
      const body = typeof res.text === 'string' ? res.text : JSON.stringify(res.body);
      for (const forbidden of [
        'kycStatus',
        'kycDocuments',
        'kycRejectionReason',
        'storageKey',
        'passwordHash',
        'secret.example',
        '1 Secret St',
        'takedown',
        'searchKeywords',
        'sellerVerified',
        'sellerCountry',
        'topCategoryId',
        'exporterOrgId',
      ]) {
        expect(body).not.toContain(forbidden);
      }
    }
  });

  it('every M3 route declares access control (boot guard) and saved needs auth', async () => {
    // The app booted, which means assertRoutesGuarded passed for the new routes.
    expect((await request(app).get('/saved')).status).toBe(401);
    expect((await request(app).post('/saved').send({ targetType: 'product', targetId: String(org._id) })).status).toBe(401);
    // …while the discovery surfaces are open to guests.
    for (const path of ['/public/search', '/public/facets', '/sitemap.xml', '/robots.txt']) {
      expect((await request(app).get(path)).status).toBe(200);
    }
  });
});
