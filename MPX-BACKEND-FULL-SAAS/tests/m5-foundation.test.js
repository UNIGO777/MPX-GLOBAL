/**
 * M5-A — foundation. Two new grantable permission strings and the indexes the
 * audit viewer will lean on.
 *
 * Small phase, but everything after it depends on both: a permission that is not
 * in the catalogue cannot be assigned (rule 6), and an unindexed `action` filter
 * becomes a collection scan on the fastest-growing collection in the system.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { PERMISSIONS } from '../src/config/permissions.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

async function makeUser(role, permissions = []) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...(role === 'buyer' ? { buyerSide: true } : {}),
    ...(role === 'exporter' ? { exporterSide: true } : {}),
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `m5a_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `61${2000000 + seq}`, e164: `+9161${2000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Organisation.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
});

describe('M5-A · the two new permission strings are in the catalogue', () => {
  it('exposes organisation:read and audit:read as grantable values', () => {
    expect(PERMISSIONS.ORGANISATION_READ).toBe('organisation:read');
    expect(PERMISSIONS.AUDIT_READ).toBe('audit:read');
    expect(Object.values(PERMISSIONS)).toContain('organisation:read');
    expect(Object.values(PERMISSIONS)).toContain('audit:read');
  });

  it('a superadmin can actually GRANT them to an employee', async () => {
    const sa = await makeUser('superadmin');
    const emp = await makeUser('employee');

    const res = await request(app)
      .patch(`/admin/employees/${emp.user._id}/permissions`)
      .set(bearer(sa.token))
      .send({ permissions: ['organisation:read', 'audit:read'] });

    expect(res.status).toBe(200);
    const stored = await User.findById(emp.user._id);
    expect(stored.permissions.sort()).toEqual(['audit:read', 'organisation:read']);
  });

  it('a mistyped variant is REJECTED — a permission only in a route file is invisible to the assignment screen (rule 6)', async () => {
    const sa = await makeUser('superadmin');
    const emp = await makeUser('employee');

    for (const bad of ['organisation:reads', 'org:read', 'audit:view', 'audit:read ', 'ORGANISATION:READ']) {
      const res = await request(app)
        .patch(`/admin/employees/${emp.user._id}/permissions`)
        .set(bearer(sa.token))
        .send({ permissions: [bad] });
      expect(res.status).toBe(400);
    }
    expect((await User.findById(emp.user._id)).permissions).toEqual([]);
  });

  it('governance strings are NOT in the catalogue — they are role-gated, never grantable (rule 5)', () => {
    const values = Object.values(PERMISSIONS);
    for (const forbidden of ['user:manage', 'org:block', 'organisation:block', 'employee:create', 'permission:assign']) {
      expect(values).not.toContain(forbidden);
    }
  });

  // Deliberately brittle: a new permission string is a governance decision, so
  // adding one must break this test and force the owner's call to be recorded.
  // 13th — `errorlog:read`, owner-decided 2026-08-01 (FINALIZE F5a): kept separate
  // from `audit:read` so debugging access does not carry the record of every KYC
  // document and private conversation staff have opened.
  // 14th — `featured:manage`, owner-decided 2026-08-01 (FINALIZE F5b): grantable
  // like `category:manage`, because curating the landing page is content work,
  // not governance — it cannot change anyone's access and it is fully audited.
  it('the catalogue is exactly the fourteen decided strings — a fifteenth needs an owner decision first', () => {
    expect(Object.values(PERMISSIONS).sort()).toEqual(
      [
        'buyer:approve', 'exporter:verify', 'user:read', 'kyc:view',
        'category:read', 'category:manage', 'product:read', 'product:takedown',
        'conversation:read', 'conversation:block',
        'organisation:read', 'audit:read',
        'errorlog:read', 'featured:manage',
      ].sort(),
    );
  });
});

describe('M5-A · AuditLog indexes the viewer needs', () => {
  it('has a compound index on action + occurredAt (filter and sort together)', async () => {
    const indexes = await AuditLog.collection.indexes();
    const byAction = indexes.find(
      (i) => i.key.action === 1 && i.key.occurredAt === -1,
    );
    expect(byAction).toBeTruthy();
  });

  it('has a compound index on actorId + occurredAt ("everything this person did")', async () => {
    const indexes = await AuditLog.collection.indexes();
    expect(indexes.find((i) => i.key.actorId === 1 && i.key.occurredAt === -1)).toBeTruthy();
  });

  it('keeps the pre-existing target and time indexes', async () => {
    const indexes = await AuditLog.collection.indexes();
    expect(indexes.find((i) => i.key.entityType === 1 && i.key.entityId === 1)).toBeTruthy();
    expect(indexes.find((i) => i.key.occurredAt === -1 && Object.keys(i.key).length === 1)).toBeTruthy();
  });

  it('an action-filtered, time-sorted query is served by an INDEX, not a collection scan', async () => {
    const actor = await makeUser('superadmin');
    for (let i = 0; i < 20; i += 1) {
      await AuditLog.create({
        actorId: actor.user._id,
        actorRole: 'superadmin',
        action: i % 2 === 0 ? 'product.takedown' : 'kyc.view',
        entityType: 'Product',
        entityId: new mongoose.Types.ObjectId(),
        occurredAt: new Date(Date.now() - i * 1000),
      });
    }

    const plan = await AuditLog.find({ action: 'product.takedown' })
      .sort({ occurredAt: -1 })
      .explain('queryPlanner');

    const stage = JSON.stringify(plan.queryPlanner.winningPlan);
    expect(stage).toContain('IXSCAN');
    expect(stage).not.toContain('COLLSCAN');
  });

  it('the append-only guarantee still holds after adding indexes', async () => {
    const entry = await AuditLog.create({
      action: 'product.purge',
      entityType: 'Product',
      entityId: new mongoose.Types.ObjectId(),
      occurredAt: new Date(),
    });

    await expect(AuditLog.updateOne({ _id: entry._id }, { $set: { action: 'x' } })).rejects.toThrow(/append-only/i);
    await expect(AuditLog.deleteOne({ _id: entry._id })).rejects.toThrow(/append-only/i);
  });

  it('a system-job row carries a NULL actor — the viewer will have to render it as "System" (W2)', async () => {
    // purgeBlockedProducts writes exactly this. Pinned here so the viewer phase
    // cannot assume every row has a user behind it.
    const entry = await AuditLog.create({
      actorId: null,
      action: 'product.purge',
      entityType: 'Product',
      entityId: new mongoose.Types.ObjectId(),
      before: { productName: 'Cotton Roll', sellerCompanyName: 'TextileHub Exports' },
      occurredAt: new Date(),
    });

    const stored = await AuditLog.findById(entry._id);
    expect(stored.actorId).toBeNull();
    expect(stored.before.productName).toBe('Cotton Roll');
  });
});
