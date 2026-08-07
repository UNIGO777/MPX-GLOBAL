import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Mock ONLY the Cloudinary-backed image storage (no network in tests).
vi.mock('../src/services/image.storage.service.js', async (importOriginal) => ({
  // Keep the REAL isOwnCloudinaryUrl — it is a pure check with no network,
  // and mocking it away would hide the ref-forgery guard it exists to enforce.
  ...(await importOriginal()),
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(async ({ folder }) => ({
    url: `https://res.cloudinary.com/fake/${folder}/img.jpg`,
    publicId: `${folder}/fakeimg`,
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

async function makeStaff(role, permissions = []) {
  seq += 1;
  const org = await Organisation.create({ name: 'Platform', type: 'platform' });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `staff_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `97${1000000 + seq}`, e164: `+9197${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { user, token: signAccessToken(user) };
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

// Small deterministic tree for the endpoint tests (the full seed is covered in
// m2-seed.test.js): one top with two subs, one deliberately-off sub, plus a
// second inactive top.
async function makeTree() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles', order: 1 });
  const subA = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods', order: 1 });
  const subB = await Category.create({ name: 'Silk fabric', parentId: top._id, type: 'goods', order: 2 });
  const offSub = await Category.create({
    name: 'Denim',
    parentId: top._id,
    type: 'goods',
    order: 3,
    active: false,
  });
  const offTop = await Category.create({ name: 'Paper', slug: 'paper', order: 2, active: false });
  await CategoryAttribute.create({
    categoryId: subA._id,
    name: 'GSM',
    key: 'gsm',
    inputType: 'number',
    unit: 'gsm',
    filterable: true,
    order: 1,
  });
  return { top, subA, subB, offSub, offTop };
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
  invalidateLeafCache();
});

describe('public category reads (M2-D)', () => {
  it('tree/tops/subs show ONLY active rows, sorted, with the public whitelist shape', async () => {
    const { subA } = await makeTree();

    const tree = await request(app).get('/categories');
    expect(tree.status).toBe(200);
    expect(tree.body.categories).toHaveLength(1); // inactive top hidden
    const textiles = tree.body.categories[0];
    expect(textiles.subs.map((s) => s.slug)).toEqual(['cotton-fabric', 'silk-fabric']); // off sub hidden
    // Whitelist shape: no order/active/synonyms/prevActive.
    expect(Object.keys(textiles).sort()).toEqual(['id', 'image', 'name', 'parentId', 'slug', 'subs', 'type']);
    expect(textiles.type).toBeNull(); // tops carry no type (A16)

    const tops = await request(app).get('/categories/top');
    expect(tops.body.categories.map((c) => c.slug)).toEqual(['textiles']);

    const subs = await request(app).get(`/categories/${textiles.id}/subcategories`);
    expect(subs.body.categories.map((c) => c.slug)).toEqual(['cotton-fabric', 'silk-fabric']);

    const single = await request(app).get('/categories/cotton-fabric'); // by slug
    expect(single.status).toBe(200);
    expect(single.body.category.id).toBe(String(subA._id));
    const byId = await request(app).get(`/categories/${subA._id}`); // by id
    expect(byId.status).toBe(200);
  });

  it('an inactive category 404s publicly; an inactive parent returns empty subs', async () => {
    const { offSub, offTop } = await makeTree();
    expect((await request(app).get(`/categories/${offSub._id}`)).status).toBe(404);
    expect((await request(app).get('/categories/paper')).status).toBe(404);
    const subs = await request(app).get(`/categories/${offTop._id}/subcategories`);
    expect(subs.status).toBe(200);
    expect(subs.body.categories).toEqual([]);
  });

  it('attributes endpoint returns the dynamic-form shape (no order field, sorted)', async () => {
    await makeTree();
    const res = await request(app).get('/categories/cotton-fabric/attributes');
    expect(res.status).toBe(200);
    expect(res.body.attributes).toHaveLength(1);
    expect(res.body.attributes[0]).toEqual({
      key: 'gsm',
      name: 'GSM',
      inputType: 'number',
      options: [],
      unit: 'gsm',
      required: false,
      filterable: true,
    });
  });
});

describe('admin category endpoints (M2-D)', () => {
  it('GET /admin/categories needs category:read and INCLUDES inactive rows', async () => {
    await makeTree();
    const noPerm = await makeStaff('employee');
    expect((await request(app).get('/admin/categories').set(bearer(noPerm.token))).status).toBe(403);

    const reader = await makeStaff('employee', ['category:read']);
    const res = await request(app).get('/admin/categories').set(bearer(reader.token));
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(2); // inactive top visible to admin
    const textiles = res.body.categories.find((c) => c.slug === 'textiles');
    expect(textiles.subs).toHaveLength(3); // off sub visible too
    expect(textiles.subs.find((s) => s.slug === 'cotton-fabric').attributeCount).toBe(1);
  });

  it('A4 cascade: top off snapshots subs; reactivate restores, deliberately-off sub stays off', async () => {
    const { top, subA, subB, offSub } = await makeTree();
    const sa = await makeStaff('superadmin');

    const off = await request(app).patch(`/admin/categories/${top._id}/toggle`).set(bearer(sa.token));
    expect(off.status).toBe(200);
    expect((await Category.findById(subA._id)).active).toBe(false);
    expect((await Category.findById(subA._id)).prevActive).toBe(true);
    expect((await Category.findById(offSub._id)).prevActive).toBe(false);

    const on = await request(app).patch(`/admin/categories/${top._id}/toggle`).set(bearer(sa.token));
    expect(on.status).toBe(200);
    expect((await Category.findById(subA._id)).active).toBe(true);
    expect((await Category.findById(subB._id)).active).toBe(true);
    expect((await Category.findById(offSub._id)).active).toBe(false); // stayed off
    expect((await Category.findById(subA._id)).prevActive).toBeUndefined(); // markers cleared
  });

  it('cascade-intent: deactivating a sub DURING a top-off period records prevActive=false', async () => {
    const { top, subA } = await makeTree();
    const sa = await makeStaff('superadmin');

    await request(app).patch(`/admin/categories/${top._id}/toggle`).set(bearer(sa.token)); // top off
    const intent = await request(app).patch(`/admin/categories/${subA._id}/toggle`).set(bearer(sa.token));
    expect(intent.status).toBe(200);

    await request(app).patch(`/admin/categories/${top._id}/toggle`).set(bearer(sa.token)); // top back on
    expect((await Category.findById(subA._id)).active).toBe(false); // intent survived the restore
  });

  it('toggling a sub under an inactive top edits the RESTORE INTENT, both ways (review fix)', async () => {
    const { offTop, subA } = await makeTree();
    const sa = await makeStaff('superadmin');

    // A sub that WOULD come back when the top is reactivated.
    const sub = await Category.create({
      name: 'Kraft',
      parentId: offTop._id,
      type: 'goods',
      active: false,
      prevActive: true,
    });

    // Toggle once → "stay off when the top returns".
    const off = await request(app).patch(`/admin/categories/${sub._id}/toggle`).set(bearer(sa.token));
    expect(off.status).toBe(200);
    expect((await Category.findById(sub._id)).prevActive).toBe(false);
    expect((await Category.findById(sub._id)).active).toBe(false); // still hidden — the top is off

    // Toggle again → the admin can UNDO it. This used to 409, making the
    // decision a one-way door until the top was reactivated.
    const back = await request(app).patch(`/admin/categories/${sub._id}/toggle`).set(bearer(sa.token));
    expect(back.status).toBe(200);
    expect((await Category.findById(sub._id)).prevActive).toBe(true);

    // Reactivating the top now honours that intent.
    await request(app).patch(`/admin/categories/${offTop._id}/toggle`).set(bearer(sa.token));
    expect((await Category.findById(sub._id)).active).toBe(true);

    const nested = await request(app)
      .post('/admin/categories')
      .set(bearer(sa.token))
      .send({ parentId: String(subA._id), name: 'Level 3', type: 'goods' });
    expect(nested.status).toBe(400); // depth stays 2
  });

  it('create/update/delete sub: type locks with products, delete blocks in use, audits written', async () => {
    const { top, subA } = await makeTree();
    const sa = await makeStaff('superadmin');

    const created = await request(app)
      .post('/admin/categories')
      .set(bearer(sa.token))
      .send({ parentId: String(top._id), name: 'Yarn & thread', type: 'goods', synonyms: ['thread'] });
    expect(created.status).toBe(201);
    expect(created.body.category.slug).toBe('yarn-thread');

    // type change is free without products…
    const flip = await request(app)
      .patch(`/admin/categories/${created.body.category.id}`)
      .set(bearer(sa.token))
      .send({ type: 'service' });
    expect(flip.status).toBe(200);

    // …but locked once a product exists.
    await Product.create({ exporterOrgId: new mongoose.Types.ObjectId(), categoryId: subA._id, name: 'Roll' });
    const locked = await request(app)
      .patch(`/admin/categories/${subA._id}`)
      .set(bearer(sa.token))
      .send({ type: 'service' });
    expect(locked.status).toBe(409);

    // delete blocked while products exist; then allowed once empty.
    expect((await request(app).delete(`/admin/categories/${subA._id}`).set(bearer(sa.token))).status).toBe(409);
    await Product.deleteMany({});
    expect((await request(app).delete(`/admin/categories/${subA._id}`).set(bearer(sa.token))).status).toBe(200);
    expect(await Category.findById(subA._id)).toBeNull();
    expect(await CategoryAttribute.countDocuments({ categoryId: subA._id })).toBe(0);

    const audits = await AuditLog.find({}).select('action');
    const actions = audits.map((a) => a.action);
    expect(actions).toContain('category.create');
    expect(actions).toContain('category.update');
    expect(actions).toContain('category.delete');
  });

  it('top PATCH allows name/order/synonyms but never a type; slug immutable by omission', async () => {
    const { top } = await makeTree();
    const sa = await makeStaff('superadmin');

    const ok = await request(app)
      .patch(`/admin/categories/${top._id}`)
      .set(bearer(sa.token))
      .send({ synonyms: ['kapda', 'cloth'], order: 5 });
    expect(ok.status).toBe(200);
    expect(ok.body.category.synonyms).toEqual(['kapda', 'cloth']);

    const bad = await request(app)
      .patch(`/admin/categories/${top._id}`)
      .set(bearer(sa.token))
      .send({ type: 'goods' });
    expect(bad.status).toBe(400); // A16 — tops carry no type
  });

  it('attribute CRUD: key+inputType immutable (stripped), select needs options, dup key 409', async () => {
    const { subA } = await makeTree();
    const sa = await makeStaff('superadmin');
    const base = `/admin/categories/${subA._id}/attributes`;

    const dup = await request(app)
      .post(base)
      .set(bearer(sa.token))
      .send({ name: 'GSM 2', key: 'gsm', inputType: 'number' });
    expect(dup.status).toBe(409);

    const sel = await request(app)
      .post(base)
      .set(bearer(sa.token))
      .send({ name: 'Material', key: 'material', inputType: 'select' });
    expect(sel.status).toBe(400); // select without options

    const created = await request(app)
      .post(base)
      .set(bearer(sa.token))
      .send({ name: 'Material', key: 'material', inputType: 'select', options: ['Cotton', 'Silk'] });
    expect(created.status).toBe(201);

    // key/inputType are not accepted on PATCH (unknown keys stripped → only name applies).
    const patched = await request(app)
      .patch(`${base}/${created.body.attribute.id}`)
      .set(bearer(sa.token))
      .send({ name: 'Material type', key: 'material2', inputType: 'text' });
    expect(patched.status).toBe(200);
    const stored = await CategoryAttribute.findById(created.body.attribute.id);
    expect(stored.key).toBe('material');
    expect(stored.inputType).toBe('select');
    expect(stored.name).toBe('Material type');

    const del = await request(app).delete(`${base}/${created.body.attribute.id}`).set(bearer(sa.token));
    expect(del.status).toBe(200);
  });

  it('image upload works on a TOP too (A20) and audits', async () => {
    const { top } = await makeTree();
    const sa = await makeStaff('superadmin');
    const res = await request(app)
      .post(`/admin/categories/${top._id}/image`)
      .set(bearer(sa.token))
      .attach('image', Buffer.from('fake-image-bytes'), 'card.jpg');
    expect(res.status).toBe(200);
    expect(res.body.category.image).toContain('mpx/categories');
    expect(await AuditLog.findOne({ action: 'category.image.upload' })).toBeTruthy();
  });

  it('employee granted category:manage can write; category:read alone cannot', async () => {
    const { top } = await makeTree();
    const reader = await makeStaff('employee', ['category:read']);
    const manager = await makeStaff('employee', ['category:manage']);

    const denied = await request(app)
      .post('/admin/categories')
      .set(bearer(reader.token))
      .send({ parentId: String(top._id), name: 'Denied', type: 'goods' });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .post('/admin/categories')
      .set(bearer(manager.token))
      .send({ parentId: String(top._id), name: 'Allowed', type: 'goods' });
    expect(ok.status).toBe(201);
  });
});

// The attribute manager's read (web screen 9). It exists BECAUSE the public
// attribute route cannot serve that screen: it hides inactive categories and
// omits the attribute id the edit/delete routes need.
describe('admin attribute read (GET /admin/categories/:id/attributes)', () => {
  it('returns id + order, which the public route deliberately does not', async () => {
    const { subA } = await makeTree();
    const reader = await makeStaff('employee', ['category:read']);

    const admin = await request(app)
      .get(`/admin/categories/${subA._id}/attributes`)
      .set(bearer(reader.token));
    expect(admin.status).toBe(200);
    expect(admin.body.attributes).toHaveLength(1);
    expect(admin.body.attributes[0]).toMatchObject({ key: 'gsm', inputType: 'number', order: 1 });
    expect(admin.body.attributes[0].id).toBeTruthy();

    // The public shape must NOT have grown an internal id (m3-public-projection).
    const publicRead = await request(app).get(`/categories/${subA._id}/attributes`);
    expect(publicRead.status).toBe(200);
    expect(publicRead.body.attributes[0].id).toBeUndefined();
    expect(publicRead.body.attributes[0].order).toBeUndefined();
  });

  it('serves an INACTIVE sub and a sub under a cascade-off top — the public route 404s both', async () => {
    const { offSub, offTop } = await makeTree();
    const sa = await makeStaff('superadmin');
    const hiddenSub = await Category.create({
      name: 'Newsprint',
      parentId: offTop._id,
      type: 'goods',
      order: 1,
    });
    await CategoryAttribute.create({
      categoryId: offSub._id,
      name: 'Weight',
      key: 'weight',
      inputType: 'number',
      order: 1,
    });

    for (const id of [offSub._id, hiddenSub._id]) {
      expect((await request(app).get(`/admin/categories/${id}/attributes`).set(bearer(sa.token))).status).toBe(200);
      expect((await request(app).get(`/categories/${id}/attributes`)).status).toBe(404);
    }
  });

  it('refuses a TOP category — §A16 puts fields on the leaf only', async () => {
    const { top } = await makeTree();
    const sa = await makeStaff('superadmin');
    const res = await request(app).get(`/admin/categories/${top._id}/attributes`).set(bearer(sa.token));
    expect(res.status).toBe(400);
  });

  it('needs category:read', async () => {
    const { subA } = await makeTree();
    const noPerm = await makeStaff('employee');
    const res = await request(app).get(`/admin/categories/${subA._id}/attributes`).set(bearer(noPerm.token));
    expect(res.status).toBe(403);
  });

  it('the returned id is what PATCH/DELETE :attrId accept — the round trip screen 9 makes', async () => {
    const { subA } = await makeTree();
    const sa = await makeStaff('superadmin');

    const listed = await request(app).get(`/admin/categories/${subA._id}/attributes`).set(bearer(sa.token));
    const { id } = listed.body.attributes[0];

    const patched = await request(app)
      .patch(`/admin/categories/${subA._id}/attributes/${id}`)
      .set(bearer(sa.token))
      .send({ name: 'Fabric GSM' });
    expect(patched.status).toBe(200);
    expect(patched.body.attribute.name).toBe('Fabric GSM');

    const deleted = await request(app)
      .delete(`/admin/categories/${subA._id}/attributes/${id}`)
      .set(bearer(sa.token));
    expect(deleted.status).toBe(200);
    expect(await CategoryAttribute.countDocuments({ _id: id })).toBe(0);
  });
});
