import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../src/services/image.storage.service.js', async (importOriginal) => ({
  // Keep the REAL isOwnCloudinaryUrl — it is a pure check with no network,
  // and mocking it away would hide the ref-forgery guard it exists to enforce.
  ...(await importOriginal()),
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(),
  deletePublicImage: vi.fn(),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { CategoryAttribute } = await import('../src/models/CategoryAttribute.js');
const { Product } = await import('../src/models/Product.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');
const { rebuildAll, rebuildForOrganisation } = await import('../src/services/searchSync.service.js');
const { buildSearchKeywords } = await import('../src/utils/searchKeywords.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let top;
let leaf;
let sellerOrg;
let sellerToken;

async function setup() {
  top = await Category.create({ name: 'Pharmaceuticals', slug: 'pharmaceuticals' });
  leaf = await Category.create({
    name: 'Pharmaceutical formulations',
    parentId: top._id,
    type: 'goods',
    synonyms: ['medicine', 'medicines', 'dawai'],
  });
  await CategoryAttribute.create({
    categoryId: leaf._id,
    name: 'Form',
    key: 'form',
    inputType: 'select',
    options: ['Tablet', 'Syrup'],
  });

  seq += 1;
  sellerOrg = await Organisation.create({
    name: 'TextileHub Exports',
    type: 'business',
    exporterSide: true,
    country: 'IN',
  });
  const seller = await User.create({
    name: 'seller',
    email: `m3_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `86${1000000 + seq}`, e164: `+9186${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'exporter',
    orgId: sellerOrg._id,
  });
  sellerToken = signAccessToken(seller);
}

async function makeStaff(permissions = []) {
  seq += 1;
  const org = await Organisation.create({ name: 'Platform', type: 'platform' });
  const user = await User.create({
    name: 'staff',
    email: `st_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `85${1000000 + seq}`, e164: `+9185${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'employee',
    orgId: org._id,
    permissions,
  });
  return signAccessToken(user);
}

const productBody = (extra = {}) => ({
  name: 'Paracetamol 500mg',
  categoryId: String(leaf._id),
  price: { mode: 'on_request' },
  attributes: [{ key: 'form', value: 'Tablet' }],
  ...extra,
});

// searchKeywords is select:false — load it explicitly.
const keywordsOf = (id) => Product.findById(id).select('+searchKeywords');

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
  await setup();
});

describe('§A26 denorm fields on create (M3-A)', () => {
  it('sets searchKeywords (category + synonyms + attribute values + seller name), categoryType, topCategoryId', async () => {
    const res = await request(app).post('/products').set(bearer(sellerToken)).send(productBody());
    expect(res.status).toBe(201);

    const stored = await keywordsOf(res.body.product.id);
    expect(stored.categoryType).toBe('goods');
    expect(String(stored.topCategoryId)).toBe(String(top._id));

    const kw = stored.searchKeywords;
    expect(kw).toContain('pharmaceutical'); // leaf category name
    expect(kw).toContain('medicines'); // synonym — the "medicines" problem
    expect(kw).toContain('dawai');
    expect(kw).toContain('tablet'); // attribute VALUE
    expect(kw).toContain('textilehub'); // seller company name (memo F8/K2)
    // The attribute KEY is a machine handle, not something a buyer types — assert
    // on TOKENS, not substrings ("formulations" contains "form").
    expect(kw.split(' ')).not.toContain('form');
  });

  it('never leaks the denorm fields on a public response', async () => {
    const created = await request(app).post('/products').set(bearer(sellerToken)).send(productBody());
    await request(app)
      .patch(`/products/${created.body.product.id}/status`)
      .set(bearer(sellerToken))
      .send({ status: 'active' });

    const pub = await request(app).get(`/public/products/${created.body.product.id}`);
    expect(pub.status).toBe(200);
    const body = JSON.stringify(pub.body);
    expect(body).not.toContain('searchKeywords');
    expect(body).not.toContain('categoryType');
    expect(body).not.toContain('topCategoryId');

    // the seller's own view must not carry them either
    const mine = await request(app).get('/products/mine').set(bearer(sellerToken));
    expect(JSON.stringify(mine.body)).not.toContain('searchKeywords');
  });
});

describe('§A26 sync points (M3-A)', () => {
  it('rebuilds keywords when the product moves category or its attributes change', async () => {
    const created = await request(app).post('/products').set(bearer(sellerToken)).send(productBody());
    const id = created.body.product.id;

    const otherTop = await Category.create({ name: 'Textiles', slug: 'textiles' });
    const otherLeaf = await Category.create({
      name: 'Cotton fabric',
      parentId: otherTop._id,
      type: 'goods',
      synonyms: ['kapda'],
    });

    const moved = await request(app)
      .patch(`/products/${id}`)
      .set(bearer(sellerToken))
      .send({ categoryId: String(otherLeaf._id) });
    expect(moved.status).toBe(200);

    const stored = await keywordsOf(id);
    expect(stored.searchKeywords).toContain('kapda'); // new leaf's synonym
    expect(stored.searchKeywords).not.toContain('dawai'); // old leaf's synonym dropped
    expect(String(stored.topCategoryId)).toBe(String(otherTop._id));
    expect(stored.categoryType).toBe('goods');
  });

  it('a category RENAME rebuilds every product in it (bulk sync)', async () => {
    const created = await request(app).post('/products').set(bearer(sellerToken)).send(productBody());
    const manager = await makeStaff(['category:manage']);

    const res = await request(app)
      .patch(`/admin/categories/${leaf._id}`)
      .set(bearer(manager))
      .send({ name: 'Allopathic formulations' });
    expect(res.status).toBe(200);

    const stored = await keywordsOf(created.body.product.id);
    expect(stored.searchKeywords).toContain('allopathic'); // new name is searchable
    expect(stored.searchKeywords).not.toContain('pharmaceutical'); // old name gone
  });

  it('a SYNONYMS edit rebuilds every product in it (A12 path)', async () => {
    const created = await request(app).post('/products').set(bearer(sellerToken)).send(productBody());
    const manager = await makeStaff(['category:manage']);

    await request(app)
      .patch(`/admin/categories/${leaf._id}`)
      .set(bearer(manager))
      .send({ synonyms: ['pills', 'tablets'] });

    const stored = await keywordsOf(created.body.product.id);
    expect(stored.searchKeywords).toContain('pills');
    expect(stored.searchKeywords).not.toContain('dawai');
  });

  it('rebuildForOrganisation picks up a company rename (the A22 hook point)', async () => {
    const created = await request(app).post('/products').set(bearer(sellerToken)).send(productBody());
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { name: 'FabricWorks Global' } });

    const { updated } = await rebuildForOrganisation(sellerOrg._id);
    expect(updated).toBe(1);

    const stored = await keywordsOf(created.body.product.id);
    expect(stored.searchKeywords).toContain('fabricworks');
    expect(stored.searchKeywords).not.toContain('textilehub');
  });
});

