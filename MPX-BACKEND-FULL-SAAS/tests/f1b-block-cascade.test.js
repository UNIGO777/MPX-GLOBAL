/**
 * F1-B — the half of the org block that reaches the catalogue and the chats.
 *
 * FINALIZE calls F1 its top priority for one reason: without this, a block
 * "looked like it worked and didn't". The seller could not log in, but buyers
 * still saw their products and still sent enquiries nobody would ever answer.
 *
 * The cascade runs in the BACKGROUND (owner decision), so these tests WAIT for
 * the real one to finish rather than racing it or running a second copy.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../src/services/push.client.js', () => ({
  isPushConfigured: () => false,
  sendToTokens: vi.fn(async () => ({ successCount: 0, deadTokens: [] })),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { Inquiry } = await import('../src/models/Inquiry.js');
const { Conversation } = await import('../src/models/Conversation.js');
const { Message } = await import('../src/models/Message.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');
const { rebuildAll } = await import('../src/services/searchSync.service.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let sa;
let leaf;
let seller;
let buyer;

async function makeUser(role, orgFields = {}, permissions = []) {
  seq += 1;
  const org = await Organisation.create({
    name: orgFields.name ?? `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...orgFields,
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `f1b_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `71${3000000 + seq}`, e164: `+9171${3000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

async function makeProduct(name, status = 'active') {
  const p = await Product.create({
    exporterOrgId: seller.org._id, categoryId: leaf._id, name, status,
    price: { mode: 'fixed', min: 300, currency: 'INR' },
    sellerCountry: 'IN', sellerVerified: false,
  });
  await rebuildAll();
  return p;
}

async function openThread(product, asBuyer = buyer) {
  const res = await request(app).post('/inquiries').set(bearer(asBuyer.token))
    .send({ productId: String(product._id), note: 'Please share your best price.' });
  expect([200, 201]).toContain(res.status);
  return res.body.conversationId;
}

const block = (reason = 'repeated violations') =>
  request(app).post(`/admin/orgs/${seller.org._id}/block`).set(bearer(sa.token)).send({ reason });
const unblock = () =>
  request(app).post(`/admin/orgs/${seller.org._id}/unblock`).set(bearer(sa.token)).send({});

/**
 * The cascade is fire-and-forget, so wait for the REAL one to finish rather than
 * running a second copy. Re-running it would exercise a path production never
 * takes, and would report 0 rows changed the second time round because the first
 * pass already did the work — which is exactly how a green test can describe
 * behaviour that never happens.
 */
async function settle(direction) {
  for (let i = 0; i < 50; i += 1) {
    const org = await Organisation.findById(seller.org._id).select('blockCascade').lean();
    if (org?.blockCascade?.status === 'done' && org.blockCascade.direction === direction) return;
    if (org?.blockCascade?.status === 'failed') throw new Error(`cascade failed: ${org.blockCascade.error}`);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  }
  throw new Error(`cascade did not complete: ${direction}`);
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
  sa = await makeUser('superadmin');
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  seller = await makeUser('exporter', { name: 'TextileHub Exports', exporterSide: true, country: 'IN' });
  buyer = await makeUser('buyer', { name: 'Sydney Imports', buyerSide: true, country: 'AU' });
});

describe('F1-B · the block finally reaches the catalogue', () => {
  it('🔴 closes the gap: a blocked seller\'s products disappear from discovery', async () => {
    const product = await makeProduct('Cotton Roll');
    expect((await request(app).get('/public/search').query({ q: 'cotton' })).body.total).toBe(1);

    await block();
    await settle('block');

    // The exact behaviour FINALIZE calls the point of F1.
    expect((await request(app).get('/public/search').query({ q: 'cotton' })).body.total).toBe(0);
    expect((await request(app).get(`/public/products/${product._id}`)).status).toBe(404);
    expect((await Product.findById(product._id)).takedown.isDown).toBe(true);
  });

  it('a buyer can no longer open an enquiry on a blocked company', async () => {
    const product = await makeProduct('Cotton Roll');
    await block();
    await settle('block');

    const res = await request(app).post('/inquiries').set(bearer(buyer.token))
      .send({ productId: String(product._id), note: 'still interested' });
    expect(res.status).toBe(404);
  });

  it('drafts and archived products are left alone', async () => {
    const draft = await makeProduct('Draft Roll', 'draft');
    const archived = await makeProduct('Gone Roll', 'archived');

    await block();
    await settle('block');

    // A draft was never public — taking it down would strand it, exactly as a
    // manual takedown refuses to.
    expect((await Product.findById(draft._id)).takedown?.isDown).toBeFalsy();
    // A7 — an archived row in takedown would match the §A8 purge and be deleted.
    expect((await Product.findById(archived._id)).takedown?.isDown).toBeFalsy();
  });

  it('🔴 the offence counter is NOT inflated by the size of the catalogue (§A24)', async () => {
    for (let i = 0; i < 4; i += 1) await makeProduct(`Roll ${i}`);

    await block();
    await settle('block');

    // §A24 counts individual moderation decisions. One account block is ONE
    // decision — counting four would corrupt the signal F6 depends on.
    expect((await Organisation.findById(seller.org._id)).takedownCount).toBe(0);
  });
});

