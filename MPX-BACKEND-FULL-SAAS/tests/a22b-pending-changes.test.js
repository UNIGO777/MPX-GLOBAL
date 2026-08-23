import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../src/services/kyc.storage.service.js', () => ({
  uploadKycDocument: vi.fn(async ({ docType }) => ({
    storageKey: `mpx/kyc/fake/${docType}_${Math.random().toString(16).slice(2)}`,
    format: 'pdf',
  })),
  verifyKycFile: vi.fn(),
  signedKycUrl: vi.fn(({ storageKey }) => ({
    url: `https://signed.fake/${storageKey}?sig=abc`,
    expiresAt: new Date(Date.now() + 120000).toISOString(),
  })),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');

/**
 * A22b — the PENDING-CHANGE lifecycle (owner redesign, 2026-08-19).
 *
 * The invariant every test guards: a verified company's LIVE profile and tick
 * move only through an admin approval — never through the company's own edits.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const FILE = Buffer.from('%PDF-1.4 fake kyc doc');
const RUN = String(Date.now()).slice(-7);
let seq = 0;

async function makeVerifiedExporter() {
  seq += 1;
  const org = await Organisation.create({
    name: `A22b Exports ${RUN}${seq}`,
    type: 'business',
    exporterSide: true,
    kycStatus: 'verified',
    verifiedAt: new Date(),
    entityType: 'business',
    country: 'IN',
    address: { line1: '1 Test Street', city: 'Mumbai', postalCode: '400001' },
  });
  const user = await User.create({
    name: `a22b-${seq}`,
    email: `a22b_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `8${RUN}${seq}`, e164: `+918${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'exporter',
    orgId: org._id,
  });
  return { user, org, token: signAccessToken(user) };
}

const patchOrg = (token, body) =>
  request(app).patch('/me/organisation').set(bearer(token)).send(body);
const uploadDoc = (token, docType) =>
  request(app)
    .post('/me/kyc/documents')
    .set(bearer(token))
    .attach('document', FILE, 'doc.pdf')
    .field('docType', docType);

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('creating and amending the pending set', () => {
  it('a second edit AMENDS the same set (same round, re-dated), never stacks a second one', async () => {
    const ex = await makeVerifiedExporter();
    await patchOrg(ex.token, { name: 'First Rename Ltd' }).expect(200);
    const first = (await Organisation.findById(ex.org._id).lean()).pendingChanges;

    const res = await patchOrg(ex.token, { country: 'AE' });
    expect(res.status).toBe(200);
    const after = (await Organisation.findById(ex.org._id).lean()).pendingChanges;
    expect(String(after.roundId)).toBe(String(first.roundId));
    expect(after.changedFields.sort()).toEqual(['country', 'name']);
    expect(after.values.name).toBe('First Rename Ltd'); // earlier field survives the amend
    expect(after.values.country).toBe('AE');
  });

  it('editing a pending field back to its LIVE value drops it; dropping the last one dissolves the set', async () => {
    const ex = await makeVerifiedExporter();
    const liveName = ex.org.name;
    await patchOrg(ex.token, { name: 'Mistake Ltd' }).expect(200);

    const res = await patchOrg(ex.token, { name: liveName });
    expect(res.status).toBe(200);
    const org = await Organisation.findById(ex.org._id).lean();
    expect(org.pendingChanges).toBeFalsy();

    const cancelAudit = await AuditLog.findOne({
      action: 'organisation.change_cancel',
      orgId: ex.org._id,
    });
    expect(cancelAudit).toBeTruthy();
  });

  it('description applies LIVE while a change pends — storefront is not identity', async () => {
    const ex = await makeVerifiedExporter();
    await patchOrg(ex.token, { name: 'Pending Ltd' }).expect(200);
    const res = await patchOrg(ex.token, { description: 'We ship worldwide.' });
    expect(res.status).toBe(200);
    expect(res.body.organisation.description).toBe('We ship worldwide.');
    expect(res.body.organisation.kycStatus).toBe('verified');
  });
});

describe('cancel', () => {
  it('cancels the set, supersedes its round documents, audits — live profile never moved', async () => {
    const ex = await makeVerifiedExporter();
    await patchOrg(ex.token, { name: 'Cancelled Ltd' }).expect(200);
    await uploadDoc(ex.token, 'registration').expect(201);

    const res = await request(app)
      .delete('/me/organisation/pending-changes')
      .set(bearer(ex.token));
    expect(res.status).toBe(200);

    const org = await Organisation.findById(ex.org._id).select('+kycDocuments').lean();
    expect(org.pendingChanges).toBeFalsy();
    expect(org.name).toBe(ex.org.name);
    expect(org.kycStatus).toBe('verified');
    const roundDoc = org.kycDocuments.find((d) => d.docType === 'registration');
    expect(roundDoc.supersededAt).toBeTruthy();
  });

  it('cancelling when nothing pends is a 409, not a silent no-op', async () => {
    const ex = await makeVerifiedExporter();
    const res = await request(app)
      .delete('/me/organisation/pending-changes')
      .set(bearer(ex.token));
    expect(res.status).toBe(409);
  });
});

describe('🔴 the public surface never leaks a pending value', () => {
  it('the public exporter read shows LIVE values and the tick throughout', async () => {
    const ex = await makeVerifiedExporter();
    await patchOrg(ex.token, { name: 'Leaky Ltd', entityType: 'individual' }).expect(200);

    const pub = await request(app).get(`/exporters/${ex.org._id}`);
    expect(pub.status).toBe(200);
    expect(pub.body.exporter.name).toBe(ex.org.name);
    expect(pub.body.exporter.entityType).toBe('business');
    expect(pub.body.exporter.verified).toBe(true);
    // No pending machinery in the public shape, under any key.
    const raw = JSON.stringify(pub.body);
    expect(raw).not.toContain('pendingChanges');
    expect(raw).not.toContain('Leaky Ltd');
  });
});
