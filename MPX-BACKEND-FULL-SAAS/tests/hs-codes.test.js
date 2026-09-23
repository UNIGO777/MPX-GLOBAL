import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../src/services/image.storage.service.js', async (importOriginal) => ({
  // Keep the REAL isOwnCloudinaryUrl — it is a pure check with no network,
  // and mocking it away would hide the ref-forgery guard it exists to enforce.
  ...(await importOriginal()),
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(async ({ folder }) => ({
    url: `https://res.cloudinary.com/fake/${folder}/p.jpg`,
    publicId: `${folder}/p_${Math.random().toString(16).slice(2, 8)}`,
  })),
  deletePublicImage: vi.fn(),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { CategoryAttribute } = await import('../src/models/CategoryAttribute.js');
const { Product } = await import('../src/models/Product.js');
await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');

const app = createApp();
let seq = 0;

async function makeExporter({ verified = false } = {}) {
  seq += 1;
  const org = await Organisation.create({
    name: `Exporter Co ${seq}`,
    type: 'business',
    exporterSide: true,
    country: 'IN',
    kycStatus: verified ? 'verified' : 'pending',
  });
  const user = await User.create({
    name: `exporter-${seq}`,
    email: `exp_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `96${1000000 + seq}`, e164: `+9196${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'exporter',
    orgId: org._id,
  });
  return { org, user, token: signAccessToken(user) };
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

let goodsLeaf;
let topCat;

async function makeTree() {
  topCat = await Category.create({ name: 'Textiles', slug: 'textiles' });
  goodsLeaf = await Category.create({ name: 'Cotton fabric', parentId: topCat._id, type: 'goods' });
  await CategoryAttribute.create({
    categoryId: goodsLeaf._id,
    name: 'GSM',
    key: 'gsm',
    inputType: 'number',
    required: true,
    filterable: true,
  });
  await CategoryAttribute.create({
    categoryId: goodsLeaf._id,
    name: 'Material',
    key: 'material',
    inputType: 'select',
    options: ['Cotton', 'Silk'],
  });
}

// A ref must look like one the upload endpoint actually issued: our Cloudinary
// host, and the URL embedding the publicId. The service re-verifies both, so a
// fabricated pair (any URL + a plausible publicId) is rejected.
const imgRef = (orgId, n = 1) => {
  const publicId = `mpx/products/${orgId}/p_${n}`;
  return { url: `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.jpg`, publicId };
};

const validBody = (orgId, extra = {}) => ({
  name: 'Cotton Fabric Roll',
  categoryId: String(goodsLeaf._id),
  price: { mode: 'fixed', min: 120, currency: 'INR' },
  attributes: [{ key: 'gsm', value: 140 }],
  images: [imgRef(orgId)],
  moq: 500,
  unit: 'meter',
  ...extra,
});

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
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  await makeTree();
});


/**
 * HS code picker (owner, 2026-09-24): search over the HS 2022 reference list,
 * exporter-only; the product field accepts a listed OR typed code, normalised
 * to 6–8 digits.
 */
const search = (token, q, limit) =>
  request(app)
    .get('/products/hs-codes')
    .query({ q, ...(limit ? { limit } : {}) })
    .set(token ? bearer(token) : {});

async function makeBuyer() {
  seq += 1;
  const org = await Organisation.create({ name: `Buyer Co ${seq}`, type: 'business', buyerSide: true, country: 'AU' });
  const user = await User.create({
    name: `buyer-${seq}`,
    email: `buy_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `97${1000000 + seq}`, e164: `+9197${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'buyer',
    orgId: org._id,
  });
  return { token: signAccessToken(user) };
}

describe('HS code search', () => {
  it('finds by code prefix, ignoring typed separators', async () => {
    const ex = await makeExporter();
    const byPrefix = await search(ex.token, '5208');
    expect(byPrefix.status).toBe(200);
    expect(byPrefix.body.results.length).toBeGreaterThan(3);
    expect(byPrefix.body.results.every((r) => r.code.startsWith('5208'))).toBe(true);

    const dotted = await search(ex.token, '5208.11');
    expect(dotted.body.results[0]).toMatchObject({ code: '520811' });
    expect(dotted.body.results[0].description).toMatch(/cotton/i);
  });

  it('finds by words — every word must match — and honours the limit', async () => {
    const ex = await makeExporter();
    const res = await search(ex.token, 'cotton woven', 5);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(5);
    for (const r of res.body.results) expect(r.code).toMatch(/^\d{6}$/);
  });

  it('is exporter-only: 401 without a session, 403 for a buyer', async () => {
    const buyer = await makeBuyer();
    expect((await search(null, 'cotton')).status).toBe(401);
    expect((await search(buyer.token, 'cotton')).status).toBe(403);
  });

  it('refuses a missing or oversized query', async () => {
    const ex = await makeExporter();
    expect((await search(ex.token, '')).status).toBe(400);
    expect((await search(ex.token, 'x'.repeat(61))).status).toBe(400);
    expect((await search(ex.token, 'cotton', 26)).status).toBe(400);
  });
});

describe('HS code on a product', () => {
  it('stores a listed code normalised ("5208.11" → "520811")', async () => {
    const ex = await makeExporter();
    const res = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id, { hsCode: '5208.11' }));
    expect(res.status).toBe(201);
    expect((await Product.findById(res.body.product.id).lean()).hsCode).toBe('520811');
  });

  it('accepts a typed 8-digit national code, and an update round-trips', async () => {
    const ex = await makeExporter();
    const created = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id, { hsCode: '52081190' }));
    expect(created.status).toBe(201);
    const id = created.body.product.id;
    const updated = await request(app).patch(`/products/${id}`).set(bearer(ex.token)).send({ hsCode: '5209 11' });
    expect(updated.status).toBe(200);
    expect((await Product.findById(id).lean()).hsCode).toBe('520911');
  });

  it.each([['letters', 'ABC123'], ['5 digits', '52081'], ['9 digits', '520811901']])(
    'refuses %s',
    async (_label, hsCode) => {
      const ex = await makeExporter();
      const res = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id, { hsCode }));
      expect(res.status).toBe(400);
      expect(await Product.countDocuments({})).toBe(0);
    },
  );
});
