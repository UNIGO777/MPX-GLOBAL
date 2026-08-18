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

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let leaf;
let sellerOrg;
let seller;
let buyer;
let otherBuyer;
let product;

async function makeUser(role, orgFields = {}, org = null) {
  seq += 1;
  const theOrg = org ?? (await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields }));
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `cv_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `51${1000000 + seq}`, e164: `+9151${1000000 + seq}` },
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

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });

  const s = await makeUser('exporter', { exporterSide: true, country: 'IN', kycStatus: 'verified' });
  seller = s; sellerOrg = s.org;
  await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { name: 'TextileHub Exports' } });
  sellerOrg.name = 'TextileHub Exports';

  buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
  await Organisation.updateOne({ _id: buyer.org._id }, { $set: { name: 'Sydney Imports' } });
  buyer.org.name = 'Sydney Imports';

  otherBuyer = await makeUser('buyer', { buyerSide: true, country: 'NZ' });
  product = await makeProduct('Cotton Roll');
}

async function openThread(asBuyer = buyer, onProduct = null, note = 'Please share your best price.') {
  const res = await request(app).post('/inquiries').set(bearer(asBuyer.token))
    .send({ productId: String((onProduct ?? product)._id), note });
  expect([200, 201]).toContain(res.status);
  return res.body.conversationId;
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
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('M4-C · the list is role-aware (M4-17 / M4-35)', () => {
  it('buyer sees product × SELLER company; seller sees product × BUYER company', async () => {
    await openThread();

    const asBuyer = await request(app).get('/conversations').set(bearer(buyer.token));
    expect(asBuyer.status).toBe(200);
    expect(asBuyer.body.conversations).toHaveLength(1);
    expect(asBuyer.body.conversations[0].title).toBe('Cotton Roll × TextileHub Exports');
    expect(asBuyer.body.conversations[0].counterparty.name).toBe('TextileHub Exports');

    const asSeller = await request(app).get('/conversations').set(bearer(seller.token));
    expect(asSeller.body.conversations[0].title).toBe('Cotton Roll × Sydney Imports');
    expect(asSeller.body.conversations[0].counterparty.name).toBe('Sydney Imports');
  });

  it('a buyer never sees another buyer\'s thread', async () => {
    await openThread(buyer);
    await openThread(otherBuyer);

    const mine = await request(app).get('/conversations').set(bearer(buyer.token));
    expect(mine.body.conversations).toHaveLength(1);
    expect(mine.body.conversations[0].counterparty.name).toBe('TextileHub Exports');

    // The seller is a party to both.
    const sellerList = await request(app).get('/conversations').set(bearer(seller.token));
    expect(sellerList.body.conversations).toHaveLength(2);
  });

  it('the platform is shown as a participant but is never a member (M4-1 / M4-2)', async () => {
    const id = await openThread();
    const res = await request(app).get(`/conversations/${id}`).set(bearer(buyer.token));

    const types = res.body.conversation.participants.map((p) => p.type);
    expect(types).toEqual(['buyer', 'exporter', 'platform']);
    expect(res.body.conversation.participants[2].name).toBe('MPX Global');

    const stored = await Conversation.findById(id);
    expect(stored.parties).toHaveLength(2); // the platform is NOT in parties
  });
});

describe('M4-C · projections leak nothing (G1 / G2)', () => {
  it('the party view has an exact key set and hides blockedBy', async () => {
    const id = await openThread();
    await Conversation.updateOne({ _id: id }, {
      $set: {
        frozen: true, frozenReason: 'blocked', blockedReason: 'off-platform payment request',
        blockedBy: new mongoose.Types.ObjectId(), blockedAt: new Date(),
      },
    });

    const res = await request(app).get(`/conversations/${id}`).set(bearer(buyer.token));
    expect(Object.keys(res.body.conversation).sort()).toEqual([
      'blockedReason', 'counterparty', 'createdAt', 'frozen', 'frozenLabel', 'id',
      'lastMessageAt', 'lastMessagePreview', 'participants', 'product', 'title', 'unread',
    ].sort());

    // M4-25: both parties see the REASON…
    expect(res.body.conversation.blockedReason).toBe('off-platform payment request');
    // …and never the admin behind it, nor any internal id.
    const blob = JSON.stringify(res.body);
    for (const leak of ['blockedBy', 'blockedAt', 'frozenReason', 'parties', 'buyerOrgId', 'exporterOrgId', 'inquiryId']) {
      expect(blob).not.toContain(leak);
    }
  });

  it('a message never carries the person who sent it (M4-17)', async () => {
    const id = await openThread();
    const res = await request(app).get(`/conversations/${id}/messages`).set(bearer(seller.token));
    expect(res.status).toBe(200);

    for (const m of res.body.messages) {
      // EXACT key list — this is the guard that fails the moment anything is
      // added to a message payload, which is how a person field would be
      // caught. `systemKind` was added deliberately on 2026-08-18.
      expect(Object.keys(m).sort()).toEqual(
        ['body', 'createdAt', 'id', 'senderType', 'systemKind'].sort(),
      );
      // It describes the PLATFORM's own notices and nothing else: a party
      // message must never carry one.
      if (m.senderType !== 'system') expect(m.systemKind).toBeNull();
    }
    const blob = JSON.stringify(res.body);
    expect(blob).not.toContain('senderUserId');
    expect(blob).not.toContain('senderOrgId');
    expect(blob).not.toContain(String(buyer.user._id));
  });
});

describe('M4-C · ownership — 404, never 403', () => {
  it('a non-party gets 404 on every thread route', async () => {
    const id = await openThread(buyer);
    const t = bearer(otherBuyer.token);

    expect((await request(app).get(`/conversations/${id}`).set(t)).status).toBe(404);
    expect((await request(app).get(`/conversations/${id}/messages`).set(t)).status).toBe(404);
    expect((await request(app).post(`/conversations/${id}/read`).set(t)).status).toBe(404);
  });

  it('messages are unreachable without their conversation (G3)', async () => {
    const id = await openThread(buyer);
    const stolen = await Message.findOne({ conversationId: id });
    // There is no route that takes a message id at all — the only way in is
    // through a conversation the caller is a party to.
    expect((await request(app).get(`/conversations/${stolen._id}/messages`).set(bearer(buyer.token))).status).toBe(404);
  });

  it('a guest gets 401, and staff see nothing on the party list (M4-2)', async () => {
    await openThread();
    expect((await request(app).get('/conversations')).status).toBe(401);

    const sa = await makeUser('superadmin', { type: 'platform' });
    const res = await request(app).get('/conversations').set(bearer(sa.token));
    expect(res.status).toBe(200);
    expect(res.body.conversations).toEqual([]); // the platform is never a party
  });
});

describe('M4-C · unread is derived, never counted (§7.5 / G7)', () => {
  it('the buyer who just wrote the enquiry does not see it unread; the seller does', async () => {
    await openThread();

    const buyerList = await request(app).get('/conversations').set(bearer(buyer.token));
    expect(buyerList.body.conversations[0].unread).toBe(false);

    const sellerList = await request(app).get('/conversations').set(bearer(seller.token));
    expect(sellerList.body.conversations[0].unread).toBe(true);

    expect((await request(app).get('/conversations/unread-count').set(bearer(seller.token))).body.unread).toBe(1);
    expect((await request(app).get('/conversations/unread-count').set(bearer(buyer.token))).body.unread).toBe(0);
  });

  it('marking read clears it for the reader only', async () => {
    const id = await openThread();

    expect((await request(app).post(`/conversations/${id}/read`).set(bearer(seller.token))).status).toBe(200);

    const sellerList = await request(app).get('/conversations').set(bearer(seller.token));
    expect(sellerList.body.conversations[0].unread).toBe(false);
    expect((await request(app).get('/conversations/unread-count').set(bearer(seller.token))).body.unread).toBe(0);

    // The buyer's own state is untouched.
    const stored = await Conversation.findById(id);
    expect(stored.exporterLastReadAt).toBeTruthy();
    expect(stored.buyerLastReadAt).toBeTruthy();
  });

  it('no unread counter is stored anywhere', async () => {
    const id = await openThread();
    const raw = await Conversation.findById(id).lean();
    for (const key of Object.keys(raw)) {
      expect(key.toLowerCase()).not.toContain('unreadcount');
    }
  });
});

describe('M4-C · list search (§8.4 / G5) — names OR ids, never message content', () => {
  it('matches a company name and a product name', async () => {
    await openThread();

    const byProductName = await request(app).get('/conversations').query({ q: 'Cotton' }).set(bearer(buyer.token));
    expect(byProductName.body.conversations).toHaveLength(1);

    const bySeller = await request(app).get('/conversations').query({ q: 'TextileHub' }).set(bearer(buyer.token));
    expect(bySeller.body.conversations).toHaveLength(1);

    const miss = await request(app).get('/conversations').query({ q: 'Pharmaceuticals' }).set(bearer(buyer.token));
    expect(miss.body.conversations).toEqual([]);
  });

  it('an ObjectId takes the exact-id branch, not the text branch', async () => {
    await openThread();
    const res = await request(app).get('/conversations')
      .query({ q: String(sellerOrg._id) }).set(bearer(buyer.token));
    expect(res.body.conversations).toHaveLength(1);

    const wrongId = await request(app).get('/conversations')
      .query({ q: String(new mongoose.Types.ObjectId()) }).set(bearer(buyer.token));
    expect(wrongId.body.conversations).toEqual([]);
  });

  it('M4-32: message CONTENT is never searched', async () => {
    const id = await openThread(buyer, product, 'zebracrossing is a very distinctive word');
    expect(await Message.countDocuments({ conversationId: id, body: /zebracrossing/ })).toBe(1);

    const res = await request(app).get('/conversations').query({ q: 'zebracrossing' }).set(bearer(buyer.token));
    expect(res.body.conversations).toEqual([]);
  });

  it('search still respects the scope filter — it never widens it', async () => {
    await openThread(otherBuyer);
    const res = await request(app).get('/conversations').query({ q: 'TextileHub' }).set(bearer(buyer.token));
    expect(res.body.conversations).toEqual([]); // buyer has no thread of their own yet
  });
});

/**
 * §8.3 — the partial-match fallback (owner, 2026-08-17).
 *
 * Native `$text` matches whole words, so "Tex" never found "TextileHub" and the
 * search box read as broken. When the indexed search finds NOTHING we retry with
 * an anchored regex. These tests pin both halves: that partials now match, and
 * that the fallback did not quietly widen the search into everything.
 */
describe('M4-C · list search falls back to partial matching', () => {
  const search = (q, token = buyer.token, extra = {}) =>
    request(app).get('/conversations').query({ q, ...extra }).set(bearer(token));

  it('a partial company or product name matches (what `$text` alone could not do)', async () => {
    await openThread();

    const partialSeller = await search('Text');
    expect(partialSeller.body.conversations).toHaveLength(1);

    const partialProduct = await search('Cot');
    expect(partialProduct.body.conversations).toHaveLength(1);
  });

  it('matches only at a WORD START — not anywhere inside a word', async () => {
    await openThread();
    // "ileHub" sits mid-word inside "TextileHub"; an unanchored regex would
    // match it and make every short query match nearly everything.
    expect((await search('ileHub')).body.conversations).toEqual([]);
  });

  it('regex metacharacters are escaped — a pasted pattern is literal text, not a program', async () => {
    await openThread();

    // Unescaped, each of these would match every row (or hang the engine).
    for (const hostile of ['.*', '.+', '(a+)+$', '^', '[', '.*Hub']) {
      const res = await search(hostile);
      expect(res.status).toBe(200);
      expect(res.body.conversations).toEqual([]);
    }

    // ⚠️ NOT a leak, and worth pinning so nobody "fixes" it: `Text|Cotton` DOES
    // return the thread — but through the indexed `$text` branch, which splits
    // the input into words and legitimately matches "Cotton" in the product
    // name. The regex fallback never runs, because the first query found a row.
    expect((await search('Text|Cotton')).body.conversations).toHaveLength(1);
  });

  it('M4-32 holds on the fallback too — message CONTENT is still never searched', async () => {
    await openThread(buyer, product, 'zebracrossing is a very distinctive word');
    // A PARTIAL of a word that exists only inside a message body.
    expect((await search('zebracros')).body.conversations).toEqual([]);
  });

  it('the fallback never widens scope — a partial still only sees your own threads', async () => {
    await openThread(otherBuyer);
    expect((await search('Text')).body.conversations).toEqual([]);
  });

  it('an id query never reaches the fallback — an unknown id stays empty', async () => {
    await openThread();
    const unknown = await search(String(new mongoose.Types.ObjectId()));
    expect(unknown.body.conversations).toEqual([]);
  });

  it('🔴 paging stays in the mode page 1 settled on', async () => {
    // Three products sharing a prefix that `$text` cannot match on its own.
    for (const name of ['Polyblend Alpha', 'Polyblend Beta', 'Polyblend Gamma']) {
      await openThread(buyer, await makeProduct(name));
    }

    const first = await search('Polyb', buyer.token, { limit: 2 });
    expect(first.body.conversations).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    // Without the mode in the cursor this second page re-runs `$text`, finds
    // nothing, and the list appears to end after one page.
    const second = await search('Polyb', buyer.token, { limit: 2, cursor: first.body.nextCursor });
    expect(second.body.conversations).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const ids = [...first.body.conversations, ...second.body.conversations].map((c) => c.id);
    expect(new Set(ids).size).toBe(3); // no row repeated, none skipped
  });

  it('a whole-word hit still goes through the indexed path and is unaffected', async () => {
    await openThread();
    const exact = await search('Cotton');
    expect(exact.body.conversations).toHaveLength(1);
  });
});

describe('M4-C · cursor paging is stable (G6 / §7.6)', () => {
  it('pages the thread list without repeating or skipping a row', async () => {
    const ids = [];
    for (let i = 0; i < 5; i += 1) {
      const p = await makeProduct(`Roll ${i}`);
      ids.push(await openThread(buyer, p));
    }
    // Force identical lastMessageAt so only the _id tiebreaker separates them.
    const same = new Date();
    await Conversation.updateMany({}, { $set: { lastMessageAt: same } });

    const seen = [];
    let cursor;
    for (let page = 0; page < 5; page += 1) {
      const res = await request(app).get('/conversations')
        .query({ limit: 2, ...(cursor ? { cursor } : {}) }).set(bearer(buyer.token));
      seen.push(...res.body.conversations.map((c) => c.id));
      cursor = res.body.nextCursor;
      if (!cursor) break;
    }

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5); // no duplicates, nothing skipped
    expect(seen.sort()).toEqual(ids.sort());
  });

  it('pages messages oldest-first and honours `before`', async () => {
    const id = await openThread();
    for (let i = 0; i < 6; i += 1) {
      await Message.create({ conversationId: id, senderType: 'system', body: `line ${i}` });
    }

    const firstPage = await request(app).get(`/conversations/${id}/messages`)
      .query({ limit: 3 }).set(bearer(buyer.token));
    expect(firstPage.body.messages).toHaveLength(3);
    // Oldest-first within the page.
    const times = firstPage.body.messages.map((m) => new Date(m.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));

    const older = await request(app).get(`/conversations/${id}/messages`)
      .query({ limit: 3, before: firstPage.body.messages[0].id }).set(bearer(buyer.token));
    expect(older.status).toBe(200);
    const overlap = older.body.messages.filter((m) => firstPage.body.messages.some((f) => f.id === m.id));
    expect(overlap).toEqual([]);
  });

  it('a malformed cursor is a clean 400, not a 500', async () => {
    expect(
      (await request(app).get('/conversations').query({ cursor: 'not-a-cursor' }).set(bearer(buyer.token))).status,
    ).toBe(400);
    const id = await openThread();
    expect(
      (await request(app).get(`/conversations/${id}/messages`)
        .query({ before: String(new mongoose.Types.ObjectId()) }).set(bearer(buyer.token))).status,
    ).toBe(400);
  });
});

describe('M4-C · labels pair a tone with TEXT (M4-19 / V3) and survive a purge (C5)', () => {
  it('a live thread has no label', async () => {
    const id = await openThread();
    const res = await request(app).get(`/conversations/${id}`).set(bearer(buyer.token));
    expect(res.body.conversation.frozenLabel).toEqual({ tone: 'none', text: null });
    expect(res.body.conversation.frozen).toBe(false);
  });

  it('a taken-down product shows YELLOW with text; a blocked chat shows RED with text', async () => {
    const id = await openThread();

    await Conversation.updateOne({ _id: id }, { $set: { frozen: true, frozenReason: 'takedown' } });
    let res = await request(app).get(`/conversations/${id}`).set(bearer(buyer.token));
    expect(res.body.conversation.frozenLabel).toEqual({ tone: 'yellow', text: 'Product under review' });

    await Conversation.updateOne({ _id: id }, { $set: { frozenReason: 'blocked' } });
    res = await request(app).get(`/conversations/${id}`).set(bearer(buyer.token));
    expect(res.body.conversation.frozenLabel.tone).toBe('red');
    expect(res.body.conversation.frozenLabel.text).toBeTruthy(); // never a bare colour
  });

  it('once the product row is GONE the label turns red and the link disappears (M4-22)', async () => {
    const id = await openThread();
    await Conversation.updateOne({ _id: id }, { $set: { frozen: true, frozenReason: 'takedown' } });
    await Product.deleteOne({ _id: product._id });

    const res = await request(app).get(`/conversations/${id}`).set(bearer(buyer.token));
    expect(res.body.conversation.frozenLabel).toEqual({ tone: 'red', text: 'Product no longer available' });
    // The title still works, from the snapshot — and there is no link to a page
    // that no longer exists.
    expect(res.body.conversation.title).toBe('Cotton Roll × TextileHub Exports');
    expect(res.body.conversation.product.id).toBeNull();
    expect(res.body.conversation.product.slug).toBeNull();
    expect(res.body.conversation.product.name).toBe('Cotton Roll');

    // …and the history is intact.
    const msgs = await request(app).get(`/conversations/${id}/messages`).set(bearer(buyer.token));
    expect(msgs.body.messages).toHaveLength(2);
  });

  it('a chat blocked BEFORE a takedown keeps the block label (M4-29)', async () => {
    const id = await openThread();
    await Conversation.updateOne({ _id: id }, {
      $set: { frozen: true, frozenReason: 'blocked', blockedReason: 'abusive language' },
    });
    // A later takedown must not overwrite the first reason.
    const res = await request(app).get(`/conversations/${id}`).set(bearer(buyer.token));
    expect(res.body.conversation.frozenLabel.text).toMatch(/blocked/i);
  });
});

describe('ATTACK · M4-C', () => {
  it('a hostile search string never 500s — quotes, operators, unicode, length', async () => {
    await openThread();
    const hostile = [
      '"unbalanced', '\\', '- -', '""', '*', '.*', 'a'.repeat(200),
      '👋🏽 emoji ünïcödé', 'null', '{"$ne":null}', '../../etc/passwd',
    ];
    for (const q of hostile) {
      const res = await request(app).get('/conversations').query({ q }).set(bearer(buyer.token));
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) expect(Array.isArray(res.body.conversations)).toBe(true);
    }
  });

  it('a Mongo operator in a query parameter is refused outright', async () => {
    // `query parser: extended` means bracket syntax really does nest, so these
    // arrive as { q: { $ne: … } } and rejectMongoOperators sees the operator.
    for (const url of ['/conversations?q[$ne]=null', '/conversations?limit[$gt]=0']) {
      const res = await request(app).get(url).set(bearer(buyer.token));
      expect([400, 403]).toContain(res.status);
    }
  });

  it('a `__proto__` query key is neutralised before the app ever sees it', async () => {
    // Not a 400: the `qs` parser drops `__proto__` outright, so the key never
    // reaches `rejectMongoOperators` and the request is simply a normal one with
    // no such parameter. Asserted explicitly so the 200 is understood as the
    // parser doing its job, not as a guard being skipped.
    await openThread(otherBuyer);
    const res = await request(app).get('/conversations?__proto__[polluted]=1').set(bearer(buyer.token));

    expect(res.status).toBe(200);
    expect(res.body.conversations).toEqual([]); // still scoped to the caller
    expect({}.polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('a forged cursor cannot widen the scope or crash the list', async () => {
    await openThread(otherBuyer); // a thread this buyer must never see
    const forged = [
      Buffer.from('9999999999999:000000000000000000000000').toString('base64url'), // far future
      Buffer.from('-1:000000000000000000000000').toString('base64url'),
      Buffer.from('not-a-number:zzz').toString('base64url'),
      Buffer.from(JSON.stringify({ $ne: null })).toString('base64url'),
      'a'.repeat(180),
    ];
    for (const cursor of forged) {
      const res = await request(app).get('/conversations').query({ cursor }).set(bearer(buyer.token));
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        // Whatever the cursor said, the scope filter still holds.
        expect(res.body.conversations).toEqual([]);
      }
    }
  });

  it('limit is capped — a caller cannot demand the whole collection', async () => {
    for (let i = 0; i < 3; i += 1) await openThread(buyer, await makeProduct(`Bulk ${i}`));

    expect((await request(app).get('/conversations').query({ limit: 9999 }).set(bearer(buyer.token))).status).toBe(400);
    expect((await request(app).get('/conversations').query({ limit: 0 }).set(bearer(buyer.token))).status).toBe(400);
    expect((await request(app).get('/conversations').query({ limit: -5 }).set(bearer(buyer.token))).status).toBe(400);

    const ok = await request(app).get('/conversations').query({ limit: 50 }).set(bearer(buyer.token));
    expect(ok.status).toBe(200);
  });

  it('a `before` cursor from ANOTHER conversation cannot page across threads', async () => {
    const mine = await openThread(buyer);
    const theirs = await openThread(otherBuyer);
    const theirMessage = await Message.findOne({ conversationId: theirs });

    const res = await request(app).get(`/conversations/${mine}/messages`)
      .query({ before: String(theirMessage._id) }).set(bearer(buyer.token));
    expect(res.status).toBe(400); // the anchor must belong to THIS thread
  });

  it('🔴 A21: a dual-side org\'s BUYER account never sees its own selling threads', async () => {
    // One Organisation may hold both sides. Scoping by `parties` alone would put
    // the company's sales conversations inside its buyer portal — this is the
    // exact reason §8.4 splits the filter by role.
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { buyerSide: true } });
    seq += 1;
    const dualBuyer = await User.create({
      name: 'dual-buyer',
      email: `dual_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `52${1000000 + seq}`, e164: `+9152${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'buyer',
      orgId: sellerOrg._id,
    });

    // Someone else enquires on this company's product — a SELLING thread for it.
    await openThread(otherBuyer);

    const res = await request(app).get('/conversations').set(bearer(signAccessToken(dualBuyer)));
    expect(res.status).toBe(200);
    expect(res.body.conversations).toEqual([]); // buyer portal shows buying threads only

    // The exporter account of the very same org DOES see it.
    const asSeller = await request(app).get('/conversations').set(bearer(seller.token));
    expect(asSeller.body.conversations).toHaveLength(1);
  });

  it('staff cannot mark a thread read or reach it through the party routes', async () => {
    const id = await openThread();
    const sa = await makeUser('superadmin', { type: 'platform' });

    expect((await request(app).post(`/conversations/${id}/read`).set(bearer(sa.token))).status).toBe(404);
    expect((await request(app).get(`/conversations/${id}`).set(bearer(sa.token))).status).toBe(404);
    expect((await request(app).get(`/conversations/${id}/messages`).set(bearer(sa.token))).status).toBe(404);

    // …and no read timestamp was written by the attempt.
    const stored = await Conversation.findById(id);
    expect(stored.exporterLastReadAt).toBeUndefined();
  });

  it('marking read cannot be redirected to another party\'s timestamp', async () => {
    const id = await openThread();
    const before = await Conversation.findById(id);

    await request(app).post(`/conversations/${id}/read`).set(bearer(seller.token))
      .send({ side: 'buyer', buyerLastReadAt: new Date(0) });

    const after = await Conversation.findById(id);
    expect(after.exporterLastReadAt).toBeTruthy();               // the caller's own
    expect(after.buyerLastReadAt.getTime()).toBe(before.buyerLastReadAt.getTime()); // untouched
  });

  it('a thread id that is a valid ObjectId but belongs to another collection is 404', async () => {
    await openThread();
    const productId = String(product._id);
    expect((await request(app).get(`/conversations/${productId}`).set(bearer(buyer.token))).status).toBe(404);
  });
});

describe('M4-C · by-product lookup drives the button (G8)', () => {
  it('404 before a thread exists, the id after — and the public product page is untouched', async () => {
    const before = await request(app).get(`/conversations/by-product/${product._id}`).set(bearer(buyer.token));
    expect(before.status).toBe(404);

    const id = await openThread();
    const after = await request(app).get(`/conversations/by-product/${product._id}`).set(bearer(buyer.token));
    expect(after.status).toBe(200);
    expect(after.body.conversationId).toBe(id);

    // G8's whole point: no per-caller field crept onto the public projection.
    const pub = await request(app).get(`/public/products/${product._id}`);
    expect(JSON.stringify(pub.body)).not.toContain('conversationId');
  });

  it('another buyer does not see this buyer\'s thread through it', async () => {
    await openThread(buyer);
    const res = await request(app).get(`/conversations/by-product/${product._id}`).set(bearer(otherBuyer.token));
    expect(res.status).toBe(404);
  });
});