describe('F1-B · the block finally reaches the chats', () => {
  it('freezes every thread the company is in, with a system message', async () => {
    const product = await makeProduct('Cotton Roll');
    const conversationId = await openThread(product);

    await block();
    await settle('block');

    const conv = await Conversation.findById(conversationId);
    expect(conv.frozen).toBe(true);
    expect(conv.frozenReason).toBe('account');

    // The buyer can still READ the history (M4-22) but cannot write.
    expect((await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'hello?' })).status).toBe(409);
    const notice = await Message.findOne({ conversationId, senderType: 'system', body: /account is currently unavailable/i });
    expect(notice).toBeTruthy();
  });

  it('the notice says nothing about the other party\'s account beyond "unavailable"', async () => {
    const product = await makeProduct('Cotton Roll');
    const conversationId = await openThread(product);
    await block();
    await settle('block');

    const notice = await Message.findOne({ conversationId, senderType: 'system', body: /unavailable/i });
    // A buyer must not learn that this company was blocked for misconduct.
    for (const leak of ['blocked', 'violation', 'suspended', 'banned']) {
      expect(notice.body.toLowerCase()).not.toContain(leak);
    }
  });

  it('freezes threads where the blocked company is the BUYER too', async () => {
    // The blocked org also buys — A21 lets one Organisation hold both sides.
    await Organisation.updateOne({ _id: seller.org._id }, { $set: { buyerSide: true } });
    seq += 1;
    const dualBuyer = await User.create({
      name: 'dual', email: `dual_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `72${3000000 + seq}`, e164: `+9172${3000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'), role: 'buyer', orgId: seller.org._id,
    });
    const otherOrg = await Organisation.create({
      name: 'Other Seller', type: 'business', exporterSide: true, country: 'IN',
    });
    const otherProduct = await Product.create({
      exporterOrgId: otherOrg._id, categoryId: leaf._id, name: 'Silk Roll',
      status: 'active', price: { mode: 'on_request' },
    });
    const asBuyerThread = await openThread(otherProduct, { token: signAccessToken(dualBuyer) });

    await block();
    await settle('block');

    expect((await Conversation.findById(asBuyerThread)).frozen).toBe(true);
  });
});

