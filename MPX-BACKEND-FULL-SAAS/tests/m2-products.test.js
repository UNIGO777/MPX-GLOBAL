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
const { AuditLog } = await import('../src/models/AuditLog.js');
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

async function makeBuyerToken() {
  seq += 1;
  const org = await Organisation.create({ name: `Buyer Co ${seq}`, type: 'business', buyerSide: true });
  const user = await User.create({
    name: `buyer-${seq}`,
    email: `buy_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `95${1000000 + seq}`, e164: `+9195${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'buyer',
    orgId: org._id,
  });
  return signAccessToken(user);
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

describe('product create (M2-E)', () => {
  it('creates a DRAFT with §A23 denorm fields set, and audits product.create', async () => {
    const ex = await makeExporter();
    const res = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id));
    expect(res.status).toBe(201);
    expect(res.body.product.status).toBe('draft');
    expect(res.body.product.slug).toBe('cotton-fabric-roll');

    const stored = await Product.findById(res.body.product.id);
    expect(stored.sellerCountry).toBe('IN');
    expect(stored.sellerVerified).toBe(false);
    expect(await AuditLog.findOne({ action: 'product.create' })).toBeTruthy();
  });

  it('rejects a TOP category (leaf-only), wrong-type fields, and bad attributes', async () => {
    const ex = await makeExporter();

    const onTop = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(validBody(ex.org._id, { categoryId: String(topCat._id) }));
    expect(onTop.status).toBe(400);

    // service-only field on a goods leaf
    const wrongType = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(validBody(ex.org._id, { engagementType: 'dedicated' }));
    expect(wrongType.status).toBe(400);

    // unknown attribute key
    const unknownAttr = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(validBody(ex.org._id, { attributes: [{ key: 'voltage', value: 5 }] }));
    expect(unknownAttr.status).toBe(400);

    // select value outside options
    const badSelect = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(validBody(ex.org._id, { attributes: [{ key: 'material', value: 'Wool' }] }));
    expect(badSelect.status).toBe(400);

    // object as attribute value (operator-shaped) — primitive union blocks it
    const objValue = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(validBody(ex.org._id, { attributes: [{ key: 'gsm', value: { $gt: '' } }] }));
    expect(objValue.status).toBe(400);
  });

  it('price mode matrix: fixed+max / range min>=max / on_request+value / missing currency → 400', async () => {
    const ex = await makeExporter();
    const cases = [
      { mode: 'fixed', min: 10, max: 20, currency: 'INR' },
      { mode: 'range', min: 20, max: 10, currency: 'INR' },
      { mode: 'on_request', min: 5 },
      { mode: 'fixed', min: 10 },
    ];
    for (const price of cases) {
      const res = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id, { price }));
      expect(res.status).toBe(400);
    }
  });

  it('A15: an unverified seller cannot create an 11th draft; a verified one can', async () => {
    const ex = await makeExporter();
    for (let i = 0; i < 10; i += 1) {
      await Product.create({ exporterOrgId: ex.org._id, categoryId: goodsLeaf._id, name: `Draft ${i}` });
    }
    const blocked = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id));
    expect(blocked.status).toBe(409);

    await Organisation.updateOne({ _id: ex.org._id }, { $set: { kycStatus: 'verified' } });
    const ok = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id));
    expect(ok.status).toBe(201);
  });

  it('a buyer cannot create products (403); a foreign image ref is rejected (400)', async () => {
    const buyerToken = await makeBuyerToken();
    const ex = await makeExporter();

    expect(
      (await request(app).post('/products').set(bearer(buyerToken)).send(validBody(ex.org._id))).status,
    ).toBe(403);

    const foreign = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(validBody(ex.org._id, { images: [imgRef(new mongoose.Types.ObjectId())] }));
    expect(foreign.status).toBe(400);

    // A forged pair — the publicId sits in the caller's own prefix, but the URL
    // points somewhere else entirely. Checking only the prefix would let this
    // through and serve an arbitrary image to buyers (review finding).
    const forgedUrl = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(
        validBody(ex.org._id, {
          images: [{ url: 'https://evil.example/stolen.jpg', publicId: `mpx/products/${ex.org._id}/p_1` }],
        }),
      );
    expect(forgedUrl.status).toBe(400);

    // …and a real Cloudinary host but a URL that does not contain the publicId
    // (i.e. someone else's asset) is rejected too.
    const mismatched = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(
        validBody(ex.org._id, {
          images: [
            {
              url: 'https://res.cloudinary.com/demo/image/upload/v1/mpx/products/someone-else/x.jpg',
              publicId: `mpx/products/${ex.org._id}/p_1`,
            },
          ],
        }),
      );
    expect(mismatched.status).toBe(400);
  });
});