describe('§A26 backfill + index (M3-A)', () => {
  it('rebuildAll fills fields for rows created without them, and is idempotent', async () => {
    // A pre-M3 style row: inserted straight to the collection, no denorms.
    const legacy = await Product.create({
      exporterOrgId: sellerOrg._id,
      categoryId: leaf._id,
      name: 'Legacy Syrup',
      attributes: [{ key: 'form', value: 'Syrup' }],
    });
    await Product.updateOne(
      { _id: legacy._id },
      { $unset: { searchKeywords: '', categoryType: '', topCategoryId: '' } },
    );

    const first = await rebuildAll();
    expect(first.updated).toBe(1);

    const stored = await keywordsOf(legacy._id);
    expect(stored.searchKeywords).toContain('syrup');
    expect(stored.categoryType).toBe('goods');
    expect(String(stored.topCategoryId)).toBe(String(top._id));

    // Idempotent: a second run writes nothing AND leaves the values identical.
    const before = await keywordsOf(legacy._id);
    const second = await rebuildAll();
    expect(second.updated).toBe(0);
    const after = await keywordsOf(legacy._id);
    expect(after.searchKeywords).toBe(before.searchKeywords);
    // A rebuild must NOT look like a product edit — recency ranking and the
    // sitemap's lastmod both read updatedAt.
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it('the ONE text index exists on Product and on Organisation', async () => {
    const productIndexes = await Product.collection.indexes();
    const productText = productIndexes.filter((i) => i.name === 'product_text');
    expect(productText).toHaveLength(1);
    expect(productText[0].weights).toMatchObject({ name: 10, searchKeywords: 5, description: 1 });
    // exactly one text index per collection — the §A26 hard constraint
    expect(productIndexes.filter((i) => i.textIndexVersion !== undefined)).toHaveLength(1);

    const orgIndexes = await Organisation.collection.indexes();
    expect(orgIndexes.filter((i) => i.textIndexVersion !== undefined)).toHaveLength(1);
  });

  it('buildSearchKeywords de-dupes, lowercases and ignores empty inputs', () => {
    const kw = buildSearchKeywords({
      categoryName: 'Cotton Fabric',
      synonyms: ['Cotton', 'kapda'],
      attributes: [{ key: 'material', value: 'Cotton' }, { key: 'gsm', value: 140 }],
      sellerName: 'Cotton Mills',
    });
    expect(kw.split(' ').filter((t) => t === 'cotton')).toHaveLength(1); // de-duped
    expect(kw).toContain('kapda');
    expect(kw).toContain('140');
    expect(buildSearchKeywords({})).toBe('');
  });
});
