import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { Inquiry } = await import('../src/models/Inquiry.js');
const { Conversation } = await import('../src/models/Conversation.js');
const { Message } = await import('../src/models/Message.js');
const { Lead } = await import('../src/models/Lead.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');

/**
 * Step 1d · enquiry routing ("help me find a supplier").
 *  1. A buyer reads only their OWN company's requests (404 otherwise) and never
 *     sees which employee handled them.
 *  2. Routing opens a NORMAL enquiry + chat in the buyer's name, through the
 *     existing createInquiry guards, with a "connected you" platform notice.
 *     Routing to a product the buyer already has a thread on LINKS it.
 *  3. Default-deny on staff routes; every action is logged.
 * Creates and removes only its own records (never wipes a collection).
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;
const made = { users: [], orgs: [], cats: [], products: [] };

async function makeUser(role, { orgId, permissions = [] } = {}) {
  seq += 1;
  const number = `6${RUN.slice(-6)}${String(seq).padStart(3, '0')}`;
  const user = await User.create({
    name: `LR ${role} ${seq}`,
    email: `lr_${RUN}_${seq}@example.com`,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword('Password123!'),
    role, orgId: orgId ?? new mongoose.Types.ObjectId(), permissions,
    isActive: true, isEmailVerified: true, isMobileVerified: true,
  });
  made.users.push(user._id);
  return { user, token: signAccessToken(user) };
}

let buyer, otherBuyer, router, plain, superadmin, goodsProduct, serviceProduct, sellerOrg, buyerOrg;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of ['Lead', 'Conversation', 'Inquiry', 'Message']) await mongoose.model(name).syncIndexes();
  const top = await Category.create({ name: `LR Top ${RUN}`, slug: `lr-top-${RUN}` });
  const goods = await Category.create({ name: `LR Goods ${RUN}`, slug: `lr-goods-${RUN}`, parentId: top._id, type: 'goods' });
  const service = await Category.create({ name: `LR Service ${RUN}`, slug: `lr-svc-${RUN}`, parentId: top._id, type: 'service' });
  made.cats.push(top._id, goods._id, service._id);
  invalidateLeafCache();
  sellerOrg = await Organisation.create({ name: `LR Seller ${RUN}`, type: 'business', exporterSide: true, country: 'IN', kycStatus: 'verified' });
  buyerOrg = await Organisation.create({ name: `LR Buyer ${RUN}`, type: 'business', buyerSide: true, country: 'AU' });
  const otherOrg = await Organisation.create({ name: `LR Other ${RUN}`, type: 'business', buyerSide: true, country: 'US' });
  made.orgs.push(sellerOrg._id, buyerOrg._id, otherOrg._id);
  goodsProduct = await Product.create({ exporterOrgId: sellerOrg._id, categoryId: goods._id, name: `LR Cotton ${RUN}`, status: 'active', price: { mode: 'on_request' } });
  serviceProduct = await Product.create({ exporterOrgId: sellerOrg._id, categoryId: service._id, name: `LR Web ${RUN}`, status: 'active', price: { mode: 'on_request' } });
  made.products.push(goodsProduct._id, serviceProduct._id);
  buyer = await makeUser('buyer', { orgId: buyerOrg._id });
  otherBuyer = await makeUser('buyer', { orgId: otherOrg._id });
  router = await makeUser('employee', { permissions: ['lead:manage'] });
  plain = await makeUser('employee', { permissions: ['support:read'] });
  superadmin = await makeUser('superadmin');
});

afterAll(async () => {
  const convs = await Conversation.find({ productId: { $in: made.products } }).select('_id');
  // Message is append-only at the model layer; test cleanup goes to the raw collection (as m4-inquiry does).
  await mongoose.connection.db.collection('messages').deleteMany({ conversationId: { $in: convs.map((c) => c._id) } });
  await Conversation.deleteMany({ productId: { $in: made.products } });
  await Inquiry.deleteMany({ productId: { $in: made.products } });
  await Lead.deleteMany({ createdBy: { $in: made.users } });
  await Product.deleteMany({ _id: { $in: made.products } });
  await Category.deleteMany({ _id: { $in: made.cats } });
  await Organisation.deleteMany({ _id: { $in: made.orgs } });
  await User.deleteMany({ _id: { $in: made.users } });
  invalidateLeafCache();
  await mongoose.disconnect();
});

const ask = (who, body = {}) =>
  request(app).post('/leads').set(bearer(who.token)).send({ what: 'Organic cotton fabric, 180 gsm', quantity: 5000, unit: 'metres', destinationCountry: 'AU', ...body });

describe('buyer side', () => {
  it('raises a request and sees it; another company gets 404', async () => {
    const res = await ask(buyer);
    expect(res.status).toBe(201);
    expect(res.body.lead.ref).toMatch(/^R-/);
    expect(res.body.lead.status).toBe('new');
    expect((await request(app).get(`/leads/${res.body.lead.id}`).set(bearer(otherBuyer.token))).status).toBe(404);
    const mine = await request(app).get('/leads').set(bearer(buyer.token));
    expect(mine.body.leads.some((l) => l.id === res.body.lead.id)).toBe(true);
  });

  it('staff and exporters cannot raise one', async () => {
    expect((await ask(superadmin)).status).toBe(403);
    expect((await ask(router)).status).toBe(403);
  });
});

describe('staff side', () => {
  it('searches by reference or by what was asked for', async () => {
    const { body } = await ask(buyer, { what: 'Handloom silk sarees, Banarasi' });
    const byWhat = await request(app).get('/admin/leads?q=banarasi&pageSize=50').set(bearer(router.token));
    expect(byWhat.body.rows.some((r) => r.id === body.lead.id)).toBe(true);
    const byRef = await request(app).get(`/admin/leads?q=${body.lead.ref}`).set(bearer(router.token));
    expect(byRef.body.rows.map((r) => r.id)).toEqual([body.lead.id]);
  });

  it('🔴 a request can be re-assigned but never put back to unassigned', async () => {
    const { body } = await ask(buyer);
    await request(app).patch(`/admin/leads/${body.lead.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: String(router.user._id) });
    const res = await request(app).patch(`/admin/leads/${body.lead.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: null });
    expect(res.status).toBe(400);
  });

  it('🔴 default-deny without lead:manage', async () => {
    const { body } = await ask(buyer);
    expect((await request(app).get('/admin/leads').set(bearer(plain.token))).status).toBe(403);
    expect((await request(app).post(`/admin/leads/${body.lead.id}/route`).set(bearer(plain.token)).send({ productId: String(goodsProduct._id) })).status).toBe(403);
    expect((await request(app).get('/admin/leads').set(bearer(buyer.token))).status).toBe(403);
  });

  it('routing opens a normal enquiry in the BUYER\'s name with the request as the note + a "connected" notice', async () => {
    const { body } = await ask(buyer);
    const res = await request(app).post(`/admin/leads/${body.lead.id}/route`).set(bearer(router.token)).send({ productId: String(goodsProduct._id) });
    expect(res.status).toBe(201);
    expect(res.body.lead.status).toBe('routed');
    expect(res.body.lead.assignedTo.id).toBe(String(router.user._id));
    const conv = await Conversation.findOne({ _id: res.body.lead.routedTo[0].conversationId });
    expect(String(conv.buyerOrgId)).toBe(String(buyerOrg._id));
    expect(String(conv.exporterOrgId)).toBe(String(sellerOrg._id));
    const msgs = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1, _id: 1 });
    expect(msgs[0].senderType).toBe('buyer');
    expect(msgs[0].body).toContain('Organic cotton fabric');
    expect(msgs[0].body).toContain('5000');
    expect(msgs.at(-1).systemKind).toBe('routed');

    // The buyer sees the supplier and the chat link, never the employee.
    const mine = await request(app).get(`/leads/${body.lead.id}`).set(bearer(buyer.token));
    expect(mine.body.lead.suppliers[0].conversationId).toBe(String(conv._id));
    expect(JSON.stringify(mine.body)).not.toContain(router.user.name);
  });

  it('routing to a product the buyer already has a thread on LINKS it, no duplicate', async () => {
    const { body } = await ask(buyer, { what: 'Web development for our store' });
    const first = await request(app).post(`/admin/leads/${body.lead.id}/route`).set(bearer(router.token)).send({ productId: String(serviceProduct._id) });
    expect(first.status).toBe(201);
    const again = await ask(buyer, { what: 'Another web project' });
    const second = await request(app).post(`/admin/leads/${again.body.lead.id}/route`).set(bearer(router.token)).send({ productId: String(serviceProduct._id) });
    expect(second.status).toBe(201);
    expect(second.body.lead.routedTo[0].created).toBe(false);
    expect(await Conversation.countDocuments({ buyerOrgId: buyerOrg._id, productId: serviceProduct._id })).toBe(1);
  });

  it('refuses the same product twice on one request, and a closed request', async () => {
    const { body } = await ask(buyer, { what: 'Something else entirely' });
    await request(app).post(`/admin/leads/${body.lead.id}/route`).set(bearer(router.token)).send({ productId: String(goodsProduct._id) });
    expect((await request(app).post(`/admin/leads/${body.lead.id}/route`).set(bearer(router.token)).send({ productId: String(goodsProduct._id) })).status).toBe(409);
    await request(app).patch(`/admin/leads/${body.lead.id}/status`).set(bearer(router.token)).send({ status: 'closed' });
    expect((await request(app).post(`/admin/leads/${body.lead.id}/route`).set(bearer(router.token)).send({ productId: String(serviceProduct._id) })).status).toBe(400);
  });

  it('assigns only to staff who can take requests; every action is logged', async () => {
    const { body } = await ask(buyer, { what: 'Assign me please' });
    expect((await request(app).patch(`/admin/leads/${body.lead.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: String(plain.user._id) })).status).toBe(400);
    const ok = await request(app).patch(`/admin/leads/${body.lead.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: String(router.user._id) });
    expect(ok.body.lead.status).toBe('in_progress');
    const actions = (await AuditLog.find({ entityType: 'lead', entityId: body.lead.id }).sort({ occurredAt: 1, _id: 1 })).map((r) => r.action);
    expect(actions).toEqual(['lead.create', 'lead.assign']);
  });
});
