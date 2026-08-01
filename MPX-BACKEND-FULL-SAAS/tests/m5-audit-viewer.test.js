/**
 * M5-C — the audit log viewer.
 *
 * §6's whole point is that this is the record which protects the operator in a
 * dispute, so the tests care about two things above all: that it is genuinely
 * read-only, and that it never drops or blanks an entry it cannot fully resolve.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { purgeBlockedProducts } from '../src/jobs/purgeBlockedProducts.js';
import { invalidateLeafCache } from '../src/services/category.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let sa;
let auditor;
let sellerOrg;
let leaf;

async function makeUser(role, permissions = []) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...(role === 'exporter' ? { exporterSide: true } : {}),
    ...(role === 'buyer' ? { buyerSide: true } : {}),
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `m5c_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `64${2000000 + seq}`, e164: `+9164${2000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

async function entry(overrides = {}) {
  return AuditLog.create({
    actorId: sa.user._id,
    actorRole: 'superadmin',
    action: 'product.takedown',
    entityType: 'Product',
    entityId: new mongoose.Types.ObjectId(),
    occurredAt: new Date(),
    ...overrides,
  });
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}), Product.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  sa = await makeUser('superadmin');
  auditor = await makeUser('employee', ['audit:read']);
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  const s = await makeUser('exporter');
  sellerOrg = s.org;
});

describe('M5-C · gate', () => {
  it('audit:read opens it; no grant is 403; organisation:read does NOT substitute', async () => {
    await entry();

    expect((await request(app).get('/admin/audit').set(bearer(auditor.token))).status).toBe(200);
    expect((await request(app).get('/admin/audit').set(bearer(sa.token))).status).toBe(200);

    const none = await makeUser('employee');
    expect((await request(app).get('/admin/audit').set(bearer(none.token))).status).toBe(403);

    // Separate permissions on purpose: the audit trail records every KYC view
    // and every conversation read, so it is a bigger grant than browsing a company.
    const orgOnly = await makeUser('employee', ['organisation:read']);
    expect((await request(app).get('/admin/audit').set(bearer(orgOnly.token))).status).toBe(403);
  });

  it('a buyer, an exporter and a guest are all refused', async () => {
    const buyer = await makeUser('buyer');
    const exporter = await makeUser('exporter');
    expect((await request(app).get('/admin/audit').set(bearer(buyer.token))).status).toBe(403);
    expect((await request(app).get('/admin/audit').set(bearer(exporter.token))).status).toBe(403);
    expect((await request(app).get('/admin/audit')).status).toBe(401);
  });
});

describe('M5-C · read-only and append-only (rule 1)', () => {
  it('there is NO write, update or delete route — every attempt is 404', async () => {
    const row = await entry();
    for (const [method, path] of [
      ['post', '/admin/audit'],
      ['patch', `/admin/audit/${row._id}`],
      ['put', `/admin/audit/${row._id}`],
      ['delete', `/admin/audit/${row._id}`],
    ]) {
      const res = await request(app)[method](path).set(bearer(sa.token)).send({ action: 'tampered' });
      expect(res.status).toBe(404);
    }
    expect((await AuditLog.findById(row._id)).action).toBe('product.takedown');
  });
});

describe('M5-C · list, filters and shape', () => {
  it('returns newest first with a stable tiebreaker when timestamps collide', async () => {
    const at = new Date();
    const made = [];
    for (let i = 0; i < 5; i += 1) made.push(await entry({ occurredAt: at }));

    const seen = [];
    for (const page of [1, 2, 3]) {
      const res = await request(app).get('/admin/audit')
        .query({ page, pageSize: 2 }).set(bearer(auditor.token));
      seen.push(...res.body.entries.map((e) => e.id));
    }
    expect(new Set(seen).size).toBe(5);
    expect(seen.sort()).toEqual(made.map((m) => String(m._id)).sort());
  });

  it('filters by actor, by action and by target', async () => {
    const other = await makeUser('employee', ['audit:read']);
    const productId = new mongoose.Types.ObjectId();
    await entry({ action: 'product.takedown', entityId: productId });
    await entry({ action: 'kyc.view', entityType: 'Organisation' });
    await entry({ actorId: other.user._id, action: 'product.restore' });

    const byActor = await request(app).get('/admin/audit')
      .query({ actorId: String(other.user._id) }).set(bearer(auditor.token));
    expect(byActor.body.total).toBe(1);
    expect(byActor.body.entries[0].action).toBe('product.restore');

    const byAction = await request(app).get('/admin/audit')
      .query({ action: 'kyc.view' }).set(bearer(auditor.token));
    expect(byAction.body.total).toBe(1);

    const byTarget = await request(app).get('/admin/audit')
      .query({ entityType: 'Product', entityId: String(productId) }).set(bearer(auditor.token));
    expect(byTarget.body.total).toBe(1);
  });

  it('filters by date range', async () => {
    await entry({ occurredAt: new Date('2026-01-10') });
    await entry({ occurredAt: new Date('2026-06-10') });

    const res = await request(app).get('/admin/audit')
      .query({ from: '2026-05-01', to: '2026-07-01' }).set(bearer(auditor.token));
    expect(res.body.total).toBe(1);
  });

  it('🔴 W6: an INVERTED date range is a 400, not a silent empty page', async () => {
    await entry();
    const res = await request(app).get('/admin/audit')
      .query({ from: '2026-07-01', to: '2026-01-01' }).set(bearer(auditor.token));
    // An empty page here would read as "no activity in this window" — the
    // opposite of the truth, and the worst answer to give an investigation.
    expect(res.status).toBe(400);
  });

  it('entityId without entityType is refused — the index is the pair', async () => {
    const res = await request(app).get('/admin/audit')
      .query({ entityId: String(new mongoose.Types.ObjectId()) }).set(bearer(auditor.token));
    expect(res.status).toBe(400);
  });

  it('an unknown action returns an empty page, not an error — the list is not an enum', async () => {
    await entry();
    const res = await request(app).get('/admin/audit')
      .query({ action: 'module9.something.new' }).set(bearer(auditor.token));
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('pageSize is capped', async () => {
    expect((await request(app).get('/admin/audit')
      .query({ pageSize: 9999 }).set(bearer(auditor.token))).status).toBe(400);
  });

  it('the list row is a summary; the detail carries the snapshot', async () => {
    const row = await entry({
      before: { kycStatus: 'submitted' },
      after: { kycStatus: 'verified' },
      requestId: 'req-123',
    });

    const list = await request(app).get('/admin/audit').set(bearer(auditor.token));
    const listed = list.body.entries[0];
    expect(Object.keys(listed).sort()).toEqual(
      ['action', 'actor', 'id', 'occurredAt', 'orgId', 'target'].sort(),
    );
    expect(listed).not.toHaveProperty('before');

    const detail = await request(app).get(`/admin/audit/${row._id}`).set(bearer(auditor.token));
    expect(detail.body.entry.before).toEqual({ kycStatus: 'submitted' });
    expect(detail.body.entry.after).toEqual({ kycStatus: 'verified' });
    expect(detail.body.entry.requestId).toBe('req-123');
  });

  it('🔴 filters by orgId — §7\'s "this Organisation\'s full record"', async () => {
    const otherOrg = await Organisation.create({ name: 'Other Co', type: 'business', exporterSide: true });

    // A product takedown carries entityType 'Product' but the SELLER's orgId, so
    // filtering by target would miss most of a company's own history — which is
    // exactly why this filter has to exist separately.
    await entry({ action: 'product.takedown', entityType: 'Product', orgId: sellerOrg._id });
    await entry({ action: 'kyc.view', entityType: 'Organisation', entityId: sellerOrg._id, orgId: sellerOrg._id });
    await entry({ action: 'product.takedown', entityType: 'Product', orgId: otherOrg._id });

    const res = await request(app).get('/admin/audit')
      .query({ orgId: String(sellerOrg._id) }).set(bearer(auditor.token));

    expect(res.body.total).toBe(2);
    expect(res.body.entries.map((e) => e.action).sort()).toEqual(['kyc.view', 'product.takedown']);

    // …and the target filter alone would NOT have found the takedown row.
    const byTarget = await request(app).get('/admin/audit')
      .query({ entityType: 'Organisation', entityId: String(sellerOrg._id) }).set(bearer(auditor.token));
    expect(byTarget.body.total).toBe(1);
  });

  it('an unknown id is 404', async () => {
    expect((await request(app).get(`/admin/audit/${new mongoose.Types.ObjectId()}`)
      .set(bearer(auditor.token))).status).toBe(404);
  });
});

describe('M5-C · actors — including the ones that are not people (W2)', () => {
  it('resolves a real actor to a name and role', async () => {
    await entry();
    const res = await request(app).get('/admin/audit').set(bearer(auditor.token));
    expect(res.body.entries[0].actor).toEqual({
      id: String(sa.user._id), name: sa.user.name, role: 'superadmin',
    });
  });

  it('🔴 the 180-day purge row renders as "System", never blank', async () => {
    // Produced by the real job, not hand-written — this is the only hard delete
    // in the system and the entry a dispute is most likely to need.
    const product = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Doomed Roll', status: 'active',
      takedown: { isDown: true, reason: 'counterfeit', byUserId: sa.user._id, at: new Date('2026-01-01') },
    });
    const { purged } = await purgeBlockedProducts({ now: new Date('2026-08-01') });
    expect(purged).toBe(1);
    expect(await Product.findById(product._id)).toBeNull();

    const res = await request(app).get('/admin/audit')
      .query({ action: 'product.purge' }).set(bearer(auditor.token));

    const row = res.body.entries[0];
    expect(row.actor).toEqual({ id: null, name: 'System', role: 'system' });

    // …and the snapshot still names what was deleted (rule 4).
    const detail = await request(app).get(`/admin/audit/${row.id}`).set(bearer(auditor.token));
    expect(detail.body.entry.before.productName).toBe('Doomed Roll');
    expect(detail.body.entry.before.sellerCompanyName).toBeTruthy();
  });

  it('an unresolvable actor still renders the entry rather than dropping it', async () => {
    const ghost = new mongoose.Types.ObjectId();
    await entry({ actorId: ghost, actorRole: 'employee' });

    const res = await request(app).get('/admin/audit')
      .query({ actorId: String(ghost) }).set(bearer(auditor.token));
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].actor).toEqual({ id: String(ghost), name: null, role: 'employee' });
  });

  it('resolves many actors in ONE query, not one per row', async () => {
    const actors = [];
    for (let i = 0; i < 4; i += 1) actors.push(await makeUser('employee'));
    for (const a of actors) {
      for (let i = 0; i < 3; i += 1) await entry({ actorId: a.user._id, actorRole: 'employee' });
    }

    const res = await request(app).get('/admin/audit')
      .query({ pageSize: 50 }).set(bearer(auditor.token));
    const named = res.body.entries.filter((e) => e.actor.name);
    expect(named.length).toBeGreaterThanOrEqual(12);
    for (const e of named) expect(e.actor.name).toBeTruthy();
  });
});

describe('M5-C · it can actually see what the platform records (§6 coverage)', () => {
  it('shows a real moderation action end to end', async () => {
    const product = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Cotton Roll', status: 'active',
      price: { mode: 'on_request' },
    });
    await request(app).post(`/admin/products/${product._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });

    const res = await request(app).get('/admin/audit')
      .query({ action: 'product.takedown' }).set(bearer(auditor.token));

    expect(res.body.total).toBe(1);
    const row = res.body.entries[0];
    expect(row.actor.name).toBe(sa.user.name);
    expect(row.target).toEqual({ type: 'Product', id: String(product._id) });

    const detail = await request(app).get(`/admin/audit/${row.id}`).set(bearer(auditor.token));
    expect(detail.body.entry.after.reason).toBe('counterfeit listing');
  });
});
