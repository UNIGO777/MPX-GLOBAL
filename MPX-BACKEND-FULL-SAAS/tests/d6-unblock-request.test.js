import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// The purge deletes Cloudinary images; nothing remote in tests.
vi.mock('../src/services/image.storage.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deletePublicImage: vi.fn(async () => {}),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { Notification } = await import('../src/models/Notification.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');
const { purgeBlockedProducts } = await import('../src/jobs/purgeBlockedProducts.js');

/**
 * D6 · seller "request unblock" (owner, 2026-09-25): the seller only asks,
 * staff approve (= restore) or decline with a reason, a pending request pauses
 * the 180-day purge, a decline starts a 7-day wait, and the seller never learns
 * WHO decided (A9).
 */
const app = createApp();
let seq = 0;
const DAY = 24 * 60 * 60 * 1000;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const flush = () => new Promise((r) => setTimeout(r, 150)); // fire-and-forget notices

async function makeUser({ role, orgId, permissions = [] }) {
  seq += 1;
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `d6_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `93${1000000 + seq}`, e164: `+9193${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId,
    permissions,
  });
  return { user, token: signAccessToken(user) };
}

let leaf;
let sellerOrg;
let otherOrg;
let seller;
let otherSeller;
let admin;

async function takenDown(extra = {}) {
  seq += 1;
  return Product.create({
    exporterOrgId: sellerOrg._id,
    categoryId: leaf._id,
    name: `Roll ${seq}`,
    status: 'active',
    moq: 100,
    unit: 'meter',
    takedown: { isDown: true, reason: 'reported', byUserId: admin.user._id, at: new Date() },
    ...extra,
  });
}

const ask = (p, token = seller.token, message = 'Fixed the photos and the description.') =>
  request(app).post(`/products/${p._id}/unblock-request`).set(bearer(token)).send({ message });

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => mongoose.disconnect());

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Organisation.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Notification.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  sellerOrg = await Organisation.create({ name: 'Seller Co', type: 'business', exporterSide: true, country: 'IN' });
  otherOrg = await Organisation.create({ name: 'Other Co', type: 'business', exporterSide: true, country: 'IN' });
  const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
  seller = await makeUser({ role: 'exporter', orgId: sellerOrg._id });
  otherSeller = await makeUser({ role: 'exporter', orgId: otherOrg._id });
  admin = await makeUser({ role: 'superadmin', orgId: platform._id });
});

describe('D6 · seller asks', () => {
  it('records a pending request, audits it, and shows it to the seller without who took it down', async () => {
    const p = await takenDown();
    const res = await ask(p);
    expect(res.status).toBe(201);
    expect(res.body.product.takedown.unblockRequest).toMatchObject({ status: 'pending', message: 'Fixed the photos and the description.' });
    expect(JSON.stringify(res.body)).not.toContain(String(admin.user._id)); // A9
    expect(await AuditLog.findOne({ action: 'product.unblock_request', entityId: p._id })).toBeTruthy();

    const own = await request(app).get(`/products/${p._id}`).set(bearer(seller.token));
    expect(own.body.product.takedown.unblockRequest.status).toBe('pending');
  });

  it("another seller's product is a 404 (never 403), and a live product can't be asked about", async () => {
    const p = await takenDown();
    expect((await ask(p, otherSeller.token)).status).toBe(404);
    const live = await takenDown({ takedown: { isDown: false } });
    expect((await ask(live)).status).toBe(409);
  });

  it('one pending request per product; a short message is refused', async () => {
    const p = await takenDown();
    expect((await ask(p, seller.token, 'fixed')).status).toBe(400);
    expect((await ask(p)).status).toBe(201);
    expect((await ask(p)).status).toBe(409);
  });

  it('staff cannot ask on the seller\'s behalf (not their company → 404), and a buyer is refused', async () => {
    const p = await takenDown();
    expect((await ask(p, admin.token)).status).toBe(404);
    const buyerOrg = await Organisation.create({ name: 'Buyer Co', type: 'business', buyerSide: true, country: 'IN' });
    const buyer = await makeUser({ role: 'buyer', orgId: buyerOrg._id });
    expect((await ask(p, buyer.token)).status).toBe(403);
    expect(await Product.countDocuments({ 'takedown.appeal.status': 'pending' })).toBe(0);
  });
});

