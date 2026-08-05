import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import Redis from 'ioredis';

import { signupThroughOtp } from './helpers/signupFlow.js';

const { otpBox } = vi.hoisted(() => ({ otpBox: { byId: new Map() } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async ({ identifier, code }) => {
    otpBox.byId.set(identifier, code);
  },
}));

// Logo tests must not reach Cloudinary. The mock still enforces the contract's
// shape (returns { url }); type/size verification is that service's own suite.
const { uploads } = vi.hoisted(() => ({ uploads: { count: 0 } }));
vi.mock('../src/services/image.storage.service.js', () => ({
  uploadPublicImage: async ({ folder }) => {
    uploads.count += 1;
    return { url: `https://res.cloudinary.com/demo/image/upload/v1/${folder}/logo_${uploads.count}.png`, publicId: `${folder}/logo_${uploads.count}` };
  },
  deletePublicImage: async () => {},
}));

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { Organisation } from '../src/models/Organisation.js';
import { Product } from '../src/models/Product.js';
import { AuditLog } from '../src/models/AuditLog.js';

/**
 * §A22 · self-service company profile.
 *
 * The stakes: `name`/`country`/`address`/`entityType` are what an Employee
 * verified against documents. A verified org editing one of them must LOSE the
 * tick (kycStatus → submitted) with an audit row — while `description`/`logo`
 * must save silently. Getting either side of that wrong is a trust-model bug,
 * not a cosmetic one.
 */
const app = createApp();
const RUN = String(Date.now()).slice(-7);
let seq = 0;
let redis;

