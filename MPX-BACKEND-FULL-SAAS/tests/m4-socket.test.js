/**
 * M4-G — live delivery. Run against a REAL socket.io server on an ephemeral
 * port with real clients, because the things worth proving here (rooms,
 * handshake auth, the tokenVersion re-check) only exist at the transport layer.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { io as ioClient } from 'socket.io-client';

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
import { attachSocket } from '../src/realtime/socket.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let httpServer;
let port;
let seq = 0;

let leaf;
let sellerOrg;
let seller;
let buyer;
let outsider;
let product;
let conversationId;
let sa;

const clients = [];

function connect(token) {
  const socket = ioClient(`http://127.0.0.1:${port}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
  clients.push(socket);
  return socket;
}

const connected = (socket) =>
  new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
    setTimeout(() => reject(new Error('connect timeout')), 4000);
  });

const nextEvent = (socket, event, ms = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event}`)), ms);
    socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });

// Fail fast and loudly rather than sitting on vitest's 30s ceiling: a missing
// ack is a real bug and should say so, not look like a slow test.
const emit = (socket, event, payload) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ack for ${event}`)), 4000);
    socket.emit(event, payload, (result) => { clearTimeout(timer); resolve(result); });
  });

/**
 * Close every client and WAIT for the server to see it.
 *
 * Closing without waiting was enough to make nine of these tests hang: the next
 * test connected while the previous sockets were still tearing down, and acks
 * for the new connections never arrived. Each test alone passed, which is the
 * signature of exactly this kind of cross-test bleed.
 */
async function closeAllClients() {
  await Promise.all(
    clients.splice(0).map(
      (socket) =>
        new Promise((resolve) => {
          if (!socket.connected) {
            socket.close();
            resolve();
            return;
          }
          socket.once('disconnect', resolve);
          socket.close();
          setTimeout(resolve, 500); // never hang the suite on a stuck teardown
        }),
    ),
  );
}

