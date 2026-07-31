import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../src/services/image.storage.service.js', () => ({
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(),
  deletePublicImage: vi.fn(async () => {}),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { SavedItem } = await import('../src/models/SavedItem.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');
const { sweepOrphanedSavedItems } = await import('../src/services/saved.service.js');
const { purgeBlockedProducts } = await import('../src/jobs/purgeBlockedProducts.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let top;
let leaf;
let sellerOrg;
let product;
let buyerToken;
let buyerOrg;

async function makeUser(role, orgFields) {
  seq += 1;
  const org = await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `sv_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `84${1000000 + seq}`, e164: `+9184${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
  });
  return { org, user, token: signAccessToken(user) };
}

async function seedWorld() {
  top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  sellerOrg = await Organisation.create({
    name: 'Seller Co',
    type: 'business',
    exporterSide: true,
    country: 'IN',
    kycStatus: 'verified',
  });
  product = await Product.create({
    exporterOrgId: sellerOrg._id,
    categoryId: leaf._id,
    name: 'Cotton Roll',
    status: 'active',
    sellerCountry: 'IN',
    sellerVerified: true,
  });
  const buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
  buyerToken = buyer.token;
  buyerOrg = buyer.org;
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
    Product.deleteMany({}),
    SavedItem.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('save / unsave (M3-D · §A13 buyer-only)', () => {
  it('a buyer saves a product and a supplier; duplicates are blocked by the DB index', async () => {
    const p = await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'product', targetId: String(product._id) });
    expect(p.status).toBe(201);

    const s = await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'supplier', targetId: String(sellerOrg._id) });
    expect(s.status).toBe(201);

    const dup = await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'product', targetId: String(product._id) });
    expect(dup.status).toBe(409);

    expect(await SavedItem.countDocuments({ buyerOrgId: buyerOrg._id })).toBe(2);
  });

  it('an EXPORTER account cannot save (§A13 — buyer accounts only)', async () => {
    const exporter = await makeUser('exporter', { exporterSide: true });
    const res = await request(app)
      .post('/saved')
      .set(bearer(exporter.token))
      .send({ targetType: 'product', targetId: String(product._id) });
    expect(res.status).toBe(403);
  });

  it('a superadmin is blocked too — requireRole passes them, the buyerSide guard does not', async () => {
    seq += 1;
    const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
    const sa = await User.create({
      name: 'root',
      email: `root_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `83${1000000 + seq}`, e164: `+9183${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'superadmin',
      orgId: platform._id,
    });
    const res = await request(app)
      .post('/saved')
      .set(bearer(signAccessToken(sa)))
      .send({ targetType: 'product', targetId: String(product._id) });
    expect(res.status).toBe(403);
  });

  it('cannot save something that is not publicly visible; guests cannot save at all', async () => {
    const hidden = await Product.create({
      exporterOrgId: sellerOrg._id,
      categoryId: leaf._id,
      name: 'Draft Roll',
      status: 'draft',
    });
    const res = await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'product', targetId: String(hidden._id) });
    expect(res.status).toBe(404);

    const guest = await request(app)
      .post('/saved')
      .send({ targetType: 'product', targetId: String(product._id) });
    expect(guest.status).toBe(401);
  });

  it('unsave is ownership-scoped — another buyer gets 404, never 403', async () => {
    const saved = await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'product', targetId: String(product._id) });

    const other = await makeUser('buyer', { buyerSide: true });
    expect(
      (await request(app).delete(`/saved/${saved.body.saved.id}`).set(bearer(other.token))).status,
    ).toBe(404);

    expect((await request(app).delete(`/saved/${saved.body.saved.id}`).set(bearer(buyerToken))).status).toBe(200);
    expect(await SavedItem.countDocuments({})).toBe(0);
  });
});