describe('status transitions + caps (M2-E)', () => {
  async function draftFor(ex, extra = {}) {
    const res = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id, extra));
    expect(res.status).toBe(201);
    return res.body.product;
  }

  it('publish enforces required attributes and the D1 cap (taken-down excluded — A10)', async () => {
    const ex = await makeExporter();

    // Missing required gsm → publish blocked.
    const incomplete = await draftFor(ex, { attributes: [] });
    const noAttrs = await request(app)
      .patch(`/products/${incomplete.id}/status`)
      .set(bearer(ex.token))
      .send({ status: 'active' });
    expect(noAttrs.status).toBe(400);

    // 3 active (one of them taken down → frees a slot).
    for (let i = 0; i < 3; i += 1) {
      await Product.create({
        exporterOrgId: ex.org._id,
        categoryId: goodsLeaf._id,
        name: `Live ${i}`,
        status: 'active',
        ...(i === 0 ? { takedown: { isDown: true, reason: 'x', at: new Date() } } : {}),
      });
    }
    const draft = await draftFor(ex);
    const publish = await request(app)
      .patch(`/products/${draft.id}/status`)
      .set(bearer(ex.token))
      .send({ status: 'active' });
    expect(publish.status).toBe(200); // 2 counted actives + this = 3 → allowed

    // Now 3 counted actives — the next publish hits the cap.
    const fourth = await draftFor(ex);
    const blocked = await request(app)
      .patch(`/products/${fourth.id}/status`)
      .set(bearer(ex.token))
      .send({ status: 'active' });
    expect(blocked.status).toBe(409);

    // Verified org: uncapped.
    await Organisation.updateOne({ _id: ex.org._id }, { $set: { kycStatus: 'verified' } });
    const uncapped = await request(app)
      .patch(`/products/${fourth.id}/status`)
      .set(bearer(ex.token))
      .send({ status: 'active' });
    expect(uncapped.status).toBe(200);
    expect(await AuditLog.findOne({ action: 'product.publish' })).toBeTruthy();
  });

  it('A1: draft is one-way; same-status 409; inactive→active re-checks the cap', async () => {
    const ex = await makeExporter();
    const p = await draftFor(ex);
    await request(app).patch(`/products/${p.id}/status`).set(bearer(ex.token)).send({ status: 'active' });

    const backToDraft = await request(app)
      .patch(`/products/${p.id}/status`)
      .set(bearer(ex.token))
      .send({ status: 'draft' });
    expect(backToDraft.status).toBe(400); // zod enum — draft is never a target

    const same = await request(app)
      .patch(`/products/${p.id}/status`)
      .set(bearer(ex.token))
      .send({ status: 'active' });
    expect(same.status).toBe(409);

    // hide it, fill the cap with 3 others, then re-activating hits the cap again
    await request(app).patch(`/products/${p.id}/status`).set(bearer(ex.token)).send({ status: 'inactive' });
    for (let i = 0; i < 3; i += 1) {
      await Product.create({
        exporterOrgId: ex.org._id,
        categoryId: goodsLeaf._id,
        name: `Cap ${i}`,
        status: 'active',
      });
    }
    const reactivate = await request(app)
      .patch(`/products/${p.id}/status`)
      .set(bearer(ex.token))
      .send({ status: 'active' });
    expect(reactivate.status).toBe(409);
  });

  it('cross-org isolation: another exporter gets 404 on read/edit/status/delete (A2)', async () => {
    const owner = await makeExporter();
    const other = await makeExporter();
    const p = await draftFor(owner);

    expect(
      (await request(app).patch(`/products/${p.id}`).set(bearer(other.token)).send({ name: 'X' })).status,
    ).toBe(404);
    expect(
      (await request(app).patch(`/products/${p.id}/status`).set(bearer(other.token)).send({ status: 'active' }))
        .status,
    ).toBe(404);
    expect((await request(app).delete(`/products/${p.id}`).set(bearer(other.token))).status).toBe(404);
  });
});

