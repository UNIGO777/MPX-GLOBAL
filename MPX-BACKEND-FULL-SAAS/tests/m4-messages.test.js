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
import { postSystemMessage } from '../src/services/message.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let leaf;
let sellerOrg;
let seller;
let buyer;
let outsider;
let product;
let conversationId;

async function makeUser(role, orgFields = {}) {
  seq += 1;
  const org = await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `msg_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `41${1000000 + seq}`, e164: `+9141${1000000 + seq}` },
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
  outsider = await makeUser('buyer', { buyerSide: true, country: 'NZ' });

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
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('M4-D · sending', () => {
  it('both parties can send, and senderType comes from the ROLE not the body', async () => {
    const fromBuyer = await send(buyer.token, 'Can you do 5000 metres?');
    expect(fromBuyer.status).toBe(201);
    expect(fromBuyer.body.message.senderType).toBe('buyer');

    const fromSeller = await send(seller.token, 'Yes, lead time is 4 weeks.');
    expect(fromSeller.status).toBe(201);
    expect(fromSeller.body.message.senderType).toBe('exporter');

    // The response carries no person, ever (M4-17). This is an EXACT key list on
    // purpose: it is the guard that fails the moment a field is added to the
    // message projection, so widening it is always a deliberate edit here.
    // `systemKind` joined it on 2026-08-18 — null on every party message.
    expect(Object.keys(fromSeller.body.message).sort()).toEqual(
      ['body', 'createdAt', 'id', 'senderType', 'systemKind'].sort(),
    );
    expect(fromSeller.body.message.systemKind).toBeNull();
  });

  it('updates the list ordering and preview', async () => {
    const before = await Conversation.findById(conversationId);
    await send(seller.token, 'Yes, we can supply that quantity.');

    const after = await Conversation.findById(conversationId);
    expect(after.lastMessageAt.getTime()).toBeGreaterThanOrEqual(before.lastMessageAt.getTime());
    expect(after.lastMessagePreview).toBe('Yes, we can supply that quantity.');
  });

  it('the sender does not see their own message as unread; the other side does', async () => {
    await send(seller.token, 'Replying now.');

    const sellerList = await request(app).get('/conversations').set(bearer(seller.token));
    expect(sellerList.body.conversations[0].unread).toBe(false);

    const buyerList = await request(app).get('/conversations').set(bearer(buyer.token));
    expect(buyerList.body.conversations[0].unread).toBe(true);
  });

  it('a sent message is immediately readable by the counterparty', async () => {
    await send(buyer.token, 'A question about packaging.');
    const res = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(seller.token));
    expect(res.body.messages.map((m) => m.body)).toContain('A question about packaging.');
  });
});

describe('M4-D · guard 1 — the sender must be a party (§7.3)', () => {
  it('an outsider gets 404, never 403, and writes nothing', async () => {
    const res = await send(outsider.token, 'let me in');
    expect(res.status).toBe(404);
    expect(await Message.countDocuments({ conversationId, senderType: 'buyer' })).toBe(1); // just the enquiry
  });

  it('a guest gets 401', async () => {
    const res = await request(app).post(`/conversations/${conversationId}/messages`).send({ body: 'hello' });
    expect(res.status).toBe(401);
  });

  it('🔴 admin can READ but cannot SPEAK (§7.3 / screen 5)', async () => {
    const sa = await makeUser('superadmin', { type: 'platform' });
    const res = await send(sa.token, 'MPX here — please pay outside the platform.');
    expect([403, 404]).toContain(res.status);

    const stored = await Message.find({ conversationId });
    expect(stored.map((m) => m.body)).not.toContain('MPX here — please pay outside the platform.');
  });

  it('an unknown conversation id is 404', async () => {
    const res = await send(buyer.token, 'hello', String(new mongoose.Types.ObjectId()));
    expect(res.status).toBe(404);
  });
});

describe('M4-D · guard 2 — a frozen thread refuses writes but keeps reading open', () => {
  for (const reason of ['takedown', 'blocked']) {
    it(`refuses a send while frozen (${reason}), from BOTH sides`, async () => {
      await Conversation.updateOne({ _id: conversationId }, { $set: { frozen: true, frozenReason: reason } });

      expect((await send(buyer.token, 'still there?')).status).toBe(409);
      expect((await send(seller.token, 'hello?')).status).toBe(409);
      expect(await Message.countDocuments({ conversationId })).toBe(2); // only the two opening messages
    });
  }

  it('reading a frozen thread still works — full history stays visible (M4-22)', async () => {
    await send(seller.token, 'before the freeze');
    await Conversation.updateOne({ _id: conversationId }, { $set: { frozen: true, frozenReason: 'takedown' } });

    const res = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(buyer.token));
    expect(res.status).toBe(200);
    expect(res.body.messages.map((m) => m.body)).toContain('before the freeze');

    // …and the thread itself is still openable.
    expect((await request(app).get(`/conversations/${conversationId}`).set(bearer(buyer.token))).status).toBe(200);
  });

  it('unfreezing lets messages flow again', async () => {
    await Conversation.updateOne({ _id: conversationId }, { $set: { frozen: true, frozenReason: 'takedown' } });
    expect((await send(buyer.token, 'blocked')).status).toBe(409);

    await Conversation.updateOne({ _id: conversationId }, { $set: { frozen: false }, $unset: { frozenReason: '' } });
    expect((await send(buyer.token, 'and we are back')).status).toBe(201);
  });
});

describe('M4-D · guard 3 — 200 characters, USER SENDS ONLY (M4-12 / C1)', () => {
  it('accepts exactly 200 and refuses 201', async () => {
    expect((await send(buyer.token, 'x'.repeat(200))).status).toBe(201);
    expect((await send(buyer.token, 'x'.repeat(201))).status).toBe(400);
  });

  it('refuses an empty or whitespace-only body', async () => {
    expect((await send(buyer.token, '')).status).toBe(400);
    expect((await send(buyer.token, '   ')).status).toBe(400);
  });

  it('🔴 C1: the composed FIRST message is over 200 and was still accepted', async () => {
    // The exact bug a model-level cap would have caused: every enquiry whose
    // composed opening line runs past 200 would have been rejected outright.
    const other = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Long Roll', status: 'active',
      price: { mode: 'on_request' },
    });
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send({
      productId: String(other._id),
      note: 'n'.repeat(200),
      fields: { quantity: 5000, unit: 'metres', targetPrice: 120, currency: 'INR', deliveryTimeline: 't'.repeat(200) },
    });
    expect(res.status).toBe(201);

    const [first] = await Message.find({ conversationId: res.body.conversationId }).sort({ createdAt: 1 });
    expect(first.senderType).toBe('buyer');
    expect(first.body.length).toBeGreaterThan(200);
  });

  it('a SYSTEM message is exempt too', async () => {
    const long = 'The platform has restricted this conversation. '.repeat(10);
    expect(long.length).toBeGreaterThan(200);

    await postSystemMessage({ conversationId, body: long });
    const stored = await Message.findOne({ conversationId, senderType: 'system', body: /restricted/ });
    expect(stored.body.length).toBeGreaterThan(200);
  });

  it('a system notice carries its KIND, and a party message never does', async () => {
    await postSystemMessage({ conversationId, body: 'Reopened.', systemKind: 'unblocked' });

    const res = await request(app)
      .get(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token));
    expect(res.status).toBe(200);

    const notice = res.body.messages.find((m) => m.body === 'Reopened.');
    expect(notice.systemKind).toBe('unblocked');

    // A buyer's or seller's own message has no kind — the field exists only so
    // the platform's notices can be told apart from one another.
    const party = res.body.messages.find((m) => m.senderType !== 'system');
    expect(party.systemKind).toBeNull();
  });

  it('a system notice written WITHOUT a kind still projects, as null', async () => {
    // Every notice sent before 2026-08-18 is in this state, and messages are
    // append-only (M4-13) so they can never be backfilled. The client must be
    // able to render them, not treat the missing field as an error.
    await postSystemMessage({ conversationId, body: 'Legacy notice.' });

    const res = await request(app)
      .get(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token));
    const legacy = res.body.messages.find((m) => m.body === 'Legacy notice.');
    expect(legacy.senderType).toBe('system');
    expect(legacy.systemKind).toBeNull();
  });

  it('a system notice does NOT mark the thread read for either side', async () => {
    await request(app).post(`/conversations/${conversationId}/read`).set(bearer(seller.token));

    // Pin the read timestamps into the past before posting. `unread` is
    // `lastMessageAt > lastReadAt` — a strict comparison, deliberately, so that
    // a reader who is level with the last message counts as caught up. Without
    // this the read and the system message can land in the SAME millisecond and
    // the assertion flips, which is a flaw in the test's timing, not the rule.
    const past = new Date(Date.now() - 60_000);
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { buyerLastReadAt: past, exporterLastReadAt: past } },
    );

    await postSystemMessage({ conversationId, body: 'This product is under review.' });

    for (const who of [buyer, seller]) {
      const list = await request(app).get('/conversations').set(bearer(who.token));
      expect(list.body.conversations[0].unread).toBe(true);
    }
  });
});

describe('ATTACK · M4-D', () => {
  it('a buyer cannot impersonate the platform or the counterparty', async () => {
    const res = await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token))
      .send({
        body: 'a normal line',
        senderType: 'system',
        senderOrgId: String(sellerOrg._id),
        senderUserId: String(seller.user._id),
        conversationId: String(new mongoose.Types.ObjectId()),
      });
    expect(res.status).toBe(201);

    const stored = await Message.findById(res.body.message.id);
    expect(stored.senderType).toBe('buyer');
    expect(String(stored.senderOrgId)).toBe(String(buyer.org._id));
    expect(String(stored.senderUserId)).toBe(String(buyer.user._id));
    expect(String(stored.conversationId)).toBe(String(conversationId));
  });

  it('a message cannot be edited or deleted through any route (M4-13)', async () => {
    const sent = await send(buyer.token, 'a line I regret');
    const id = sent.body.message.id;

    for (const method of ['patch', 'put', 'delete']) {
      const res = await request(app)[method](`/conversations/${conversationId}/messages/${id}`)
        .set(bearer(buyer.token)).send({ body: 'rewritten' });
      expect(res.status).toBe(404); // no such route exists at all
    }
    expect((await Message.findById(id)).body).toBe('a line I regret');
  });

  it('hostile bodies are stored as text, never interpreted', async () => {
    for (const body of [
      '<script>alert(1)</script>',
      '{"$ne": null}',
      '../../etc/passwd',
      '👨‍👩‍👧‍👦 emoji ünïcödé',
      'line one\nline two',
    ]) {
      const res = await send(buyer.token, body);
      expect(res.status).toBe(201);
      expect(res.body.message.body).toBe(body.trim());
    }
  });

  it('a Mongo operator as the body is refused, not coerced', async () => {
    const res = await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('an outsider cannot send into a thread by guessing a valid ObjectId', async () => {
    const otherRes = await request(app).post('/inquiries').set(bearer(outsider.token))
      .send({ productId: String(product._id), note: 'my own thread' });
    const theirs = otherRes.body.conversationId;

    // Each may write in their own thread…
    expect((await send(outsider.token, 'mine', theirs)).status).toBe(201);
    // …and neither in the other's.
    expect((await send(buyer.token, 'yours', theirs)).status).toBe(404);
    expect((await send(outsider.token, 'theirs', conversationId)).status).toBe(404);
  });
});
