/**
 * M5-D — Organisation list and detail.
 *
 * §7 made the COMPANY the unit an admin governs. The tests weight three things
 * heavily, because all three are ways this screen could quietly mislead:
 * the block's real reach, which side was actually reviewed, and the fields that
 * will never fill.
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
import { Inquiry } from '../src/models/Inquiry.js';
import { Conversation } from '../src/models/Conversation.js';
import { SavedItem } from '../src/models/SavedItem.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { invalidateLeafCache } from '../src/services/category.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let sa;
let reader;
let leaf;
let sellerOrg;
let seller;
let buyer;

async function makeUser(role, orgFields = {}, permissions = [], org = null) {
  seq += 1;
  const theOrg = org ?? (await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...orgFields,
  }));
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `m5d_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `65${2000000 + seq}`, e164: `+9165${2000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: theOrg._id,
    permissions,
  });
  return { org: theOrg, user, token: signAccessToken(user) };
}

async function seedWorld() {
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });

  sa = await makeUser('superadmin');
  reader = await makeUser('employee', {}, ['organisation:read']);

  const s = await makeUser('exporter', { exporterSide: true, country: 'IN', kycStatus: 'submitted' });
  seller = s; sellerOrg = s.org;
  await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { name: 'TextileHub Exports' } });
  sellerOrg.name = 'TextileHub Exports';

  buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
}

const listAs = (token, query = {}) =>
  request(app).get('/admin/orgs').query(query).set(bearer(token));
const detailAs = (token, id) => request(app).get(`/admin/orgs/${id}`).set(bearer(token));

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

describe('M5-D · gate', () => {
  it('organisation:read opens it; no grant is 403; audit:read does not substitute', async () => {
    expect((await listAs(reader.token)).status).toBe(200);
    expect((await listAs(sa.token)).status).toBe(200);

    const none = await makeUser('employee');
    expect((await listAs(none.token)).status).toBe(403);

    const auditOnly = await makeUser('employee', {}, ['audit:read']);
    expect((await listAs(auditOnly.token)).status).toBe(403);
  });

  it('parties and guests are refused', async () => {
    expect((await listAs(buyer.token)).status).toBe(403);
    expect((await listAs(seller.token)).status).toBe(403);
    expect((await request(app).get('/admin/orgs')).status).toBe(401);
  });

  it('🔴 it is a READ — there is no create, edit or delete route (rules 1 and 3)', async () => {
    for (const [method, path] of [
      ['post', '/admin/orgs'],
      ['patch', `/admin/orgs/${sellerOrg._id}`],
      ['put', `/admin/orgs/${sellerOrg._id}`],
      ['delete', `/admin/orgs/${sellerOrg._id}`],
    ]) {
      expect((await request(app)[method](path).set(bearer(sa.token)).send({ name: 'Renamed' })).status).toBe(404);
    }
    expect((await Organisation.findById(sellerOrg._id)).name).toBe('TextileHub Exports');
  });
});

describe('M5-D · list', () => {
  it('returns the five columns plus country and slug for the second line', async () => {
    const res = await listAs(reader.token);
    const row = res.body.organisations.find((o) => o.id === String(sellerOrg._id));

    expect(Object.keys(row).sort()).toEqual(
      // `logo` rides in the company cell beside the name (added with the M5
      // close-out admin polish). It is public data the seller page already
      // shows — the point of pinning this list is that nothing PRIVATE leaks
      // in, so a public field is an allowed addition, a new private one is not.
      [
        'blocked', 'country', 'id', 'logo', 'name', 'products', 'sides', 'slug', 'takedowns', 'verification',
        'changePending', 'changeSubmittedAt', // change re-verification chips (2026-08-19)
      ].sort(),
    );
    expect(row.country).toBe('IN');
    expect(row.verification).toBe('submitted');
    expect(row.sides).toEqual({ buyer: false, exporter: true, both: false });
  });

  it('🔴 V5: the platform org is NOT a company and never appears', async () => {
    const res = await listAs(reader.token);
    const names = res.body.organisations.map((o) => o.name);
    expect(names).not.toContain(sa.org.name);
    expect(res.body.organisations.every((o) => o.id !== String(sa.org._id))).toBe(true);
  });

  it('counts LIVE products only — taken down and archived do not count', async () => {
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Live', status: 'active' });
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Hidden', status: 'inactive' });
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Gone', status: 'archived' });
    await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Blocked', status: 'active',
      takedown: { isDown: true, reason: 'x', at: new Date() },
    });

    const res = await listAs(reader.token);
    const row = res.body.organisations.find((o) => o.id === String(sellerOrg._id));
    expect(row.products).toBe(1);
  });

  it('🔴 V4: a page of many orgs costs ONE aggregation, not one query per row', async () => {
    const orgs = [];
    for (let i = 0; i < 12; i += 1) {
      const o = await Organisation.create({
        name: `Bulk Co ${i}`, type: 'business', exporterSide: true, country: 'IN',
      });
      orgs.push(o);
      await Product.create({ exporterOrgId: o._id, categoryId: leaf._id, name: `P${i}`, status: 'active' });
    }

    const res = await listAs(reader.token, { pageSize: 50 });
    for (const o of orgs) {
      expect(res.body.organisations.find((r) => r.id === String(o._id)).products).toBe(1);
    }
  });

  it('sorts by takedown count so repeat offenders surface first', async () => {
    const worst = await Organisation.create({
      name: 'Repeat Offender', type: 'business', exporterSide: true, takedownCount: 7,
    });
    await Organisation.create({ name: 'Mild Co', type: 'business', exporterSide: true, takedownCount: 2 });

    const res = await listAs(reader.token);
    expect(res.body.organisations[0].id).toBe(String(worst._id));
    expect(res.body.organisations[0].takedowns).toBe(7);
  });

  it('filters by side, verification and blocked', async () => {
    await Organisation.create({ name: 'Both Co', type: 'business', buyerSide: true, exporterSide: true });
    await Organisation.updateOne({ _id: buyer.org._id }, { $set: { isActive: false } });

    expect((await listAs(reader.token, { side: 'both' })).body.total).toBe(1);
    expect((await listAs(reader.token, { verification: 'submitted' })).body.total).toBe(1);
    expect((await listAs(reader.token, { blocked: 'true' })).body.total).toBe(1);
  });

  it('search is regex-escaped and prefix-anchored (rule 9)', async () => {
    expect((await listAs(reader.token, { q: 'TextileHub' })).body.total).toBe(1);
    // A prefix, not a substring.
    expect((await listAs(reader.token, { q: 'Hub' })).body.total).toBe(0);
    // Metacharacters are literal, never compiled.
    expect((await listAs(reader.token, { q: '.*' })).body.total).toBe(0);
  });

  it('pageSize is capped', async () => {
    expect((await listAs(reader.token, { pageSize: 9999 })).status).toBe(400);
  });
});

describe('M5-D · detail — the three things it must be honest about', () => {
  it('🔴 reports what a block ACTUALLY does — now including the F1-B cascade (rule 11)', async () => {
    const res = await detailAs(reader.token, sellerOrg._id);
    const reach = res.body.organisation.blockReach;

    // F1-B shipped 2026-08-01, so a block finally reaches all four. This
    // assertion used to say the opposite ON PURPOSE — the gap was pinned so that
    // closing it could never happen by accident.
    expect(reach.organisation).toBe(true);
    expect(reach.users).toBe(true);
    expect(reach.products).toBe(true);
    expect(reach.conversations).toBe(true);
    expect(reach.note).toMatch(/takes its live products down/i);
    // Drafts and archived rows are deliberately exempt, and the copy says so.
    expect(reach.note).toMatch(/drafts and archived/i);
    // Never blocked, so no cascade has run.
    expect(reach.cascade).toBeNull();
  });

  it('🔴 says WHICH SIDES were actually reviewed — kycStatus is one shared value (rule 13)', async () => {
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { buyerSide: true } });
    const verifier = await makeUser('employee', {}, ['exporter:verify']);

    // Nobody has reviewed anything yet.
    let res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.verification.reviewedSides).toEqual([]);

    await request(app).post(`/employee/exporters/${sellerOrg._id}/verify`).set(bearer(verifier.token));

    res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.verification.reviewedSides).toEqual(['exporter']);
    expect(res.body.organisation.verification.reviewedAt).toBeTruthy();
    // The whole company is verified off ONE side's review — which is exactly why
    // the screen has to name the side. The buyer side here is unreviewed.
    expect(res.body.organisation.header.verified).toBe(true);
    expect(res.body.organisation.sides.both).toBe(true);
  });

  it('reports BOTH sides once both have been reviewed — not just the first', async () => {
    // A single value would keep saying "buyer" for a company whose exporter side
    // has since been reviewed too, understating the evidence on the screen whose
    // whole job is to show it.
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { buyerSide: true } });
    const staff = await makeUser('employee', {}, ['buyer:approve', 'exporter:verify']);

    await request(app).post(`/employee/buyers/${sellerOrg._id}/approve`).set(bearer(staff.token));
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { kycStatus: 'submitted' } });
    await request(app).post(`/employee/exporters/${sellerOrg._id}/verify`).set(bearer(staff.token));

    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.verification.reviewedSides.sort()).toEqual(['buyer', 'exporter']);
  });

  it('names WHO verified, not just an id', async () => {
    const verifier = await makeUser('employee', {}, ['exporter:verify']);
    await request(app).post(`/employee/exporters/${sellerOrg._id}/verify`).set(bearer(verifier.token));

    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.verification.verifiedBy).toEqual({
      id: String(verifier.user._id), name: verifier.user.name, role: 'employee',
    });
  });

  it('an unverified org has no verifier at all', async () => {
    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.verification.verifiedBy).toBeNull();
  });

  it('🔴 flags the fields that will NEVER fill rather than rendering them blank (rule 13)', async () => {
    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.notCaptured.sort()).toEqual(
      ['authorisedSignatory', 'establishedYear', 'registrationNumber', 'taxId', 'website'].sort(),
    );
    // …and they are not rendered as empty company fields either.
    expect(Object.keys(res.body.organisation.company).sort()).toEqual(
      ['address', 'country', 'description', 'entityType', 'logo'].sort(),
    );
  });
});

describe('M5-D · detail — leaks', () => {
  it('🔴 V3: organisation:read returns a COUNT of KYC documents, never the documents', async () => {
    await Organisation.updateOne({ _id: sellerOrg._id }, {
      $set: {
        kycDocuments: [
          { docType: 'pan', storageKey: 'mpx/kyc/SECRETKEY1', uploadedAt: new Date() },
          { docType: 'gst', storageKey: 'mpx/kyc/SECRETKEY2', uploadedAt: new Date() },
        ],
      },
    });

    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.verification.kycDocumentCount).toBe(2);

    const blob = JSON.stringify(res.body);
    expect(blob).not.toContain('SECRETKEY1');
    expect(blob).not.toContain('storageKey');
    expect(blob).not.toContain('kycDocuments');
  });

  it('🔴 V2: the users list carries no permissions and no password hash — for anyone', async () => {
    await User.updateOne({ _id: seller.user._id }, { $set: { permissions: ['product:read'] } });

    const res = await detailAs(reader.token, sellerOrg._id);
    const users = res.body.organisation.users;
    expect(users.length).toBeGreaterThan(0);

    for (const u of users) {
      expect(Object.keys(u).sort()).toEqual(['email', 'id', 'isActive', 'lastLoginAt', 'name', 'role'].sort());
    }
    const blob = JSON.stringify(res.body);
    expect(blob).not.toContain('permissions');
    expect(blob).not.toContain('passwordHash');
    expect(blob).not.toContain('tokenVersion');
  });

  it('reads lastLoginAt, which M1 already sets on every successful login', async () => {
    const at = new Date('2026-07-30T10:00:00Z');
    await User.updateOne({ _id: seller.user._id }, { $set: { lastLoginAt: at } });

    const res = await detailAs(reader.token, sellerOrg._id);
    const row = res.body.organisation.users.find((u) => u.id === String(seller.user._id));
    expect(new Date(row.lastLoginAt).toISOString()).toBe(at.toISOString());
  });
});

describe('M5-D · detail — sides, counts and the empty claim history', () => {
  it('shows the exporter product breakdown, with archived as a COUNT only (W3)', async () => {
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'A', status: 'active' });
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'B', status: 'inactive' });
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'C', status: 'archived' });
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'D', status: 'draft' });

    const res = await detailAs(reader.token, sellerOrg._id);
    const p = res.body.organisation.products;
    expect(p).toMatchObject({ active: 1, inactive: 1, archived: 1, draft: 1, blocked: 0 });
    // Flagged so nobody links this number into the monitoring list, which
    // deliberately cannot show archived rows.
    expect(p.archivedIsCountOnly).toBe(true);
  });

  it('🔴 the breakdown buckets are DISJOINT — a blocked product is counted once', async () => {
    // A taken-down product whose underlying status is `inactive` used to be
    // counted in BOTH buckets, so the parts added up to more than the whole.
    await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Blocked+Inactive', status: 'inactive',
      takedown: { isDown: true, reason: 'x', at: new Date() },
    });
    await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Plain Live', status: 'active' });

    const res = await detailAs(reader.token, sellerOrg._id);
    const p = res.body.organisation.products;

    expect(p.blocked).toBe(1);
    expect(p.inactive).toBe(0); // NOT double-counted
    expect(p.active).toBe(1);

    const sum = p.active + p.inactive + p.draft + p.archived + p.blocked;
    expect(sum).toBe(await Product.countDocuments({ exporterOrgId: sellerOrg._id }));
  });

  it('a buyer-only org gets buyer activity and no product block', async () => {
    const product = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Cotton Roll',
      status: 'active', price: { mode: 'on_request' },
    });
    await request(app).post('/inquiries').set(bearer(buyer.token))
      .send({ productId: String(product._id), note: 'Best price please.' });
    await request(app).post('/saved').set(bearer(buyer.token))
      .send({ targetType: 'product', targetId: String(product._id) });

    const res = await detailAs(reader.token, buyer.org._id);
    expect(res.body.organisation.products).toBeNull();
    expect(res.body.organisation.buyerActivity).toEqual({ enquiriesSent: 1, savedItems: 1 });
    expect(res.body.organisation.chats).toEqual({ asBuyer: 1, asExporter: 0 });
  });

  it('a BOTH-SIDES org gets both chat counts, split by field (§7)', async () => {
    await Organisation.updateOne({ _id: sellerOrg._id }, { $set: { buyerSide: true } });
    const product = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Cotton Roll',
      status: 'active', price: { mode: 'on_request' },
    });
    await request(app).post('/inquiries').set(bearer(buyer.token))
      .send({ productId: String(product._id), note: 'Best price please.' });

    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.chats).toEqual({ asBuyer: 0, asExporter: 1 });
    expect(res.body.organisation.products).not.toBeNull();
    expect(res.body.organisation.buyerActivity).not.toBeNull();
  });

  it('🔴 claim history is EMPTY and says so — A21 Step 4b never writes org.claim', async () => {
    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.sides.claimHistory).toEqual([]);
    // The flag is what stops a screen implying the data went missing.
    expect(res.body.organisation.sides.claimHistoryAvailable).toBe(false);
  });

  it('counts resubmits from the kyc.submit audit rows (no field stores it)', async () => {
    const { AuditLog } = await import('../src/models/AuditLog.js');
    for (let i = 0; i < 3; i += 1) {
      await AuditLog.create({
        actorId: seller.user._id, actorRole: 'exporter', action: 'kyc.submit',
        entityType: 'Organisation', entityId: sellerOrg._id, orgId: sellerOrg._id,
        occurredAt: new Date(Date.now() + i * 1000),
      });
    }
    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.verification.resubmitCount).toBe(3);
  });

  it('an unknown org and the platform org are both 404 (rule 7 / V5)', async () => {
    expect((await detailAs(reader.token, new mongoose.Types.ObjectId())).status).toBe(404);
    expect((await detailAs(reader.token, sa.org._id)).status).toBe(404);
  });

  it('a rejected org shows the reason and carries NO verifiedAt', async () => {
    await Organisation.updateOne({ _id: sellerOrg._id }, {
      $set: { kycStatus: 'rejected', kycRejectionReason: 'Documents unreadable' },
      $unset: { verifiedAt: '', verifiedBy: '' },
    });

    const res = await detailAs(reader.token, sellerOrg._id);
    expect(res.body.organisation.verification.status).toBe('rejected');
    expect(res.body.organisation.verification.rejectionReason).toBe('Documents unreadable');
    expect(res.body.organisation.header.verified).toBe(false);
    expect(res.body.organisation.header.verifiedAt).toBeNull();
  });
});
