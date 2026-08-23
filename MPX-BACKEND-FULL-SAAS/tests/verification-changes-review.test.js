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
const { Product } = await import('../src/models/Product.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');

/**
 * Change re-verification (2026-08-19): approve APPLIES, reject HOLDS.
 * The tick must be continuous through an approval — kycStatus never leaves
 * `verified` — and a rejection must move nothing but the pending state.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const FILE = Buffer.from('%PDF-1.4 fake kyc doc');
const RUN = String(Date.now()).slice(-7);
let seq = 0;

async function makeVerifiedExporter() {
  seq += 1;
  const org = await Organisation.create({
    name: `VCR Exports ${RUN}${seq}`,
    type: 'business',
    exporterSide: true,
    kycStatus: 'verified',
    verifiedAt: new Date(Date.now() - 86400000),
    entityType: 'business',
    country: 'IN',
    address: { line1: '1 Test Street', city: 'Mumbai', postalCode: '400001' },
  });
  const user = await User.create({
    name: `vcr-${seq}`,
    email: `vcr_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `7${RUN}${seq}`, e164: `+917${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'exporter',
    orgId: org._id,
  });
  return { user, org, token: signAccessToken(user) };
}

async function makeReviewer(permissions = ['exporter:verify']) {
  seq += 1;
  const org = await Organisation.create({ name: `VCR Staff ${RUN}${seq}`, type: 'platform' });
  const user = await User.create({
    name: `vcr-staff-${seq}`,
    email: `vcrs_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `6${RUN}${seq}`, e164: `+916${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'employee',
    orgId: org._id,
    permissions,
  });
  return { user, token: signAccessToken(user) };
}

/** Verified exporter with a reviewable change: PATCH the profile + upload a round doc. */
async function withReviewableChange(patch = { name: 'Approved New Name Ltd' }) {
  const ex = await makeVerifiedExporter();
  await request(app).patch('/me/organisation').set(bearer(ex.token)).send(patch).expect(200);
  await request(app)
    .post('/me/kyc/documents')
    .set(bearer(ex.token))
    .attach('document', FILE, 'doc.pdf')
    .field('docType', patch.entityType === 'individual' ? 'pan' : 'registration')
    .expect(201);
  return ex;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('approve', () => {
  it('applies the values, supersedes prior docs, keeps the tick continuous, syncs denorms', async () => {
    const ex = await makeVerifiedExporter();
    // A pre-existing current document (the previously-verified set).
    await Organisation.updateOne(
      { _id: ex.org._id },
      { $push: { kycDocuments: { docType: 'gst', storageKey: 'mpx/kyc/prev/gst', uploadedAt: new Date(Date.now() - 86400000) } } },
    );
    await Product.create({
      exporterOrgId: ex.org._id,
      categoryId: new mongoose.Types.ObjectId(),
      name: 'Widget',
      slug: `vcr-widget-${RUN}${seq}`,
      status: 'active',
      sellerVerified: true,
      sellerCountry: 'IN',
    });
    await request(app).patch('/me/organisation').set(bearer(ex.token)).send({ name: 'Approved New Name Ltd', country: 'AE' }).expect(200);
    await request(app).post('/me/kyc/documents').set(bearer(ex.token)).attach('document', FILE, 'doc.pdf').field('docType', 'registration').expect(201);

    const reviewer = await makeReviewer();
    const res = await request(app)
      .post(`/employee/exporters/${ex.org._id}/changes/approve`)
      .set(bearer(reviewer.token));
    expect(res.status).toBe(200);
    expect(res.body.organisation.kycStatus).toBe('verified'); // never blinked

    const org = await Organisation.findById(ex.org._id).select('+kycDocuments').lean();
    expect(org.name).toBe('Approved New Name Ltd');
    expect(org.country).toBe('AE');
    expect(org.kycStatus).toBe('verified');
    expect(org.pendingChanges).toBeFalsy();
    expect(String(org.verifiedBy)).toBe(String(reviewer.user._id));

    // Old set superseded, round doc current.
    const prev = org.kycDocuments.find((d) => d.docType === 'gst');
    const roundDoc = org.kycDocuments.find((d) => d.docType === 'registration');
    expect(prev.supersededAt).toBeTruthy();
    expect(roundDoc.supersededAt).toBeFalsy();

    // §A23 denorm sync followed the new country.
    const product = await Product.findOne({ exporterOrgId: ex.org._id }).lean();
    expect(product.sellerCountry).toBe('AE');
    expect(product.sellerVerified).toBe(true);

    const audit = await AuditLog.findOne({ action: 'organisation.change_approve', orgId: ex.org._id }).lean();
    expect(audit.after.changedFields.sort()).toEqual(['country', 'name']);
  });

  it('409 when there is nothing reviewable (no set, or documents not yet uploaded)', async () => {
    const ex = await makeVerifiedExporter();
    const reviewer = await makeReviewer();
    // no pending set at all
    expect(
      (await request(app).post(`/employee/exporters/${ex.org._id}/changes/approve`).set(bearer(reviewer.token))).status,
    ).toBe(409);
    // set exists but still awaiting documents
    await request(app).patch('/me/organisation').set(bearer(ex.token)).send({ name: 'Docless Ltd' }).expect(200);
    expect(
      (await request(app).post(`/employee/exporters/${ex.org._id}/changes/approve`).set(bearer(reviewer.token))).status,
    ).toBe(409);
  });

  it('403 without the side permission; 404 on a side mismatch', async () => {
    const ex = await withReviewableChange();
    const wrongPerm = await makeReviewer(['buyer:approve']);
    expect(
      (await request(app).post(`/employee/exporters/${ex.org._id}/changes/approve`).set(bearer(wrongPerm.token))).status,
    ).toBe(403);
    // buyer route against an exporter-only org — the reviewer HOLDS buyer:approve,
    // so this is the side-mismatch 404, never a 403 that confirms existence.
    expect(
      (await request(app).post(`/employee/buyers/${ex.org._id}/changes/approve`).set(bearer(wrongPerm.token))).status,
    ).toBe(404);
  });
});

describe('reject', () => {
  it('HOLDS the set with the reason; live profile, tick and docs untouched; amend re-enters review', async () => {
    const ex = await withReviewableChange({ name: 'Rejected Name Ltd' });
    const reviewer = await makeReviewer();
    const res = await request(app)
      .post(`/employee/exporters/${ex.org._id}/changes/reject`)
      .set(bearer(reviewer.token))
      .send({ reason: 'The registration certificate does not show this name.' });
    expect(res.status).toBe(200);

    let org = await Organisation.findById(ex.org._id).lean();
    expect(org.kycStatus).toBe('verified');
    expect(org.name).toBe(ex.org.name);
    expect(org.pendingChanges.state).toBe('rejected');

    // The owner sees the reason on their own surface…
    const mine = await request(app).get('/me/organisation').set(bearer(ex.token));
    expect(mine.body.organisation.pendingChanges.rejectionReason).toMatch(/does not show/);
    // …the public never does.
    const pub = await request(app).get(`/exporters/${ex.org._id}`);
    expect(JSON.stringify(pub.body)).not.toContain('does not show');

    // Amending goes straight back to review (the round already has documents).
    await request(app).patch('/me/organisation').set(bearer(ex.token)).send({ name: 'Corrected Name Ltd' }).expect(200);
    org = await Organisation.findById(ex.org._id).lean();
    expect(org.pendingChanges.state).toBe('awaiting_review');
    expect(org.pendingChanges.values.name).toBe('Corrected Name Ltd');
  });

  it('a reason is mandatory (400 without one)', async () => {
    const ex = await withReviewableChange();
    const reviewer = await makeReviewer();
    expect(
      (await request(app).post(`/employee/exporters/${ex.org._id}/changes/reject`).set(bearer(reviewer.token)).send({})).status,
    ).toBe(400);
  });
});

describe('the queue sees change re-verifications', () => {
  it("verification=change_pending returns the flagged row; plain 'verified' does too but unflagged rows exist", async () => {
    const ex = await withReviewableChange();
    const reader = await makeReviewer(['organisation:read']);

    const res = await request(app)
      .get('/admin/orgs')
      .query({ verification: 'change_pending' })
      .set(bearer(reader.token));
    expect(res.status).toBe(200);
    const row = res.body.organisations.find((o) => o.id === String(ex.org._id));
    expect(row).toBeTruthy();
    expect(row.changePending).toBe(true);
    expect(row.changeSubmittedAt).toBeTruthy();
    expect(row.verification).toBe('verified');
  });
});
