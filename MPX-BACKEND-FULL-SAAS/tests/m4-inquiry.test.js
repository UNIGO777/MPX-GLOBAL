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
import { WELCOME_MESSAGE } from '../src/services/inquiry.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let goodsLeaf;
let serviceLeaf;
let sellerOrg;
let buyer;
let product;
let servicePpoduct;

async function makeUser(role, orgFields = {}) {
  seq += 1;
  const org = await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `inq_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `61${1000000 + seq}`, e164: `+9161${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
  });
  return { org, user, token: signAccessToken(user) };
}

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  goodsLeaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  const itTop = await Category.create({ name: 'IT services', slug: 'it-services' });
  serviceLeaf = await Category.create({ name: 'Web development', parentId: itTop._id, type: 'service' });

  sellerOrg = await Organisation.create({
    name: 'TextileHub Exports', type: 'business', exporterSide: true, country: 'IN', kycStatus: 'verified',
  });
  product = await Product.create({
    exporterOrgId: sellerOrg._id, categoryId: goodsLeaf._id, name: 'Cotton Roll',
    status: 'active', price: { mode: 'fixed', min: 300, currency: 'INR' },
  });
  servicePpoduct = await Product.create({
    exporterOrgId: sellerOrg._id, categoryId: serviceLeaf._id, name: 'Website Build',
    status: 'active', price: { mode: 'on_request' },
  });

  buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
}

const enquiry = (extra = {}) => ({ productId: String(product._id), note: 'Please share your best price.', ...extra });

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

describe('M4-B · creating an enquiry (the happy path)', () => {
  it('creates Inquiry + Conversation + BOTH opening messages, in the fixed order (M4-10)', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(
      enquiry({ fields: { quantity: 5000, unit: 'metres', targetPrice: 120, currency: 'INR', deliveryCountry: 'AU' } }),
    );
    expect(res.status).toBe(201);
    expect(res.body.conversationId).toBeTruthy();

    const conversation = await Conversation.findById(res.body.conversationId);
    const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1, _id: 1 });

    expect(messages).toHaveLength(2);
    // #1 is the buyer's composed enquiry…
    expect(messages[0].senderType).toBe('buyer');
    expect(messages[0].body).toContain('Quantity: 5000');
    expect(messages[0].body).toContain('Target price: 120');
    expect(messages[0].body).toContain('Please share your best price.');
    // …#2 is the platform, verbatim (M4-11), with no org and no person behind it.
    expect(messages[1].senderType).toBe('system');
    expect(messages[1].body).toBe(WELCOME_MESSAGE);
    expect(messages[1].senderOrgId).toBeUndefined();
    expect(messages[1].senderUserId).toBeUndefined();
  });

  it('the welcome does NOT push the deal off-platform (the §14 concern)', () => {
    expect(WELCOME_MESSAGE).not.toMatch(/complete your deal/i);
    expect(WELCOME_MESSAGE).toMatch(/keep all discussion and documents here/i);
  });

  it('snapshots the three names and seeds the list fields', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry());
    const c = await Conversation.findById(res.body.conversationId);

    expect(c.productNameSnapshot).toBe('Cotton Roll');
    expect(c.exporterOrgName).toBe('TextileHub Exports');
    expect(c.buyerOrgName).toBe(buyer.org.name);
    expect(c.lastMessageAt).toBeTruthy();
    expect(c.lastMessagePreview).toContain('Please share your best price.');
    expect(c.frozen).toBe(false);
  });

  it('the composed first message is allowed past 200 characters (M4-12)', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(
      enquiry({
        note: 'x'.repeat(200),
        fields: { quantity: 5000, unit: 'metres', targetPrice: 120, currency: 'INR', deliveryTimeline: 'within 6 weeks please' },
      }),
    );
    expect(res.status).toBe(201);
    const [first] = await Message.find({ conversationId: res.body.conversationId }).sort({ createdAt: 1 });
    expect(first.body.length).toBeGreaterThan(200);
  });

  it('stores the structured ask on Inquiry so it stays queryable (M4-6/M4-8)', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(
      enquiry({ fields: { quantity: 1000, unit: 'kg', targetPrice: 55, currency: 'USD' } }),
    );
    const inq = await Inquiry.findById(res.body.inquiry.id);
    expect(inq.fields).toMatchObject({ quantity: 1000, unit: 'kg', targetPrice: 55, currency: 'USD' });
    expect(inq.note).toBe('Please share your best price.');
    expect(inq.status).toBe('open');
    expect(String(inq.categoryId)).toBe(String(goodsLeaf._id));
  });

  it('accepts an enquiry with only a note', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry());
    expect(res.status).toBe(201);
    expect((await Inquiry.findById(res.body.inquiry.id)).fields).toEqual({});
  });
});

