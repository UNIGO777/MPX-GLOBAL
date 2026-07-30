import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Capture OTPs (M1 flow) + mock Cloudinary-backed storage (M2 uploads).
const { otpBox } = vi.hoisted(() => ({ otpBox: { byId: new Map() } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async ({ identifier, code }) => {
    otpBox.byId.set(identifier, code);
  },
}));
vi.mock('../src/services/image.storage.service.js', () => ({
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

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let goodsTop;
let goodsLeaf;
let serviceLeaf;

async function makeTree() {
  goodsTop = await Category.create({ name: 'Textiles', slug: 'textiles' });
  goodsLeaf = await Category.create({ name: 'Cotton fabric', parentId: goodsTop._id, type: 'goods' });
  const serviceTop = await Category.create({ name: 'IT Services', slug: 'it-services' });
  serviceLeaf = await Category.create({ name: 'Web development', parentId: serviceTop._id, type: 'service' });
  await CategoryAttribute.create({
    categoryId: serviceLeaf._id,
    name: 'Tech stack',
    key: 'tech_stack',
    inputType: 'text',
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
    User.deleteMany({}),
    Organisation.deleteMany({}),
    Category.deleteMany({}),
    CategoryAttribute.deleteMany({}),
    Product.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  otpBox.byId.clear();
  invalidateLeafCache();
  await makeTree();
});

describe('M1 auth → M2 catalogue, end to end over real HTTP', () => {
  it('exporter signup → OTP session → create+publish → public browse shows it → verify flips the tick', async () => {
    seq += 1;
    const mobileNo = `98${7000000 + seq}`;
    // --- M1: real signup + OTP exchange (no signAccessToken shortcut) ---------
    const signup = await request(app).post('/auth/exporter/signup').send({
      name: 'End ToEnd',
      email: `e2e_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: mobileNo },
      password: 'longpassword1',
      company: 'E2E Exports',
      country: 'IN',
      entityType: 'business',
    });
    expect(signup.status).toBe(201);
    const code = otpBox.byId.get(`+91${mobileNo}`);
    const verifyOtp = await request(app)
      .post('/auth/verify-otp')
      .send({ loginToken: signup.body.loginToken, code });
    expect(verifyOtp.status).toBe(200);
    const token = verifyOtp.body.accessToken;
    const orgId = verifyOtp.body.user.orgId;

    // --- M2: create (draft) → publish → public visibility ---------------------
    const created = await request(app)
      .post('/products')
      .set(bearer(token))
      .send({
        name: 'E2E Cotton Roll',
        categoryId: String(goodsLeaf._id),
        price: { mode: 'on_request' },
      });
    expect(created.status).toBe(201);

    const published = await request(app)
      .patch(`/products/${created.body.product.id}/status`)
      .set(bearer(token))
      .send({ status: 'active' });
    expect(published.status).toBe(200);

    const browse = await request(app).get('/public/products');
    expect(browse.body.total).toBe(1);
    expect(browse.body.products[0].seller.verified).toBe(false);
    expect(browse.body.products[0].seller.name).toBe('E2E Exports');

    // sellerCountry denorm came from the org captured at signup (§A23)
    expect((await Product.findById(created.body.product.id)).sellerCountry).toBe('IN');

    // --- M1 verification → §A23 sync → tick on the M2 public surface ----------
    await Organisation.updateOne({ _id: orgId }, { $set: { kycStatus: 'submitted' } });
    seq += 1;
    const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
    const reviewer = await User.create({
      name: 'rev',
      email: `rev_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `91${1000000 + seq}`, e164: `+9191${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'employee',
      orgId: platform._id,
      permissions: ['exporter:verify'],
    });
    const review = await request(app)
      .post(`/employee/exporters/${orgId}/verify`)
      .set(bearer(signAccessToken(reviewer)));
    expect(review.status).toBe(200);

    const after = await request(app).get('/public/products');
    expect(after.body.products[0].seller.verified).toBe(true); // tick flipped, raw kycStatus absent
    expect(JSON.stringify(after.body)).not.toContain('kycStatus');
    expect((await Product.findById(created.body.product.id)).sellerVerified).toBe(true); // §A23

    // seller profile carries the §9b count for the live listing
    const profile = await request(app).get(`/exporters/${orgId}`);
    expect(profile.body.exporter.productCount).toBe(1);
  });

  it("superadmin's requireRole bypass CANNOT create a product (exporterSide org guard, 403)", async () => {
    seq += 1;
    const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
    const sa = await User.create({
      name: 'root',
      email: `root_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `90${1000000 + seq}`, e164: `+9190${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'superadmin',
      orgId: platform._id,
    });
    const res = await request(app)
      .post('/products')
      .set(bearer(signAccessToken(sa)))
      .send({ name: 'Rogue', categoryId: String(goodsLeaf._id), price: { mode: 'on_request' } });
    expect(res.status).toBe(403); // the platform org has no exporter side
  });
});

describe('F1-A org block × M2 catalogue (the documented F1-B gap)', () => {
  it('block kills the seller session AND hides the profile — but products stay public until F1-B', async () => {
    seq += 1;
    const org = await Organisation.create({
      name: 'Blocked Co',
      type: 'business',
      exporterSide: true,
      country: 'IN',
    });
    const seller = await User.create({
      name: 'seller',
      email: `blk_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `89${1000000 + seq}`, e164: `+9189${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'exporter',
      orgId: org._id,
    });
    const sellerToken = signAccessToken(seller);
    await Product.create({
      exporterOrgId: org._id,
      categoryId: goodsLeaf._id,
      name: 'Still Visible',
      status: 'active',
    });

    seq += 1;
    const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
    const sa = await User.create({
      name: 'root',
      email: `root2_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `88${1000000 + seq}`, e164: `+9188${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'superadmin',
      orgId: platform._id,
    });
    const block = await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(signAccessToken(sa)))
      .send({ reason: 'fraud investigation' });
    expect(block.status).toBe(200);

    // M1 side: session dead (tokenVersion bump), profile 404.
    expect((await request(app).get('/products/mine').set(bearer(sellerToken))).status).toBe(401);
    expect((await request(app).get(`/exporters/${org._id}`)).status).toBe(404);

    // M2 side: the accepted F1-B gap — listings remain publicly visible.
    const browse = await request(app).get('/public/products');
    expect(browse.body.total).toBe(1);
    expect(browse.body.products[0].name).toBe('Still Visible');
  });
});

describe('cross-type category change (bug-fix regression)', () => {
  it('goods→service move auto-clears goods fields + stale attributes instead of bricking the product', async () => {
    seq += 1;
    const org = await Organisation.create({
      name: 'Mover Co',
      type: 'business',
      exporterSide: true,
      country: 'IN',
    });
    const seller = await User.create({
      name: 'mover',
      email: `mv_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `87${1000000 + seq}`, e164: `+9187${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'exporter',
      orgId: org._id,
    });
    const token = signAccessToken(seller);

    const created = await request(app)
      .post('/products')
      .set(bearer(token))
      .send({
        name: 'Was Goods',
        categoryId: String(goodsLeaf._id),
        price: { mode: 'fixed', min: 100, currency: 'INR' },
        moq: 500,
        unit: 'meter',
        countryOfOrigin: 'IN',
      });
    expect(created.status).toBe(201);

    // Move to the service leaf, adding a service field + the new leaf's attribute.
    const moved = await request(app)
      .patch(`/products/${created.body.product.id}`)
      .set(bearer(token))
      .send({
        categoryId: String(serviceLeaf._id),
        engagementType: 'dedicated',
        attributes: [{ key: 'tech_stack', value: 'Node.js' }],
      });
    expect(moved.status).toBe(200);
    expect(moved.body.product.moq).toBeNull(); // goods group auto-cleared
    expect(moved.body.product.unit).toBeNull();
    expect(moved.body.product.countryOfOrigin).toBeNull();
    expect(moved.body.product.engagementType).toBe('dedicated');
    expect(moved.body.product.attributes).toEqual([{ key: 'tech_stack', value: 'Node.js' }]);

    // And without attributes in the patch, stale goods attrs are dropped, not 400.
    const back = await request(app)
      .patch(`/products/${created.body.product.id}`)
      .set(bearer(token))
      .send({ categoryId: String(goodsLeaf._id), moq: 100, unit: 'meter' });
    expect(back.status).toBe(200);
    expect(back.body.product.attributes).toEqual([]);
    expect(back.body.product.engagementType).toBeNull(); // service group cleared on the way back
  });
});

describe('public browse seller filter by SLUG (M2-F)', () => {
  it('resolves an org slug exactly like an id', async () => {
    const org = await Organisation.create({
      name: 'Slug Sellers',
      type: 'business',
      exporterSide: true,
      country: 'IN',
    });
    await Product.create({ exporterOrgId: org._id, categoryId: goodsLeaf._id, name: 'By Slug', status: 'active' });

    const fresh = await Organisation.findById(org._id);
    const res = await request(app).get('/public/products').query({ seller: fresh.slug });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe('By Slug');
  });
});
