/**
 * Platform warnings in a conversation (owner, 2026-09-24 — a confirmed override
 * of "admin can read, admin cannot speak", kept narrow): staff pick a KEY from a
 * fixed list; the server posts its own text as a platform notice, freezes
 * nothing, and audits who sent it. No free text, ever.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// A warning must never become a push notification (a new push event would be a
// D5 decision) — the mock lets the test prove nothing was sent.
const pushes = vi.hoisted(() => []);
vi.mock('../src/services/push.client.js', () => ({
  isPushConfigured: () => true,
  sendToTokens: vi.fn(async (...args) => {
    pushes.push(args);
    return { successCount: 0, deadTokens: [] };
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
const { Message } = await import('../src/models/Message.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');
const { CHAT_WARNINGS } = await import('../src/utils/chatWarnings.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;
let sa;
let blocker;
let reader;
let buyer;
let seller;
let conversationId;

async function makeUser(role, orgFields = {}, permissions = []) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...orgFields,
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `warn_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `43${1000000 + seq}`, e164: `+9143${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

const warn = (token, warning, id = conversationId) =>
  request(app).post(`/admin/conversations/${id}/warn`).set(bearer(token)).send({ warning });

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  pushes.length = 0;
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), Inquiry.deleteMany({}), Conversation.deleteMany({}),
    mongoose.connection.db.collection('messages').deleteMany({}),
  ]);
  invalidateLeafCache();
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  const leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  sa = await makeUser('superadmin');
  blocker = await makeUser('employee', {}, ['conversation:read', 'conversation:block']);
  reader = await makeUser('employee', {}, ['conversation:read']);
  seller = await makeUser('exporter', { exporterSide: true, country: 'IN' });
  buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
  const product = await Product.create({
    exporterOrgId: seller.org._id, categoryId: leaf._id, name: 'Cotton Roll',
    status: 'active', price: { mode: 'fixed', min: 300, currency: 'INR' },
  });
  const res = await request(app).post('/inquiries').set(bearer(buyer.token))
    .send({ productId: String(product._id), note: 'Please share your best price.' });
  conversationId = res.body.conversationId;
});

describe('platform warnings — what they do', () => {
  it('posts the SERVER-owned text as a platform notice, freezes nothing, and audits the sender', async () => {
    const res = await warn(sa.token, 'off_platform');
    expect(res.status).toBe(200);
    expect(res.body.conversation.frozen).toBe(false);

    const notice = await Message.findOne({ conversationId, systemKind: /^warning/ }).lean();
    expect(notice).toMatchObject({ senderType: 'system', body: CHAT_WARNINGS.off_platform.body });
    // The platform speaks — no person is attached to the message.
    expect(notice.senderUserId).toBeUndefined();

    const audit = await AuditLog.findOne({ action: 'conversation.warn' }).lean();
    expect(String(audit.actorId)).toBe(String(sa.user._id));
    expect(audit.after).toEqual({ warning: 'off_platform' });
  });

  it('both parties see it in their thread, and can still send afterwards', async () => {
    await warn(sa.token, 'conduct');
    for (const party of [buyer, seller]) {
      const res = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(party.token));
      const w = res.body.messages.find((m) => m.systemKind?.startsWith('warning'));
      expect(w.body).toBe(CHAT_WARNINGS.conduct.body);
    }
    const send = await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'Understood.' });
    expect(send.status).toBe(201);
  });

  it('sends no push notification', async () => {
    await warn(sa.token, 'final');
    expect(pushes).toHaveLength(0);
  });

  it('lists the fixed warnings for the admin UI, with the exact text that will post', async () => {
    const res = await request(app).get('/admin/conversation-warnings').set(bearer(blocker.token));
    expect(res.status).toBe(200);
    expect(res.body.warnings.map((w) => w.key)).toEqual(Object.keys(CHAT_WARNINGS));
    expect(res.body.warnings[0]).toEqual({ key: 'off_platform', ...CHAT_WARNINGS.off_platform });
  });

  it('each warning posts with ITS tone, so the thread colours it by nature', async () => {
    const expected = { off_platform: 'reminder', payment_safety: 'reminder', accuracy: 'reminder',
      conduct: 'caution', suspicious: 'serious', final: 'final' };
    for (const [key, tone] of Object.entries(expected)) {
      expect(CHAT_WARNINGS[key].tone).toBe(tone);
      await warn(sa.token, key);
      const latest = await Message.findOne({ conversationId, systemKind: /^warning/ }).sort({ createdAt: -1, _id: -1 }).lean();
      expect(latest.systemKind).toBe(`warning_${tone}`);
    }
  });
});

describe('platform warnings — what is refused', () => {
  it('free text is impossible: an unknown key, or a body, is a 400 and posts nothing', async () => {
    const unknown = await warn(sa.token, 'my own words');
    const withText = await request(app).post(`/admin/conversations/${conversationId}/warn`)
      .set(bearer(sa.token)).send({ warning: 'conduct', body: 'Custom staff text' });
    expect(unknown.status).toBe(400);
    // An extra `body` is dropped by validation: the SERVER's text posts, never the typed one.
    expect(withText.status).toBe(200);
    expect(await Message.countDocuments({ body: 'Custom staff text' })).toBe(0);
    const w = await Message.findOne({ systemKind: /^warning/ }).lean();
    expect(w.body).toBe(CHAT_WARNINGS.conduct.body);
  });

  it('needs conversation:block — read-only staff and the parties themselves are refused', async () => {
    expect((await warn(reader.token, 'conduct')).status).toBe(403);
    expect((await warn(buyer.token, 'conduct')).status).toBe(403);
    expect((await warn(seller.token, 'conduct')).status).toBe(403);
    expect((await request(app).get('/admin/conversation-warnings').set(bearer(reader.token))).status).toBe(403);
    expect(await Message.countDocuments({ systemKind: /^warning/ })).toBe(0);
  });

  it('an employee granted conversation:block may send one', async () => {
    expect((await warn(blocker.token, 'payment_safety')).status).toBe(200);
  });

  it('a closed (frozen) conversation gets no warning', async () => {
    await Conversation.updateOne({ _id: conversationId }, { $set: { frozen: true, frozenReason: 'blocked' } });
    const res = await warn(sa.token, 'conduct');
    expect(res.status).toBe(409);
    expect(await Message.countDocuments({ systemKind: /^warning/ })).toBe(0);
  });

  it('an unknown conversation is a 404', async () => {
    const res = await warn(sa.token, 'conduct', new mongoose.Types.ObjectId().toString());
    expect(res.status).toBe(404);
  });
});

describe('notices written before systemKind existed (pre 2026-08-18)', () => {
  it('an untagged block / reopen notice reads back as blocked / unblocked — nothing is rewritten', async () => {
    const [blocked, reopened, other] = await Message.insertMany([
      { conversationId, senderType: 'system', body: 'This conversation has been restricted by MPX Global. Reason: spam' },
      { conversationId, senderType: 'system', body: 'This conversation has been reopened by MPX Global.' },
      { conversationId, senderType: 'system', body: 'Some other historical notice.' },
    ]);
    const res = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(buyer.token));
    const kindOf = (id) => res.body.messages.find((m) => m.id === String(id)).systemKind;
    expect(kindOf(blocked._id)).toBe('blocked');
    expect(kindOf(reopened._id)).toBe('unblocked');
    expect(kindOf(other._id)).toBeNull();
    // Append-only (M4-13): the stored rows still carry no kind.
    expect((await Message.findById(blocked._id).lean()).systemKind).toBeUndefined();
  });

  it('a TAGGED notice always uses its tag, whatever its words say', async () => {
    const m = await Message.create({
      conversationId, senderType: 'system', systemKind: 'warning_caution',
      body: 'This conversation has been restricted by MPX Global. Reason: quoted in a warning',
    });
    const res = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(buyer.token));
    expect(res.body.messages.find((x) => x.id === String(m._id)).systemKind).toBe('warning_caution');
  });
});

