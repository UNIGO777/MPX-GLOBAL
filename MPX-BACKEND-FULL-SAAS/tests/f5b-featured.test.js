/**
 * FINALIZE F5b — curated landing content.
 *
 * The tests that matter most are the SELF-HEALING ones. A featured row is only a
 * pointer, so the landing page must drop a card the moment its target stops
 * being publicly available — a taken-down product, a deactivated category, a
 * blocked company. If those ever start rendering, a blocked supplier sits on the
 * front page, which is exactly the failure F1 was built to close.
 *
 * The second group is the public surface: a landing card must be the SAME
 * projection the rest of the public API uses, never a richer one.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { FeaturedItem } from '../src/models/FeaturedItem.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { invalidateLeafCache } from '../src/services/category.service.js';

// Banner creation streams to Cloudinary; stub it so the suite stays offline.
vi.mock('../src/services/image.storage.service.js', () => ({
  uploadPublicImage: vi.fn(async () => ({
    url: 'https://res.cloudinary.com/demo/image/upload/mpx/banners/abc.png',
    publicId: 'mpx/banners/abc',
  })),
  deletePublicImage: vi.fn(async () => {}),
  isOwnCloudinaryUrl: () => true,
}));

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
let seq = 0;

let sa;
let curator;
let plain;
let buyer;
let sellerOrg;
let top;
let leaf;
let product;

async function makeUser(role, permissions = []) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...(role === 'exporter' ? { exporterSide: true, kycStatus: 'verified', verifiedAt: new Date() } : {}),
    ...(role === 'buyer' ? { buyerSide: true } : {}),
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `f5b_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `66${4000000 + seq}`, e164: `+9166${4000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

async function makeProduct(overrides = {}) {
  seq += 1;
  return Product.create({
    name: `Cotton Bale ${seq}`,
    slug: `cotton-bale-${seq}-${Date.now()}`,
    description: 'Long staple cotton',
    exporterOrgId: sellerOrg._id,
    categoryId: leaf._id,
    categoryType: 'goods',
    topCategoryId: top._id,
    status: 'active',
    price: { mode: 'fixed', min: 100, currency: 'INR' },
    sellerCountry: 'IN',
    sellerVerified: true,
    ...overrides,
  });
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
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), FeaturedItem.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  sa = await makeUser('superadmin');
  curator = await makeUser('employee', ['featured:manage']);
  plain = await makeUser('employee', []);
  buyer = await makeUser('buyer');
  const seller = await makeUser('exporter');
  sellerOrg = seller.org;
  top = await Category.create({ name: 'Textiles', slug: `textiles-${seq}` });
  leaf = await Category.create({ name: 'Cotton', slug: `cotton-${seq}`, parentId: top._id, type: 'goods' });
  invalidateLeafCache();
  product = await makeProduct();
});

describe('F5b · access control', () => {
  it('the landing read is PUBLIC — a guest gets it', async () => {
    const res = await request(app).get('/public/featured');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('banners');
    expect(res.body).toHaveProperty('products');
  });

  it('curating requires featured:manage', async () => {
    const body = { kind: 'product', targetId: String(product._id) };
    expect((await request(app).post('/admin/featured').set(bearer(plain.token)).send(body)).status).toBe(403);
    expect((await request(app).post('/admin/featured').set(bearer(buyer.token)).send(body)).status).toBe(403);
    expect((await request(app).post('/admin/featured').send(body)).status).toBe(401);
    expect((await request(app).post('/admin/featured').set(bearer(curator.token)).send(body)).status).toBe(201);
  });

  it('superadmin is all-access', async () => {
    const res = await request(app)
      .post('/admin/featured')
      .set(bearer(sa.token))
      .send({ kind: 'product', targetId: String(product._id) });
    expect(res.status).toBe(201);
  });

  it('the admin list is gated', async () => {
    expect((await request(app).get('/admin/featured').set(bearer(plain.token))).status).toBe(403);
    expect((await request(app).get('/admin/featured').set(bearer(curator.token))).status).toBe(200);
  });
});

describe('F5b · the landing page heals itself', () => {
  async function feature(kind, targetId) {
    return FeaturedItem.create({ kind, targetId, createdBy: sa.user._id });
  }

  it('shows a featured product', async () => {
    await feature('product', product._id);
    const res = await request(app).get('/public/featured');
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].product.name).toBe(product.name);
  });

  it('DROPS a featured product once it is taken down', async () => {
    await feature('product', product._id);
    await Product.updateOne(
      { _id: product._id },
      { $set: { takedown: { isDown: true, reason: 'counterfeit', at: new Date() } } },
    );
    const res = await request(app).get('/public/featured');
    expect(res.body.products).toHaveLength(0);
  });

  it('DROPS a featured product that is no longer active', async () => {
    await feature('product', product._id);
    await Product.updateOne({ _id: product._id }, { $set: { status: 'draft' } });
    expect((await request(app).get('/public/featured')).body.products).toHaveLength(0);
  });

  it('DROPS a featured product whose category was deactivated', async () => {
    await feature('product', product._id);
    await Category.updateOne({ _id: leaf._id }, { $set: { active: false } });
    invalidateLeafCache();
    expect((await request(app).get('/public/featured')).body.products).toHaveLength(0);
  });

  it('shows a featured category, and drops it when deactivated', async () => {
    await feature('category', top._id);
    expect((await request(app).get('/public/featured')).body.categories).toHaveLength(1);

    await Category.updateOne({ _id: top._id }, { $set: { active: false } });
    expect((await request(app).get('/public/featured')).body.categories).toHaveLength(0);
  });

  it('shows a highlighted supplier with its LIVE listing count', async () => {
    await feature('supplier', sellerOrg._id);
    await makeProduct(); // a second live listing
    const res = await request(app).get('/public/featured');
    expect(res.body.suppliers).toHaveLength(1);
    expect(res.body.suppliers[0].supplier.productCount).toBe(2);
  });

  // The F1 failure this whole design exists to prevent.
  it('DROPS a highlighted supplier once the company is blocked', async () => {
    await feature('supplier', sellerOrg._id);
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { isActive: false } });
    expect((await request(app).get('/public/featured')).body.suppliers).toHaveLength(0);
  });

  it('a supplier count excludes taken-down listings', async () => {
    await feature('supplier', sellerOrg._id);
    await Product.updateOne(
      { _id: product._id },
      { $set: { takedown: { isDown: true, reason: 'x', at: new Date() } } },
    );
    const res = await request(app).get('/public/featured');
    expect(res.body.suppliers[0].supplier.productCount).toBe(0);
  });

  it('a hard-deleted target leaves no broken card', async () => {
    await feature('product', product._id);
    await Product.deleteOne({ _id: product._id });
    const res = await request(app).get('/public/featured');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
  });
});

describe('F5b · the public projection is not widened', () => {
  it('a featured product card is the SAME shape as the public product read', async () => {
    await FeaturedItem.create({ kind: 'product', targetId: product._id });
    const featured = (await request(app).get('/public/featured')).body.products[0].product;
    const direct = (await request(app).get(`/public/products/${product._id}`)).body.product;
    expect(Object.keys(featured).sort()).toEqual(Object.keys(direct).sort());
  });

  it('a supplier card never leaks kycStatus, website or internal fields', async () => {
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { website: 'https://secret.example' } });
    await FeaturedItem.create({ kind: 'supplier', targetId: sellerOrg._id });
    const res = await request(app).get('/public/featured');
    const serialised = JSON.stringify(res.body);

    expect(res.body.suppliers[0].supplier).not.toHaveProperty('kycStatus');
    expect(res.body.suppliers[0].supplier).not.toHaveProperty('website');
    expect(res.body.suppliers[0].supplier).not.toHaveProperty('exporterSide');
    expect(serialised).not.toContain('secret.example');
    // The tick is a derived boolean, never the raw status (B7).
    expect(res.body.suppliers[0].supplier.verified).toBe(true);
  });

  it('the banner card carries no internal Cloudinary id', async () => {
    await FeaturedItem.create({ kind: 'banner', image: 'https://cdn/x.png', publicId: 'mpx/banners/x' });
    const res = await request(app).get('/public/featured');
    expect(res.body.banners[0]).not.toHaveProperty('publicId');
    expect(res.body.banners[0].image).toBe('https://cdn/x.png');
  });
});

describe('F5b · curation rules', () => {
  it('orders by `order`, then newest', async () => {
    const a = await makeProduct();
    const b = await makeProduct();
    await FeaturedItem.create({ kind: 'product', targetId: a._id, order: 5 });
    await FeaturedItem.create({ kind: 'product', targetId: b._id, order: 1 });
    const res = await request(app).get('/public/featured');
    expect(res.body.products.map((p) => p.product.name)).toEqual([b.name, a.name]);
  });

  it('respects active and the date window', async () => {
    const a = await makeProduct();
    const b = await makeProduct();
    const c = await makeProduct();
    await FeaturedItem.create({ kind: 'product', targetId: product._id, active: false });
    await FeaturedItem.create({ kind: 'product', targetId: a._id, startsAt: new Date(Date.now() + 60_000) });
    await FeaturedItem.create({ kind: 'product', targetId: b._id, endsAt: new Date(Date.now() - 60_000) });
    await FeaturedItem.create({ kind: 'product', targetId: c._id, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 60_000) });

    const res = await request(app).get('/public/featured');
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].product.name).toBe(c.name);
  });

  it('refuses to feature the same target twice', async () => {
    const body = { kind: 'product', targetId: String(product._id) };
    expect((await request(app).post('/admin/featured').set(bearer(curator.token)).send(body)).status).toBe(201);
    const dup = await request(app).post('/admin/featured').set(bearer(curator.token)).send(body);
    expect(dup.status).toBe(400);
  });

  it('refuses a target that does not exist', async () => {
    const res = await request(app)
      .post('/admin/featured')
      .set(bearer(curator.token))
      .send({ kind: 'product', targetId: String(new mongoose.Types.ObjectId()) });
    expect(res.status).toBe(400);
  });

  // B7: verification is never a gate. An unverified exporter may be curated; the
  // public read decides what is renderable, not the curation step.
  it('allows featuring an UNVERIFIED supplier', async () => {
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { kycStatus: 'pending' } });
    const res = await request(app)
      .post('/admin/featured')
      .set(bearer(curator.token))
      .send({ kind: 'supplier', targetId: String(sellerOrg._id) });
    expect(res.status).toBe(201);
    const landing = await request(app).get('/public/featured');
    expect(landing.body.suppliers[0].supplier.verified).toBe(false);
  });

  it('an inverted date window is rejected', async () => {
    const res = await request(app)
      .post('/admin/featured')
      .set(bearer(curator.token))
      .send({
        kind: 'product',
        targetId: String(product._id),
        startsAt: '2026-09-01',
        endsAt: '2026-08-01',
      });
    expect(res.status).toBe(400);
  });

  it('the admin list shows inactive and expired rows the public read hides', async () => {
    await FeaturedItem.create({ kind: 'product', targetId: product._id, active: false });
    const admin = await request(app).get('/admin/featured').set(bearer(curator.token));
    expect(admin.body.items).toHaveLength(1);
    expect((await request(app).get('/public/featured')).body.products).toHaveLength(0);
  });

  it('patches order and active, but cannot repoint the slot', async () => {
    const item = await FeaturedItem.create({ kind: 'product', targetId: product._id });
    const other = await makeProduct();
    const res = await request(app)
      .patch(`/admin/featured/${item._id}`)
      .set(bearer(curator.token))
      .send({ order: 9, active: false, targetId: String(other._id), kind: 'banner' });

    expect(res.status).toBe(200);
    const after = await FeaturedItem.findById(item._id);
    expect(after.order).toBe(9);
    expect(after.active).toBe(false);
    // Unknown keys are stripped, so the slot still points where it did.
    expect(String(after.targetId)).toBe(String(product._id));
    expect(after.kind).toBe('product');
  });

  it('deletes a slot', async () => {
    const item = await FeaturedItem.create({ kind: 'product', targetId: product._id });
    expect((await request(app).delete(`/admin/featured/${item._id}`).set(bearer(curator.token))).status).toBe(204);
    expect(await FeaturedItem.countDocuments({})).toBe(0);
  });

  it('every curation action writes an audit row', async () => {
    const created = await request(app)
      .post('/admin/featured')
      .set(bearer(curator.token))
      .send({ kind: 'product', targetId: String(product._id) });
    await request(app).patch(`/admin/featured/${created.body.item.id}`).set(bearer(curator.token)).send({ order: 3 });
    await request(app).delete(`/admin/featured/${created.body.item.id}`).set(bearer(curator.token));

    const actions = (await AuditLog.find({ entityType: 'FeaturedItem' }).lean()).map((a) => a.action);
    expect(actions).toContain('featured.create');
    expect(actions).toContain('featured.update');
    expect(actions).toContain('featured.delete');
  });
});

describe('F5b · banners', () => {
  it('creates a banner from an uploaded image', async () => {
    const res = await request(app)
      .post('/admin/featured/banner')
      .set(bearer(curator.token))
      .field('title', 'Monsoon deals')
      .field('linkUrl', '/search?q=cotton')
      .attach('image', PNG, 'banner.png');

    expect(res.status).toBe(201);
    expect(res.body.item.image).toContain('cloudinary');
    expect((await request(app).get('/public/featured')).body.banners).toHaveLength(1);
  });

  it('refuses a banner with no image file', async () => {
    const res = await request(app)
      .post('/admin/featured/banner')
      .set(bearer(curator.token))
      .field('title', 'No image');
    expect(res.status).toBe(400);
  });

  // Stored XSS: this value is rendered into an href on the landing page.
  it.each(['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:msgbox'])(
    'rejects the dangerous link %s',
    async (linkUrl) => {
      const res = await request(app)
        .post('/admin/featured/banner')
        .set(bearer(curator.token))
        .field('linkUrl', linkUrl)
        .attach('image', PNG, 'banner.png');
      expect(res.status).toBe(400);
    },
  );

  it('accepts a relative path and an absolute http(s) url', async () => {
    for (const linkUrl of ['/products/cotton', 'https://mpx.example/landing']) {
      const res = await request(app)
        .post('/admin/featured/banner')
        .set(bearer(curator.token))
        .field('linkUrl', linkUrl)
        .attach('image', PNG, 'banner.png');
      expect(res.status).toBe(201);
    }
  });

  it('a non-banner slot refuses an image', async () => {
    const item = await FeaturedItem.create({ kind: 'product', targetId: product._id });
    const res = await request(app)
      .post(`/admin/featured/${item._id}/image`)
      .set(bearer(curator.token))
      .attach('image', PNG, 'banner.png');
    expect(res.status).toBe(400);
  });

  it('a banner may not carry a targetId, and a non-banner must', async () => {
    await expect(FeaturedItem.create({ kind: 'banner', image: 'x', targetId: product._id })).rejects.toThrow();
    await expect(FeaturedItem.create({ kind: 'product' })).rejects.toThrow();
    await expect(FeaturedItem.create({ kind: 'banner' })).rejects.toThrow();
  });
});