describe('D6 · staff decide', () => {
  it('lists pending requests under status=requests', async () => {
    const p = await takenDown();
    await takenDown(); // blocked, no request
    await ask(p);
    const res = await request(app).get('/admin/products?status=requests').set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.rows.map((r) => String(r.id))).toEqual([String(p._id)]);
    expect(res.body.rows[0].purgePaused).toBe(true);
  });

  it('decline: reason reaches the seller, not who declined; 7-day wait before asking again', async () => {
    const p = await takenDown();
    await ask(p);
    const bad = await request(app).post(`/admin/products/${p._id}/unblock-request/reject`).set(bearer(admin.token)).send({});
    expect(bad.status).toBe(400);
    const res = await request(app)
      .post(`/admin/products/${p._id}/unblock-request/reject`)
      .set(bearer(admin.token))
      .send({ reason: 'Photos still show a brand logo.' });
    expect(res.status).toBe(200);
    expect(await AuditLog.findOne({ action: 'product.unblock_reject', entityId: p._id })).toBeTruthy();

    const own = await request(app).get(`/products/${p._id}`).set(bearer(seller.token));
    const ur = own.body.product.takedown.unblockRequest;
    expect(ur).toMatchObject({ status: 'rejected', rejectReason: 'Photos still show a brand logo.' });
    expect(new Date(ur.canAskAgainAt).getTime()).toBeGreaterThan(Date.now() + 6 * DAY);
    expect(JSON.stringify(own.body)).not.toContain(String(admin.user._id));

    expect((await ask(p)).status).toBe(409); // too soon
    // A week later it is allowed again.
    await Product.updateOne({ _id: p._id }, { $set: { 'takedown.appeal.decidedAt': new Date(Date.now() - 8 * DAY) } });
    expect((await ask(p)).status).toBe(201);
  });

  it('decline with nothing pending is 409; unknown product 404; needs product:takedown', async () => {
    const p = await takenDown();
    const url = `/admin/products/${p._id}/unblock-request/reject`;
    expect((await request(app).post(url).set(bearer(admin.token)).send({ reason: 'no' + 'pe' })).status).toBe(409);
    const ghost = new mongoose.Types.ObjectId();
    expect(
      (await request(app).post(`/admin/products/${ghost}/unblock-request/reject`).set(bearer(admin.token)).send({ reason: 'nope' })).status,
    ).toBe(404);
    const staff = await makeUser({ role: 'employee', orgId: admin.user.orgId, permissions: ['product:read'] });
    await ask(p);
    expect((await request(app).post(url).set(bearer(staff.token)).send({ reason: 'nope' })).status).toBe(403);
    expect((await request(app).post(url).set(bearer(seller.token)).send({ reason: 'nope' })).status).toBe(403);
  });

  it('approve = restore: product back, request cleared, audit marks the approval', async () => {
    const p = await takenDown();
    await ask(p);
    const res = await request(app).post(`/admin/products/${p._id}/restore`).set(bearer(admin.token));
    expect(res.status).toBe(200);
    const stored = await Product.findById(p._id);
    expect(stored.takedown.isDown).toBe(false);
    expect(stored.takedown.appeal?.status).toBeFalsy();
    const log = await AuditLog.findOne({ action: 'product.restore', entityId: p._id }).lean();
    expect(log.after.unblockRequestApproved).toBe(true);
  });
});

describe('D6 · notices (web, both ways)', () => {
  it('request → reviewers; decision → the seller company, and the reviewer notice clears', async () => {
    const p = await takenDown();
    const reviewer = await makeUser({ role: 'employee', orgId: admin.user.orgId, permissions: ['product:read', 'product:takedown'] });
    const bystander = await makeUser({ role: 'employee', orgId: admin.user.orgId, permissions: ['support:read'] });
    await ask(p);
    await flush();
    const note = await Notification.findOne({ userId: reviewer.user._id, type: 'product.unblock_requested' }).lean();
    expect(note).toBeTruthy();
    expect(note.readAt).toBeNull();
    expect(await Notification.countDocuments({ userId: bystander.user._id })).toBe(0);

    await request(app)
      .post(`/admin/products/${p._id}/unblock-request/reject`)
      .set(bearer(admin.token))
      .send({ reason: 'Still infringing.' });
    await flush();
    const toSeller = await Notification.findOne({ userId: seller.user._id, type: 'product.unblock_rejected' }).lean();
    expect(toSeller).toBeTruthy();
    expect(JSON.stringify(toSeller)).not.toContain(admin.user.name); // A9
    expect((await Notification.findOne({ _id: note._id }).lean()).readAt).not.toBeNull();
  });

  it('restoring with a pending request tells the seller it was approved; a plain restore does not', async () => {
    const withReq = await takenDown();
    const plain = await takenDown();
    await ask(withReq);
    await request(app).post(`/admin/products/${withReq._id}/restore`).set(bearer(admin.token));
    await request(app).post(`/admin/products/${plain._id}/restore`).set(bearer(admin.token));
    await flush();
    expect(await Notification.countDocuments({ userId: seller.user._id, type: 'product.unblock_approved' })).toBe(1);
  });
});

describe('D6 · a pending request pauses the 180-day purge', () => {
  it('pending → kept; declined → purged on the next run', async () => {
    const old = new Date(Date.now() - 200 * DAY);
    const p = await takenDown({ takedown: { isDown: true, reason: 'x', byUserId: admin.user._id, at: old } });
    await ask(p);
    expect((await purgeBlockedProducts()).purged).toBe(0);
    expect(await Product.exists({ _id: p._id })).toBeTruthy();

    await request(app).post(`/admin/products/${p._id}/unblock-request/reject`).set(bearer(admin.token)).send({ reason: 'No.' });
    expect((await purgeBlockedProducts()).purged).toBe(1);
  });
});