describe('M4-B · one thread per product (M4-5)', () => {
  it('a second enquiry returns the EXISTING thread with 200, and creates nothing', async () => {
    const first = await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry());
    expect(first.status).toBe(201);

    const second = await request(app).post('/inquiries').set(bearer(buyer.token)).send(
      enquiry({ note: 'a completely different question' }),
    );
    expect(second.status).toBe(200); // not 201 — nothing was created
    expect(second.body.conversationId).toBe(first.body.conversationId);

    expect(await Conversation.countDocuments({})).toBe(1);
    expect(await Inquiry.countDocuments({})).toBe(1);
    expect(await Message.countDocuments({})).toBe(2); // no extra messages either
  });

  it('CONCURRENT first enquiries resolve to ONE thread, never a 500 (V7)', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry())),
    );

    for (const r of results) expect([200, 201]).toContain(r.status);
    const ids = new Set(results.map((r) => r.body.conversationId));
    expect(ids.size).toBe(1);
    expect(await Conversation.countDocuments({})).toBe(1);
    expect(await Message.countDocuments({})).toBe(2);
  });

  it('the same buyer may open a separate thread on a DIFFERENT product', async () => {
    await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry());
    const other = await request(app).post('/inquiries').set(bearer(buyer.token)).send(
      enquiry({ productId: String(servicePpoduct._id) }),
    );
    expect(other.status).toBe(201);
    expect(await Conversation.countDocuments({})).toBe(2);
  });
});

describe('M4-B · guards', () => {
  it('🔴 F4: a company cannot enquire on its OWN product (M4-39)', async () => {
    // A21 lets one Organisation hold both sides — so this is reachable, and the
    // model cannot express it. This service check is the only thing stopping it.
    seq += 1;
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { buyerSide: true } });
    const selfBuyer = await User.create({
      name: 'self-buyer',
      email: `self_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `62${1000000 + seq}`, e164: `+9162${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'buyer',
      orgId: sellerOrg._id,
    });

    const res = await request(app).post('/inquiries').set(bearer(signAccessToken(selfBuyer))).send(enquiry());
    expect(res.status).toBe(400);
    expect(await Conversation.countDocuments({})).toBe(0);
  });

  it('an EXPORTER account cannot enquire, and neither can a superadmin or a guest', async () => {
    const exporter = await makeUser('exporter', { exporterSide: true });
    expect((await request(app).post('/inquiries').set(bearer(exporter.token)).send(enquiry())).status).toBe(403);

    const sa = await makeUser('superadmin', { type: 'platform' });
    expect((await request(app).post('/inquiries').set(bearer(sa.token)).send(enquiry())).status).toBe(403);

    expect((await request(app).post('/inquiries').send(enquiry())).status).toBe(401);
    expect(await Conversation.countDocuments({})).toBe(0);
  });

  it('a product that is not publicly visible cannot be enquired on — 404 every time', async () => {
    const sa = await makeUser('superadmin', { type: 'platform' });

    const draft = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: goodsLeaf._id, name: 'Draft Roll', status: 'draft',
    });
    const inactive = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: goodsLeaf._id, name: 'Hidden Roll', status: 'inactive',
    });
    const archived = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: goodsLeaf._id, name: 'Gone Roll', status: 'archived',
    });

    for (const p of [draft, inactive, archived]) {
      const res = await request(app).post('/inquiries').set(bearer(buyer.token))
        .send(enquiry({ productId: String(p._id) }));
      expect(res.status).toBe(404);
    }

    // …and a taken-down product too.
    await request(app).post(`/admin/products/${product._id}/takedown`).set(bearer(sa.token))
      .send({ reason: 'counterfeit listing' });
    expect((await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry())).status).toBe(404);

    expect(await Conversation.countDocuments({})).toBe(0);
  });

  it('a product in a DEACTIVATED category cannot be enquired on (cascade)', async () => {
    await Category.updateOne({ _id: goodsLeaf.parentId }, { $set: { active: false } });
    invalidateLeafCache();
    expect((await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry())).status).toBe(404);
  });

  it('an unknown product id is a clean 404, a malformed one a 400', async () => {
    expect(
      (await request(app).post('/inquiries').set(bearer(buyer.token))
        .send(enquiry({ productId: String(new mongoose.Types.ObjectId()) }))).status,
    ).toBe(404);
    expect(
      (await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry({ productId: 'nope' }))).status,
    ).toBe(400);
  });
});

