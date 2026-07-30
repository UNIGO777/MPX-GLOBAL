import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';

const app = createApp();
let seq = 0;

async function makeUser(role, { permissions = [], isActive = true, kycStatus = 'pending' } = {}) {
  seq += 1;
  const isCompany = role === 'buyer' || role === 'exporter';
  const org = await Organisation.create({
    name: `${role} Co`,
    type: isCompany ? 'business' : 'platform',
    buyerSide: role === 'buyer',
    exporterSide: role === 'exporter',
    kycStatus,
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `u_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `98${1000000 + seq}`, e164: `+9198${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
    isActive,
  });
  return { user, org, token: signAccessToken(user) };
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Organisation.deleteMany({});
  await mongoose.connection.db.collection('auditlogs').deleteMany({});
});

describe('user management — reads (M1-E)', () => {
  it('requires user:read — an employee without it is denied', async () => {
    const emp = await makeUser('employee');
    const res = await request(app).get('/admin/users').set(bearer(emp.token));
    expect(res.status).toBe(403);
  });

  it('superadmin lists users with curated rows (no passwordHash / permissions)', async () => {
    const sa = await makeUser('superadmin');
    await makeUser('buyer');
    await makeUser('exporter');

    const res = await request(app).get('/admin/users').set(bearer(sa.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.rows.length).toBeGreaterThanOrEqual(3);
    for (const row of res.body.rows) {
      expect(row).not.toHaveProperty('passwordHash');
      expect(row).not.toHaveProperty('permissions');
      expect(row).toHaveProperty('role');
    }
  });

  it('an employee GRANTED user:read can list', async () => {
    const emp = await makeUser('employee', { permissions: ['user:read'] });
    const res = await request(app).get('/admin/users').set(bearer(emp.token));
    expect(res.status).toBe(200);
  });

  it('pageSize is hard-capped (>100 rejected)', async () => {
    const sa = await makeUser('superadmin');
    const res = await request(app).get('/admin/users?pageSize=9999').set(bearer(sa.token));
    expect(res.status).toBe(400);
  });

  it('search prefix matches; a regex metachar is neutralised (no injection)', async () => {
    const sa = await makeUser('superadmin');
    const target = await makeUser('buyer');

    const r1 = await request(app)
      .get('/admin/users')
      .query({ q: target.user.email.slice(0, 6) })
      .set(bearer(sa.token));
    expect(r1.status).toBe(200);
    expect(r1.body.rows.some((row) => row.email === target.user.email)).toBe(true);

    // '.*' would match everything if compiled as a pattern; escaped it matches nothing.
    const r2 = await request(app).get('/admin/users').query({ q: '.*' }).set(bearer(sa.token));
    expect(r2.status).toBe(200);
    expect(r2.body.rows.length).toBe(0);
  });

  it('filters by role and by kycStatus, and rows carry a flat kycStatus + orgId', async () => {
    const sa = await makeUser('superadmin');
    await makeUser('buyer', { kycStatus: 'pending' });
    await makeUser('exporter', { kycStatus: 'verified' });

    const byRole = await request(app).get('/admin/users').query({ role: 'exporter' }).set(bearer(sa.token));
    expect(byRole.status).toBe(200);
    expect(byRole.body.rows.every((r) => r.role === 'exporter')).toBe(true);
    expect(byRole.body.rows[0]).toHaveProperty('orgId');
    expect(byRole.body.rows[0].kycStatus).toBe('verified');

    const byKyc = await request(app).get('/admin/users').query({ kycStatus: 'verified' }).set(bearer(sa.token));
    expect(byKyc.status).toBe(200);
    expect(byKyc.body.rows.every((r) => r.kycStatus === 'verified')).toBe(true);
  });

  it('rejects an unknown role filter (enum-guarded)', async () => {
    const sa = await makeUser('superadmin');
    const res = await request(app).get('/admin/users').query({ role: 'ceo' }).set(bearer(sa.token));
    expect(res.status).toBe(400);
  });

  it('GET /admin/users/:id returns a curated user + org summary', async () => {
    const sa = await makeUser('superadmin');
    const target = await makeUser('exporter', { kycStatus: 'verified' });

    const res = await request(app).get(`/admin/users/${target.user._id}`).set(bearer(sa.token));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(String(target.user._id));
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user.org.kycStatus).toBe('verified');
    // A21 contract: the side flags are the buyer/exporter discriminator. This
    // regressed once (the populate select didn't include them → false for every
    // org) — these assertions lock the fix in.
    expect(res.body.user.org.exporterSide).toBe(true);
    expect(res.body.user.org.buyerSide).toBe(false);
  });

  it('POST /admin/employees validates permissions against the catalogue', async () => {
    const sa = await makeUser('superadmin');
    const employeeBody = (email, number, permissions) => ({
      name: 'New Employee',
      email,
      mobile: { countryCode: '+91', number },
      password: 'longpassword1',
      permissions,
    });

    // A string outside the catalogue (e.g. a would-be governance permission) is a
    // 400 at the boundary — same rule as PATCH /admin/employees/:id/permissions.
    const bad = await request(app)
      .post('/admin/employees')
      .set(bearer(sa.token))
      .send(employeeBody(`emp_bad_${Date.now()}@example.com`, '9890000001', ['user:manage']));
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post('/admin/employees')
      .set(bearer(sa.token))
      .send(employeeBody(`emp_ok_${Date.now()}@example.com`, '9890000002', ['user:read']));
    expect(ok.status).toBe(201);
    expect(ok.body.user.permissions).toEqual(['user:read']);
  });
});

