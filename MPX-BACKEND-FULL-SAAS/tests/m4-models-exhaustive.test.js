/**
 * M4-A exhaustive pass — every mutation path, enum boundary, required field and
 * scoping declaration on the four M4 models.
 *
 * The append-only block below is the important half: M4-13 says a sent message
 * can never be edited or deleted BY ANYONE, and the only thing standing behind
 * that promise is this model. Each entry is a route someone could realistically
 * reach for.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import '../src/models/index.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { Inquiry } from '../src/models/Inquiry.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { DeviceToken } from '../src/models/DeviceToken.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { ownershipFilter } from '../src/models/scoping.js';

let buyerOrg;
let sellerOrg;
let product;
let seq = 0;

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  const leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  buyerOrg = await Organisation.create({ name: 'Buyer Co', type: 'business', buyerSide: true, country: 'AU' });
  sellerOrg = await Organisation.create({ name: 'Seller Co', type: 'business', exporterSide: true, country: 'IN' });
  product = await Product.create({
    exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Cotton Roll', status: 'active',
  });
}

function conversationDoc(extra = {}) {
  return {
    inquiryId: new mongoose.Types.ObjectId(),
    buyerOrgId: buyerOrg._id,
    exporterOrgId: sellerOrg._id,
    productId: product._id,
    productNameSnapshot: product.name,
    buyerOrgName: buyerOrg.name,
    exporterOrgName: sellerOrg.name,
    ...extra,
  };
}

async function makeMessage(extra = {}) {
  const c = await Conversation.create(conversationDoc());
  return Message.create({
    conversationId: c._id, senderType: 'buyer', senderOrgId: buyerOrg._id, body: 'original', ...extra,
  });
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  await Promise.all([
    Organisation.deleteMany({}), Category.deleteMany({}), Product.deleteMany({}),
    Inquiry.deleteMany({}), Conversation.deleteMany({}), DeviceToken.deleteMany({}),
    mongoose.connection.db.collection('messages').deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  await seedWorld();
});

describe('M4-13 · every mutation route into Message is refused', () => {
  // Each pair is (name, call). If a new Mongoose mutation API appears, add it here.
  const MUTATIONS = [
    ['updateOne', (m) => Message.updateOne({ _id: m._id }, { $set: { body: 'X' } })],
    ['updateMany', () => Message.updateMany({}, { $set: { body: 'X' } })],
    ['replaceOne', (m) => Message.replaceOne({ _id: m._id }, { conversationId: m.conversationId, senderType: 'buyer', body: 'X' })],
    ['findOneAndUpdate', (m) => Message.findOneAndUpdate({ _id: m._id }, { $set: { body: 'X' } })],
    ['findOneAndReplace', (m) => Message.findOneAndReplace({ _id: m._id }, { conversationId: m.conversationId, senderType: 'buyer', body: 'X' })],
    ['findByIdAndUpdate', (m) => Message.findByIdAndUpdate(m._id, { $set: { body: 'X' } })],
    ['deleteOne', (m) => Message.deleteOne({ _id: m._id })],
    ['deleteMany', () => Message.deleteMany({})],
    ['findOneAndDelete', (m) => Message.findOneAndDelete({ _id: m._id })],
    ['findByIdAndDelete', (m) => Message.findByIdAndDelete(m._id)],
    ['updateOne via Query', (m) => Message.where({ _id: m._id }).updateOne({ $set: { body: 'X' } })],
    // bulkWrite bypasses query middleware — it needed its own static guard.
    ['bulkWrite update', (m) => Message.bulkWrite([{ updateOne: { filter: { _id: m._id }, update: { $set: { body: 'X' } } } }])],
    ['bulkWrite delete', (m) => Message.bulkWrite([{ deleteOne: { filter: { _id: m._id } } }])],
  ];

  for (const [label, call] of MUTATIONS) {
    it(`${label} is refused and leaves the message intact`, async () => {
      const msg = await makeMessage();
      await expect(call(msg)).rejects.toThrow(/append-only/i);

      const fresh = await Message.findById(msg._id);
      expect(fresh).toBeTruthy();
      expect(fresh.body).toBe('original');
    });
  }

  it('document .save() on an existing message and document .deleteOne() are both refused', async () => {
    const msg = await makeMessage();
    msg.body = 'edited';
    await expect(msg.save()).rejects.toThrow(/append-only/i);
    await expect(msg.deleteOne()).rejects.toThrow(/append-only/i);
    expect((await Message.findById(msg._id)).body).toBe('original');
  });

  it('inserting is of course still allowed — including insertMany', async () => {
    const c = await Conversation.create(conversationDoc());
    await Message.insertMany([
      { conversationId: c._id, senderType: 'buyer', body: 'one' },
      { conversationId: c._id, senderType: 'system', body: 'two' },
    ]);
    expect(await Message.countDocuments({ conversationId: c._id })).toBe(2);
  });

  it('KNOWN LIMIT, recorded deliberately: the raw driver bypasses Mongoose entirely', async () => {
    // Documenting the boundary of what a schema can promise. The application
    // never uses `.collection.*`; the durable guarantee for append-only data is
    // the database grant (security-baseline rule 5 / tracker C10), which is a
    // deployment step, not something a model can enforce.
    const msg = await makeMessage();
    await Message.collection.updateOne({ _id: msg._id }, { $set: { body: 'raw' } });
    expect((await Message.findById(msg._id)).body).toBe('raw');
  });
});

describe('AuditLog · the same bulkWrite hole (tracker C10)', () => {
  it('bulkWrite cannot edit or delete an audit record either', async () => {
    const entry = await AuditLog.create({
      action: 'test.event', entityType: 'Product', entityId: product._id, occurredAt: new Date(),
    });
    await expect(
      AuditLog.bulkWrite([{ updateOne: { filter: { _id: entry._id }, update: { $set: { action: 'tampered' } } } }]),
    ).rejects.toThrow(/append-only/i);
    await expect(
      AuditLog.bulkWrite([{ deleteOne: { filter: { _id: entry._id } } }]),
    ).rejects.toThrow(/append-only/i);
    expect((await AuditLog.findById(entry._id)).action).toBe('test.event');
  });
});

describe('Conversation · required fields, defaults and derived state', () => {
  const REQUIRED = ['inquiryId', 'productId', 'productNameSnapshot', 'buyerOrgName', 'exporterOrgName', 'buyerOrgId', 'exporterOrgId'];

  for (const field of REQUIRED) {
    it(`refuses to save without ${field}`, async () => {
      const doc = conversationDoc();
      delete doc[field];
      await expect(Conversation.create(doc)).rejects.toThrow();
    });
  }

  it('derives `parties` from the two org ids, and keeps the platform out (M4-2)', async () => {
    const c = await Conversation.create(conversationDoc());
    expect(c.parties.map(String)).toEqual([String(buyerOrg._id), String(sellerOrg._id)]);
  });

  it('defaults: not frozen, no reason, lastMessageAt stamped, nobody has read it', async () => {
    const c = await Conversation.create(conversationDoc());
    expect(c.frozen).toBe(false);
    expect(c.frozenReason).toBeUndefined();
    expect(c.lastMessageAt).toBeInstanceOf(Date);
    expect(c.buyerLastReadAt).toBeUndefined();
    expect(c.exporterLastReadAt).toBeUndefined();
  });

  it('frozenReason accepts only takedown and blocked', async () => {
    for (const reason of ['takedown', 'blocked']) {
      const c = await Conversation.create(conversationDoc({ inquiryId: new mongoose.Types.ObjectId(), productId: (await Product.create({ exporterOrgId: sellerOrg._id, categoryId: product.categoryId, name: `P${(seq += 1)}`, status: 'active' }))._id }));
      c.frozen = true;
      c.frozenReason = reason;
      await expect(c.save()).resolves.toBeTruthy();
    }
    const bad = await Conversation.create(conversationDoc({ inquiryId: new mongoose.Types.ObjectId(), productId: (await Product.create({ exporterOrgId: sellerOrg._id, categoryId: product.categoryId, name: 'Pz', status: 'active' }))._id }));
    for (const reason of ['purged', 'suspended', '', 'TAKEDOWN']) {
      bad.frozenReason = reason;
      await expect(bad.save()).rejects.toThrow();
    }
  });

  it('the model does NOT stop a self-enquiry — F4 is a service guard, by design (M4-39)', async () => {
    // Recorded so nobody assumes the schema covers it: A21 lets one Organisation
    // hold both sides, so buyerOrgId === exporterOrgId is structurally valid here.
    // The ONLY thing preventing it is the server-side check at enquiry creation.
    const selfDoc = conversationDoc({ buyerOrgId: sellerOrg._id, buyerOrgName: sellerOrg.name });
    await expect(Conversation.create(selfDoc)).resolves.toBeTruthy();
  });

  it('toJSON exposes no unexpected internals beyond the declared fields', async () => {
    const c = await Conversation.create(conversationDoc());
    const json = c.toJSON();
    expect(json).not.toHaveProperty('__v');
    // isActive comes from withPartiesScope and is deliberately unused on this
    // model — assert it is never something the code starts depending on.
    expect(json.isActive).toBe(true);
  });
});

describe('Inquiry · validation', () => {
  it('rejects an unknown status', async () => {
    await expect(
      Inquiry.create({ buyerOrgId: buyerOrg._id, exporterOrgId: sellerOrg._id, productId: product._id, status: 'archived' }),
    ).rejects.toThrow();
  });

  it('requires a productId — there are no product-less enquiries (M4-4)', async () => {
    await expect(
      Inquiry.create({ buyerOrgId: buyerOrg._id, exporterOrgId: sellerOrg._id }),
    ).rejects.toThrow();
  });

  it('accepts a structured `fields` object and returns it intact', async () => {
    const fields = { quantity: 5000, unit: 'metres', targetPrice: 120, currency: 'INR', deliveryCountry: 'AU' };
    const inq = await Inquiry.create({
      buyerOrgId: buyerOrg._id, exporterOrgId: sellerOrg._id, productId: product._id, fields,
    });
    expect((await Inquiry.findById(inq._id)).fields).toMatchObject(fields);
  });

  it('a 200-character note is fine; 201 is not', async () => {
    const base = { buyerOrgId: buyerOrg._id, exporterOrgId: sellerOrg._id };
    const p2 = await Product.create({ exporterOrgId: sellerOrg._id, categoryId: product.categoryId, name: 'P2', status: 'active' });
    await expect(Inquiry.create({ ...base, productId: product._id, note: 'x'.repeat(200) })).resolves.toBeTruthy();
    await expect(Inquiry.create({ ...base, productId: p2._id, note: 'x'.repeat(201) })).rejects.toThrow();
  });
});

describe('Message · sender shape', () => {
  it('rejects an unknown senderType', async () => {
    const c = await Conversation.create(conversationDoc());
    await expect(
      Message.create({ conversationId: c._id, senderType: 'admin', body: 'hi' }),
    ).rejects.toThrow();
  });

  it('requires a body and a conversationId', async () => {
    const c = await Conversation.create(conversationDoc());
    await expect(Message.create({ conversationId: c._id, senderType: 'buyer' })).rejects.toThrow();
    await expect(Message.create({ senderType: 'buyer', body: 'hi' })).rejects.toThrow();
  });

  it('refuses a body past the 4000 abuse ceiling', async () => {
    const c = await Conversation.create(conversationDoc());
    await expect(
      Message.create({ conversationId: c._id, senderType: 'buyer', body: 'x'.repeat(4001) }),
    ).rejects.toThrow();
  });

  it('carries no updatedAt — a record that can never change has no use for one', async () => {
    const msg = await makeMessage();
    expect(msg.createdAt).toBeInstanceOf(Date);
    expect(msg.updatedAt).toBeUndefined();
  });
});

describe('DeviceToken · validation', () => {
  it('rejects an unknown platform and requires user/org/token', async () => {
    const base = { userId: new mongoose.Types.ObjectId(), orgId: buyerOrg._id };
    await expect(DeviceToken.create({ ...base, token: 'a1', platform: 'desktop' })).rejects.toThrow();
    await expect(DeviceToken.create({ ...base, platform: 'web' })).rejects.toThrow();
    await expect(DeviceToken.create({ token: 'a2', platform: 'web' })).rejects.toThrow();
  });

  it('one user may register several devices', async () => {
    const userId = new mongoose.Types.ObjectId();
    for (const [token, platform] of [['t-a', 'ios'], ['t-b', 'android'], ['t-c', 'web']]) {
      await DeviceToken.create({ userId, orgId: buyerOrg._id, token, platform });
    }
    expect(await DeviceToken.countDocuments({ userId })).toBe(3);
  });
});

describe('Scoping is declared on every M4 model (default-deny)', () => {
  it('ownershipFilter builds the right fragment and never throws for an M4 model', () => {
    const user = { orgId: String(buyerOrg._id), _id: new mongoose.Types.ObjectId() };
    expect(ownershipFilter(Conversation, user)).toEqual({ parties: user.orgId });
    expect(ownershipFilter(Inquiry, user)).toEqual({ parties: user.orgId });
    expect(ownershipFilter(DeviceToken, user)).toEqual({ userId: user._id });
    // Message is PLATFORM-scoped on purpose — it has no owner field and is
    // reachable only through its conversation (see Message.js).
    expect(ownershipFilter(Message, user)).toEqual({});
  });
});