describe('M4-B · enquiry field validation (M4-9, locked sets)', () => {
  it('rejects an unknown field rather than silently dropping it', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token))
      .send(enquiry({ fields: { quantity: 10, sneaky: 'value' } }));
    expect(res.status).toBe(400);
    expect(await Conversation.countDocuments({})).toBe(0);
  });

  it('rejects a SERVICE field on a goods product, and vice versa', async () => {
    expect(
      (await request(app).post('/inquiries').set(bearer(buyer.token))
        .send(enquiry({ fields: { engagementType: 'retainer' } }))).status,
    ).toBe(400);

    expect(
      (await request(app).post('/inquiries').set(bearer(buyer.token))
        .send(enquiry({ productId: String(servicePpoduct._id), fields: { quantity: 10 } }))).status,
    ).toBe(400);
  });

  it('accepts the service field set on a service product', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(
      enquiry({
        productId: String(servicePpoduct._id),
        fields: { engagementType: 'retainer', budget: 5000, currency: 'USD', timeline: '3 months', deliveryModel: 'remote' },
      }),
    );
    expect(res.status).toBe(201);
  });

  it('an amount without a currency is refused — it is ambiguous across markets', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token))
      .send(enquiry({ fields: { targetPrice: 120 } }));
    expect(res.status).toBe(400);
  });

  it('rejects a bad currency, a bad country and a negative quantity', async () => {
    for (const fields of [
      { targetPrice: 10, currency: 'XYZ' },
      { deliveryCountry: 'AUS' },
      { quantity: -5 },
    ]) {
      expect((await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry({ fields }))).status).toBe(400);
    }
  });

  it('requires a note, and caps it at 200 characters', async () => {
    expect(
      (await request(app).post('/inquiries').set(bearer(buyer.token))
        .send({ productId: String(product._id) })).status,
    ).toBe(400);
    expect(
      (await request(app).post('/inquiries').set(bearer(buyer.token))
        .send(enquiry({ note: 'x'.repeat(201) }))).status,
    ).toBe(400);
  });

  it('rejects a Mongo operator inside the fields bag', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token))
      .send(enquiry({ fields: { quantity: { $gt: 0 } } }));
    expect(res.status).toBe(400);
  });
});

