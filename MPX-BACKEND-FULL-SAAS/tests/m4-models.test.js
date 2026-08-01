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
    exporterOrgId: sellerOrg._id,
    categoryId: leaf._id,
    name: 'Cotton Roll',
    status: 'active',
  });
}

async function makeThread(overrides = {}) {
  const inquiry = await Inquiry.create({
    buyerOrgId: buyerOrg._id,
    exporterOrgId: sellerOrg._id,
    productId: product._id,
    note: 'need a quote',
    ...overrides.inquiry,
  });
  const conversation = await Conversation.create({
    inquiryId: inquiry._id,
    buyerOrgId: buyerOrg._id,
    exporterOrgId: sellerOrg._id,
    productId: product._id,
    productNameSnapshot: product.name,
    buyerOrgName: buyerOrg.name,
    exporterOrgName: sellerOrg.name,
    ...overrides.conversation,
  });
  return { inquiry, conversation };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    Organisation.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Inquiry.deleteMany({}),
    Conversation.deleteMany({}),
    DeviceToken.deleteMany({}),
    // Message is append-only, so its own deleteMany is blocked — go via the driver.
    mongoose.connection.db.collection('messages').deleteMany({}),
  ]);
  await seedWorld();
});

describe('M4-A · one thread per (buyer, product) — enforced by the DATABASE (M4-3)', () => {
  it('a second Conversation for the same buyer+product is rejected by the unique index', async () => {
    await makeThread();
    await expect(
      makeThread({ inquiry: { note: 'second try' } }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('the same buyer CAN open a thread on a different product (M4-27 territory)', async () => {
    await makeThread();
    const other = await Product.create({
      exporterOrgId: sellerOrg._id,
      categoryId: product.categoryId,
      name: 'Silk Roll',
      status: 'active',
    });
    const second = await makeThread({
      inquiry: { productId: other._id },
      conversation: { productId: other._id, productNameSnapshot: other.name },
    });
    expect(second.conversation._id).toBeTruthy();
    expect(await Conversation.countDocuments({ buyerOrgId: buyerOrg._id })).toBe(2);
  });

  it('a DIFFERENT buyer may open their own thread on the same product', async () => {
    await makeThread();
    const otherBuyer = await Organisation.create({
      name: 'Other Buyer', type: 'business', buyerSide: true, country: 'NZ',
    });
    await Conversation.create({
      inquiryId: new mongoose.Types.ObjectId(),
      buyerOrgId: otherBuyer._id,
      exporterOrgId: sellerOrg._id,
      productId: product._id,
      productNameSnapshot: product.name,
      buyerOrgName: otherBuyer.name,
      exporterOrgName: sellerOrg.name,
    });
    expect(await Conversation.countDocuments({ productId: product._id })).toBe(2);
  });
});

describe('M4-A · Message is APPEND-ONLY (M4-13)', () => {
  async function makeMessage() {
    const { conversation } = await makeThread();
    return Message.create({
      conversationId: conversation._id,
      senderType: 'buyer',
      senderOrgId: buyerOrg._id,
      senderUserId: new mongoose.Types.ObjectId(),
      body: 'original text',
    });
  }

  it('every mutating query operation is refused', async () => {
    const msg = await makeMessage();

    await expect(Message.updateOne({ _id: msg._id }, { $set: { body: 'edited' } })).rejects.toThrow(
      /append-only/i,
    );
    await expect(Message.updateMany({}, { $set: { body: 'edited' } })).rejects.toThrow(/append-only/i);
    await expect(
      Message.findOneAndUpdate({ _id: msg._id }, { $set: { body: 'edited' } }),
    ).rejects.toThrow(/append-only/i);
    await expect(Message.deleteOne({ _id: msg._id })).rejects.toThrow(/append-only/i);
    await expect(Message.deleteMany({})).rejects.toThrow(/append-only/i);
    await expect(Message.findOneAndDelete({ _id: msg._id })).rejects.toThrow(/append-only/i);

    // …and the text really is untouched.
    const fresh = await Message.findById(msg._id);
    expect(fresh.body).toBe('original text');
  });

  it('re-saving an existing message is refused, but creating a new one is fine', async () => {
    const msg = await makeMessage();
    msg.body = 'edited via save()';
    await expect(msg.save()).rejects.toThrow(/append-only/i);

    const second = await Message.create({
      conversationId: msg.conversationId,
      senderType: 'system',
      body: 'a system line',
    });
    expect(second._id).toBeTruthy();
    expect(await Message.countDocuments({})).toBe(2);
  });

  it('a system message carries no org and no person', async () => {
    const { conversation } = await makeThread();
    const sys = await Message.create({
      conversationId: conversation._id,
      senderType: 'system',
      body: 'MPX Global is part of this conversation.',
    });
    expect(sys.senderOrgId).toBeUndefined();
    expect(sys.senderUserId).toBeUndefined();
  });

  it('the composed first message may exceed 200 characters (M4-12 exemption)', async () => {
    const { conversation } = await makeThread();
    // The real composed enquiry — structured fields plus a note — routinely runs
    // past 200. A model-level cap would reject the thread's own opening message.
    const long = 'Quantity: 5000 metres. Target price: 120 INR. '.repeat(8);
    expect(long.length).toBeGreaterThan(200);

    const msg = await Message.create({
      conversationId: conversation._id,
      senderType: 'buyer',
      senderOrgId: buyerOrg._id,
      body: long,
    });
    // Compare against the trimmed value — the schema trims, so an exact match on
    // the raw input would only be testing the trailing space.
    expect(msg.body).toBe(long.trim());
    expect(msg.body.length).toBeGreaterThan(200);
  });
});

describe('M4-A · Conversation state and indexes', () => {
  it('frozenReason accepts takedown/blocked and REJECTS purged (C5)', async () => {
    const { conversation } = await makeThread();

    conversation.frozen = true;
    conversation.frozenReason = 'takedown';
    await expect(conversation.save()).resolves.toBeTruthy();

    conversation.frozenReason = 'purged';
    await expect(conversation.save()).rejects.toThrow(/purged/);
  });

  it('a fresh thread is not frozen and carries the three denormalised names', async () => {
    const { conversation } = await makeThread();
    expect(conversation.frozen).toBe(false);
    expect(conversation.frozenReason).toBeUndefined();
    expect(conversation.productNameSnapshot).toBe('Cotton Roll');
    expect(conversation.buyerOrgName).toBe('Buyer Co');
    expect(conversation.exporterOrgName).toBe('Seller Co');
  });

  it('parties holds exactly the two company orgs — the platform is never a member (M4-2)', async () => {
    const { conversation } = await makeThread();
    expect(conversation.parties.map(String).sort()).toEqual(
      [String(buyerOrg._id), String(sellerOrg._id)].sort(),
    );
    expect(conversation.parties).toHaveLength(2);
  });

  it('exactly ONE text index exists, over the three name fields (§8.3 / A26)', async () => {
    const indexes = await Conversation.collection.indexes();
    const textIndexes = indexes.filter((i) => Object.values(i.key).includes('text'));
    expect(textIndexes).toHaveLength(1);
    expect(textIndexes[0].name).toBe('conversation_text');
    expect(Object.keys(textIndexes[0].weights).sort()).toEqual(
      ['buyerOrgName', 'exporterOrgName', 'productNameSnapshot'].sort(),
    );
  });

  it('the thread survives its product being hard-deleted (A8 purge — M4-22)', async () => {
    const { conversation } = await makeThread();
    await Product.deleteOne({ _id: product._id });

    const fresh = await Conversation.findById(conversation._id);
    expect(fresh).toBeTruthy();
    // The dangling ref is expected; the snapshot is what keeps the title alive.
    expect(fresh.productNameSnapshot).toBe('Cotton Roll');
    expect(await Product.findById(fresh.productId)).toBeNull();
  });
});

describe('M4-A · Inquiry', () => {
  it('one enquiry per buyer per product (M4-5)', async () => {
    await makeThread();
    await expect(
      Inquiry.create({
        buyerOrgId: buyerOrg._id,
        exporterOrgId: sellerOrg._id,
        productId: product._id,
        note: 'again',
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('note is capped at 200 characters — this cap IS real (unlike Message.body)', async () => {
    await expect(
      Inquiry.create({
        buyerOrgId: buyerOrg._id,
        exporterOrgId: sellerOrg._id,
        productId: product._id,
        note: 'x'.repeat(201),
      }),
    ).rejects.toThrow();
  });

  it('status defaults to open and is left alone (lifecycle is month 2)', async () => {
    const { inquiry } = await makeThread();
    expect(inquiry.status).toBe('open');
  });
});

describe('M4-A · DeviceToken', () => {
  it('the same token cannot be registered twice', async () => {
    seq += 1;
    const base = { userId: new mongoose.Types.ObjectId(), orgId: buyerOrg._id, platform: 'android' };
    await DeviceToken.create({ ...base, token: `tok_${seq}` });
    await expect(DeviceToken.create({ ...base, token: `tok_${seq}` })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('an upsert moves a device to its new owner (G10) rather than colliding forever', async () => {
    seq += 1;
    const token = `shared_${seq}`;
    const firstUser = new mongoose.Types.ObjectId();
    const secondUser = new mongoose.Types.ObjectId();

    await DeviceToken.create({ userId: firstUser, orgId: buyerOrg._id, token, platform: 'ios' });
    await DeviceToken.updateOne(
      { token },
      { $set: { userId: secondUser, orgId: sellerOrg._id, lastSeenAt: new Date() } },
      { upsert: true },
    );

    const rows = await DeviceToken.find({ token });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].userId)).toBe(String(secondUser));
  });
});
