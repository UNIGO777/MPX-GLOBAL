/**
 * M1 → M5 full-stack integration.
 *
 * Module tests prove each part in isolation. This file proves the SEAMS: that a
 * single real action ripples correctly through every module that has an opinion
 * about it. Most cross-module defects live exactly there — one module updates
 * its own state and another module's view of the same fact goes stale.
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
const { SavedItem } = await import('../src/models/SavedItem.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');
const { purgeBlockedProducts } = await import('../src/jobs/purgeBlockedProducts.js');
const { rebuildAll } = await import('../src/services/searchSync.service.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const DAY = 24 * 60 * 60 * 1000;
let seq = 0;

let sa;
let staff;   // employee holding every grantable permission
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
    email: `fs_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `68${2000000 + seq}`, e164: `+9168${2000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

const ALL_PERMS = [
  'buyer:approve', 'exporter:verify', 'user:read', 'kyc:view',
  'category:read', 'category:manage', 'product:read', 'product:takedown',
  'conversation:read', 'conversation:block', 'organisation:read', 'audit:read',
];

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({
    name: 'Cotton fabric', parentId: top._id, type: 'goods', synonyms: ['kapda', 'fabric'],
  });

  sa = await makeUser('superadmin');
  staff = await makeUser('employee', {}, ALL_PERMS);

  seller = await makeUser('exporter', {
    name: 'TextileHub Exports', exporterSide: true, country: 'IN', kycStatus: 'submitted',
    kycSubmittedAt: new Date(Date.now() - 3 * DAY),
  });
  buyer = await makeUser('buyer', { name: 'Sydney Imports', buyerSide: true, country: 'AU' });
}

async function listProduct(name = 'Cotton Roll') {
  const created = await request(app).post('/products').set(bearer(seller.token)).send({
    name, categoryId: String(leaf._id), price: { mode: 'fixed', min: 300, currency: 'INR' },
  });
  expect(created.status).toBe(201);
  const id = created.body.product.id;
  expect((await request(app).patch(`/products/${id}/status`).set(bearer(seller.token))
    .send({ status: 'active' })).status).toBe(200);
  await rebuildAll();
  return id;
}

async function openThread(productId, note = 'Please share your best price.') {
  const res = await request(app).post('/inquiries').set(bearer(buyer.token))
    .send({ productId, note });
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
    Product.deleteMany({}), Inquiry.deleteMany({}), Conversation.deleteMany({}), SavedItem.deleteMany({}),
    mongoose.connection.db.collection('messages').deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('the whole journey — signup to moderation, across all five modules', () => {
  it('one verification ripples into products, search, the org screen and the dashboard', async () => {
    const productId = await listProduct();

    // Before verification: unverified everywhere.
    expect((await Product.findById(productId)).sellerVerified).toBe(false);
    let pub = await request(app).get(`/exporters/${seller.org._id}`);
    expect(pub.body.exporter.verified).toBe(false);

    // M1 · an employee verifies the exporter.
    expect((await request(app).post(`/employee/exporters/${seller.org._id}/verify`)
      .set(bearer(staff.token))).status).toBe(200);

    // M2 · the denormalised search field flipped on the product…
    expect((await Product.findById(productId)).sellerVerified).toBe(true);
    // M3 · …the public seller page shows the tick, and search agrees…
    pub = await request(app).get(`/exporters/${seller.org._id}`);
    expect(pub.body.exporter.verified).toBe(true);
    const search = await request(app).get('/public/search').query({ q: 'cotton', verifiedOnly: 'true' });
    expect(search.body.total).toBe(1);

    // M5 · …the org screen names WHICH side was reviewed…
    const detail = await request(app).get(`/admin/orgs/${seller.org._id}`).set(bearer(staff.token));
    expect(detail.body.organisation.verification.reviewedSides).toEqual(['exporter']);
    expect(detail.body.organisation.verification.verifiedBy.name).toBe(staff.user.name);

    // …the dashboard queue empties and turnaround starts measuring…
    const dash = await request(app).get('/admin/dashboard').set(bearer(staff.token));
    expect(dash.body.tiles.pendingExporterVerifications.count).toBe(0);
    expect(dash.body.health.verification.sample).toBe(1);
    expect(dash.body.health.verification.averageDaysToVerify).toBeGreaterThan(0);

    // …and the audit trail records who did it.
    const audit = await request(app).get('/admin/audit')
      .query({ orgId: String(seller.org._id), action: 'exporter.verify' }).set(bearer(staff.token));
    expect(audit.body.total).toBe(1);
    expect(audit.body.entries[0].actor.name).toBe(staff.user.name);
  });

  it('one takedown ripples into chats, the cap, monitoring, the org screen and the dashboard', async () => {
    const productId = await listProduct();
    const conversationId = await openThread(productId);
    await request(app).post('/saved').set(bearer(buyer.token))
      .send({ targetType: 'product', targetId: productId });

    // M2/M5 · admin takes it down.
    expect((await request(app).post(`/admin/products/${productId}/takedown`)
      .set(bearer(staff.token)).send({ reason: 'counterfeit listing' })).status).toBe(200);

    // M4 · the thread froze on both sides, with a system message…
    const conv = await Conversation.findById(conversationId);
    expect(conv.frozen).toBe(true);
    expect(conv.frozenReason).toBe('takedown');
    expect((await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'still there?' })).status).toBe(409);

    // …and both parties can still READ it (M4-22).
    const history = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(seller.token));
    expect(history.status).toBe(200);
    expect(history.body.messages.some((m) => m.senderType === 'system' && /under review/i.test(m.body))).toBe(true);

    // M3 · gone from search and flagged in the buyer's saved list.
    expect((await request(app).get('/public/search').query({ q: 'cotton' })).body.total).toBe(0);
    const saved = await request(app).get('/saved').set(bearer(buyer.token));
    expect(saved.body.items[0].available).toBe(false);

    // M2 · the offence counter incremented and a cap slot freed (A10).
    expect((await Organisation.findById(seller.org._id)).takedownCount).toBe(1);

    // M5 · monitoring names the actor and shows the countdown…
    const monitoring = await request(app).get('/admin/products')
      .query({ status: 'blocked' }).set(bearer(staff.token));
    const row = monitoring.body.rows.find((r) => r.id === productId);
    expect(row.takedown.byName).toBe(staff.user.name);
    expect(row.seller.takedownCount).toBe(1);
    expect(row.purgeAt).toBeTruthy();

    // …the org screen counts it as blocked, not inactive…
    const detail = await request(app).get(`/admin/orgs/${seller.org._id}`).set(bearer(staff.token));
    expect(detail.body.organisation.products).toMatchObject({ blocked: 1, active: 0, inactive: 0 });

    // …the dashboard tile agrees with the list it links to…
    const dash = await request(app).get('/admin/dashboard').set(bearer(staff.token));
    expect(dash.body.tiles.blockedProducts.count).toBe(1);

    // …and the audit trail has it, findable by the seller's org.
    const audit = await request(app).get('/admin/audit')
      .query({ orgId: String(seller.org._id), action: 'product.takedown' }).set(bearer(staff.token));
    expect(audit.body.total).toBe(1);
  });

  it('a restore reverses every one of those effects, except the offence counter', async () => {
    const productId = await listProduct();
    const conversationId = await openThread(productId);
    await request(app).post(`/admin/products/${productId}/takedown`)
      .set(bearer(staff.token)).send({ reason: 'counterfeit listing' });

    expect((await request(app).post(`/admin/products/${productId}/restore`)
      .set(bearer(staff.token))).status).toBe(200);

    // M4 · the thread reopened…
    const conv = await Conversation.findById(conversationId);
    expect(conv.frozen).toBe(false);
    expect((await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'we are back' })).status).toBe(201);

    // M3 · searchable again…
    expect((await request(app).get('/public/search').query({ q: 'cotton' })).body.total).toBe(1);

    // M5 · but §A24 is increment-only: the offence is remembered.
    expect((await Organisation.findById(seller.org._id)).takedownCount).toBe(1);
    const list = await request(app).get('/admin/orgs').set(bearer(staff.token));
    expect(list.body.organisations.find((o) => o.id === String(seller.org._id)).takedowns).toBe(1);
  });

  it('🔴 a chat block and a product takedown stack — lifting one does not reopen the thread', async () => {
    const productId = await listProduct();
    const conversationId = await openThread(productId);

    // Blocked FIRST, so M4-29 keeps the block label even after the takedown.
    await request(app).post(`/admin/conversations/${conversationId}/block`)
      .set(bearer(staff.token)).send({ reason: 'off-platform payment request' });
    await request(app).post(`/admin/products/${productId}/takedown`)
      .set(bearer(staff.token)).send({ reason: 'counterfeit listing' });

    expect((await Conversation.findById(conversationId)).frozenReason).toBe('blocked');

    // Restoring the PRODUCT must not reopen a thread the admin blocked (M4-30).
    await request(app).post(`/admin/products/${productId}/restore`).set(bearer(staff.token));
    let conv = await Conversation.findById(conversationId);
    expect(conv.frozen).toBe(true);
    expect(conv.frozenReason).toBe('blocked');
    expect((await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'hello?' })).status).toBe(409);

    // Only lifting the block itself reopens it.
    await request(app).post(`/admin/conversations/${conversationId}/unblock`)
      .set(bearer(staff.token)).send({});
    conv = await Conversation.findById(conversationId);
    expect(conv.frozen).toBe(false);
    expect((await request(app).post(`/conversations/${conversationId}/messages`)
      .set(bearer(buyer.token)).send({ body: 'hello?' })).status).toBe(201);
  });

  it('the 180-day purge deletes the product but leaves the thread, the audit and the counter', async () => {
    const productId = await listProduct();
    const conversationId = await openThread(productId);
    await request(app).post('/saved').set(bearer(buyer.token))
      .send({ targetType: 'product', targetId: productId });
    await request(app).post(`/admin/products/${productId}/takedown`)
      .set(bearer(staff.token)).send({ reason: 'counterfeit listing' });
    await Product.updateOne({ _id: productId }, { $set: { 'takedown.at': new Date(Date.now() - 200 * DAY) } });

    const { purged } = await purgeBlockedProducts();
    expect(purged).toBe(1);
    expect(await Product.findById(productId)).toBeNull();

    // M4 · the thread survives with its full history and its snapshot title.
    const thread = await request(app).get(`/conversations/${conversationId}`).set(bearer(buyer.token));
    expect(thread.status).toBe(200);
    expect(thread.body.conversation.product.name).toBe('Cotton Roll');
    expect(thread.body.conversation.product.id).toBeNull();
    expect(thread.body.conversation.frozenLabel).toEqual({ tone: 'red', text: 'Product no longer available' });

    // M3 · the saved row is gone (permanent removal, not a flag).
    expect(await SavedItem.countDocuments({})).toBe(0);

    // M5 · the audit row survives, attributed to System, naming what was deleted.
    const audit = await request(app).get('/admin/audit')
      .query({ action: 'product.purge' }).set(bearer(staff.token));
    expect(audit.body.total).toBe(1);
    expect(audit.body.entries[0].actor).toEqual({ id: null, name: 'System', role: 'system' });
    const detail = await request(app).get(`/admin/audit/${audit.body.entries[0].id}`).set(bearer(staff.token));
    expect(detail.body.entry.before.productName).toBe('Cotton Roll');

    // …and the offence counter outlives the row it counted (§A24's whole point).
    expect((await Organisation.findById(seller.org._id)).takedownCount).toBe(1);
  });

  it('an org block kills sessions, hides the profile AND takes the catalogue down (F1-B)', async () => {
    const productId = await listProduct();
    await openThread(productId);

    expect((await request(app).post(`/admin/orgs/${seller.org._id}/block`)
      .set(bearer(sa.token)).send({ reason: 'repeated violations' })).status).toBe(200);

    // M1 · the seller's session is dead.
    expect((await request(app).get('/auth/me').set(bearer(seller.token))).status).toBe(401);
    // M3 · the public profile 404s…
    expect((await request(app).get(`/exporters/${seller.org._id}`)).status).toBe(404);

    // …and F1-B now takes the catalogue with it. The account half is synchronous
    // (sessions die immediately); the catalogue half runs in the background.
    for (let i = 0; i < 50; i += 1) {
      const org = await Organisation.findById(seller.org._id).select('blockCascade').lean();
      if (org?.blockCascade?.status === 'done') break;
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    }
    expect((await request(app).get('/public/search').query({ q: 'cotton' })).body.total).toBe(0);

    const detail = await request(app).get(`/admin/orgs/${seller.org._id}`).set(bearer(staff.token));
    expect(detail.body.organisation.header.blocked).toBe(true);
    expect(detail.body.organisation.blockReach.products).toBe(true);
    expect(detail.body.organisation.blockReach.conversations).toBe(true);
    // The screen still has to be honest about whether the background half FINISHED.
    expect(detail.body.organisation.blockReach.cascade.status).toBe('done');

    // M5 · the list shows the blocked state and the filter finds it.
    const blocked = await request(app).get('/admin/orgs').query({ blocked: 'true' }).set(bearer(staff.token));
    expect(blocked.body.organisations.map((o) => o.id)).toContain(String(seller.org._id));
  });

  it('a category deactivation hides products from discovery but not from moderation', async () => {
    const productId = await listProduct();

    await request(app).patch(`/admin/categories/${leaf.parentId}/toggle`).set(bearer(staff.token));
    invalidateLeafCache();

    // M3 · gone from every public surface…
    expect((await request(app).get('/public/search').query({ q: 'cotton' })).body.total).toBe(0);
    expect((await request(app).get(`/public/products/${productId}`)).status).toBe(404);
    // M4 · and a buyer can no longer enquire on it.
    expect((await request(app).post('/inquiries').set(bearer(buyer.token))
      .send({ productId, note: 'still interested' })).status).toBe(404);

    // M5 · but the admin can still see and moderate it — monitoring is not
    // discovery, and a hidden category must not hide evidence.
    const monitoring = await request(app).get('/admin/products').set(bearer(staff.token));
    expect(monitoring.body.rows.some((r) => r.id === productId)).toBe(true);
  });
});

describe('cross-module counts stay consistent with each other', () => {
  it('the org detail, the conversation list and the dashboard agree about one enquiry', async () => {
    const productId = await listProduct();
    await openThread(productId);

    const sellerDetail = await request(app).get(`/admin/orgs/${seller.org._id}`).set(bearer(staff.token));
    expect(sellerDetail.body.organisation.chats).toEqual({ asBuyer: 0, asExporter: 1 });

    const buyerDetail = await request(app).get(`/admin/orgs/${buyer.org._id}`).set(bearer(staff.token));
    expect(buyerDetail.body.organisation.chats).toEqual({ asBuyer: 1, asExporter: 0 });
    expect(buyerDetail.body.organisation.buyerActivity.enquiriesSent).toBe(1);

    // The side-filtered admin lists reproduce exactly those counts.
    const asExporter = await request(app).get('/admin/conversations')
      .query({ orgId: String(seller.org._id), side: 'exporter' }).set(bearer(staff.token));
    expect(asExporter.body.conversations).toHaveLength(1);
    const asBuyerSide = await request(app).get('/admin/conversations')
      .query({ orgId: String(seller.org._id), side: 'buyer' }).set(bearer(staff.token));
    expect(asBuyerSide.body.conversations).toHaveLength(0);

    const dash = await request(app).get('/admin/dashboard').set(bearer(staff.token));
    expect(dash.body.totals.conversations).toBe(1);
  });

  it('the org list product count matches the org detail breakdown', async () => {
    await listProduct('Roll One');
    await listProduct('Roll Two');
    const third = await listProduct('Roll Three');
    await request(app).post(`/admin/products/${third}/takedown`)
      .set(bearer(staff.token)).send({ reason: 'counterfeit listing' });

    const list = await request(app).get('/admin/orgs').set(bearer(staff.token));
    const listed = list.body.organisations.find((o) => o.id === String(seller.org._id));

    const detail = await request(app).get(`/admin/orgs/${seller.org._id}`).set(bearer(staff.token));
    const breakdown = detail.body.organisation.products;

    // The list column is "live products" — which is exactly the detail's `active`.
    expect(listed.products).toBe(breakdown.active);
    expect(listed.products).toBe(2);
    expect(breakdown.blocked).toBe(1);
    expect(listed.takedowns).toBe(1);
  });

  it('every audit action the platform writes is reachable through the viewer (§6)', async () => {
    const productId = await listProduct();
    const conversationId = await openThread(productId);

    // A REAL signup through the endpoint — the fixtures above create users
    // directly, so without this there is no `auth.signup` row to find and the
    // coverage claim would be checking an action the test never performed.
    seq += 1;
    await request(app).post('/auth/buyer/signup').send({
      name: 'Fresh Buyer',
      email: `fresh_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `69${2000000 + seq}` },
      password: 'longpassword1',
      company: `Fresh Imports ${seq}`,
      country: 'AU',
    });

    await request(app).post(`/employee/exporters/${seller.org._id}/verify`).set(bearer(staff.token));
    await request(app).post(`/admin/products/${productId}/takedown`)
      .set(bearer(staff.token)).send({ reason: 'counterfeit listing' });
    await request(app).post(`/admin/products/${productId}/restore`).set(bearer(staff.token));
    await request(app).post(`/admin/conversations/${conversationId}/block`)
      .set(bearer(staff.token)).send({ reason: 'off-platform payment request' });
    await request(app).post(`/admin/conversations/${conversationId}/unblock`)
      .set(bearer(staff.token)).send({});
    await request(app).get(`/admin/conversations/${conversationId}`).set(bearer(staff.token));
    await request(app).post(`/admin/users/${buyer.user._id}/deactivate`).set(bearer(sa.token));

    const EXPECTED = [
      'auth.signup', 'product.create', 'product.publish', 'exporter.verify',
      'product.takedown', 'product.restore', 'conversation.block', 'conversation.unblock',
      'conversation.read', 'user.deactivate',
    ];
    for (const action of EXPECTED) {
      const res = await request(app).get('/admin/audit').query({ action }).set(bearer(staff.token));
      expect(res.body.total, `no audit rows for ${action}`).toBeGreaterThan(0);
    }

    // …and the one §6 lists that genuinely cannot exist yet.
    expect(await AuditLog.countDocuments({ action: 'org.claim' })).toBe(0);
  });
});

describe('permission boundaries hold across the whole stack', () => {
  it('an employee sees exactly the surfaces they were granted, and no more', async () => {
    const productId = await listProduct();
    await openThread(productId);

    const limited = await makeUser('employee', {}, ['product:read']);
    const t = bearer(limited.token);

    expect((await request(app).get('/admin/products').set(t)).status).toBe(200);
    for (const path of ['/admin/orgs', '/admin/audit', '/admin/conversations', '/admin/users']) {
      expect((await request(app).get(path).set(t)).status, path).toBe(403);
    }
    // Governance is out of reach whatever they hold.
    expect((await request(app).post(`/admin/orgs/${seller.org._id}/block`)
      .set(t).send({ reason: 'trying it on' })).status).toBe(403);
    expect((await request(app).post(`/admin/users/${buyer.user._id}/deactivate`).set(t)).status).toBe(403);

    // The dashboard shows only their tiles.
    const dash = await request(app).get('/admin/dashboard').set(t);
    expect(dash.body.tiles.blockedProducts).toBeTruthy();
    expect(dash.body.tiles.pendingExporterVerifications).toBeUndefined();
    expect(dash.body.totals.organisations).toBeUndefined();
  });

  it('a party account cannot reach any admin surface, and a guest cannot reach a private one', async () => {
    const productId = await listProduct();
    const conversationId = await openThread(productId);

    for (const token of [buyer.token, seller.token]) {
      for (const path of ['/admin/orgs', '/admin/audit', '/admin/dashboard', '/admin/products', '/admin/conversations', '/admin/users']) {
        expect([403, 404]).toContain((await request(app).get(path).set(bearer(token))).status);
      }
    }

    for (const path of ['/conversations', `/conversations/${conversationId}`, '/saved', '/products/mine']) {
      expect((await request(app).get(path)).status, path).toBe(401);
    }
  });

  it('no public surface leaks a private field, whatever state the data is in', async () => {
    const productId = await listProduct();
    await request(app).post(`/employee/exporters/${seller.org._id}/verify`).set(bearer(staff.token));
    await Organisation.updateOne({ _id: seller.org._id }, {
      $set: { website: 'https://private.example', kycDocuments: [{ docType: 'pan', storageKey: 'SECRET', uploadedAt: new Date() }] },
    });

    const responses = await Promise.all([
      request(app).get('/public/search').query({ q: 'cotton' }),
      request(app).get('/public/products'),
      request(app).get(`/public/products/${productId}`),
      request(app).get(`/exporters/${seller.org._id}`),
      request(app).get('/public/facets').query({ q: 'cotton' }),
      request(app).get('/sitemap.xml'),
    ]);

    const FORBIDDEN = [
      'kycStatus', 'kycDocuments', 'storageKey', 'SECRET', 'website', 'passwordHash',
      'searchKeywords', 'sellerVerified', 'sellerCountry', 'takedown', 'exporterOrgId', 'tokenVersion',
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      const blob = JSON.stringify(res.body) + (res.text ?? '');
      for (const field of FORBIDDEN) expect(blob, field).not.toContain(field);
    }
  });
});