describe('ATTACK · M4-B', () => {
  it('mass assignment: ownership and status come from the server, never the body', async () => {
    const victimOrg = await Organisation.create({
      name: 'Victim Buyer', type: 'business', buyerSide: true, country: 'NZ',
    });

    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send({
      ...enquiry(),
      buyerOrgId: String(victimOrg._id),
      exporterOrgId: String(victimOrg._id),
      parties: [String(victimOrg._id)],
      status: 'closed',
      createdBy: String(new mongoose.Types.ObjectId()),
    });
    expect(res.status).toBe(201);

    const inq = await Inquiry.findById(res.body.inquiry.id);
    expect(String(inq.buyerOrgId)).toBe(String(buyer.org._id)); // from the token
    expect(String(inq.exporterOrgId)).toBe(String(sellerOrg._id)); // from the product
    expect(String(inq.createdBy)).toBe(String(buyer.user._id));
    expect(inq.status).toBe('open');
    expect(inq.parties.map(String).sort()).toEqual([String(buyer.org._id), String(sellerOrg._id)].sort());

    const c = await Conversation.findById(res.body.conversationId);
    expect(String(c.buyerOrgId)).toBe(String(buyer.org._id));
  });

  it('the snapshotted names cannot be forged from the body', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send({
      ...enquiry(),
      productNameSnapshot: 'Something Else Entirely',
      buyerOrgName: 'Fake Buyer Ltd',
      exporterOrgName: 'Fake Seller Ltd',
      lastMessagePreview: 'forged preview',
      frozen: true,
      frozenReason: 'blocked',
    });
    expect(res.status).toBe(201);

    const c = await Conversation.findById(res.body.conversationId);
    expect(c.productNameSnapshot).toBe('Cotton Roll');
    expect(c.exporterOrgName).toBe('TextileHub Exports');
    expect(c.buyerOrgName).toBe(buyer.org.name);
    expect(c.frozen).toBe(false); // a buyer cannot open a thread pre-frozen
    expect(c.frozenReason).toBeUndefined();
  });

  it('a buyer cannot pre-forge the opening messages or impersonate the platform', async () => {
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send({
      ...enquiry(),
      senderType: 'system',
      messages: [{ senderType: 'system', body: 'MPX Global says: pay outside the platform.' }],
    });
    expect(res.status).toBe(201);

    const messages = await Message.find({ conversationId: res.body.conversationId }).sort({ createdAt: 1 });
    expect(messages).toHaveLength(2);
    expect(messages[0].senderType).toBe('buyer'); // the buyer's own line is a BUYER line
    expect(messages[1].body).toBe(WELCOME_MESSAGE); // and only the server writes the system one
    expect(JSON.stringify(messages)).not.toContain('pay outside the platform');
  });

  it('prototype-pollution and dotted keys inside `fields` are refused', async () => {
    // ⚠️ Sent as RAW JSON on purpose. Writing `{ __proto__: {...} }` as an object
    // literal sets the prototype instead of creating an own property, so
    // JSON.stringify emits `{}` and the attack never leaves the test — the
    // payload has to go over the wire exactly as a hostile client would send it.
    const raw = (fieldsJson) =>
      `{"productId":"${product._id}","note":"hello","fields":${fieldsJson}}`;

    for (const fieldsJson of [
      '{"__proto__":{"polluted":true}}',
      '{"constructor":{"prototype":{"polluted":true}}}',
      '{"quantity.$gt":1}',
      '{"$where":"1==1"}',
    ]) {
      const res = await request(app)
        .post('/inquiries')
        .set(bearer(buyer.token))
        .type('json')
        .send(raw(fieldsJson));
      expect([400, 403]).toContain(res.status);
    }

    expect({}.polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
    expect(await Conversation.countDocuments({})).toBe(0);
  });

  it('a very large `fields` bag is rejected, not stored', async () => {
    const fields = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`junk${i}`, 'x']));
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry({ fields }));
    expect(res.status).toBe(400);
    expect(await Inquiry.countDocuments({})).toBe(0);
  });

  it('the composed opening message stays well inside the model ceiling', async () => {
    // Every field is individually capped, so the worst realistic case must not
    // approach the 4000-char abuse ceiling on Message.body.
    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(
      enquiry({
        note: 'n'.repeat(200),
        fields: {
          quantity: 999999999,
          unit: 'u'.repeat(40),
          targetPrice: 999999999,
          currency: 'INR',
          deliveryCountry: 'AU',
          deliveryTimeline: 't'.repeat(200),
        },
      }),
    );
    expect(res.status).toBe(201);
    const [first] = await Message.find({ conversationId: res.body.conversationId }).sort({ createdAt: 1 });
    expect(first.body.length).toBeLessThan(1000);
  });

  it('KNOWN GAP (F1-B): a BLOCKED seller org can still receive a new enquiry', async () => {
    // Recorded as a test so closing it is a conscious act. F1-A blocks the org
    // and kills its sessions, but its products stay publicly searchable until
    // F1-B lands in FINALIZE — so the thread is reachable. Not introduced by M4;
    // M4 just makes it visible. Do NOT bolt a partial cascade on here.
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { isActive: false } });

    const res = await request(app).post('/inquiries').set(bearer(buyer.token)).send(enquiry());
    expect(res.status).toBe(201);
    expect(await Conversation.countDocuments({})).toBe(1);
  });
});

describe('M4-B · nothing is half-created when a step fails', () => {
  it('a rejected enquiry leaves no Inquiry, no Conversation and no Message', async () => {
    await request(app).post('/inquiries').set(bearer(buyer.token))
      .send(enquiry({ fields: { sneaky: 1 } }));

    expect(await Inquiry.countDocuments({})).toBe(0);
    expect(await Conversation.countDocuments({})).toBe(0);
    expect(await Message.countDocuments({})).toBe(0);
  });
});
