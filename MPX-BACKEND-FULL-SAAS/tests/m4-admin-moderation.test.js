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
import { AuditLog } from '../src/models/AuditLog.js';
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
let product;
let conversationId;
let sa;

async function makeUser(role, orgFields = {}, permissions = []) {
  seq += 1;
  const org = await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `mod_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `31${1000000 + seq}`, e164: `+9131${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
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

const block = (token, reason = 'off-platform payment request', id = conversationId) =>
  request(app).post(`/admin/conversations/${id}/block`).set(bearer(token)).send({ reason });
const unblock = (token, id = conversationId) =>
  request(app).post(`/admin/conversations/${id}/unblock`).set(bearer(token)).send({});
const sendAs = (token, body) =>
  request(app).post(`/conversations/${conversationId}/messages`).set(bearer(token)).send({ body });

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

describe('M4-E · blocking one chat (M4-23)', () => {
  it('freezes both sides, posts a system message, audits — and leaves the product live', async () => {
    const res = await block(sa.token);
    expect(res.status).toBe(200);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(true);
    expect(stored.frozenReason).toBe('blocked');
    expect(stored.blockedReason).toBe('off-platform payment request');
    expect(String(stored.blockedBy)).toBe(String(sa.user._id));

    // Both sides are silenced.
    expect((await sendAs(buyer.token, 'hello?')).status).toBe(409);
    expect((await sendAs(seller.token, 'hello?')).status).toBe(409);

    // M4-25 — the reason is in the thread for both to read.
    const notice = await Message.findOne({ conversationId, senderType: 'system', body: /restricted/ });
    expect(notice.body).toContain('off-platform payment request');

    expect(await AuditLog.findOne({ action: 'conversation.block', entityId: conversationId })).toBeTruthy();
    // The product itself is untouched (M4-23).
    expect((await Product.findById(product._id)).takedown?.isDown).toBeFalsy();
  });

  it('block and unblock stamp their systemKind, and a still-frozen unblock does NOT say reopened', async () => {
    await block(sa.token);
    const blocked = await Message.findOne({ conversationId, senderType: 'system', body: /restricted/ });
    expect(blocked.systemKind).toBe('blocked');

    await request(app).post(`/admin/conversations/${conversationId}/unblock`).set(bearer(sa.token)).send({});
    const reopened = await Message.findOne({ conversationId, senderType: 'system', body: /reopened/ });
    expect(reopened.systemKind).toBe('unblocked');

    // 🔴 The kind follows the COPY, not the action. Take the product down, then
    // block and unblock: the thread stays frozen under the takedown, the notice
    // says so, and the kind has to agree — a 'unblocked' stamp here would paint
    // a green "reopened" chrome over a sentence that says messaging is paused.
    await Product.updateOne({ _id: product._id }, { $set: { 'takedown.isDown': true } });
    await block(sa.token);
    await request(app).post(`/admin/conversations/${conversationId}/unblock`).set(bearer(sa.token)).send({});
    const [latest] = await Message.find({ conversationId, senderType: 'system' }).sort({ createdAt: -1 }).limit(1);
    expect(latest.body).toMatch(/under review/);
    expect(latest.systemKind).toBe('product_takedown');
  });

  it('other chats on the same product are unaffected', async () => {
    const other = await makeUser('buyer', { buyerSide: true, country: 'NZ' });
    const otherRes = await request(app).post('/inquiries').set(bearer(other.token))
      .send({ productId: String(product._id), note: 'my own enquiry' });

    await block(sa.token);

    expect((await Conversation.findById(otherRes.body.conversationId)).frozen).toBe(false);
    expect(
      (await request(app).post(`/conversations/${otherRes.body.conversationId}/messages`)
        .set(bearer(other.token)).send({ body: 'still fine' })).status,
    ).toBe(201);
  });

  it('a reason is required, and double-blocking is a 409', async () => {
    expect((await request(app).post(`/admin/conversations/${conversationId}/block`)
      .set(bearer(sa.token)).send({})).status).toBe(400);

    expect((await block(sa.token)).status).toBe(200);
    expect((await block(sa.token)).status).toBe(409);
  });
});

describe('M4-E · unblocking is NOT a toggle (M4-30)', () => {
  it('reopens the thread when nothing else applies', async () => {
    await block(sa.token);
    const res = await unblock(sa.token);
    expect(res.status).toBe(200);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(false);
    expect(stored.frozenReason).toBeUndefined();
    expect(stored.blockedReason).toBeUndefined();
    expect(stored.blockedBy).toBeUndefined();

    expect((await sendAs(buyer.token, 'we are back')).status).toBe(201);
    expect(await AuditLog.findOne({ action: 'conversation.unblock' })).toBeTruthy();
  });

  it('🔴 stays FROZEN when the product is still taken down', async () => {
    await block(sa.token);
    await request(app).post(`/admin/products/${product._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });

    await unblock(sa.token);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(true);            // the other reason still holds
    expect(stored.frozenReason).toBe('takedown'); // and takes over the label
    expect(stored.blockedReason).toBeUndefined();
    expect((await sendAs(buyer.token, 'surely now?')).status).toBe(409);
  });

  it('🔴 stays FROZEN when the product row is gone entirely (purged)', async () => {
    await block(sa.token);
    await Product.deleteOne({ _id: product._id });

    await unblock(sa.token);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozen).toBe(true);
    expect((await sendAs(buyer.token, 'hello')).status).toBe(409);
  });

  it('unblocking something that is not blocked is a 409', async () => {
    expect((await unblock(sa.token)).status).toBe(409);
  });
});

describe('M4-E · first reason wins (M4-29)', () => {
  it('a takedown BEFORE a block keeps the takedown label', async () => {
    await request(app).post(`/admin/products/${product._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });
    await block(sa.token);

    const stored = await Conversation.findById(conversationId);
    expect(stored.frozenReason).toBe('takedown'); // NOT overwritten by the block
    expect(stored.blockedReason).toBe('off-platform payment request'); // but recorded
  });

  it('a block BEFORE a takedown keeps the block label', async () => {
    await block(sa.token);
    await request(app).post(`/admin/products/${product._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });

    expect((await Conversation.findById(conversationId)).frozenReason).toBe('blocked');
  });
});

describe('M4-E · staff reads are audited (M4-34), the list is not (G11)', () => {
  it('reading a thread and its messages writes an audit row each', async () => {
    await request(app).get(`/admin/conversations/${conversationId}`).set(bearer(sa.token));
    await request(app).get(`/admin/conversations/${conversationId}/messages`).set(bearer(sa.token));

    const rows = await AuditLog.find({ action: 'conversation.read', entityId: conversationId });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.after.scope).sort()).toEqual(['messages', 'thread']);
    expect(String(rows[0].actorId)).toBe(String(sa.user._id));
  });

  it('an EMPLOYEE read is audited exactly like a superadmin\'s', async () => {
    const emp = await makeUser('employee', { type: 'platform' }, ['conversation:read']);
    await request(app).get(`/admin/conversations/${conversationId}`).set(bearer(emp.token));

    const row = await AuditLog.findOne({ action: 'conversation.read' });
    expect(String(row.actorId)).toBe(String(emp.user._id));
    expect(row.actorRole).toBe('employee');
  });

  it('listing threads is NOT audited — metadata, not content', async () => {
    await request(app).get('/admin/conversations').set(bearer(sa.token));
    await request(app).get('/admin/conversations').query({ q: 'Cotton' }).set(bearer(sa.token));
    expect(await AuditLog.countDocuments({ action: 'conversation.read' })).toBe(0);
  });
});

describe('M4-E · permissions are default-deny and grantable', () => {
  it('an employee with NO grant is refused everywhere', async () => {
    const emp = await makeUser('employee', { type: 'platform' });
    const t = bearer(emp.token);

    expect((await request(app).get('/admin/conversations').set(t)).status).toBe(403);
    expect((await request(app).get(`/admin/conversations/${conversationId}`).set(t)).status).toBe(403);
    expect((await block(emp.token)).status).toBe(403);
  });

  it('conversation:read alone can read but NOT block', async () => {
    const emp = await makeUser('employee', { type: 'platform' }, ['conversation:read']);
    expect((await request(app).get(`/admin/conversations/${conversationId}`).set(bearer(emp.token))).status).toBe(200);
    expect((await block(emp.token)).status).toBe(403);
  });

  it('conversation:block lets an employee block AND unblock (owner override of M4-38)', async () => {
    const emp = await makeUser('employee', { type: 'platform' }, ['conversation:block']);
    expect((await block(emp.token)).status).toBe(200);
    expect((await unblock(emp.token)).status).toBe(200);
    expect((await Conversation.findById(conversationId)).frozen).toBe(false);
  });

  it('a buyer, a seller and a guest cannot reach any staff route', async () => {
    for (const token of [buyer.token, seller.token]) {
      expect((await request(app).get('/admin/conversations').set(bearer(token))).status).toBe(403);
      expect((await block(token)).status).toBe(403);
    }
    expect((await request(app).get('/admin/conversations')).status).toBe(401);
  });
});

describe('M4-E · the staff view shows what a moderator needs', () => {
  it('carries both orgs and the acting admin — which a PARTY never sees', async () => {
    await block(sa.token);

    const staffRes = await request(app).get(`/admin/conversations/${conversationId}`).set(bearer(sa.token));
    const staffView = staffRes.body.conversation;
    expect(staffView.buyerOrg.name).toBeTruthy();
    expect(staffView.exporterOrg.name).toBeTruthy();
    expect(staffView.blockedBy).toBe(String(sa.user._id));
    expect(staffView.frozenReason).toBe('blocked');
    expect(staffView.title).toContain('×');

    // The same thread, seen by the buyer, hides all of it.
    const partyRes = await request(app).get(`/conversations/${conversationId}`).set(bearer(buyer.token));
    const blob = JSON.stringify(partyRes.body);
    expect(blob).not.toContain('blockedBy');
    expect(blob).not.toContain(String(sa.user._id));
    expect(blob).not.toContain('frozenReason');
  });

  it('the admin list is searchable and there is NO composer at any level', async () => {
    // The list is CURSOR paginated (m5-rules §9), so there is deliberately no
    // `total` — a count over a set that reorders on every message is a number
    // that is wrong by the time it renders.
    const byName = await request(app).get('/admin/conversations').query({ q: 'Cotton' }).set(bearer(sa.token));
    expect(byName.body.conversations).toHaveLength(1);
    expect(byName.body).not.toHaveProperty('total');
    expect(byName.body).toHaveProperty('nextCursor');

    const byOrgId = await request(app).get('/admin/conversations')
      .query({ q: String(sellerOrg._id) }).set(bearer(sa.token));
    expect(byOrgId.body.conversations).toHaveLength(1);

    // Screen 5: read-only. There is no admin send route at all.
    expect((await request(app).post(`/admin/conversations/${conversationId}/messages`)
      .set(bearer(sa.token)).send({ body: 'admin speaking' })).status).toBe(404);
  });

  /**
   * 🔴 Regression, found 2026-08-17 while building the moderation screen.
   *
   * `freezeLabel()` reads a MISSING product as purged, and both actions built
   * their response with `product: null` — so the payload announced "Product no
   * longer available" about a listing that was never touched. A moderator would
   * have read it as "the product is gone", which is a different decision.
   */
  it('block and unblock report the product HONESTLY in their own response', async () => {
    const blocked = await block(sa.token);
    expect(blocked.status).toBe(200);
    // The product is alive and well — the label must be the block, not a purge.
    expect(blocked.body.conversation.frozenLabel).toEqual({
      tone: 'red', text: 'Conversation blocked by MPX Global',
    });
    expect(blocked.body.conversation.product.name).toBe('Cotton Roll');
    expect(blocked.body.conversation.product.id).toBeTruthy();

    const reopened = await unblock(sa.token);
    expect(reopened.status).toBe(200);
    // Nothing is holding it shut, so there is no label at all.
    expect(reopened.body.conversation.frozenLabel).toEqual({ tone: 'none', text: null });
    expect(reopened.body.conversation.frozen).toBe(false);
    expect(reopened.body.conversation.product.name).toBe('Cotton Roll');
  });

  it('blocking an ALREADY taken-down thread keeps the takedown label (M4-29)', async () => {
    await Product.updateOne({ _id: product._id }, { $set: { 'takedown.isDown': true } });
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { frozen: true, frozenReason: 'takedown' } },
    );

    const res = await block(sa.token);
    expect(res.status).toBe(200);
    // First reason wins — and it is emphatically not "no longer available".
    expect(res.body.conversation.frozenLabel).toEqual({ tone: 'yellow', text: 'Product under review' });
    expect(res.body.conversation.frozenReason).toBe('takedown');
    expect(res.body.conversation.blockedReason).toBeTruthy();
  });

  /**
   * §8.4 — roles differ ONLY in scope. The partial-match fallback added on
   * 2026-08-17 therefore has to reach the moderator's list too: one shared
   * branch (`conversationSearch.js`), not two that drift apart.
   */
  it('the admin list gets the SAME partial matching as the party list', async () => {
    const partial = await request(app).get('/admin/conversations')
      .query({ q: 'Cot' }).set(bearer(sa.token));
    expect(partial.status).toBe(200);
    expect(partial.body.conversations).toHaveLength(1);

    // Mid-word still does not match, and a pasted pattern is literal text.
    for (const miss of ['otton', '.*', '(a+)+$']) {
      const res = await request(app).get('/admin/conversations').query({ q: miss }).set(bearer(sa.token));
      expect(res.status).toBe(200);
      expect(res.body.conversations).toEqual([]);
    }
  });
});
