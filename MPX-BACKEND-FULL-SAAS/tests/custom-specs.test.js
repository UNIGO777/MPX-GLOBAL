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
 * Seller-written specifications ("customSpecs") — client change request,
 * owner-approved 2026-09-23, reversing §A17's "no free-form specs".
 *
 * Display-only by design: kept apart from the admin-defined `attributes`,
 * never searched or filtered. They DO reach the public product page, so the
 * guards that matter are the ones at the boundary: capped, unique, no repeat
 * of the category's own fields, and no contact details.
 */
const withSpecs = (orgId, customSpecs) => validBody(orgId, { customSpecs });

describe('customSpecs · seller-written specifications', () => {
  it('saves them and returns them to the seller', async () => {
    const ex = await makeExporter();
    const specs = [
      { label: 'Weave', value: 'Plain' },
      { label: 'Shrinkage', value: 'Under 3%' },
    ];
    const res = await request(app).post('/products').set(bearer(ex.token)).send(withSpecs(ex.org._id, specs));
    expect(res.status).toBe(201);
    expect(res.body.product.customSpecs).toEqual(specs);
  });

  it('an edit replaces the set, and an empty array clears it', async () => {
    const ex = await makeExporter();
    const created = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(withSpecs(ex.org._id, [{ label: 'Weave', value: 'Plain' }]));
    const id = created.body.product.id;

    const edited = await request(app)
      .patch(`/products/${id}`)
      .set(bearer(ex.token))
      .send({ customSpecs: [{ label: 'Finish', value: 'Mercerised' }] });
    expect(edited.status).toBe(200);
    expect(edited.body.product.customSpecs).toEqual([{ label: 'Finish', value: 'Mercerised' }]);

    const cleared = await request(app).patch(`/products/${id}`).set(bearer(ex.token)).send({ customSpecs: [] });
    expect(cleared.body.product.customSpecs).toEqual([]);
  });

  it('refuses more than 10, blank or over-long rows, and a label listed twice', async () => {
    const ex = await makeExporter();
    const eleven = Array.from({ length: 11 }, (_, i) => ({ label: `Field ${i}`, value: 'x' }));
    const post = (specs) => request(app).post('/products').set(bearer(ex.token)).send(withSpecs(ex.org._id, specs));

    expect((await post(eleven)).status).toBe(400);
    expect((await post([{ label: '', value: 'x' }])).status).toBe(400);
    expect((await post([{ label: 'x'.repeat(41), value: 'x' }])).status).toBe(400);
    expect((await post([{ label: 'Weave', value: 'x'.repeat(201) }])).status).toBe(400);
    expect(
      (await post([
        { label: 'Weave', value: 'Plain' },
        { label: 'weave', value: 'Twill' },
      ])).status,
    ).toBe(400);
  });

  it('refuses a label that repeats one of the category\'s own fields', async () => {
    const ex = await makeExporter();
    const res = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(withSpecs(ex.org._id, [{ label: 'gsm', value: '200' }]));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/already a specification/i);
  });

  it('🔴 refuses contact details — they would route buyers around the platform', async () => {
    const ex = await makeExporter();
    const post = (value) =>
      request(app).post('/products').set(bearer(ex.token)).send(withSpecs(ex.org._id, [{ label: 'Contact', value }]));

    for (const value of ['sales@acme.com', 'www.acme.com', 'acme.in', 'https://acme.example', '+91 98765 43210', '9876543210']) {
      expect((await post(value)).status, value).toBe(400);
    }
    // Ordinary spec values that merely contain numbers still pass.
    for (const value of ['ISO 9001', '2024-2025', 'Capacity 5000000 units']) {
      expect((await post(value)).status, value).toBe(201);
    }
  });

  it('appear on the PUBLIC product page as {label, value} only — and never become filters', async () => {
    const ex = await makeExporter({ verified: true });
    const created = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(withSpecs(ex.org._id, [{ label: 'Weave', value: 'Plain' }]));
    const id = created.body.product.id;
    await request(app).patch(`/products/${id}/status`).set(bearer(ex.token)).send({ status: 'active' });

    const pub = await request(app).get(`/public/products/${created.body.product.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.product.customSpecs).toEqual([{ label: 'Weave', value: 'Plain' }]);

    const stored = await Product.findById(id).lean();
    expect(stored.attributes.map((a) => a.key)).not.toContain('weave');
  });
});
