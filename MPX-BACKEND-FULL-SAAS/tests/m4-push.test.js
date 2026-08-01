/**
 * M4-H — FCM push, the approved narrow slice.
 * The FCM client is mocked throughout: no credential is needed to build or test
 * this, which is the whole point of `isPushConfigured()`.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { pushBox } = vi.hoisted(() => ({
  pushBox: { configured: true, calls: [], deadTokens: [], fail: false },
}));

vi.mock('../src/services/push.client.js', () => ({
  isPushConfigured: () => pushBox.configured,
  sendToTokens: vi.fn(async ({ tokens, title, body, data }) => {
    if (pushBox.fail) throw new Error('firebase unreachable');
    pushBox.calls.push({ tokens, title, body, data });
    return { sent: tokens.length, deadTokens: pushBox.deadTokens };
  }),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { Inquiry } = await import('../src/models/Inquiry.js');
const { Conversation } = await import('../src/models/Conversation.js');
const { DeviceToken } = await import('../src/models/DeviceToken.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let leaf;
let sellerOrg;
let seller;
let seller2;
let buyer;
let product;
let conversationId;

async function makeUser(role, orgFields = {}, org = null) {
  seq += 1;
  const theOrg = org ?? (await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields }));
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `pu_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `81${1000000 + seq}`, e164: `+9181${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: theOrg._id,
  });
  return { org: theOrg, user, token: signAccessToken(user) };
}

async function registerDevice(who, token, platform = 'android') {
  const res = await request(app).post('/me/devices').set(bearer(who.token)).send({ token, platform });
  expect(res.status).toBe(201);
}

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });

  const s = await makeUser('exporter', { exporterSide: true, country: 'IN' });
  seller = s; sellerOrg = s.org;
  await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { name: 'TextileHub Exports' } });
  sellerOrg.name = 'TextileHub Exports';
  // A second person in the SAME seller org — D-N2 says both should be reachable.
  seller2 = await makeUser('exporter', {}, sellerOrg);

  buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
  await Organisation.updateOne({ _id: buyer.org._id }, { $set: { name: 'Sydney Imports' } });
  buyer.org.name = 'Sydney Imports';

  product = await Product.create({
    exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Cotton Roll',
    status: 'active', price: { mode: 'fixed', min: 300, currency: 'INR' },
  });
}

async function openThread() {
  const res = await request(app).post('/inquiries').set(bearer(buyer.token))
    .send({ productId: String(product._id), note: 'Please share your best price.' });
  conversationId = res.body.conversationId;
  return conversationId;
}

// The notification is fire-and-forget, so give the microtask queue a turn.
const settle = () => new Promise((r) => setTimeout(r, 60));

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  pushBox.configured = true;
  pushBox.calls = [];
  pushBox.deadTokens = [];
  pushBox.fail = false;
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), Inquiry.deleteMany({}), Conversation.deleteMany({}),
    DeviceToken.deleteMany({}),
    mongoose.connection.db.collection('messages').deleteMany({}),
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('M4-H · device registration', () => {
  it('registers, and re-registering the same token UPSERTS rather than colliding (G10)', async () => {
    await registerDevice(buyer, 'token-aaaaaaaaaaaaaaaaaaaa');
    await registerDevice(buyer, 'token-aaaaaaaaaaaaaaaaaaaa', 'ios');

    const rows = await DeviceToken.find({ token: 'token-aaaaaaaaaaaaaaaaaaaa' });
    expect(rows).toHaveLength(1);
    expect(rows[0].platform).toBe('ios');
  });

  it('a device that changes hands is reassigned to its new owner', async () => {
    await registerDevice(buyer, 'shared-device-token-xxxxx');
    await registerDevice(seller, 'shared-device-token-xxxxx');

    const rows = await DeviceToken.find({ token: 'shared-device-token-xxxxx' });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].userId)).toBe(String(seller.user._id));
  });

  it('unregistering only ever removes the CALLER\'s own device', async () => {
    await registerDevice(buyer, 'buyer-device-token-aaaaa');

    // Another user cannot drop it.
    await request(app).delete('/me/devices/buyer-device-token-aaaaa').set(bearer(seller.token));
    expect(await DeviceToken.countDocuments({ token: 'buyer-device-token-aaaaa' })).toBe(1);

    await request(app).delete('/me/devices/buyer-device-token-aaaaa').set(bearer(buyer.token));
    expect(await DeviceToken.countDocuments({ token: 'buyer-device-token-aaaaa' })).toBe(0);
  });

  it('rejects a bad platform, a short token, and a guest', async () => {
    expect((await request(app).post('/me/devices').set(bearer(buyer.token))
      .send({ token: 'a'.repeat(30), platform: 'desktop' })).status).toBe(400);
    expect((await request(app).post('/me/devices').set(bearer(buyer.token))
      .send({ token: 'short', platform: 'web' })).status).toBe(400);
    expect((await request(app).post('/me/devices')
      .send({ token: 'a'.repeat(30), platform: 'web' })).status).toBe(401);
  });

  it('never echoes the token back in a response', async () => {
    const res = await request(app).post('/me/devices').set(bearer(buyer.token))
      .send({ token: 'secret-device-token-zzzzz', platform: 'web' });
    expect(JSON.stringify(res.body)).not.toContain('secret-device-token');
  });
});

describe('M4-H · a new enquiry notifies the seller', () => {
  it('reaches EVERY active user of the seller org (D-N2), not the buyer', async () => {
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');
    await registerDevice(seller2, 'seller-device-2-aaaaaaaa');
    await registerDevice(buyer, 'buyer-device-1-aaaaaaaaa');

    await openThread();
    await settle();

    expect(pushBox.calls).toHaveLength(1);
    const call = pushBox.calls[0];
    expect(call.tokens.sort()).toEqual(['seller-device-1-aaaaaaaa', 'seller-device-2-aaaaaaaa'].sort());
    expect(call.tokens).not.toContain('buyer-device-1-aaaaaaaaa');
    expect(call.data).toMatchObject({ type: 'enquiry' });
  });

  it('🔴 D-N1: the payload carries company + product but NEVER the message text', async () => {
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');
    await request(app).post('/inquiries').set(bearer(buyer.token)).send({
      productId: String(product._id),
      note: 'CONFIDENTIAL: we will pay 40 lakh via bank transfer',
      fields: { quantity: 5000, unit: 'metres' },
    });
    await settle();

    const call = pushBox.calls[0];
    expect(call.body).toContain('Sydney Imports');
    expect(call.body).toContain('Cotton Roll');
    const blob = JSON.stringify(call);
    expect(blob).not.toContain('CONFIDENTIAL');
    expect(blob).not.toContain('40 lakh');
    expect(blob).not.toContain('5000');
  });

  it('an inactive user in the seller org is not notified', async () => {
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');
    await registerDevice(seller2, 'seller-device-2-aaaaaaaa');
    await User.updateOne({ _id: seller2.user._id }, { $set: { isActive: false } });

    await openThread();
    await settle();
    expect(pushBox.calls[0].tokens).toEqual(['seller-device-1-aaaaaaaa']);
  });
});

describe('M4-H · a new message notifies the counterparty only', () => {
  it('a buyer message reaches the seller, never the buyer themselves (D-N3)', async () => {
    await openThread();
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');
    await registerDevice(buyer, 'buyer-device-1-aaaaaaaaa');
    pushBox.calls = [];

    await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'Any update on the quote?' });
    await settle();

    expect(pushBox.calls).toHaveLength(1);
    expect(pushBox.calls[0].tokens).toEqual(['seller-device-1-aaaaaaaa']);
    // 🔴 D-N1 again — the reply text never travels.
    expect(JSON.stringify(pushBox.calls[0])).not.toContain('Any update');
  });

  it('a seller reply reaches the buyer', async () => {
    await openThread();
    await registerDevice(buyer, 'buyer-device-1-aaaaaaaaa');
    pushBox.calls = [];

    await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(seller.token)).send({ body: 'Yes, 4 week lead time.' });
    await settle();

    expect(pushBox.calls[0].tokens).toEqual(['buyer-device-1-aaaaaaaaa']);
    expect(pushBox.calls[0].body).toContain('TextileHub Exports');
  });

  it('the OTHER person in the sender\'s own org is not notified either', async () => {
    await openThread();
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');
    await registerDevice(seller2, 'seller-device-2-aaaaaaaa');
    await registerDevice(buyer, 'buyer-device-1-aaaaaaaaa');
    pushBox.calls = [];

    await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(seller.token)).send({ body: 'replying' });
    await settle();

    expect(pushBox.calls[0].tokens).toEqual(['buyer-device-1-aaaaaaaaa']);
  });

  it('a system message sends no push at all', async () => {
    await openThread();
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');
    await registerDevice(buyer, 'buyer-device-1-aaaaaaaaa');
    pushBox.calls = [];

    const sa = await makeUser('superadmin', { type: 'platform' });
    await request(app).post(`/admin/conversations/${conversationId}/block`)
      .set(bearer(sa.token)).send({ reason: 'off-platform payment request' });
    await settle();

    expect(pushBox.calls).toHaveLength(0);
  });
});

describe('M4-H · failure never reaches the user', () => {
  it('🔴 a push failure does NOT fail the message send', async () => {
    await openThread();
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');
    pushBox.fail = true;

    const res = await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'this must still go through' });
    await settle();

    expect(res.status).toBe(201);
    const stored = await mongoose.connection.db.collection('messages')
      .findOne({ body: 'this must still go through' });
    expect(stored).toBeTruthy();
  });

  it('🔴 with NO credential configured the layer is inert — no crash, no 5xx', async () => {
    pushBox.configured = false;
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');

    const enquiryRes = await request(app).post('/inquiries').set(bearer(buyer.token))
      .send({ productId: String(product._id), note: 'still works without firebase' });
    expect(enquiryRes.status).toBe(201);

    const msgRes = await request(app).post(`/conversations/${enquiryRes.body.conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'and so does this' });
    expect(msgRes.status).toBe(201);

    await settle();
    expect(pushBox.calls).toHaveLength(0); // nothing attempted at all
  });

  it('a dead token reported by FCM is deleted', async () => {
    await openThread();
    await registerDevice(seller, 'seller-device-1-aaaaaaaa');
    await registerDevice(seller2, 'seller-device-2-aaaaaaaa');
    pushBox.deadTokens = ['seller-device-1-aaaaaaaa'];

    await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'triggering a send' });
    await settle();

    expect(await DeviceToken.countDocuments({ token: 'seller-device-1-aaaaaaaa' })).toBe(0);
    expect(await DeviceToken.countDocuments({ token: 'seller-device-2-aaaaaaaa' })).toBe(1);
  });

  it('nobody registered means no send is attempted', async () => {
    await openThread();
    pushBox.calls = [];
    await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'into the void' });
    await settle();

    expect(pushBox.calls.filter((c) => c.tokens.length > 0)).toHaveLength(0);
  });
});