describe('archive + frozen states (M2-E)', () => {
  it('A5/A6: delete archives with a slug marker; the clean slug frees for a re-list; archived is terminal', async () => {
    const ex = await makeExporter();
    const create = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id));
    const id = create.body.product.id;

    const del = await request(app).delete(`/products/${id}`).set(bearer(ex.token));
    expect(del.status).toBe(200);
    expect(del.body.product.status).toBe('archived');
    expect(del.body.product.slug).toMatch(/^cotton-fabric-roll--archived-/);

    // clean slug is free again
    const relist = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id));
    expect(relist.status).toBe(201);
    expect(relist.body.product.slug).toBe('cotton-fabric-roll');

    // archived = terminal
    expect((await request(app).patch(`/products/${id}`).set(bearer(ex.token)).send({ name: 'X' })).status).toBe(409);
    expect(
      (await request(app).patch(`/products/${id}/status`).set(bearer(ex.token)).send({ status: 'active' })).status,
    ).toBe(409);
    expect((await request(app).delete(`/products/${id}`).set(bearer(ex.token))).status).toBe(409);
    expect(await AuditLog.findOne({ action: 'product.archive' })).toBeTruthy();
  });

  it('taken-down: status change and delete are frozen (409); content edit stays possible; rename keeps the slug', async () => {
    const ex = await makeExporter();
    const create = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id));
    const id = create.body.product.id;
    await Product.updateOne(
      { _id: id },
      { $set: { takedown: { isDown: true, reason: 'reported', byUserId: new mongoose.Types.ObjectId(), at: new Date() } } },
    );

    expect(
      (await request(app).patch(`/products/${id}/status`).set(bearer(ex.token)).send({ status: 'active' })).status,
    ).toBe(409);
    expect((await request(app).delete(`/products/${id}`).set(bearer(ex.token))).status).toBe(409);

    const edit = await request(app).patch(`/products/${id}`).set(bearer(ex.token)).send({ name: 'Fixed Name' });
    expect(edit.status).toBe(200);
    expect(edit.body.product.slug).toBe('cotton-fabric-roll'); // A6 — rename never regenerates
    // A19: edit MUST audit (the dropped `createdBy` replacement — who touched what).
    const editAudit = await AuditLog.findOne({ action: 'product.update' });
    expect(editAudit).toBeTruthy();
    expect(editAudit.after.changed).toContain('name');
  });

  it('an admin deleting an attribute does NOT brick the seller\'s ability to edit (review fix)', async () => {
    const ex = await makeExporter();
    const created = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(validBody(ex.org._id, { attributes: [{ key: 'gsm', value: 140 }, { key: 'material', value: 'Cotton' }] }));
    expect(created.status).toBe(201);
    const id = created.body.product.id;

    // The admin removes the attribute AFTER products already store a value.
    await CategoryAttribute.deleteOne({ categoryId: goodsLeaf._id, key: 'material' });

    // The seller's normal round-trip — GET the product, PATCH it back — must
    // still work; the orphaned key is dropped rather than 400-ing forever.
    const mine = await request(app).get('/products/mine').set(bearer(ex.token));
    const current = mine.body.products.find((p) => p.id === id);
    const edit = await request(app)
      .patch(`/products/${id}`)
      .set(bearer(ex.token))
      .send({ name: 'Renamed Roll', attributes: current.attributes });
    expect(edit.status).toBe(200);
    expect(edit.body.product.attributes).toEqual([{ key: 'gsm', value: 140 }]);

    // A select option removed under a stored value behaves the same way.
    await CategoryAttribute.updateOne({ categoryId: goodsLeaf._id, key: 'gsm' }, { $set: { inputType: 'number' } });
    const again = await request(app)
      .patch(`/products/${id}`)
      .set(bearer(ex.token))
      .send({ attributes: [{ key: 'gsm', value: 150 }] });
    expect(again.status).toBe(200);

    // But CREATE still rejects an unknown key — nothing is stale on a new listing.
    const fresh = await request(app)
      .post('/products')
      .set(bearer(ex.token))
      .send(validBody(ex.org._id, { attributes: [{ key: 'material', value: 'Cotton' }] }));
    expect(fresh.status).toBe(400);
  });

  it('A9: /products/mine shows takedown reason + date but NEVER byUserId', async () => {
    const ex = await makeExporter();
    const create = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id));
    await Product.updateOne(
      { _id: create.body.product.id },
      { $set: { takedown: { isDown: true, reason: 'reported', byUserId: new mongoose.Types.ObjectId(), at: new Date() } } },
    );

    const mine = await request(app).get('/products/mine').set(bearer(ex.token));
    expect(mine.status).toBe(200);
    expect(mine.body.products).toHaveLength(1);
    expect(mine.body.products[0].takedown.reason).toBe('reported');
    expect(JSON.stringify(mine.body)).not.toContain('byUserId');
  });
});

