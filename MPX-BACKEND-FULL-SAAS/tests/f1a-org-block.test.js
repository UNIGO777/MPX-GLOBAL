import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { assertOrgClaimable } from '../src/services/orgBlock.service.js';

const app = createApp();
const PASSWORD = 'longpassword1';
let seq = 0;

// One org with N users on it — the shape the cascade actually has to handle.
async function makeOrgWithUsers(role, { users = 1, kycStatus = 'verified' } = {}) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: 'business',
    buyerSide: role === 'buyer',
    exporterSide: role === 'exporter',
    kycStatus,
    entityType: 'business',
    country: 'IN',
  });

  const made = [];
  for (let i = 0; i < users; i += 1) {
    seq += 1;
    made.push(
      await User.create({
        name: `${role}-${seq}`,
        email: `u_${Date.now()}_${seq}@example.com`,
        mobile: { countryCode: '+91', number: `98${1000000 + seq}`, e164: `+9198${1000000 + seq}` },
        passwordHash: await hashPassword(PASSWORD),
        role,
        orgId: org._id,
        isActive: true,
      }),
    );
  }
  return { org, users: made };
}

async function makeSuperadmin() {
  seq += 1;
  const org = await Organisation.create({ name: `Platform ${seq}`, type: 'platform' });
  const user = await User.create({
    name: `sa-${seq}`,
    email: `sa_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `97${1000000 + seq}`, e164: `+9197${1000000 + seq}` },
    passwordHash: await hashPassword(PASSWORD),
    role: 'superadmin',
    orgId: org._id,
    isActive: true,
  });
  return { user, org, token: signAccessToken(user) };
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const auditRows = () => mongoose.connection.db.collection('auditlogs').find({}).toArray();

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

describe('F1-A · org block — the two writes', () => {
  it('blocking sets Organisation.isActive=false AND cascades to every user', async () => {
    const sa = await makeSuperadmin();
    const { org, users } = await makeOrgWithUsers('exporter', { users: 3 });
    const versionsBefore = users.map((u) => u.tokenVersion);

    const res = await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'counterfeit listings' });

    expect(res.status).toBe(200);
    expect(res.body.organisation.isActive).toBe(false);
    expect(res.body.usersCascaded).toBe(3);

    const freshOrg = await Organisation.findById(org._id);
    expect(freshOrg.isActive).toBe(false);
    expect(freshOrg.blockReason).toBe('counterfeit listings');
    expect(String(freshOrg.blockedBy)).toBe(String(sa.user._id));

    // every user row: deactivated + tokenVersion bumped (kills live sessions)
    const fresh = await User.find({ orgId: org._id }).sort({ email: 1 });
    expect(fresh).toHaveLength(3);
    fresh.forEach((u, i) => {
      expect(u.isActive).toBe(false);
      expect(u.tokenVersion).toBe(versionsBefore[i] + 1);
    });
  });

  it('a blocked org\'s users cannot log in, and live access tokens stop working', async () => {
    const sa = await makeSuperadmin();
    const { org, users } = await makeOrgWithUsers('exporter');
    const liveToken = signAccessToken(users[0]); // issued BEFORE the block

    // sanity: the token works right now
    const before = await request(app).get('/auth/me').set(bearer(liveToken));
    expect(before.status).toBe(200);

    await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'fraud' });

    // live session is dead (tokenVersion bump + isActive false)
    const after = await request(app).get('/auth/me').set(bearer(liveToken));
    expect(after.status).toBe(401);

    // and login is refused — same generic message, no "you are blocked" oracle
    const login = await request(app)
      .post('/auth/login')
      .send({ identifier: users[0].email, password: PASSWORD, portal: 'exporter' });
    expect(login.status).toBe(401);
    expect(JSON.stringify(login.body)).not.toMatch(/block/i);
  });

  it('the public seller profile 404s once the org is blocked', async () => {
    const sa = await makeSuperadmin();
    const { org } = await makeOrgWithUsers('exporter');

    const before = await request(app).get(`/exporters/${org._id}`);
    expect(before.status).toBe(200);

    await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'fraud' });

    const after = await request(app).get(`/exporters/${org._id}`);
    expect(after.status).toBe(404);
  });
});

describe('F1-A · the three holes', () => {
  it('a claim onto a blocked org is refused', async () => {
    const sa = await makeSuperadmin();
    const { org } = await makeOrgWithUsers('exporter');

    // claimable while active
    const active = await Organisation.findById(org._id);
    expect(() => assertOrgClaimable(active)).not.toThrow();

    await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'fraud' });

    // refused once blocked — this is the guard A21 Step 4c must call before
    // attaching a user to an existing Organisation.
    const blocked = await Organisation.findById(org._id);
    expect(() => assertOrgClaimable(blocked)).toThrow(/blocked/i);
  });

  it('per-user activate is refused while the org is blocked', async () => {
    const sa = await makeSuperadmin();
    const { org, users } = await makeOrgWithUsers('exporter');

    await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'fraud' });

    const res = await request(app)
      .post(`/admin/users/${users[0]._id}/activate`)
      .set(bearer(sa.token))
      .send({});

    expect(res.status).toBe(409);
    const fresh = await User.findById(users[0]._id);
    expect(fresh.isActive).toBe(false); // hole stays shut
  });

  it('unblock restores PRIOR per-user state, not everyone', async () => {
    const sa = await makeSuperadmin();
    const { org, users } = await makeOrgWithUsers('exporter', { users: 3 });

    // one user is deactivated INDIVIDUALLY before the org block
    const singled = users[2];
    const deact = await request(app)
      .post(`/admin/users/${singled._id}/deactivate`)
      .set(bearer(sa.token))
      .send({});
    expect(deact.status).toBe(200);

    await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'fraud' });

    const unblock = await request(app)
      .post(`/admin/orgs/${org._id}/unblock`)
      .set(bearer(sa.token))
      .send({ reason: 'appeal upheld' });

    expect(unblock.status).toBe(200);
    expect(unblock.body.organisation.isActive).toBe(true);
    expect(unblock.body.usersRestored).toBe(2); // NOT 3

    const restored = await User.find({ orgId: org._id, _id: { $ne: singled._id } });
    restored.forEach((u) => expect(u.isActive).toBe(true));

    // the individually-deactivated user stays off — the block did not launder it
    const stillOff = await User.findById(singled._id);
    expect(stillOff.isActive).toBe(false);
    // and the marker is cleared so a later block re-captures cleanly
    const anyMarker = await User.find({ orgId: org._id, prevActive: { $exists: true } });
    expect(anyMarker).toHaveLength(0);
  });
});

describe('F1-A · audit + guards', () => {
  it('org.block / org.unblock audit rows carry actor, reason and before/after', async () => {
    const sa = await makeSuperadmin();
    const { org } = await makeOrgWithUsers('exporter');

    await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'counterfeit listings' });
    await request(app)
      .post(`/admin/orgs/${org._id}/unblock`)
      .set(bearer(sa.token))
      .send({ reason: 'appeal upheld' });

    const rows = await auditRows();
    const block = rows.find((r) => r.action === 'org.block');
    const unblock = rows.find((r) => r.action === 'org.unblock');

    expect(block).toBeTruthy();
    expect(String(block.actorId)).toBe(String(sa.user._id));
    expect(block.actorRole).toBe('superadmin');
    expect(block.entityType).toBe('Organisation');
    expect(String(block.entityId)).toBe(String(org._id));
    expect(block.before).toMatchObject({ isActive: true });
    expect(block.after).toMatchObject({ isActive: false, reason: 'counterfeit listings' });

    expect(unblock).toBeTruthy();
    expect(unblock.before).toMatchObject({ isActive: false });
    expect(unblock.after).toMatchObject({ isActive: true, reason: 'appeal upheld' });
  });

  it('block requires a reason, and is superadmin-only', async () => {
    const sa = await makeSuperadmin();
    const { org, users } = await makeOrgWithUsers('exporter');

    const noReason = await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({});
    expect(noReason.status).toBe(400);

    // an ordinary account cannot block, even its own org
    const asExporter = await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(signAccessToken(users[0])))
      .send({ reason: 'nice try' });
    expect(asExporter.status).toBe(403);
  });

  it('the platform org can never be blocked, and double-block is a conflict', async () => {
    const sa = await makeSuperadmin();
    const { org } = await makeOrgWithUsers('exporter');

    const platform = await request(app)
      .post(`/admin/orgs/${sa.org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'lockout attempt' });
    expect(platform.status).toBe(403);

    await request(app).post(`/admin/orgs/${org._id}/block`).set(bearer(sa.token)).send({ reason: 'fraud' });
    const again = await request(app)
      .post(`/admin/orgs/${org._id}/block`)
      .set(bearer(sa.token))
      .send({ reason: 'fraud again' });
    expect(again.status).toBe(409);
  });
});