async function makeUser(role, orgFields = {}) {
  seq += 1;
  const org = await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `sk_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `11${1000000 + seq}`, e164: `+9111${1000000 + seq}` },
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
  sa = await makeUser('superadmin', { type: 'platform' });

  product = await Product.create({
    exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Cotton Roll',
    status: 'active', price: { mode: 'fixed', min: 300, currency: 'INR' },
  });

  const res = await request(app).post('/inquiries').set(bearer(buyer.token))
    .send({ productId: String(product._id), note: 'Please share your best price.' });
  conversationId = res.body.conversationId;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
  httpServer = createServer(app);
  attachSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterAll(async () => {
  await closeAllClients();
  await new Promise((resolve) => httpServer.close(resolve));
  await mongoose.disconnect();
});

beforeEach(async () => {
  await closeAllClients();
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), Inquiry.deleteMany({}), Conversation.deleteMany({}),
    mongoose.connection.db.collection('messages').deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('M4-G · handshake auth (§7.2)', () => {
  it('a valid token connects', async () => {
    await expect(connected(connect(buyer.token))).resolves.toBeTruthy();
  });

  it('no token, a garbage token and a token for a deleted user are all refused', async () => {
    const ghost = await makeUser('buyer', { buyerSide: true });
    await User.deleteOne({ _id: ghost.user._id });

    for (const token of ['', 'not-a-jwt', ghost.token]) {
      await expect(connected(connect(token))).rejects.toThrow();
    }
  });

  it('a stale tokenVersion cannot connect', async () => {
    const stale = signAccessToken(buyer.user);
    await User.updateOne({ _id: buyer.user._id }, { $inc: { tokenVersion: 1 } });
    await expect(connected(connect(stale))).rejects.toThrow();
  });
});

describe('M4-G · rooms (§7.2)', () => {
  it('both parties receive a message live', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    const sellerSocket = await connected(connect(seller.token));

    const delivered = nextEvent(sellerSocket, 'message:new');
    const ack = await emit(buyerSocket, 'message:send', { conversationId, body: 'live hello' });
    expect(ack.ok).toBe(true);

    const payload = await delivered;
    expect(payload.conversationId).toBe(String(conversationId));
    expect(payload.message.body).toBe('live hello');
    // The wire carries the same projection as REST — no person, ever. Keep this
    // list in step with the two REST guards (m4-messages, m4-conversations):
    // three exact-key assertions is what makes a projection change deliberate.
    expect(Object.keys(payload.message).sort()).toEqual(
      ['body', 'createdAt', 'id', 'senderType', 'systemKind'].sort(),
    );
  });

  it('an outsider is not in the room and receives nothing', async () => {
    const outsiderSocket = await connected(connect(outsider.token));
    const buyerSocket = await connected(connect(buyer.token));

    let leaked = false;
    outsiderSocket.on('message:new', () => { leaked = true; });

    await emit(buyerSocket, 'message:send', { conversationId, body: 'private' });
    await new Promise((r) => setTimeout(r, 400));
    expect(leaked).toBe(false);
  });

  it('an ADMIN joins no room by default, and only one on conversation:open', async () => {
    const adminSocket = await connected(connect(sa.token));
    const buyerSocket = await connected(connect(buyer.token));

    let received = 0;
    adminSocket.on('message:new', () => { received += 1; });

    await emit(buyerSocket, 'message:send', { conversationId, body: 'before open' });
    await new Promise((r) => setTimeout(r, 300));
    expect(received).toBe(0); // idle admins are not pushed thousands of threads

    const opened = await emit(adminSocket, 'conversation:open', { conversationId });
    expect(opened.ok).toBe(true);

    await emit(buyerSocket, 'message:send', { conversationId, body: 'after open' });
    await new Promise((r) => setTimeout(r, 400));
    expect(received).toBe(1);
  });
});

describe('M4-G · the send guards are the SAME ones (§7.3)', () => {
  it('an outsider cannot send into a thread', async () => {
    const outsiderSocket = await connected(connect(outsider.token));
    const ack = await emit(outsiderSocket, 'message:send', { conversationId, body: 'let me in' });
    expect(ack.ok).toBe(false);
    expect(await Message.countDocuments({ conversationId, body: 'let me in' })).toBe(0);
  });

  it('🔴 admin can open a room but STILL cannot speak', async () => {
    const adminSocket = await connected(connect(sa.token));
    await emit(adminSocket, 'conversation:open', { conversationId });

    const ack = await emit(adminSocket, 'message:send', { conversationId, body: 'MPX speaking' });
    expect(ack.ok).toBe(false);
    expect(await Message.countDocuments({ conversationId, body: 'MPX speaking' })).toBe(0);
  });

  it('a frozen thread refuses socket sends too', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    await Conversation.updateOne({ _id: conversationId }, { $set: { frozen: true, frozenReason: 'blocked' } });

    const ack = await emit(buyerSocket, 'message:send', { conversationId, body: 'sneaking past REST' });
    expect(ack.ok).toBe(false);
    expect(await Message.countDocuments({ conversationId, body: 'sneaking past REST' })).toBe(0);
  });

  it('the 200-character cap applies on the socket path as well', async () => {
    const buyerSocket = await connected(connect(buyer.token));

    expect((await emit(buyerSocket, 'message:send', { conversationId, body: 'x'.repeat(200) })).ok).toBe(true);
    expect((await emit(buyerSocket, 'message:send', { conversationId, body: 'x'.repeat(201) })).ok).toBe(false);
    expect((await emit(buyerSocket, 'message:send', { conversationId, body: '   ' })).ok).toBe(false);
    expect((await emit(buyerSocket, 'message:send', { conversationId, body: { $ne: null } })).ok).toBe(false);
  });

  it('🔴 an ALREADY-OPEN socket stops sending once tokenVersion is bumped (§7.2 build note)', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    expect((await emit(buyerSocket, 'message:send', { conversationId, body: 'before' })).ok).toBe(true);

    // This is what the handshake alone cannot catch: the connection is already up.
    await User.updateOne({ _id: buyer.user._id }, { $inc: { tokenVersion: 1 } });

    const ack = await emit(buyerSocket, 'message:send', { conversationId, body: 'after revocation' });
    expect(ack.ok).toBe(false);
    expect(await Message.countDocuments({ conversationId, body: 'after revocation' })).toBe(0);
  });

  it('senderType comes from the role here too — a buyer cannot emit as system', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    await emit(buyerSocket, 'message:send', {
      conversationId, body: 'a line', senderType: 'system', senderOrgId: String(sellerOrg._id),
    });
    const stored = await Message.findOne({ conversationId, body: 'a line' });
    expect(stored.senderType).toBe('buyer');
    expect(String(stored.senderOrgId)).toBe(String(buyer.org._id));
  });
});

describe('M4-G · review fixes', () => {
  it('a client that authenticates by HEADER can also SEND, not just connect', async () => {
    // The handshake accepts auth.token OR an Authorization header, but the
    // per-send re-check used to read only auth.token — so a header client could
    // connect and then never send a single message.
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      extraHeaders: { Authorization: `Bearer ${buyer.token}` },
      transports: ['websocket'],
      reconnection: false,
    });
    clients.push(socket);
    await connected(socket);

    const ack = await emit(socket, 'message:send', { conversationId, body: 'sent via header auth' });
    expect(ack.ok).toBe(true);
    expect(await Message.countDocuments({ conversationId, body: 'sent via header auth' })).toBe(1);
  });

  it('🔴 a revoked token stops RESYNC too, not just sending', async () => {
    // resync hands back message bodies, so a stale socket must not keep serving
    // them after deactivation / password change / org block.
    const socket = await connected(connect(buyer.token));
    expect((await emit(socket, 'conversation:resync', { conversationId })).ok).toBe(true);

    await User.updateOne({ _id: buyer.user._id }, { $inc: { tokenVersion: 1 } });

    const after = await emit(socket, 'conversation:resync', { conversationId });
    expect(after.ok).toBe(false);
    expect(after.messages).toBeUndefined(); // no content leaked
  });

  it('a revoked token also stops mark-read and admin room joins', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    const adminSocket = await connected(connect(sa.token));

    await User.updateOne({ _id: buyer.user._id }, { $inc: { tokenVersion: 1 } });
    await User.updateOne({ _id: sa.user._id }, { $inc: { tokenVersion: 1 } });

    expect((await emit(buyerSocket, 'conversation:read', { conversationId })).ok).toBe(false);
    expect((await emit(adminSocket, 'conversation:open', { conversationId })).ok).toBe(false);
  });

  it('the 200-char rule agrees with REST on trailing whitespace', async () => {
    // zString trims THEN bounds, so 200 chars plus spaces is valid over REST.
    // The socket used to measure before trimming and reject the same input.
    const socket = await connected(connect(buyer.token));
    const padded = `${'x'.repeat(200)}     `;

    const viaRest = await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: padded });
    expect(viaRest.status).toBe(201);

    const viaSocket = await emit(socket, 'message:send', { conversationId, body: padded });
    expect(viaSocket.ok).toBe(true); // same input, same verdict

    // …and 201 real characters is refused on both.
    expect((await emit(socket, 'message:send', { conversationId, body: 'y'.repeat(201) })).ok).toBe(false);
  });
});

describe('M4-G · freeze is PUSHED, not polled (§7.4)', () => {
  it('an admin block reaches an open composer immediately', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    const frozen = nextEvent(buyerSocket, 'conversation:frozen');

    await request(app).post(`/admin/conversations/${conversationId}/block`)
      .set(bearer(sa.token)).send({ reason: 'off-platform payment request' });

    const payload = await frozen;
    expect(payload.conversationId).toBe(String(conversationId));
    expect(payload.reason).toBe('blocked');
  });

  it('a product takedown pushes the freeze, and a restore pushes the reopening', async () => {
    const sellerSocket = await connected(connect(seller.token));

    const frozen = nextEvent(sellerSocket, 'conversation:frozen');
    await request(app).post(`/admin/products/${product._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });
    expect((await frozen).reason).toBe('takedown');

    const unfrozen = nextEvent(sellerSocket, 'conversation:unfrozen');
    await request(app).post(`/admin/products/${product._id}/restore`).set(bearer(sa.token));
    expect((await unfrozen).conversationId).toBe(String(conversationId));
  });
});