async function makeParty(role) {
  seq += 1;
  const res = await signupThroughOtp(app, otpBox, {
    name: `A22 ${role}`,
    email: `a22_${RUN}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `9${RUN}${seq}` },
    password: 'longpassword1',
    role,
    company: `A22 ${role} Co ${RUN}${seq}`,
    country: 'IN',
    ...(role === 'exporter' ? { entityType: 'business' } : {}),
  });
  expect(res.body.accessToken).toBeTruthy();
  return { token: res.body.accessToken, user: res.body.user };
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

async function verifyOrg(orgId) {
  await Organisation.updateOne(
    { _id: orgId },
    { $set: { kycStatus: 'verified', verifiedAt: new Date() } },
  );
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
  redis = new Redis(process.env.REDIS_URL);
});
afterAll(async () => {
  await mongoose.disconnect();
  await redis.quit();
});

describe('GET /me/organisation', () => {
  it('returns the curated owner view — own kycStatus yes, website never', async () => {
    const { token } = await makeParty('exporter');
    await Organisation.updateOne({}, {}); // no-op; keeps mongoose warm

    const res = await request(app).get('/me/organisation').set(bearer(token));
    expect(res.status).toBe(200);

    const org = res.body.organisation;
    expect(org.name).toContain('A22 exporter Co');
    expect(org.entityType).toBe('business');
    expect(org.exporterSide).toBe(true);
    expect(org.kycStatus).toBe('pending');
    expect(org.slug).toBeTruthy(); // preview needs /supplier/<slug>
    expect(org).not.toHaveProperty('website');
    expect(org).not.toHaveProperty('kycDocuments');
  });

  it('requires auth', async () => {
    await request(app).get('/me/organisation').expect(401);
  });
});

describe('PATCH /me/organisation — unverified life', () => {
  it('edits freely with no demotion, and a buyer can set entityType', async () => {
    const { token } = await makeParty('buyer');

    const res = await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({
        entityType: 'individual',
        address: { line1: '12 Test Lane', city: 'Mumbai', postalCode: '400001' },
      });

    expect(res.status).toBe(200);
    expect(res.body.demoted).toBe(false);
    expect(res.body.organisation.entityType).toBe('individual');
    expect(res.body.organisation.address.city).toBe('Mumbai');
    expect(res.body.organisation.kycStatus).toBe('pending');
  });

  it('rejects an empty patch', async () => {
    const { token } = await makeParty('buyer');
    await request(app).patch('/me/organisation').set(bearer(token)).send({}).expect(400);
  });

  it('caps the description at 500', async () => {
    const { token } = await makeParty('exporter');
    await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ description: 'x'.repeat(501) })
      .expect(400);
  });
});

describe('🔴 the lock — verified + locked-field change demotes', () => {
  it('name change on a VERIFIED exporter → submitted, audit row, sellerVerified synced', async () => {
    const { token, user } = await makeParty('exporter');
    await verifyOrg(user.orgId);
    // A live product carrying the denormalised verified flag (§A23).
    await Product.create({
      exporterOrgId: user.orgId,
      categoryId: new mongoose.Types.ObjectId(),
      name: 'Widget',
      slug: `widget-${RUN}-${seq}`,
      status: 'active',
      sellerVerified: true,
    });

    const res = await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ name: 'Renamed Exports Pvt Ltd' });

    expect(res.status).toBe(200);
    expect(res.body.demoted).toBe(true);
    expect(res.body.organisation.kycStatus).toBe('submitted');
    expect(res.body.organisation.verifiedAt).toBeNull();

    const audit = await AuditLog.findOne({
      action: 'organisation.self_update',
      orgId: user.orgId,
    }).sort({ createdAt: -1 });
    expect(audit).toBeTruthy();
    expect(audit.after.changedFields).toContain('name');
    expect(audit.after.demoted).toBe(true);

    const product = await Product.findOne({ exporterOrgId: user.orgId });
    expect(product.sellerVerified).toBe(false);
  });

  it('🔴 the slug does NOT follow a rename — indexed public URLs must not break', async () => {
    const { token, user } = await makeParty('exporter');
    const before = (await Organisation.findOne({ _id: user.orgId })).slug;

    await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ name: 'Completely Different Name Ltd' })
      .expect(200);

    const after = (await Organisation.findOne({ _id: user.orgId })).slug;
    expect(after).toBe(before);
  });

  it('a SAME-VALUE save on a verified org does not demote', async () => {
    const { token, user } = await makeParty('exporter');
    await verifyOrg(user.orgId);
    const current = (await Organisation.findOne({ _id: user.orgId })).name;

    const res = await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ name: current });

    expect(res.status).toBe(200);
    expect(res.body.demoted).toBe(false);
    expect(res.body.organisation.kycStatus).toBe('verified');
  });

  it('🔴 description NEVER demotes — storefront is not identity', async () => {
    const { token, user } = await makeParty('exporter');
    await verifyOrg(user.orgId);

    const res = await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ description: 'We export industrial textiles worldwide.' });

    expect(res.status).toBe(200);
    expect(res.body.demoted).toBe(false);
    expect(res.body.organisation.kycStatus).toBe('verified');
    expect(res.body.organisation.description).toContain('textiles');
  });

  it('a verified BUYER changing entityType demotes like any locked field', async () => {
    const { token, user } = await makeParty('buyer');
    await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ entityType: 'business' })
      .expect(200);
    await verifyOrg(user.orgId);

    const res = await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ entityType: 'individual' });

    expect(res.status).toBe(200);
    expect(res.body.demoted).toBe(true);
    expect(res.body.organisation.kycStatus).toBe('submitted');
  });
});

describe('entityType and storefront boundaries', () => {
  it('an EXPORTER can never change entityType — any status', async () => {
    const { token } = await makeParty('exporter');
    const res = await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ entityType: 'individual' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/set at signup/i);
  });

  it('a BUYER has no description', async () => {
    const { token } = await makeParty('buyer');
    await request(app)
      .patch('/me/organisation')
      .set(bearer(token))
      .send({ description: 'buyers have no storefront' })
      .expect(400);
  });
});

describe('logo endpoints', () => {
  it('exporter uploads a logo; kycStatus untouched', async () => {
    const { token, user } = await makeParty('exporter');
    await verifyOrg(user.orgId);

    const res = await request(app)
      .post('/me/organisation/logo')
      .set(bearer(token))
      .attach('logo', Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'logo.png');

    expect(res.status).toBe(200);
    expect(res.body.organisation.logo).toContain('mpx/logos/');
    expect(res.body.organisation.kycStatus).toBe('verified'); // never demotes

    const removed = await request(app).delete('/me/organisation/logo').set(bearer(token));
    expect(removed.status).toBe(200);
    expect(removed.body.organisation.logo).toBeNull();
  });

  it('a buyer is refused — no public page, no logo', async () => {
    const { token } = await makeParty('buyer');
    await request(app)
      .post('/me/organisation/logo')
      .set(bearer(token))
      .attach('logo', Buffer.from([0x89, 0x50]), 'logo.png')
      .expect(403);
  });

  it('a missing file is a 400, not a crash', async () => {
    const { token } = await makeParty('exporter');
    await request(app).post('/me/organisation/logo').set(bearer(token)).expect(400);
  });
});