describe('user management — activate/deactivate (M1-E)', () => {
  it('deactivate sets isActive=false, bumps tokenVersion, kills the session, and audits', async () => {
    const sa = await makeUser('superadmin');
    const target = await makeUser('buyer');
    const before = await User.findById(target.user._id);

    const res = await request(app).post(`/admin/users/${target.user._id}/deactivate`).set(bearer(sa.token));
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);

    const after = await User.findById(target.user._id);
    expect(after.isActive).toBe(false);
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);

    // The target's previously-issued access token is now dead.
    const me = await request(app).get('/auth/me').set(bearer(target.token));
    expect(me.status).toBe(401);

    const audit = await AuditLog.findOne({ action: 'user.deactivate' });
    expect(audit).toBeTruthy();
    expect(String(audit.actorId)).toBe(String(sa.user._id));
    expect(audit.after.isActive).toBe(false);
  });

  it('activate re-enables a deactivated user', async () => {
    const sa = await makeUser('superadmin');
    const target = await makeUser('buyer', { isActive: false });

    const res = await request(app).post(`/admin/users/${target.user._id}/activate`).set(bearer(sa.token));
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(true);
    const after = await User.findById(target.user._id);
    expect(after.isActive).toBe(true);
  });

  it('deactivate is role-gated — an employee WITH user:read still cannot (403)', async () => {
    const emp = await makeUser('employee', { permissions: ['user:read'] });
    const target = await makeUser('buyer');
    const res = await request(app).post(`/admin/users/${target.user._id}/deactivate`).set(bearer(emp.token));
    expect(res.status).toBe(403);
    const after = await User.findById(target.user._id);
    expect(after.isActive).toBe(true); // unchanged
  });

  // The 'admin' role was removed from ROLES: governance is superadmin-only and
  // nothing ever created an 'admin' user. This locks the decision in — if a later
  // change re-adds the role to the enum, this test fails.
  it("the 'admin' role does not exist — it cannot be assigned", async () => {
    const org = await Organisation.create({ name: 'Platform', type: 'platform' });
    await expect(
      User.create({
        name: 'Admin',
        email: `admin_${Date.now()}@example.com`,
        mobile: { countryCode: '+91', number: '9990000009', e164: '+919990000009' },
        passwordHash: await hashPassword('longpassword1'),
        role: 'admin',
        orgId: org._id,
      }),
    ).rejects.toThrow(/validation/i);
  });

  it('a superadmin cannot be deactivated', async () => {
    const sa = await makeUser('superadmin');
    const other = await makeUser('superadmin');
    const res = await request(app).post(`/admin/users/${other.user._id}/deactivate`).set(bearer(sa.token));
    expect(res.status).toBe(403);
  });

  // Asserts the SELF-protection guard specifically (not the superadmin-immunity
  // guard that follows it) — the distinct client message proves which one fired.
  it('cannot change your own active state', async () => {
    const sa = await makeUser('superadmin');
    const res = await request(app).post(`/admin/users/${sa.user._id}/deactivate`).set(bearer(sa.token));
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/own account status/i);
  });

  it('404 for a missing user', async () => {
    const sa = await makeUser('superadmin');
    const res = await request(app)
      .post(`/admin/users/${new mongoose.Types.ObjectId()}/deactivate`)
      .set(bearer(sa.token));
    expect(res.status).toBe(404);
  });
});

