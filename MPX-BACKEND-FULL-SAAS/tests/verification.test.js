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

async function makeStaff(role, permissions = []) {
  seq += 1;
  const org = await Organisation.create({ name: 'Platform', type: 'platform' });
  const user = await User.create({
    name: 'Staff',
    email: `staff_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `98${1000000 + seq}`, e164: `+9198${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
    isActive: true,
  });
  return { user, token: signAccessToken(user) };
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const makeOrg = (type, kycStatus = 'pending') => Organisation.create({ name: `${type} Co`, type, kycStatus });

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
  // AuditLog is append-only at the model layer; clean via the raw driver.
  await mongoose.connection.db.collection('auditlogs').deleteMany({});
});

describe('verification & approval', () => {
  it('employee with buyer:approve approves a pending buyer + writes audit with actor id', async () => {
    const { user, token } = await makeStaff('employee', ['buyer:approve']);
    const org = await makeOrg('buyer');

    const res = await request(app).post(`/employee/buyers/${org._id}/approve`).set(bearer(token)).send({});
    expect(res.status).toBe(200);
    expect(res.body.organisation.kycStatus).toBe('verified');

    const fresh = await Organisation.findById(org._id);
    expect(fresh.kycStatus).toBe('verified');
    expect(String(fresh.verifiedBy)).toBe(String(user._id));

    const audit = await AuditLog.findOne({ entityId: org._id, action: 'buyer.approve' });
    expect(audit).toBeTruthy();
    expect(String(audit.actorId)).toBe(String(user._id));
    expect(audit.before.kycStatus).toBe('pending');
    expect(audit.after.kycStatus).toBe('verified');
  });

  it('employee with exporter:verify verifies a pending exporter', async () => {
    const { token } = await makeStaff('employee', ['exporter:verify']);
    const org = await makeOrg('exporter');
    const res = await request(app).post(`/employee/exporters/${org._id}/verify`).set(bearer(token)).send({});
    expect(res.status).toBe(200);
    expect(res.body.organisation.kycStatus).toBe('verified');
  });

  it('rejection stores the reason and requires one', async () => {
    const { token } = await makeStaff('employee', ['exporter:verify']);
    const org = await makeOrg('exporter');

    const noReason = await request(app).post(`/employee/exporters/${org._id}/reject`).set(bearer(token)).send({});
    expect(noReason.status).toBe(400);

    const res = await request(app)
      .post(`/employee/exporters/${org._id}/reject`)
      .set(bearer(token))
      .send({ reason: 'Documents unreadable' });
    expect(res.status).toBe(200);
    expect(res.body.organisation.kycStatus).toBe('rejected');
    const fresh = await Organisation.findById(org._id);
    expect(fresh.kycRejectionReason).toBe('Documents unreadable');
  });

  it('default-deny: no permission → 403; wrong permission → 403', async () => {
    const org = await makeOrg('buyer');

    const noPerm = await makeStaff('employee', []);
    const r1 = await request(app).post(`/employee/buyers/${org._id}/approve`).set(bearer(noPerm.token)).send({});
    expect(r1.status).toBe(403);

    // Has exporter:verify but not buyer:approve.
    const wrongPerm = await makeStaff('employee', ['exporter:verify']);
    const r2 = await request(app).post(`/employee/buyers/${org._id}/approve`).set(bearer(wrongPerm.token)).send({});
    expect(r2.status).toBe(403);
  });

  it('type mismatch → 404; already-decided → 409; bad/unknown id → 400/404', async () => {
    const { token } = await makeStaff('employee', ['buyer:approve']);

    // exporter org hit via the buyer endpoint → 404
    const exporter = await makeOrg('exporter');
    const mismatch = await request(app).post(`/employee/buyers/${exporter._id}/approve`).set(bearer(token)).send({});
    expect(mismatch.status).toBe(404);

    // already verified → 409
    const verified = await makeOrg('buyer', 'verified');
    const conflict = await request(app).post(`/employee/buyers/${verified._id}/approve`).set(bearer(token)).send({});
    expect(conflict.status).toBe(409);

    // malformed id → 400
    const bad = await request(app).post('/employee/buyers/not-an-id/approve').set(bearer(token)).send({});
    expect(bad.status).toBe(400);

    // valid-but-missing id → 404
    const missing = await request(app)
      .post(`/employee/buyers/${new mongoose.Types.ObjectId()}/approve`)
      .set(bearer(token))
      .send({});
    expect(missing.status).toBe(404);
  });

  it('the audit entry is append-only (cannot be updated)', async () => {
    const { token } = await makeStaff('employee', ['buyer:approve']);
    const org = await makeOrg('buyer');
    await request(app).post(`/employee/buyers/${org._id}/approve`).set(bearer(token)).send({});

    const audit = await AuditLog.findOne({ entityId: org._id });
    await expect(AuditLog.updateOne({ _id: audit._id }, { $set: { action: 'tampered' } })).rejects.toThrow();
  });
});
