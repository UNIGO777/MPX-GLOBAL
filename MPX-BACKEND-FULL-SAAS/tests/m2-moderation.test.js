import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { invalidateLeafCache } from '../src/services/category.service.js';

const app = createApp();
let seq = 0;

async function makeStaff(role, permissions = []) {
  seq += 1;
  const org = await Organisation.create({ name: 'Platform', type: 'platform' });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `mod_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `94${1000000 + seq}`, e164: `+9194${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { user, token: signAccessToken(user) };
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

let leaf;
let sellerOrg;

async function seedBasics() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  sellerOrg = await Organisation.create({
    name: 'Seller Co',
    type: 'business',
    exporterSide: true,
    country: 'IN',
  });
}

function productDoc(extra = {}) {
  seq += 1;
  return {
    exporterOrgId: sellerOrg._id,
    categoryId: leaf._id,
    name: `Roll ${seq}`,
    status: 'active',
    // goods need both to survive an API publish (2026-08-17 rule)
    moq: 100,
    unit: 'meter',
    ...extra,
  };
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
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  await seedBasics();
});

describe('takedown / restore (M2-G)', () => {
  it('takedown leaves status untouched, sets the object, increments takedownCount, audits', async () => {
    const sa = await makeStaff('superadmin');
    const p = await Product.create(productDoc({ status: 'inactive' })); // seller had hidden it

    const noReason = await request(app).post(`/admin/products/${p._id}/takedown`).set(bearer(sa.token)).send({});
    expect(noReason.status).toBe(400); // reason required

    const res = await request(app)
      .post(`/admin/products/${p._id}/takedown`)
      .set(bearer(sa.token))
      .send({ reason: 'counterfeit listing' });
    expect(res.status).toBe(200);

    const stored = await Product.findById(p._id);
    expect(stored.status).toBe('inactive'); // m5-rules §2 — status untouched
    expect(stored.takedown.isDown).toBe(true);
    expect(String(stored.takedown.byUserId)).toBe(String(sa.user._id));
    expect((await Organisation.findById(sellerOrg._id)).takedownCount).toBe(1);
    expect(await AuditLog.findOne({ action: 'product.takedown' })).toBeTruthy();

    // double takedown → 409
    expect(
      (await request(app).post(`/admin/products/${p._id}/takedown`).set(bearer(sa.token)).send({ reason: 'again' }))
        .status,
    ).toBe(409);
  });

  it('restore returns the product to the state the seller left; counter NOT decremented', async () => {
    const sa = await makeStaff('superadmin');
    const p = await Product.create(productDoc({ status: 'active' }));
    await request(app).post(`/admin/products/${p._id}/takedown`).set(bearer(sa.token)).send({ reason: 'reported' });

    const res = await request(app).post(`/admin/products/${p._id}/restore`).set(bearer(sa.token));
    expect(res.status).toBe(200);

    const stored = await Product.findById(p._id);
    expect(stored.status).toBe('active'); // exactly as frozen
    expect(stored.takedown.isDown).toBe(false);
    expect(stored.takedown.reason).toBeUndefined();
    expect((await Organisation.findById(sellerOrg._id)).takedownCount).toBe(1); // §A24 increment-only
    expect(await AuditLog.findOne({ action: 'product.restore' })).toBeTruthy();

    // restoring a not-down product → 409
    expect((await request(app).post(`/admin/products/${p._id}/restore`).set(bearer(sa.token))).status).toBe(409);
  });

  it('a DRAFT cannot be taken down (409) — it was never public and would be stranded', async () => {
    const sa = await makeStaff('superadmin');
    const draft = await Product.create(productDoc({ status: 'draft' }));

    const res = await request(app)
      .post(`/admin/products/${draft._id}/takedown`)
      .set(bearer(sa.token))
      .send({ reason: 'reported by mistake' });
    expect(res.status).toBe(409);

    // Nothing was recorded against the seller for content no buyer ever saw.
    expect((await Organisation.findById(sellerOrg._id)).takedownCount).toBe(0);
    // …and the draft is still fully usable by its owner.
    expect((await Product.findById(draft._id)).takedown.isDown).toBe(false);
  });

  it('A7 guard: an ARCHIVED product cannot be taken down (409) — it must never become purgeable', async () => {
    const sa = await makeStaff('superadmin');
    const p = await Product.create(productDoc({ status: 'archived' }));
    const res = await request(app)
      .post(`/admin/products/${p._id}/takedown`)
      .set(bearer(sa.token))
      .send({ reason: 'late report' });
    expect(res.status).toBe(409);
  });

  it('§A25 gates: product:takedown is grantable; product:read alone cannot act; unknown id 404', async () => {
    const reader = await makeStaff('employee', ['product:read']);
    const moderator = await makeStaff('employee', ['product:takedown']);
    const p = await Product.create(productDoc());

    expect(
      (await request(app).post(`/admin/products/${p._id}/takedown`).set(bearer(reader.token)).send({ reason: 'x-y-z' }))
        .status,
    ).toBe(403);
    expect(
      (await request(app).post(`/admin/products/${p._id}/takedown`).set(bearer(moderator.token)).send({ reason: 'spam listing' }))
        .status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/admin/products/${new mongoose.Types.ObjectId()}/takedown`)
          .set(bearer(moderator.token))
          .send({ reason: 'x-y-z' })
      ).status,
    ).toBe(404);
  });

  it('takedown frees a D1 cap slot for the seller (A10 — end to end through the cap query)', async () => {
    const sa = await makeStaff('superadmin');
    seq += 1;
    const sellerUser = await User.create({
      name: 'seller',
      email: `cap_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `93${1000000 + seq}`, e164: `+9193${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'exporter',
      orgId: sellerOrg._id,
    });
    const sellerToken = signAccessToken(sellerUser);

    const live = [];
    for (let i = 0; i < 3; i += 1) live.push(await Product.create(productDoc()));
    const draft = await Product.create(productDoc({ status: 'draft' }));

    const blocked = await request(app)
      .patch(`/products/${draft._id}/status`)
      .set(bearer(sellerToken))
      .send({ status: 'active' });
    expect(blocked.status).toBe(409); // cap full

    await request(app).post(`/admin/products/${live[0]._id}/takedown`).set(bearer(sa.token)).send({ reason: 'reported' });

    const freed = await request(app)
      .patch(`/products/${draft._id}/status`)
      .set(bearer(sellerToken))
      .send({ status: 'active' });
    expect(freed.status).toBe(200); // a block frees a slot
  });
});

describe('monitoring list (M2-G)', () => {
  it('never shows drafts/archived; Blocked reads takedown.isDown (an inactive product is not blocked)', async () => {
    const reader = await makeStaff('employee', ['product:read']);
    await Product.create(productDoc({ status: 'active' }));
    const hidden = await Product.create(productDoc({ status: 'inactive' }));
    await Product.create(productDoc({ status: 'draft' }));
    await Product.create(productDoc({ status: 'archived' }));
    const down = await Product.create(
      productDoc({ status: 'active', takedown: { isDown: true, reason: 'x', byUserId: reader.user._id, at: new Date() } }),
    );

    const all = await request(app).get('/admin/products').set(bearer(reader.token));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3); // active + inactive + blocked — no draft/archived

    const blocked = await request(app).get('/admin/products').query({ status: 'blocked' }).set(bearer(reader.token));
    expect(blocked.body.total).toBe(1);
    expect(blocked.body.rows[0].id).toBe(String(down._id));
    expect(blocked.body.rows[0].takedown.byUserId).toBeTruthy(); // staff view MAY show the actor
    expect(blocked.body.rows[0].purgeAt).toBeTruthy(); // load-bearing countdown
    expect(blocked.body.rows[0].seller.takedownCount).toBe(0); // direct insert — counter untouched

    const inactive = await request(app).get('/admin/products').query({ status: 'inactive' }).set(bearer(reader.token));
    expect(inactive.body.total).toBe(1);
    expect(inactive.body.rows[0].id).toBe(String(hidden._id));
  });

  it('filters by seller and by name prefix (escaped); requires product:read', async () => {
    const reader = await makeStaff('employee', ['product:read']);
    const noPerm = await makeStaff('employee');
    await Product.create(productDoc({ name: 'Alpha Roll' }));
    await Product.create(productDoc({ name: 'Beta Roll' }));

    expect((await request(app).get('/admin/products').set(bearer(noPerm.token))).status).toBe(403);

    const byName = await request(app).get('/admin/products').query({ q: 'Alpha' }).set(bearer(reader.token));
    expect(byName.body.total).toBe(1);

    const regex = await request(app).get('/admin/products').query({ q: '.*' }).set(bearer(reader.token));
    expect(regex.body.total).toBe(0); // escaped, matches nothing

    const bySeller = await request(app)
      .get('/admin/products')
      .query({ seller: String(sellerOrg._id) })
      .set(bearer(reader.token));
    expect(bySeller.body.total).toBe(2);
  });
});
