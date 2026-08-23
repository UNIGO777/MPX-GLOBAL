import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { Product } from '../src/models/Product.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';

/**
 * Revoke (2026-08-19): removing a granted tick. Target state is `submitted` —
 * literally true (documents on file awaiting review) — and the org re-enters
 * the ordinary queue. The reason is mandatory, owner-visible, never public.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;

async function makeVerifiedExporter() {
  seq += 1;
  const org = await Organisation.create({
    name: `RVK Exports ${RUN}${seq}`,
    type: 'business',
    exporterSide: true,
    kycStatus: 'verified',
    kycSubmittedAt: new Date(Date.now() - 7 * 86400000),
    verifiedAt: new Date(Date.now() - 86400000),
    entityType: 'business',
    country: 'IN',
    address: { line1: '1 Test Street', city: 'Mumbai', postalCode: '400001' },
  });
  const user = await User.create({
    name: `rvk-${seq}`,
    email: `rvk_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `5${RUN}${seq}`, e164: `+915${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'exporter',
    orgId: org._id,
  });
  return { user, org, token: signAccessToken(user) };
}

async function makeReviewer(permissions = ['exporter:verify']) {
  seq += 1;
  const org = await Organisation.create({ name: `RVK Staff ${RUN}${seq}`, type: 'platform' });
  const user = await User.create({
    name: `rvk-staff-${seq}`,
    email: `rvks_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `4${RUN}${seq}`, e164: `+914${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'employee',
    orgId: org._id,
    permissions,
  });
  return { user, token: signAccessToken(user) };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('revoke', () => {
  it('verified → submitted (re-dated), tick gone publicly, sellerVerified synced, audited', async () => {
    const ex = await makeVerifiedExporter();
    const oldSubmittedAt = ex.org.kycSubmittedAt;
    await Product.create({
      exporterOrgId: ex.org._id,
      categoryId: new mongoose.Types.ObjectId(),
      name: 'Widget',
      slug: `rvk-widget-${RUN}${seq}`,
      status: 'active',
      sellerVerified: true,
    });
    const reviewer = await makeReviewer();

    const res = await request(app)
      .post(`/employee/exporters/${ex.org._id}/revoke`)
      .set(bearer(reviewer.token))
      .send({ reason: 'The GST registration on file has been cancelled by the issuer.' });
    expect(res.status).toBe(200);
    expect(res.body.organisation.kycStatus).toBe('submitted');

    const org = await Organisation.findById(ex.org._id).lean();
    expect(org.kycStatus).toBe('submitted');
    expect(org.kycSubmittedAt.getTime()).toBeGreaterThan(oldSubmittedAt.getTime());
    expect(org.verifiedAt).toBeFalsy();
    expect(org.kycRevocation.reason).toMatch(/cancelled by the issuer/);

    // Public tick gone; the reason never public.
    const pub = await request(app).get(`/exporters/${ex.org._id}`);
    expect(pub.body.exporter.verified).toBe(false);
    expect(JSON.stringify(pub.body)).not.toContain('cancelled by the issuer');

    // Owner sees the reason on their own verification surface.
    const mine = await request(app).get('/me/verification').set(bearer(ex.token));
    expect(mine.body.verification.revocation.reason).toMatch(/cancelled by the issuer/);

    const product = await Product.findOne({ exporterOrgId: ex.org._id }).lean();
    expect(product.sellerVerified).toBe(false);

    const audit = await AuditLog.findOne({ action: 'verification.revoke', orgId: ex.org._id }).lean();
    expect(audit.before.kycStatus).toBe('verified');
    expect(audit.after.kycStatus).toBe('submitted');
  });

  it('an open pending set APPLIES live on revoke (unverified orgs edit live)', async () => {
    const ex = await makeVerifiedExporter();
    await request(app)
      .patch('/me/organisation')
      .set(bearer(ex.token))
      .send({ name: 'Mid-Change Ltd' })
      .expect(200);
    const reviewer = await makeReviewer();

    await request(app)
      .post(`/employee/exporters/${ex.org._id}/revoke`)
      .set(bearer(reviewer.token))
      .send({ reason: 'Verification withdrawn pending fresh documents.' })
      .expect(200);

    const org = await Organisation.findById(ex.org._id).lean();
    expect(org.name).toBe('Mid-Change Ltd'); // applied, not destroyed
    expect(org.pendingChanges).toBeFalsy();
    expect(org.kycStatus).toBe('submitted');
  });

  it('reason mandatory (400); non-verified org is a 409; re-verify clears the revocation notice', async () => {
    const ex = await makeVerifiedExporter();
    const reviewer = await makeReviewer();

    expect(
      (await request(app).post(`/employee/exporters/${ex.org._id}/revoke`).set(bearer(reviewer.token)).send({})).status,
    ).toBe(400);

    await request(app)
      .post(`/employee/exporters/${ex.org._id}/revoke`)
      .set(bearer(reviewer.token))
      .send({ reason: 'Revoked once for the state test.' })
      .expect(200);
    // Already un-verified → a second revoke is a 409.
    expect(
      (await request(app).post(`/employee/exporters/${ex.org._id}/revoke`).set(bearer(reviewer.token)).send({ reason: 'again' })).status,
    ).toBe(409);

    // Re-verify through the ordinary queue path clears the notice.
    await request(app).post(`/employee/exporters/${ex.org._id}/verify`).set(bearer(reviewer.token)).expect(200);
    const org = await Organisation.findById(ex.org._id).lean();
    expect(org.kycStatus).toBe('verified');
    expect(org.kycRevocation?.revokedAt).toBeFalsy();
    const mine = await request(app).get('/me/verification').set(bearer(ex.token));
    expect(mine.body.verification.revocation).toBeNull();
  });
});
