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
 * Seller product-list search (2026-09-24): `q` narrows the rows by name,
 * inside the seller's own scope; the counts describe the whole catalogue.
 */
const mine = (token, query) => request(app).get('/products/mine').query(query).set(bearer(token));

describe('GET /products/mine?q=', () => {
  it('finds the seller\'s own products by name, case-insensitive', async () => {
    const ex = await makeExporter();
    for (const name of ['Cotton Fabric Roll', 'Silk Scarf', 'Organic cotton towel']) {
      await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id, { name }));
    }
    const res = await mine(ex.token, { q: 'COTTON' });
    expect(res.status).toBe(200);
    expect(res.body.products.map((p) => p.name).sort()).toEqual(['Cotton Fabric Roll', 'Organic cotton towel']);
    expect(res.body.total).toBe(2);
    // The counts describe the catalogue, not the search.
    expect(res.body.counts.all).toBe(3);
  });

  it('never returns another seller\'s products', async () => {
    const a = await makeExporter();
    const b = await makeExporter();
    await request(app).post('/products').set(bearer(b.token)).send(validBody(b.org._id, { name: 'Cotton Other Seller' }));
    const res = await mine(a.token, { q: 'cotton' });
    expect(res.body.products).toHaveLength(0);
  });

  it('treats regex characters as plain text', async () => {
    const ex = await makeExporter();
    await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id, { name: 'Roll (A+) grade' }));
    const hit = await mine(ex.token, { q: '(A+)' });
    expect(hit.status).toBe(200);
    expect(hit.body.products).toHaveLength(1);
    const wild = await mine(ex.token, { q: '.*' });
    expect(wild.body.products).toHaveLength(0);
  });
});