describe('employee permission assignment (M1-F)', () => {
  const setPerms = (token, id, permissions) =>
    request(app).patch(`/admin/employees/${id}/permissions`).set(bearer(token)).send({ permissions });

  it('superadmin assigns permissions to an employee + audits before/after', async () => {
    const sa = await makeUser('superadmin');
    const emp = await makeUser('employee');

    const res = await setPerms(sa.token, emp.user._id, ['user:read', 'buyer:approve']);
    expect(res.status).toBe(200);
    expect(res.body.user.permissions.sort()).toEqual(['buyer:approve', 'user:read']);

    const fresh = await User.findById(emp.user._id);
    expect(fresh.permissions.sort()).toEqual(['buyer:approve', 'user:read']);

    const audit = await AuditLog.findOne({ action: 'employee.permissions.update' });
    expect(audit).toBeTruthy();
    expect(String(audit.actorId)).toBe(String(sa.user._id));
    expect(audit.before.permissions).toEqual([]);
    expect(audit.after.permissions.sort()).toEqual(['buyer:approve', 'user:read']);
  });

  it('a new permission is LIVE on the next request without re-login (no tokenVersion bump)', async () => {
    const sa = await makeUser('superadmin');
    const emp = await makeUser('employee'); // no perms

    // Same token is denied before the grant...
    const before = await request(app).get('/admin/users').set(bearer(emp.token));
    expect(before.status).toBe(403);

    await setPerms(sa.token, emp.user._id, ['user:read']);

    // ...and allowed after — using the SAME token (session not killed).
    const after = await request(app).get('/admin/users').set(bearer(emp.token));
    expect(after.status).toBe(200);

    const fresh = await User.findById(emp.user._id);
    expect(fresh.tokenVersion).toBe(0); // unchanged
  });

  it('rejects an unknown / non-grantable permission (400)', async () => {
    const sa = await makeUser('superadmin');
    const emp = await makeUser('employee');
    // 'user:manage' is deliberately NOT in the catalogue (not grantable).
    const res = await setPerms(sa.token, emp.user._id, ['user:read', 'user:manage']);
    expect(res.status).toBe(400);
  });

  it('is superadmin-only — a non-staff role cannot assign permissions (403)', async () => {
    const exporter = await makeUser('exporter');
    const emp = await makeUser('employee');
    const res = await setPerms(exporter.token, emp.user._id, ['user:read']);
    expect(res.status).toBe(403);
  });

  it('an employee cannot assign permissions, even with user:read (403)', async () => {
    const emp = await makeUser('employee', { permissions: ['user:read'] });
    const target = await makeUser('employee');
    const res = await setPerms(emp.token, target.user._id, ['buyer:approve']);
    expect(res.status).toBe(403);
  });

  it('404 when the target is not an employee (e.g. a buyer)', async () => {
    const sa = await makeUser('superadmin');
    const buyer = await makeUser('buyer');
    const res = await setPerms(sa.token, buyer.user._id, ['user:read']);
    expect(res.status).toBe(404);
  });

  it('empty array revokes all permissions; duplicates are de-duped', async () => {
    const sa = await makeUser('superadmin');
    const emp = await makeUser('employee', { permissions: ['user:read'] });

    const dup = await setPerms(sa.token, emp.user._id, ['buyer:approve', 'buyer:approve']);
    expect(dup.status).toBe(200);
    expect(dup.body.user.permissions).toEqual(['buyer:approve']);

    // Audit captures the PRIOR non-empty set as a plain, independent snapshot.
    const audit = await AuditLog.findOne({ action: 'employee.permissions.update' });
    expect(audit.before.permissions).toEqual(['user:read']);
    expect(audit.after.permissions).toEqual(['buyer:approve']);

    const revoke = await setPerms(sa.token, emp.user._id, []);
    expect(revoke.status).toBe(200);
    expect(revoke.body.user.permissions).toEqual([]);
  });
});
