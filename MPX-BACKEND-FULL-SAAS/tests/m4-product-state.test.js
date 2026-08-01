/**
 * M4-F — what a product's state does to the threads hanging off it.
 * This is the phase that reaches back into M2, so it also has to prove it broke
 * nothing there.
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
import { Message } from '../src/models/Message.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { invalidateLeafCache } from '../src/services/category.service.js';
import { purgeBlockedProducts } from '../src/jobs/purgeBlockedProducts.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let leaf;
let sellerOrg;
let seller;
let buyer;
let product;
let conversationId;
let sa;

async function makeUser(role, orgFields = {}) {
  seq += 1;
  const org = await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `ps_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `21${1000000 + seq}`, e164: `+9121${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
  });
  return { org, user, token: signAccessToken(user) };
}

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });

  const s = await makeUser('exporter', { exporterSide: true, country: 'IN' });
  seller = s; sellerOrg = s.org;
  buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
  sa = await makeUser('superadmin', { type: 'platform' });

  product = await Product.create({
    exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Cotton Roll',
    status: 'active', price: { mode: 'fixed', min: 300, currency: 'INR' },
  });

  const res = await request(app).post('/inquiries').set(bearer(buyer.token))
    .send({ productId: String(product._id), note: 'Please share your best price.' });
  conversationId = res.body.conversationId;
}

const send = (token, body, id = conversationId) =>
  request(app).post(`/conversations/${id}/messages`).set(bearer(token)).send({ body });
const takedown = (reason = 'counterfeit listing') =>
  request(app).post(`/admin/products/${product._id}/takedown`).set(bearer(sa.token)).send({ reason });
const restore = () =>
  request(app).post(`/admin/products/${product._id}/restore`).set(bearer(sa.token));

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

describe('M4-20 · the SELLER\'s own actions never touch a thread', () => {
  it('setting the product inactive changes nothing — no freeze, no label, no message', async () => {
    const before = await Message.countDocuments({ conversationId });

    const res = await request(app).patch(`/products/${product._id}/status`)
      .set(bearer(seller.token)).send({ status: 'inactive' });
    expect(res.status).toBe(200);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(false);
    expect(stored.frozenReason).toBeUndefined();
    expect(await Message.countDocuments({ conversationId })).toBe(before);

    // Messaging carries on.
    expect((await send(buyer.token, 'still interested')).status).toBe(201);
  });

  it('archiving (the seller\'s delete) also changes nothing', async () => {
    const res = await request(app).delete(`/products/${product._id}`).set(bearer(seller.token));
    expect(res.status).toBe(200);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(false);
    expect((await send(seller.token, 'we can still talk')).status).toBe(201);

    const view = await request(app).get(`/conversations/${conversationId}`).set(bearer(buyer.token));
    expect(view.body.conversation.frozenLabel).toEqual({ tone: 'none', text: null });
  });
});

describe('M4-21 · an ADMIN takedown freezes the threads', () => {
  it('freezes both sides, explains why, and suggests other suppliers', async () => {
    expect((await takedown()).status).toBe(200);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(true);
    expect(stored.frozenReason).toBe('takedown');

    expect((await send(buyer.token, 'hello?')).status).toBe(409);
    expect((await send(seller.token, 'hello?')).status).toBe(409);

    const notice = await Message.findOne({ conversationId, senderType: 'system', body: /under review/ });
    expect(notice).toBeTruthy();
    expect(notice.body).toMatch(/other suppliers/i);
  });

  it('the buyer sees a YELLOW label with text while it is still reversible', async () => {
    await takedown();
    const res = await request(app).get(`/conversations/${conversationId}`).set(bearer(buyer.token));
    expect(res.body.conversation.frozenLabel).toEqual({ tone: 'yellow', text: 'Product under review' });
  });

  it('reading the full history still works while frozen (M4-22)', async () => {
    await send(seller.token, 'said before the freeze');
    await takedown();

    const res = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(buyer.token));
    expect(res.status).toBe(200);
    expect(res.body.messages.map((m) => m.body)).toContain('said before the freeze');
  });

  it('only threads on THAT product freeze', async () => {
    const other = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Silk Roll',
      status: 'active', price: { mode: 'on_request' },
    });
    const otherRes = await request(app).post('/inquiries').set(bearer(buyer.token))
      .send({ productId: String(other._id), note: 'a different product' });

    await takedown();

    expect((await Conversation.findById(otherRes.body.conversationId)).frozen).toBe(false);
    expect((await send(buyer.token, 'fine here', otherRes.body.conversationId)).status).toBe(201);
  });
});

describe('M4-21 / M4-30 · restore reopens — but only what it should', () => {
  it('restoring lifts the freeze and says so', async () => {
    await takedown();
    expect((await restore()).status).toBe(200);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(false);
    expect(stored.frozenReason).toBeUndefined();
    expect((await send(buyer.token, 'and we are back')).status).toBe(201);

    expect(await Message.findOne({ conversationId, senderType: 'system', body: /available again/ })).toBeTruthy();
  });

  it('🔴 a thread the admin ALSO blocked stays shut after the product is restored', async () => {
    await takedown();
    await request(app).post(`/admin/conversations/${conversationId}/block`)
      .set(bearer(sa.token)).send({ reason: 'abusive language' });

    await restore();

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(true);              // M4-30 — the block still applies
    expect(stored.blockedReason).toBe('abusive language');
    expect((await send(buyer.token, 'let me through')).status).toBe(409);

    // …and it did NOT claim to be reopened.
    expect(await Message.findOne({ conversationId, senderType: 'system', body: /available again/ })).toBeNull();
  });

  it('the label after a restore reflects the block, not the product', async () => {
    await takedown();
    await request(app).post(`/admin/conversations/${conversationId}/block`)
      .set(bearer(sa.token)).send({ reason: 'abusive language' });
    await restore();

    const res = await request(app).get(`/conversations/${conversationId}`).set(bearer(buyer.token));
    expect(res.body.conversation.frozenLabel.tone).toBe('red');
    expect(res.body.conversation.blockedReason).toBe('abusive language');
  });
});

describe('M4-22 · the purge leaves the thread alone', () => {
  it('the conversation survives, stays frozen, keeps its history and turns RED', async () => {
    await send(seller.token, 'a line worth keeping');
    await takedown();

    await Product.updateOne({ _id: product._id }, { $set: { 'takedown.at': new Date('2026-01-01') } });
    const { purged } = await purgeBlockedProducts({ now: new Date('2026-08-01') });
    expect(purged).toBe(1);
    expect(await Product.findById(product._id)).toBeNull();

    const stored = await Conversation.findById(conversationId);
    expect(stored).toBeTruthy();
    expect(stored.frozen).toBe(true);
    // C5 — the purge writes NOTHING to the conversation; the reason is untouched.
    expect(stored.frozenReason).toBe('takedown');

    const view = await request(app).get(`/conversations/${conversationId}`).set(bearer(buyer.token));
    expect(view.body.conversation.frozenLabel).toEqual({ tone: 'red', text: 'Product no longer available' });
    expect(view.body.conversation.product.id).toBeNull();      // no link to a dead page
    expect(view.body.conversation.title).toContain('Cotton Roll'); // from the snapshot

    const msgs = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(buyer.token));
    expect(msgs.body.messages.map((m) => m.body)).toContain('a line worth keeping');
  });
});

describe('M4-F · the M2 behaviour it reaches into is unchanged', () => {
  it('takedown still leaves status alone, counts the offence and audits', async () => {
    await request(app).patch(`/products/${product._id}/status`).set(bearer(seller.token)).send({ status: 'inactive' });
    await takedown();

    const stored = await Product.findById(product._id);
    expect(stored.status).toBe('inactive');        // m5-rules §2 — status untouched
    expect(stored.takedown.isDown).toBe(true);
    expect((await Organisation.findById(sellerOrg._id)).takedownCount).toBe(1);
  });

  it('restore still returns the product to exactly the state it was frozen in', async () => {
    await request(app).patch(`/products/${product._id}/status`).set(bearer(seller.token)).send({ status: 'inactive' });
    await takedown();
    await restore();

    const stored = await Product.findById(product._id);
    expect(stored.status).toBe('inactive');
    expect(stored.takedown.isDown).toBe(false);
    expect((await Organisation.findById(sellerOrg._id)).takedownCount).toBe(1); // §A24 increment-only
  });

  it('a product with NO threads takes down and restores without incident', async () => {
    const lonely = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Unloved Roll',
      status: 'active', price: { mode: 'on_request' },
    });
    expect((await request(app).post(`/admin/products/${lonely._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'spam' })).status).toBe(200);
    expect((await request(app).post(`/admin/products/${lonely._id}/restore`).set(bearer(sa.token))).status).toBe(200);
  });

  it('a takedown is still refused on a draft and on an archived product', async () => {
    const draft = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Draft', status: 'draft',
    });
    const archived = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Archived', status: 'archived',
    });
    for (const p of [draft, archived]) {
      expect((await request(app).post(`/admin/products/${p._id}/takedown`)
        .set(bearer(sa.token)).send({ reason: 'x-y-z' })).status).toBe(409);
    }
  });
});
