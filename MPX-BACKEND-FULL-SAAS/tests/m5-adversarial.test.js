/**
 * M5-F — adversarial pass over the new admin surface.
 *
 * The console is the most privileged thing in the system: it reads two
 * companies' private data and can freeze their trade. These are attacks, not
 * feature tests.
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
import { Conversation } from '../src/models/Conversation.js';
import { Inquiry } from '../src/models/Inquiry.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { invalidateLeafCache } from '../src/services/category.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let sa;
let sellerOrg;
let leaf;

async function makeUser(role, orgFields = {}, permissions = []) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...orgFields,
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `m5f_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `67${2000000 + seq}`, e164: `+9167${2000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

const NEW_ROUTES = ['/admin/orgs', '/admin/audit', '/admin/dashboard'];

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

describe('ATTACK · privilege escalation through the console', () => {
  it('a party account cannot touch ANY new admin route', async () => {
    const buyer = await makeUser('buyer', { buyerSide: true });
    const exporter = await makeUser('exporter', { exporterSide: true });

    for (const token of [buyer.token, exporter.token]) {
      for (const path of NEW_ROUTES) {
        const res = await request(app).get(path).set(bearer(token));
        expect([403, 404]).toContain(res.status);
      }
      expect((await request(app).get(`/admin/orgs/${sellerOrg._id}`).set(bearer(token))).status).toBe(403);
    }
  });

  it('one grant never implies another', async () => {
    const orgOnly = await makeUser('employee', {}, ['organisation:read']);
    const auditOnly = await makeUser('employee', {}, ['audit:read']);

    expect((await request(app).get('/admin/orgs').set(bearer(orgOnly.token))).status).toBe(200);
    expect((await request(app).get('/admin/audit').set(bearer(orgOnly.token))).status).toBe(403);

    expect((await request(app).get('/admin/audit').set(bearer(auditOnly.token))).status).toBe(200);
    expect((await request(app).get('/admin/orgs').set(bearer(auditOnly.token))).status).toBe(403);

    // Neither read grant reaches governance.
    for (const token of [orgOnly.token, auditOnly.token]) {
      expect((await request(app).post(`/admin/orgs/${sellerOrg._id}/block`)
        .set(bearer(token)).send({ reason: 'trying it on' })).status).toBe(403);
    }
  });

  it('🔴 an employee cannot grant themselves the new strings', async () => {
    const emp = await makeUser('employee', {}, ['organisation:read']);
    const res = await request(app)
      .patch(`/admin/employees/${emp.user._id}/permissions`)
      .set(bearer(emp.token))
      .send({ permissions: ['organisation:read', 'audit:read'] });

    expect(res.status).toBe(403);
    expect((await User.findById(emp.user._id)).permissions).toEqual(['organisation:read']);
  });

  it('a revoked grant stops working on the very next request — no re-login needed', async () => {
    const emp = await makeUser('employee', {}, ['organisation:read']);
    expect((await request(app).get('/admin/orgs').set(bearer(emp.token))).status).toBe(200);

    await request(app).patch(`/admin/employees/${emp.user._id}/permissions`)
      .set(bearer(sa.token)).send({ permissions: [] });

    expect((await request(app).get('/admin/orgs').set(bearer(emp.token))).status).toBe(403);
  });
});

describe('ATTACK · the console never writes (rules 1 and 3)', () => {
  it('no new route accepts a write, in any verb', async () => {
    const row = await AuditLog.create({
      actorId: sa.user._id, action: 'product.takedown', entityType: 'Product',
      entityId: new mongoose.Types.ObjectId(), occurredAt: new Date(),
    });

    const attempts = [
      ['post', '/admin/orgs'], ['patch', `/admin/orgs/${sellerOrg._id}`],
      ['put', `/admin/orgs/${sellerOrg._id}`], ['delete', `/admin/orgs/${sellerOrg._id}`],
      ['post', '/admin/audit'], ['patch', `/admin/audit/${row._id}`],
      ['delete', `/admin/audit/${row._id}`], ['post', '/admin/dashboard'],
    ];
    for (const [method, path] of attempts) {
      const res = await request(app)[method](path).set(bearer(sa.token)).send({ name: 'x', action: 'tampered' });
      expect(res.status).toBe(404);
    }

    expect((await Organisation.findById(sellerOrg._id)).name).toBeTruthy();
    expect((await AuditLog.findById(row._id)).action).toBe('product.takedown');
  });

  it('an admin cannot edit seller content through any surface (rule 3 / B6)', async () => {
    const product = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Seller Owned', status: 'active',
    });
    for (const [method, path] of [['patch', `/admin/products/${product._id}`], ['put', `/admin/products/${product._id}`]]) {
      expect((await request(app)[method](path).set(bearer(sa.token)).send({ name: 'Renamed' })).status).toBe(404);
    }
    expect((await Product.findById(product._id)).name).toBe('Seller Owned');
  });
});

describe('ATTACK · injection and hostile input on the new surface', () => {
  it('Mongo operators and prototype keys are refused', async () => {
    const reader = await makeUser('employee', {}, ['organisation:read', 'audit:read']);

    for (const url of [
      '/admin/orgs?q[$ne]=null',
      '/admin/orgs?pageSize[$gt]=0',
      '/admin/audit?action[$ne]=null',
      '/admin/audit?actorId[$ne]=null',
    ]) {
      const res = await request(app).get(url).set(bearer(reader.token));
      expect([400, 403]).toContain(res.status);
    }
    expect({}.polluted).toBeUndefined();
  });

  it('hostile search strings never 500 and never compile as patterns', async () => {
    const reader = await makeUser('employee', {}, ['organisation:read']);
    await Organisation.create({ name: 'Regex Co', type: 'business', exporterSide: true });

    for (const q of ['.*', '^.*$', '(((', '\\', 'a'.repeat(100), '👋 ünïcödé', '../../etc']) {
      const res = await request(app).get('/admin/orgs').query({ q }).set(bearer(reader.token));
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        // Escaped: a metacharacter matches literally, so it finds nothing.
        expect(res.body.organisations.every((o) => o.name.startsWith(q) || res.body.total === 0)).toBe(true);
      }
    }
  });

  it('malformed ids are clean 4xx, never 500', async () => {
    const reader = await makeUser('employee', {}, ['organisation:read', 'audit:read']);
    expect((await request(app).get('/admin/orgs/not-an-id').set(bearer(reader.token))).status).toBe(400);
    expect((await request(app).get('/admin/audit/not-an-id').set(bearer(reader.token))).status).toBe(400);
    expect((await request(app).get('/admin/audit').query({ actorId: 'nope' }).set(bearer(reader.token))).status).toBe(400);
  });
});

describe('ATTACK · data exposure across the console', () => {
  it('🔴 no new admin response ever carries a secret or another user\'s permissions', async () => {
    const reader = await makeUser('employee', {}, ['organisation:read', 'audit:read', 'product:read', 'conversation:read']);

    await Organisation.updateOne({ _id: sellerOrg._id }, {
      $set: {
        website: 'https://private.example',
        kycDocuments: [{ docType: 'pan', storageKey: 'mpx/kyc/SECRETKEY', uploadedAt: new Date() }],
      },
    });
    await AuditLog.create({
      actorId: sa.user._id, action: 'kyc.view', entityType: 'Organisation',
      entityId: sellerOrg._id, orgId: sellerOrg._id, occurredAt: new Date(),
    });

    const responses = await Promise.all([
      request(app).get('/admin/orgs').set(bearer(reader.token)),
      request(app).get(`/admin/orgs/${sellerOrg._id}`).set(bearer(reader.token)),
      request(app).get('/admin/audit').set(bearer(reader.token)),
      request(app).get('/admin/dashboard').set(bearer(reader.token)),
      request(app).get('/admin/products').set(bearer(reader.token)),
      request(app).get('/admin/conversations').set(bearer(reader.token)),
    ]);

    const FORBIDDEN = [
      'passwordHash', 'tokenVersion', 'twoFactorSecret', 'twoFactorBackupCodes',
      'kycDocuments', 'storageKey', 'SECRETKEY', 'permissions', 'codeHash', 'refreshToken',
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      const blob = JSON.stringify(res.body);
      for (const field of FORBIDDEN) expect(blob, `${field} leaked`).not.toContain(field);
    }
  });

  it('🔴 organisation:read cannot reach KYC documents — that still needs kyc:view', async () => {
    const orgReader = await makeUser('employee', {}, ['organisation:read']);
    await Organisation.updateOne({ _id: sellerOrg._id }, {
      $set: { kycDocuments: [{ docType: 'pan', storageKey: 'mpx/kyc/SECRETKEY', uploadedAt: new Date() }] },
    });

    // The count is visible…
    const detail = await request(app).get(`/admin/orgs/${sellerOrg._id}`).set(bearer(orgReader.token));
    expect(detail.body.organisation.verification.kycDocumentCount).toBe(1);

    // …the documents are not, and the dedicated endpoint still refuses.
    expect((await request(app).get(`/employee/orgs/${sellerOrg._id}/kyc/documents`)
      .set(bearer(orgReader.token))).status).toBe(403);
    expect(await AuditLog.countDocuments({ action: 'kyc.view' })).toBe(0);
  });

  it('the audit viewer does not become a back door into message content', async () => {
    const auditor = await makeUser('employee', {}, ['audit:read']);
    const buyer = await makeUser('buyer', { buyerSide: true });
    const product = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Cotton Roll',
      status: 'active', price: { mode: 'on_request' },
    });
    await request(app).post('/inquiries').set(bearer(buyer.token))
      .send({ productId: String(product._id), note: 'zebracrossing secret detail' });

    // An admin read writes an audit row — but the row records the ACCESS, not
    // the content (rule 4).
    const conv = await Conversation.findOne({});
    await request(app).get(`/admin/conversations/${conv._id}/messages`).set(bearer(sa.token));

    const res = await request(app).get('/admin/audit').query({ action: 'conversation.read' }).set(bearer(auditor.token));
    expect(res.body.total).toBeGreaterThan(0);

    const detail = await request(app).get(`/admin/audit/${res.body.entries[0].id}`).set(bearer(auditor.token));
    expect(JSON.stringify(detail.body)).not.toContain('zebracrossing');
  });
});

describe('ATTACK · counts cannot be made to lie', () => {
  it('the org list product count ignores drafts, archived and taken-down rows', async () => {
    const reader = await makeUser('employee', {}, ['organisation:read']);
    for (const [name, status] of [['A', 'active'], ['B', 'draft'], ['C', 'archived'], ['D', 'inactive']]) {
      await Product.create({ exporterOrgId: sellerOrg._id, categoryId: leaf._id, name, status });
    }
    await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'E', status: 'active',
      takedown: { isDown: true, reason: 'x', at: new Date() },
    });

    const res = await request(app).get('/admin/orgs').set(bearer(reader.token));
    const row = res.body.organisations.find((o) => o.id === String(sellerOrg._id));
    expect(row.products).toBe(1);
  });

  it('🔴 takedownCount survives the purge — the count is persisted, never derived from rows', async () => {
    const reader = await makeUser('employee', {}, ['organisation:read']);
    const product = await Product.create({
      exporterOrgId: sellerOrg._id, categoryId: leaf._id, name: 'Doomed', status: 'active',
    });
    await request(app).post(`/admin/products/${product._id}/takedown`)
      .set(bearer(sa.token)).send({ reason: 'counterfeit listing' });

    // The row is gone, the offence is not. Counting Product rows would
    // undercount repeat offenders exactly when it matters most.
    await Product.deleteOne({ _id: product._id });

    const res = await request(app).get('/admin/orgs').set(bearer(reader.token));
    const row = res.body.organisations.find((o) => o.id === String(sellerOrg._id));
    expect(row.takedowns).toBe(1);
  });
});
