/**
 * M5-B — the five gaps found in M4 while reviewing M5.
 *
 * Two are rule violations in shipped code (G1 cursor, G2 unread); three are
 * capabilities M5's screens navigate by and could not (G3, G4, G5).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { Inquiry } from '../src/models/Inquiry.js';
import { Conversation } from '../src/models/Conversation.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { invalidateLeafCache } from '../src/services/category.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let leaf;
let sellerOrg;
let seller;
let buyer;
let sa;
let productA;
let productB;

async function makeUser(role, orgFields = {}, org = null) {
  seq += 1;
  const theOrg = org ?? (await Organisation.create({ name: `${role} Co ${seq}`, type: role === 'superadmin' ? 'platform' : 'business', ...orgFields }));
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `m5b_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `62${2000000 + seq}`, e164: `+9162${2000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: theOrg._id,
  });
  return { org: theOrg, user, token: signAccessToken(user) };
}

async function makeProduct(name) {
  return Product.create({
    exporterOrgId: sellerOrg._id, categoryId: leaf._id, name, status: 'active',
    price: { mode: 'fixed', min: 300, currency: 'INR' },
  });
}

async function openThread(asBuyer, product) {
  const res = await request(app).post('/inquiries').set(bearer(asBuyer.token))
    .send({ productId: String(product._id), note: 'Please share your best price.' });
  expect([200, 201]).toContain(res.status);
  return res.body.conversationId;
}

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });

  const s = await makeUser('exporter', { exporterSide: true, country: 'IN' });
  seller = s; sellerOrg = s.org;
  buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
  sa = await makeUser('superadmin');

  productA = await makeProduct('Cotton Roll A');
  productB = await makeProduct('Cotton Roll B');
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), Inquiry.deleteMany({}), Conversation.deleteMany({}),
    mongoose.connection.db.collection('messages').deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('G1 · the admin conversation list is CURSOR paginated (m5-rules §9)', () => {
  it('pages without repeating or skipping, even when every row shares a timestamp', async () => {
    const ids = [];
    for (let i = 0; i < 5; i += 1) {
      const b = await makeUser('buyer', { buyerSide: true });
      ids.push(await openThread(b, productA));
    }
    // Force identical lastMessageAt so ONLY the _id tiebreaker separates them —
    // this is the case page numbers get wrong.
    await Conversation.updateMany({}, { $set: { lastMessageAt: new Date() } });

    const seen = [];
    let cursor;
    for (let page = 0; page < 5; page += 1) {
      const res = await request(app).get('/admin/conversations')
        .query({ limit: 2, ...(cursor ? { cursor } : {}) }).set(bearer(sa.token));
      expect(res.status).toBe(200);
      seen.push(...res.body.conversations.map((c) => c.id));
      cursor = res.body.nextCursor;
      if (!cursor) break;
    }

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect(seen.sort()).toEqual(ids.sort());
  });

  it('returns nextCursor while more remain and null at the end', async () => {
    for (let i = 0; i < 3; i += 1) {
      const b = await makeUser('buyer', { buyerSide: true });
      await openThread(b, productA);
    }
    const first = await request(app).get('/admin/conversations').query({ limit: 2 }).set(bearer(sa.token));
    expect(first.body.nextCursor).toBeTruthy();

    const last = await request(app).get('/admin/conversations')
      .query({ limit: 2, cursor: first.body.nextCursor }).set(bearer(sa.token));
    expect(last.body.nextCursor).toBeNull();
  });

  it('a forged cursor is a clean 400, and limit is capped', async () => {
    expect((await request(app).get('/admin/conversations')
      .query({ cursor: 'not-a-cursor' }).set(bearer(sa.token))).status).toBe(400);
    expect((await request(app).get('/admin/conversations')
      .query({ limit: 9999 }).set(bearer(sa.token))).status).toBe(400);
  });
});

describe('G2 · the staff view carries the PARTIES\' unread (m5-features #10)', () => {
  it('reports each side separately — and reading as admin changes neither', async () => {
    const id = await openThread(buyer, productA);

    const before = await request(app).get('/admin/conversations').set(bearer(sa.token));
    const row = before.body.conversations[0];
    // The buyer wrote the enquiry, so it is read for them and unread for the seller.
    expect(row.unread).toEqual({ buyer: false, exporter: true });

    // Admin has no read-tracking of its own; opening the thread must not clear it.
    await request(app).get(`/admin/conversations/${id}`).set(bearer(sa.token));
    await request(app).get(`/admin/conversations/${id}/messages`).set(bearer(sa.token));

    const after = await request(app).get('/admin/conversations').set(bearer(sa.token));
    expect(after.body.conversations[0].unread).toEqual({ buyer: false, exporter: true });

    const stored = await Conversation.findById(id);
    expect(stored.exporterLastReadAt).toBeUndefined();
  });

  it('flips once the seller actually reads it', async () => {
    const id = await openThread(buyer, productA);

    // Push the message into the past before reading. `unread` is
    // `lastMessageAt > lastReadAt`, a strict comparison by design so a reader
    // level with the last message counts as caught up — but that makes the
    // assertion sensitive to both landing in the same millisecond. The rule is
    // right; the timing is the test's problem to remove.
    await Conversation.updateOne({ _id: id }, { $set: { lastMessageAt: new Date(Date.now() - 60_000) } });

    await request(app).post(`/conversations/${id}/read`).set(bearer(seller.token));

    const res = await request(app).get('/admin/conversations').set(bearer(sa.token));
    expect(res.body.conversations[0].unread).toEqual({ buyer: false, exporter: false });
  });

  it('a party still never sees the staff-only fields alongside it', async () => {
    const id = await openThread(buyer, productA);
    const res = await request(app).get(`/conversations/${id}`).set(bearer(buyer.token));
    const blob = JSON.stringify(res.body);
    for (const staffOnly of ['blockedBy', 'frozenReason', 'buyerOrgId', 'exporterOrgId']) {
      expect(blob).not.toContain(staffOnly);
    }
  });
});

describe('G3 · filter admin conversations by PRODUCT (§4 "view that product\'s chats")', () => {
  it('returns only that product\'s threads', async () => {
    const b2 = await makeUser('buyer', { buyerSide: true });
    const onA = await openThread(buyer, productA);
    await openThread(b2, productB);

    const res = await request(app).get('/admin/conversations')
      .query({ productId: String(productA._id) }).set(bearer(sa.token));

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].id).toBe(onA);
  });

  it('a product with no threads returns an empty page, not an error', async () => {
    const lonely = await makeProduct('Unloved Roll');
    const res = await request(app).get('/admin/conversations')
      .query({ productId: String(lonely._id) }).set(bearer(sa.token));
    expect(res.status).toBe(200);
    expect(res.body.conversations).toEqual([]);
  });

  it('a malformed productId is a 400', async () => {
    expect((await request(app).get('/admin/conversations')
      .query({ productId: 'nope' }).set(bearer(sa.token))).status).toBe(400);
  });
});

describe('G4 · split a BOTH-SIDES company into two clean lists (§7)', () => {
  it('side=buyer and side=exporter return different threads for the same org', async () => {
    // sellerOrg also buys — the A21 case §7 is written for.
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { buyerSide: true } });
    seq += 1;
    const dualBuyer = await User.create({
      name: 'dual-buyer',
      email: `dual_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `63${2000000 + seq}`, e164: `+9163${2000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'buyer',
      orgId: sellerOrg._id,
    });

    // Someone else's product, so the dual org is the BUYER here (F4 forbids
    // enquiring on your own).
    const otherSellerOrg = await Organisation.create({
      name: 'Other Seller', type: 'business', exporterSide: true, country: 'IN',
    });
    const otherProduct = await Product.create({
      exporterOrgId: otherSellerOrg._id, categoryId: leaf._id, name: 'Silk Roll',
      status: 'active', price: { mode: 'on_request' },
    });

    const asExporter = await openThread(buyer, productA);              // dual org SELLS
    const asBuyer = await openThread({ token: signAccessToken(dualBuyer) }, otherProduct); // dual org BUYS

    const exporterSide = await request(app).get('/admin/conversations')
      .query({ orgId: String(sellerOrg._id), side: 'exporter' }).set(bearer(sa.token));
    const buyerSide = await request(app).get('/admin/conversations')
      .query({ orgId: String(sellerOrg._id), side: 'buyer' }).set(bearer(sa.token));

    expect(exporterSide.body.conversations.map((c) => c.id)).toEqual([asExporter]);
    expect(buyerSide.body.conversations.map((c) => c.id)).toEqual([asBuyer]);

    // Without a side it is both — the same reach as pasting the id into `q`.
    const both = await request(app).get('/admin/conversations')
      .query({ orgId: String(sellerOrg._id) }).set(bearer(sa.token));
    expect(both.body.conversations).toHaveLength(2);
  });

  it('side without orgId is rejected rather than silently ignored', async () => {
    const res = await request(app).get('/admin/conversations')
      .query({ side: 'buyer' }).set(bearer(sa.token));
    expect(res.status).toBe(400);
  });
});

describe('G5 · monitoring names WHO took a product down — staff only (§A9)', () => {
  it('shows the acting admin\'s name to staff', async () => {
    await request(app).post(`/admin/products/${productA._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });

    const res = await request(app).get('/admin/products').query({ status: 'blocked' }).set(bearer(sa.token));
    const row = res.body.rows.find((p) => p.id === String(productA._id));

    expect(row.takedown.byName).toBe(sa.user.name);
    expect(row.takedown.reason).toBe('counterfeit listing');
    expect(row.purgeAt).toBeTruthy();
  });

  it('🔴 the SELLER still never sees the actor — neither id nor name (§A9 regression)', async () => {
    await request(app).post(`/admin/products/${productA._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });

    const mine = await request(app).get('/products/mine').set(bearer(seller.token));
    const row = mine.body.products.find((p) => p.id === String(productA._id));

    expect(row.takedown.reason).toBe('counterfeit listing'); // the reason, yes
    const blob = JSON.stringify(mine.body);
    expect(blob).not.toContain('byUserId');
    expect(blob).not.toContain('byName');
    expect(blob).not.toContain(sa.user.name);
    expect(blob).not.toContain(String(sa.user._id));
  });

  it('a live product carries no actor at all, and the lookup is skipped', async () => {
    const res = await request(app).get('/admin/products').set(bearer(sa.token));
    for (const row of res.body.rows) {
      expect(row.takedown?.byName).toBeUndefined();
    }
  });
});