describe('availability: temporary stays flagged, permanent is cleaned up (Saved-item.md §3.2)', () => {
  async function saveProduct() {
    const res = await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'product', targetId: String(product._id) });
    expect(res.status).toBe(201);
  }

  it('inactive / taken-down / dead-category targets STAY, flagged unavailable', async () => {
    await saveProduct();

    // 1. seller hides it
    await Product.updateOne({ _id: product._id }, { $set: { status: 'inactive' } });
    let res = await request(app).get('/saved').set(bearer(buyerToken));
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].available).toBe(false);
    expect(res.body.items[0].unavailableReason).toBe('unavailable');
    expect(res.body.items[0].product.name).toBe('Cotton Roll'); // still renderable

    // 2. admin takes it down
    await Product.updateOne(
      { _id: product._id },
      { $set: { status: 'active', takedown: { isDown: true, reason: 'x', at: new Date() } } },
    );
    res = await request(app).get('/saved').set(bearer(buyerToken));
    expect(res.body.items[0].available).toBe(false);

    // 3. its category is deactivated
    await Product.updateOne({ _id: product._id }, { $set: { takedown: { isDown: false } } });
    await Category.updateOne({ _id: top._id }, { $set: { active: false } });
    invalidateLeafCache();
    res = await request(app).get('/saved').set(bearer(buyerToken));
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].available).toBe(false);
  });

  it('a blocked/deactivated SUPPLIER stays flagged, not removed', async () => {
    await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'supplier', targetId: String(sellerOrg._id) });

    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { isActive: false } });
    const res = await request(app).get('/saved').set(bearer(buyerToken));
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].available).toBe(false);
    expect(res.body.items[0].supplier.name).toBe('Seller Co');
  });

  it('ARCHIVE removes the saved rows (seller delete = permanently gone)', async () => {
    await saveProduct();
    seq += 1;
    const seller = await User.create({
      name: 'seller',
      email: `sel_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `82${1000000 + seq}`, e164: `+9182${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'exporter',
      orgId: sellerOrg._id,
    });

    const del = await request(app).delete(`/products/${product._id}`).set(bearer(signAccessToken(seller)));
    expect(del.status).toBe(200);

    expect(await SavedItem.countDocuments({})).toBe(0);
    const res = await request(app).get('/saved').set(bearer(buyerToken));
    expect(res.body.items).toEqual([]);
  });

  it('the A8 PURGE removes the saved rows too', async () => {
    await saveProduct();
    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          takedown: {
            isDown: true,
            reason: 'counterfeit',
            byUserId: new mongoose.Types.ObjectId(),
            at: new Date('2026-01-01'),
          },
        },
      },
    );

    const { purged } = await purgeBlockedProducts({ now: new Date('2026-07-31') });
    expect(purged).toBe(1);
    expect(await SavedItem.countDocuments({})).toBe(0);
  });

  it('a dangling target is SKIPPED, not rendered broken; the sweep clears it', async () => {
    await saveProduct();
    // Simulate pre-hook data: the product vanishes with its saved row left behind.
    await Product.deleteOne({ _id: product._id });

    const res = await request(app).get('/saved').set(bearer(buyerToken));
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]); // skipped, no crash

    const { removed } = await sweepOrphanedSavedItems();
    expect(removed).toBe(1);
    expect(await SavedItem.countDocuments({})).toBe(0);
  });
});

describe('saved list shape + paging (M3-D)', () => {
  it('returns the SAME public projections as every other surface (no leaks)', async () => {
    await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'product', targetId: String(product._id) });
    await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'supplier', targetId: String(sellerOrg._id) });

    const res = await request(app).get('/saved').set(bearer(buyerToken));
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    for (const forbidden of ['searchKeywords', 'sellerVerified', 'sellerCountry', 'takedown', 'exporterOrgId', 'kycStatus', 'website']) {
      expect(body).not.toContain(forbidden);
    }
    const productRow = res.body.items.find((i) => i.targetType === 'product');
    expect(productRow.product.seller.verified).toBe(true);
  });

  it('filters by targetType and caps pageSize', async () => {
    await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'product', targetId: String(product._id) });
    await request(app)
      .post('/saved')
      .set(bearer(buyerToken))
      .send({ targetType: 'supplier', targetId: String(sellerOrg._id) });

    const onlyProducts = await request(app).get('/saved').query({ targetType: 'product' }).set(bearer(buyerToken));
    expect(onlyProducts.body.total).toBe(1);
    expect(onlyProducts.body.items[0].targetType).toBe('product');

    expect((await request(app).get('/saved').query({ pageSize: 9999 }).set(bearer(buyerToken))).status).toBe(400);
  });
});