describe('🔴 F1 open point 1 · unblock must NOT blanket-restore', () => {
  it('a product taken down BEFORE the block stays down after unblock', async () => {
    const individually = await makeProduct('Counterfeit Roll');
    const ordinary = await makeProduct('Honest Roll');

    // An admin removes ONE listing on its own merits.
    await request(app).post(`/admin/products/${individually._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });

    await block();
    await settle('block');
    await unblock();
    await settle('unblock');

    // The account is back, and so is the honest listing…
    expect((await Product.findById(ordinary._id)).takedown.isDown).toBe(false);
    // …but the individually removed one STAYS removed, with its own reason.
    const stillDown = await Product.findById(individually._id);
    expect(stillDown.takedown.isDown).toBe(true);
    expect(stillDown.takedown.reason).toBe('counterfeit listing');
  });

  it('a chat blocked BEFORE the block stays blocked after unblock', async () => {
    const product = await makeProduct('Cotton Roll');
    const other = await makeProduct('Second Roll');
    const blockedThread = await openThread(product);
    const ordinaryThread = await openThread(other);

    await request(app).post(`/admin/conversations/${blockedThread}/block`)
      .set(bearer(sa.token)).send({ reason: 'off-platform payment request' });

    await block();
    await settle('block');
    await unblock();
    await settle('unblock');

    expect((await Conversation.findById(ordinaryThread)).frozen).toBe(false);

    const stillFrozen = await Conversation.findById(blockedThread);
    expect(stillFrozen.frozen).toBe(true);
    expect(stillFrozen.frozenReason).toBe('blocked');
    expect(stillFrozen.blockedReason).toBe('off-platform payment request');
  });

  it('the markers are cleared, so a SECOND block captures fresh state', async () => {
    const product = await makeProduct('Cotton Roll');
    const conversationId = await openThread(product);

    await block(); await settle('block');
    await unblock(); await settle('unblock');

    expect((await Product.findById(product._id)).prevTakedown).toBeUndefined();
    expect((await Conversation.findById(conversationId)).prevFrozen).toBeUndefined();

    // A second cycle behaves identically rather than restoring a stale snapshot.
    await block(); await settle('block');
    expect((await Product.findById(product._id)).takedown.isDown).toBe(true);
    await unblock(); await settle('unblock');
    expect((await Product.findById(product._id)).takedown.isDown).toBe(false);
  });

  it('🔴 unblocking does not reopen a thread whose PRODUCT is still taken down (M4-30)', async () => {
    const product = await makeProduct('Cotton Roll');
    const conversationId = await openThread(product);

    await request(app).post(`/admin/products/${product._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });
    await block(); await settle('block');
    await unblock(); await settle('unblock');

    const conv = await Conversation.findById(conversationId);
    expect(conv.frozen).toBe(true);
    expect(conv.frozenReason).toBe('takedown');
  });

  it('🔴 restoring a product does not reopen chats while the COMPANY is still blocked', async () => {
    const product = await makeProduct('Cotton Roll');
    const conversationId = await openThread(product);

    await block(); await settle('block');
    // An admin restores this one listing while the account stays blocked.
    await request(app).post(`/admin/products/${product._id}/restore`).set(bearer(sa.token));

    // This is why `account` had to be its own freeze reason: without it the
    // product restore would have reopened a blocked company's conversation.
    const conv = await Conversation.findById(conversationId);
    expect(conv.frozen).toBe(true);
  });
});

describe('F1-B · the console tells the truth about what the block did', () => {
  it('reports the cascade reach and its completed status', async () => {
    const product = await makeProduct('Cotton Roll');
    await openThread(product);

    await block();
    await settle('block');

    const res = await request(app).get(`/admin/orgs/${seller.org._id}`).set(bearer(sa.token));
    const reach = res.body.organisation.blockReach;

    expect(reach).toMatchObject({ organisation: true, users: true, products: true, conversations: true });
    expect(reach.cascade.status).toBe('done');
    expect(reach.cascade.direction).toBe('block');
    expect(reach.cascade.products).toBe(1);
    expect(reach.cascade.conversations).toBe(1);
    expect(reach.cascade.failed).toBe(false);
  });

  it('🔴 a FAILED cascade is visible — the admin must know the catalogue is still live', async () => {
    await makeProduct('Cotton Roll');
    await block();
    // Simulate the background job dying part-way.
    await Organisation.updateOne({ _id: seller.org._id }, {
      $set: { blockCascade: { status: 'failed', direction: 'block', error: 'connection lost' } },
    });

    const res = await request(app).get(`/admin/orgs/${seller.org._id}`).set(bearer(sa.token));
    // Silence here would be the worst outcome of choosing a background cascade.
    expect(res.body.organisation.blockReach.cascade.failed).toBe(true);
    expect(res.body.organisation.blockReach.cascade.status).toBe('failed');
  });

  it('the account half is already done by the time the admin gets a response', async () => {
    await makeProduct('Cotton Roll');

    const res = await block();
    expect(res.status).toBe(200);

    // Sessions are dead immediately — that is the part that cannot wait for a
    // background job.
    expect((await request(app).get('/auth/me').set(bearer(seller.token))).status).toBe(401);
    expect((await Organisation.findById(seller.org._id)).isActive).toBe(false);
    expect((await request(app).get(`/exporters/${seller.org._id}`)).status).toBe(404);
  });
});