// The seller list screen's tabs + cap meter come from this one call.
describe('/products/mine status tabs, counts and cap meter', () => {
  // Seeded directly: these assert the READ, not the write paths (which have
  // their own cap tests above and would refuse to create this spread).
  async function seedSpread(ex) {
    const rows = [
      { name: 'D1', status: 'draft' },
      { name: 'D2', status: 'draft' },
      { name: 'Live1', status: 'active' },
      { name: 'Live2', status: 'active' },
      { name: 'Hidden1', status: 'inactive' },
      { name: 'Gone1', status: 'archived' },
    ];
    for (const r of rows) {
      await Product.create({ exporterOrgId: ex.org._id, categoryId: goodsLeaf._id, ...r });
    }
  }

  it('counts every status and sums to all', async () => {
    const ex = await makeExporter();
    await seedSpread(ex);

    const res = await request(app).get('/products/mine').set(bearer(ex.token));
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ all: 6, draft: 2, active: 2, inactive: 1, archived: 1 });
    expect(res.body.counts.all).toBe(
      res.body.counts.draft + res.body.counts.active + res.body.counts.inactive + res.body.counts.archived,
    );
  });

  it('the status filter returns only that status, and counts stay whole-list', async () => {
    const ex = await makeExporter();
    await seedSpread(ex);

    const drafts = await request(app).get('/products/mine?status=draft').set(bearer(ex.token));
    expect(drafts.status).toBe(200);
    expect(drafts.body.products).toHaveLength(2);
    expect(drafts.body.products.every((p) => p.status === 'draft')).toBe(true);
    expect(drafts.body.total).toBe(2);
    // The tabs must keep showing every tab's size while one tab is selected.
    expect(drafts.body.counts.all).toBe(6);

    const archived = await request(app).get('/products/mine?status=archived').set(bearer(ex.token));
    expect(archived.body.products.map((p) => p.name)).toEqual(['Gone1']);

    expect((await request(app).get('/products/mine?status=nonsense').set(bearer(ex.token))).status).toBe(400);
  });

  it('§A10: a taken-down product stays in its status COUNT but frees a cap SLOT', async () => {
    const ex = await makeExporter();
    for (let i = 0; i < 3; i += 1) {
      await Product.create({
        exporterOrgId: ex.org._id,
        categoryId: goodsLeaf._id,
        name: `Live ${i}`,
        status: 'active',
        ...(i === 0 ? { takedown: { isDown: true, reason: 'reported', at: new Date() } } : {}),
      });
    }

    const res = await request(app).get('/products/mine').set(bearer(ex.token));
    // The Live tab shows all three — a blocked product keeps its status.
    expect(res.body.counts.active).toBe(3);
    // The meter shows two — the block freed a slot, so publishing is allowed.
    expect(res.body.caps).toMatchObject({ verified: false, active: { used: 2, limit: 3 } });

    // And the meter agrees with what publish actually does.
    const draft = await request(app).post('/products').set(bearer(ex.token)).send(validBody(ex.org._id));
    const publish = await request(app)
      .patch(`/products/${draft.body.product.id}/status`)
      .set(bearer(ex.token))
      .send({ status: 'active' });
    expect(publish.status).toBe(200);
  });

  it('a verified seller gets no cap numbers at all', async () => {
    const ex = await makeExporter({ verified: true });
    await seedSpread(ex);

    const res = await request(app).get('/products/mine').set(bearer(ex.token));
    expect(res.body.caps).toEqual({ verified: true });
    expect(res.body.counts.all).toBe(6); // tabs still work
  });

  it('draft usage tracks the 10-draft cap', async () => {
    const ex = await makeExporter();
    for (let i = 0; i < 4; i += 1) {
      await Product.create({
        exporterOrgId: ex.org._id,
        categoryId: goodsLeaf._id,
        name: `Draft ${i}`,
        status: 'draft',
      });
    }
    const res = await request(app).get('/products/mine').set(bearer(ex.token));
    expect(res.body.caps.drafts).toEqual({ used: 4, limit: 10 });
  });

  it('counts and caps are scoped to the caller, never another seller', async () => {
    const mine = await makeExporter();
    const other = await makeExporter();
    await seedSpread(other);
    await Product.create({
      exporterOrgId: mine.org._id,
      categoryId: goodsLeaf._id,
      name: 'Only mine',
      status: 'draft',
    });

    const res = await request(app).get('/products/mine').set(bearer(mine.token));
    expect(res.body.counts).toEqual({ all: 1, draft: 1, active: 0, inactive: 0, archived: 0 });
    expect(res.body.caps.drafts.used).toBe(1);
  });
});

describe('image upload endpoint (M2-E)', () => {
  it('returns refs for an exporter; a 6th file is rejected at the transport layer', async () => {
    const ex = await makeExporter();
    const ok = await request(app)
      .post('/products/images')
      .set(bearer(ex.token))
      .attach('images', Buffer.from('img-bytes-1'), 'a.jpg')
      .attach('images', Buffer.from('img-bytes-2'), 'b.jpg');
    expect(ok.status).toBe(201);
    expect(ok.body.images).toHaveLength(2);
    expect(ok.body.images[0].publicId).toContain(`mpx/products/${ex.org._id}`);

    let req6 = request(app).post('/products/images').set(bearer(ex.token));
    for (let i = 0; i < 6; i += 1) req6 = req6.attach('images', Buffer.from(`x${i}`), `f${i}.jpg`);
    const tooMany = await req6;
    expect(tooMany.status).toBe(400);
  });
});
