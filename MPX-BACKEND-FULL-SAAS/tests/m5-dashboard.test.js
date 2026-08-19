/**
 * M5-E — the dashboard.
 *
 * §5 calls it "not a metrics wall — only things that ask for work". The tests
 * therefore care most about the numbers being TRUE and CLICKABLE: the purge
 * countdown agreeing with the job that does the purging, the two verification
 * tiles not double-counting silently, and no tile linking somewhere the caller
 * cannot go.
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
import { Conversation } from '../src/models/Conversation.js';
import { Inquiry } from '../src/models/Inquiry.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { invalidateLeafCache } from '../src/services/category.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const DAY = 24 * 60 * 60 * 1000;
let seq = 0;

let sa;
let leaf;
let sellerOrg;

const ALL_PERMS = [
  'buyer:approve', 'exporter:verify', 'user:read', 'kyc:view',
  'category:read', 'category:manage', 'product:read', 'product:takedown',
  'conversation:read', 'conversation:block', 'organisation:read', 'audit:read',
];

async function makeUser(role, orgFields = {}, permissions = []) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...orgFields,
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `m5e_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `66${2000000 + seq}`, e164: `+9166${2000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

const dash = (token) => request(app).get('/admin/dashboard').set(bearer(token));

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), Conversation.deleteMany({}), Inquiry.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
  invalidateLeafCache();
  sa = await makeUser('superadmin');
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  const s = await makeUser('exporter', { exporterSide: true, country: 'IN' });
  sellerOrg = s.org;
});

describe('M5-E · gate (V1)', () => {
  it('🔴 a buyer and an exporter get 403 — "no permission of its own" is not "no gate"', async () => {
    const buyer = await makeUser('buyer', { buyerSide: true });
    const exporter = await makeUser('exporter', { exporterSide: true });

    // An empty object would still mean a party account reached an /admin route.
    expect((await dash(buyer.token)).status).toBe(403);
    expect((await dash(exporter.token)).status).toBe(403);
    expect((await request(app).get('/admin/dashboard')).status).toBe(401);
  });

  it('an employee with NO permissions gets in, but sees nothing', async () => {
    const emp = await makeUser('employee');
    const res = await dash(emp.token);

    expect(res.status).toBe(200);
    expect(res.body.tiles).toEqual({});
    expect(res.body.totals).toEqual({});
  });
});

describe('M5-E · 14-day series (owner override, 2026-08-18)', () => {
  it('buckets by UTC day, zero-fills, and the window is exactly 14 days', async () => {
    // Two orgs today, one three days ago — the fixture exporter org also counts.
    await makeUser('exporter', { exporterSide: true, country: 'IN' });
    const old = await makeUser('exporter', { exporterSide: true, country: 'IN' });
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    // Native driver, not Mongoose: `timestamps: true` makes createdAt
    // immutable, so a Mongoose update silently drops the backdate.
    await Organisation.collection.updateOne({ _id: old.org._id }, { $set: { createdAt: threeDaysAgo } });

    const res = await request(app).get('/admin/dashboard').set(bearer(sa.token));
    const { series } = res.body;
    expect(series.days).toHaveLength(14);
    expect(series.organisations).toHaveLength(14);
    // The last entry is TODAY's bucket and the axis is date-keyed.
    expect(series.days[13]).toBe(new Date().toISOString().slice(0, 10));
    expect(series.organisations[13]).toBeGreaterThanOrEqual(2);
    expect(series.organisations[10]).toBeGreaterThanOrEqual(1);
    // A quiet day is 0, not a hole.
    expect(series.organisations.every((n) => typeof n === 'number')).toBe(true);
  });

  it('each series needs its own permission, and no permission means NO series at all', async () => {
    const orgOnly = await makeUser('employee', {}, ['organisation:read']);
    const r1 = await request(app).get('/admin/dashboard').set(bearer(orgOnly.token));
    expect(r1.body.series.organisations).toBeDefined();
    expect(r1.body.series.enquiries).toBeUndefined();

    const none = await makeUser('employee', {}, ['user:read']);
    const r2 = await request(app).get('/admin/dashboard').set(bearer(none.token));
    // Not an empty axis — null, so the client can hide the panel outright.
    expect(r2.body.series).toBeNull();
  });
});

describe('M5-E · chart window (owner, 2026-08-19)', () => {
  it('days=7 returns a 7-day axis; the default stays 14', async () => {
    const seven = await request(app).get('/admin/dashboard?days=7').set(bearer(sa.token));
    expect(seven.body.series.days).toHaveLength(7);
    const dflt = await request(app).get('/admin/dashboard').set(bearer(sa.token));
    expect(dflt.body.series.days).toHaveLength(14);
  });

  it('the window is an allowlist — an arbitrary number is a 400, not a giant aggregation', async () => {
    expect((await request(app).get('/admin/dashboard?days=100000').set(bearer(sa.token))).status).toBe(400);
    expect((await request(app).get('/admin/dashboard?days=15').set(bearer(sa.token))).status).toBe(400);
  });
});

describe('M5-E · tiles are filtered by what the caller already holds (D1)', () => {
  it('exporter:verify alone shows the exporter queue and NOT the buyer one', async () => {
    const emp = await makeUser('employee', {}, ['exporter:verify']);
    const res = await dash(emp.token);

    expect(res.body.tiles.pendingExporterVerifications).toBeTruthy();
    expect(res.body.tiles.pendingBuyerVerifications).toBeUndefined();
    // No product or org tiles either — those need their own grants.
    expect(res.body.tiles.blockedProducts).toBeUndefined();
    expect(res.body.totals.organisations).toBeUndefined();
  });

  it('product:read shows the product tiles only', async () => {
    const emp = await makeUser('employee', {}, ['product:read']);
    const res = await dash(emp.token);

    expect(res.body.tiles.blockedProducts).toBeTruthy();
    expect(res.body.tiles.nearingPurge).toBeTruthy();
    expect(res.body.tiles.pendingExporterVerifications).toBeUndefined();
    expect(res.body.totals.activeProducts).toBeDefined();
    expect(res.body.totals.conversations).toBeUndefined();
  });

  it('a superadmin sees everything without holding a single explicit grant', async () => {
    const res = await dash(sa.token);
    expect(sa.user.permissions).toEqual([]);

    for (const tile of ['pendingBuyerVerifications', 'pendingExporterVerifications', 'blockedProducts', 'nearingPurge', 'rejectedAwaitingResubmit']) {
      expect(res.body.tiles[tile]).toBeTruthy();
    }
    expect(res.body.totals.organisations).toBeTruthy();
    expect(res.body.totals.conversations).toBeDefined();
  });

  it('🔴 every returned tile carries the query that ACTUALLY reproduces its count', async () => {
    // Seed something into each tile so a real comparison is possible.
    await Organisation.create({ name: 'Pending Both', type: 'business', buyerSide: true, exporterSide: true, kycStatus: 'submitted' });
    await Organisation.create({ name: 'Rejected Co', type: 'business', exporterSide: true, kycStatus: 'rejected' });
    await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Old Block', status: 'active',
      takedown: { isDown: true, reason: 'x', at: new Date(Date.now() - 160 * DAY) },
    });
    await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Fresh Block', status: 'active',
      takedown: { isDown: true, reason: 'x', at: new Date() },
    });

    const emp = await makeUser('employee', {}, ALL_PERMS);
    const res = await dash(emp.token);

    // A link that opens a DIFFERENT number is worse than no link: the admin
    // trusts the tile, lands on a longer list, and cannot tell which rows the
    // count meant (§5 — "clicks through to the same list already filtered").
    for (const [name, tile] of Object.entries(res.body.tiles)) {
      if (name === 'bothSidesPending') continue; // an explanation, not a list
      expect(tile.link, `${name} has no link`).toBeTruthy();
      expect(tile.link.path).toMatch(/^\/admin\//);

      const listed = await request(app).get(tile.link.path)
        .query({ ...tile.link.query, pageSize: 50 }).set(bearer(emp.token));
      expect(listed.status, `${name} link is not reachable`).toBe(200);
      expect(listed.body.total, `${name}: tile says ${tile.count}, list says ${listed.body.total}`)
        .toBe(tile.count);
    }
  });
});

describe('M5-E · the two verification tiles are NOT independent queues', () => {
  it('🔴 a both-sides org counts in BOTH, and bothSidesPending says so', async () => {
    await Organisation.create({
      name: 'Both Co', type: 'business', buyerSide: true, exporterSide: true, kycStatus: 'submitted',
    });
    await Organisation.create({
      name: 'Buyer Only', type: 'business', buyerSide: true, kycStatus: 'submitted',
    });

    const res = await dash(sa.token);
    expect(res.body.tiles.pendingBuyerVerifications.count).toBe(2);   // both + buyer-only
    expect(res.body.tiles.pendingExporterVerifications.count).toBe(1); // both

    // 2 + 1 = 3 tiles' worth of "work", but there are only 2 companies. Without
    // this the numbers read as two separate reviews.
    expect(res.body.tiles.bothSidesPending.count).toBe(1);
    expect(res.body.tiles.bothSidesPending.note).toMatch(/verifies the whole company/i);
  });

  it('the platform org is never counted anywhere', async () => {
    const res = await dash(sa.token);
    const orgs = res.body.totals.organisations;
    expect(orgs.buyerOnly + orgs.exporterOnly + orgs.both).toBe(1); // just sellerOrg
  });
});

describe('M5-E · nearing purge agrees with the job that purges (W1)', () => {
  async function blockedProduct(name, daysAgo, status = 'active') {
    return Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name, status,
      takedown: { isDown: true, reason: 'x', at: new Date(Date.now() - daysAgo * DAY) },
    });
  }

  it('counts a product blocked 150+ days', async () => {
    await blockedProduct('Old Block', 160);
    await blockedProduct('Fresh Block', 10);

    const res = await dash(sa.token);
    expect(res.body.tiles.nearingPurge.count).toBe(1);
    expect(res.body.tiles.blockedProducts.count).toBe(2);
    expect(res.body.tiles.nearingPurge.afterDays).toBe(180);
  });

  it('🔴 an ARCHIVED taken-down product is NOT counted — it will never be purged (A7)', async () => {
    await blockedProduct('Archived Block', 170, 'archived');

    const res = await dash(sa.token);
    // Counting it would show a countdown that never fires, and an admin stops
    // trusting a number that lies.
    expect(res.body.tiles.nearingPurge.count).toBe(0);
  });

  it('a product that is not taken down is never nearing purge, however old', async () => {
    await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Just Old', status: 'active',
      createdAt: new Date(Date.now() - 400 * DAY),
    });
    const res = await dash(sa.token);
    expect(res.body.tiles.nearingPurge.count).toBe(0);
  });
});

describe('M5-E · verification turnaround measures VERIFICATIONS only (D3)', () => {
  it('averages days from submission to verification', async () => {
    await Organisation.create({
      name: 'Fast Co', type: 'business', exporterSide: true, kycStatus: 'verified',
      kycSubmittedAt: new Date(Date.now() - 4 * DAY), verifiedAt: new Date(Date.now() - 2 * DAY),
    });
    await Organisation.create({
      name: 'Slow Co', type: 'business', exporterSide: true, kycStatus: 'verified',
      kycSubmittedAt: new Date(Date.now() - 10 * DAY), verifiedAt: new Date(Date.now() - 6 * DAY),
    });

    const res = await dash(sa.token);
    expect(res.body.health.verification.averageDaysToVerify).toBe(3); // (2 + 4) / 2
    expect(res.body.health.verification.sample).toBe(2);
  });

  it('🔴 a REJECTED org does not contribute — it has no verifiedAt by design', async () => {
    await Organisation.create({
      name: 'Rejected Co', type: 'business', exporterSide: true, kycStatus: 'rejected',
      kycSubmittedAt: new Date(Date.now() - 30 * DAY), kycRejectionReason: 'Documents unreadable',
    });
    await Organisation.create({
      name: 'Verified Co', type: 'business', exporterSide: true, kycStatus: 'verified',
      kycSubmittedAt: new Date(Date.now() - 3 * DAY), verifiedAt: new Date(Date.now() - 1 * DAY),
    });

    const res = await dash(sa.token);
    // 30 days would have dragged the average wildly if rejections were included —
    // and `verifiedAt` is cleared on reject precisely because it would be a lie.
    expect(res.body.health.verification.averageDaysToVerify).toBe(2);
    expect(res.body.health.verification.sample).toBe(1);
  });

  it('reports null rather than zero when nothing has been verified yet', async () => {
    const res = await dash(sa.token);
    expect(res.body.health.verification.averageDaysToVerify).toBeNull();
    expect(res.body.health.verification.sample).toBe(0);
  });
});

describe('M5-E · totals, and what is deliberately absent', () => {
  it('counts organisations by side, active products, conversations and users', async () => {
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Live', status: 'active' });
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Draft', status: 'draft' });

    const res = await dash(sa.token);
    expect(res.body.totals.activeProducts).toBe(1);
    expect(res.body.totals.organisations).toEqual({ buyerOnly: 0, exporterOnly: 1, both: 0 });
    expect(res.body.totals.conversations).toBe(0);
    expect(res.body.totals.users).toBeGreaterThan(0);
  });

  it('carries no saved-item counts, no message counts, no trend data and no error tile (§5)', async () => {
    const res = await dash(sa.token);
    const blob = JSON.stringify(res.body);
    for (const absent of ['savedItems', 'messages', 'trend', 'errors', 'errorLog']) {
      expect(blob).not.toContain(absent);
    }
  });
});