describe('M4-G · reconnect recovery (the approved deviation, G9)', () => {
  it('replays only what was missed', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    const [, welcome] = await Message.find({ conversationId }).sort({ createdAt: 1 });

    // Three lines arrive while the client is "away".
    for (const body of ['one', 'two', 'three']) {
      await request(app).post(`/conversations/${conversationId}/messages`)
        .set(bearer(seller.token)).send({ body });
    }

    const ack = await emit(buyerSocket, 'conversation:resync', {
      conversationId, lastMessageId: String(welcome._id),
    });
    expect(ack.ok).toBe(true);
    expect(ack.truncated).toBe(false);
    expect(ack.messages.map((m) => m.body)).toEqual(['one', 'two', 'three']);
  });

  it('says `truncated` rather than firehosing a long absence', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    const [first] = await Message.find({ conversationId }).sort({ createdAt: 1 });

    const bulk = Array.from({ length: 120 }, (_, i) => ({
      conversationId, senderType: 'system', body: `bulk ${i}`,
    }));
    await Message.insertMany(bulk);

    const ack = await emit(buyerSocket, 'conversation:resync', {
      conversationId, lastMessageId: String(first._id),
    });
    expect(ack.truncated).toBe(true);
    expect(ack.messages).toEqual([]); // refetch over REST instead — the socket is not for bulk history
  });

  it('a non-party cannot resync a thread, and an unknown anchor is refused', async () => {
    const outsiderSocket = await connected(connect(outsider.token));
    expect((await emit(outsiderSocket, 'conversation:resync', { conversationId })).ok).toBe(false);

    const buyerSocket = await connected(connect(buyer.token));
    const bad = await emit(buyerSocket, 'conversation:resync', {
      conversationId, lastMessageId: String(new mongoose.Types.ObjectId()),
    });
    expect(bad.ok).toBe(false);
  });
});

describe('M4-G · the socket is never the only path (§7.1)', () => {
  it('everything sent over the socket is readable over REST afterwards', async () => {
    const buyerSocket = await connected(connect(buyer.token));
    await emit(buyerSocket, 'message:send', { conversationId, body: 'sent over the wire' });

    const res = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(seller.token));
    expect(res.body.messages.map((m) => m.body)).toContain('sent over the wire');
  });

  it('conversation:read over the socket updates unread the same way REST does', async () => {
    const sellerSocket = await connected(connect(seller.token));
    expect((await emit(sellerSocket, 'conversation:read', { conversationId })).ok).toBe(true);

    const list = await request(app).get('/conversations').set(bearer(seller.token));
    expect(list.body.conversations[0].unread).toBe(false);
  });
});
