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
await import('../src/models/CategoryAttribute.js');
await import('../src/models/Product.js');
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


/**
 * Top-category CREATE (owner-approved 2026-09-23; create only — tops still
 * cannot be renamed or deleted). Names are unique among tops, the public URL is
 * exactly /category/<slugified name>, and a new top starts OFF and cannot be
 * switched on until it has a sub-category.
 */
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
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  await Category.create({ name: 'Textiles', slug: 'textiles', order: 1 });
});

const createTop = (token, body) =>
  request(app).post('/admin/categories/top').set(bearer(token)).send(body);

describe('top category create', () => {
  it('creates it OFF, last in order, with a clean /category/<name> slug — and audits it', async () => {
    const sa = await makeStaff('superadmin');
    const res = await createTop(sa.token, { name: 'Toys & Games', synonyms: ['toys', 'games'] });
    expect(res.status).toBe(201);
    expect(res.body.category).toMatchObject({
      name: 'Toys & Games',
      slug: 'toys-games',
      parentId: null,
      type: null,
      active: false,
      order: 2,
    });
    const audit = await AuditLog.findOne({ action: 'category.create', entityId: res.body.category.id });
    expect(audit?.after?.top).toBe(true);
  });

  it('is invisible to buyers until switched on', async () => {
    const sa = await makeStaff('superadmin');
    await createTop(sa.token, { name: 'Toys' });
    const pub = await request(app).get('/categories/toys');
    expect(pub.status).toBe(404);
    // …and it is not in the public top-category list either (the check that
    // proves the 404 above is "hidden", not "wrong address").
    const tops = await request(app).get('/categories/top').expect(200);
    expect(JSON.stringify(tops.body)).not.toContain('toys');
    expect(JSON.stringify(tops.body)).toContain('textiles');
  });

  it('🔴 names are unique among top categories, case-blind', async () => {
    const sa = await makeStaff('superadmin');
    expect((await createTop(sa.token, { name: 'Toys' })).status).toBe(201);
    expect((await createTop(sa.token, { name: 'toys' })).status).toBe(409);
    expect((await createTop(sa.token, { name: 'TEXTILES' })).status).toBe(409);
  });

  it('refuses a name whose address a sub-category already uses (no silent suffix)', async () => {
    const sa = await makeStaff('superadmin');
    const top = await Category.findOne({ slug: 'textiles' });
    await Category.create({ name: 'Denim', slug: 'denim', parentId: top._id, type: 'goods', order: 1 });
    const res = await createTop(sa.token, { name: 'Denim' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/\/category\/denim/);
  });

  it('cannot be switched on until it has a sub-category — then it can', async () => {
    const sa = await makeStaff('superadmin');
    const created = (await createTop(sa.token, { name: 'Toys' })).body.category;
    const toggle = () =>
      request(app).patch(`/admin/categories/${created.id}/toggle`).set(bearer(sa.token)).send({});

    const early = await toggle();
    expect(early.status).toBe(400);
    expect(early.body.error.message).toMatch(/sub-category/i);

    await request(app)
      .post('/admin/categories')
      .set(bearer(sa.token))
      .send({ parentId: created.id, name: 'Board games', type: 'goods' })
      .expect(201);
    expect((await toggle()).status).toBe(200);
    expect((await Category.findById(created.id)).active).toBe(true);
    expect((await request(app).get('/categories/toys')).status).toBe(200);
  });

  it('needs category:manage — category:read alone is refused; a top takes no type', async () => {
    const reader = await makeStaff('employee', ['category:read']);
    expect((await createTop(reader.token, { name: 'Toys' })).status).toBe(403);
    const manager = await makeStaff('employee', ['category:manage']);
    expect((await createTop(manager.token, { name: 'Toys' })).status).toBe(201);
    const typed = await createTop(manager.token, { name: 'Games', type: 'goods' });
    // Unknown keys are stripped, so a sent `type` never reaches the top.
    expect(typed.body.category?.type ?? null).toBeNull();
  });
});
