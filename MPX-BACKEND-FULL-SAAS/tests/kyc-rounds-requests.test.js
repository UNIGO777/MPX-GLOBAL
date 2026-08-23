import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Same storage mock as kyc.test.js — endpoint tests never reach Cloudinary.
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
 * Verification-redesign (2026-08-19) — document ROUNDS and staff document
 * REQUESTS. The stakes: a verified company's tick must never blink because of
 * an upload, and a verified upload must be impossible OUTSIDE a pending change
 * round or an open request (else "already verified" would stop meaning
 * anything).
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const FILE = Buffer.from('%PDF-1.4 fake kyc doc');
const RUN = String(Date.now()).slice(-7);
let seq = 0;

async function makeUser(role, { entityType, kycStatus = 'pending', permissions = [] } = {}) {
  seq += 1;
  const isCompany = role === 'buyer' || role === 'exporter';
  const org = await Organisation.create({
    name: `${role} RR Co ${seq}`,
    type: isCompany ? 'business' : 'platform',
    buyerSide: role === 'buyer',
    exporterSide: role === 'exporter',
    kycStatus,
    country: 'IN',
    address: { line1: '1 Test Street', city: 'Mumbai', postalCode: '400001' },
    ...(entityType ? { entityType } : {}),
  });
  const user = await User.create({
    name: `${role}-rr-${seq}`,
    email: `rr_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `9${RUN}${seq}`, e164: `+919${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { user, org, token: signAccessToken(user) };
}

const upload = (token, docType, extra = {}) => {
  const req = request(app).post('/me/kyc/documents').set(bearer(token)).attach('document', FILE, 'doc.pdf');
  req.field('docType', docType);
  for (const [k, v] of Object.entries(extra)) req.field(k, v);
  return req;
};

/** Seed a pending change directly — the PATCH path that creates it is its own suite. */
async function seedPendingChange(orgId, { values, state = 'awaiting_documents' }) {
  const roundId = new mongoose.Types.ObjectId();
  await Organisation.updateOne(
    { _id: orgId },
    {
      $set: {
        pendingChanges: {
          values,
          changedFields: Object.keys(values),
          state,
          roundId,
          submittedAt: new Date(),
        },
      },
    },
  );
  return roundId;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('staff document requests — creation', () => {
  it('requires the side review permission (403 without, 404 on side mismatch)', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    const noPerm = await makeUser('employee', { permissions: ['kyc:view'] });
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });

    const body = { docTypes: ['gst'], note: 'GST certificate needed for the address on file.' };
    expect(
      (await request(app).post(`/employee/exporters/${ex.org._id}/kyc/request-documents`).set(bearer(noPerm.token)).send(body)).status,
    ).toBe(403);
    // buyer route + exporter-only org = side mismatch → 404, never 403
    const buyerRoute = await request(app)
      .post(`/employee/buyers/${ex.org._id}/kyc/request-documents`)
      .set(bearer(reviewer.token))
      .send(body);
    expect([403, 404]).toContain(buyerRoute.status); // 403 (no buyer perm) is also correct here
    expect(
      (await request(app).post(`/employee/exporters/${ex.org._id}/kyc/request-documents`).set(bearer(reviewer.token)).send(body)).status,
    ).toBe(201);
  });

  it('refuses a docType invalid for the entity, an empty list, and a short note', async () => {
    const ex = await makeUser('exporter', { entityType: 'individual', kycStatus: 'verified' });
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });
    const url = `/employee/exporters/${ex.org._id}/kyc/request-documents`;

    // gst is a BUSINESS doc — this org is individual
    expect(
      (await request(app).post(url).set(bearer(reviewer.token)).send({ docTypes: ['gst'], note: 'please upload' })).status,
    ).toBe(400);
    expect(
      (await request(app).post(url).set(bearer(reviewer.token)).send({ docTypes: [], note: 'please upload' })).status,
    ).toBe(400);
    expect(
      (await request(app).post(url).set(bearer(reviewer.token)).send({ docTypes: ['pan'], note: 'x' })).status,
    ).toBe(400);
  });

  it('writes an audit row and surfaces the request to the company', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });
    await request(app)
      .post(`/employee/exporters/${ex.org._id}/kyc/request-documents`)
      .set(bearer(reviewer.token))
      .send({ docTypes: ['certificate'], note: 'The incorporation certificate is blurry — please re-upload.' });

    const audit = await AuditLog.findOne({ action: 'kyc.request_documents', orgId: ex.org._id }).lean();
    expect(audit).toBeTruthy();
    expect(audit.after.docTypes).toEqual(['certificate']);

    const mine = await request(app).get('/me/verification').set(bearer(ex.token));
    expect(mine.status).toBe(200);
    expect(mine.body.verification.documentRequests).toHaveLength(1);
    expect(mine.body.verification.documentRequests[0].note).toMatch(/blurry/);
    expect(mine.body.verification.documentRequests[0].fulfilledAt).toBeNull();
  });
});

describe('verified-org uploads — the carve-out', () => {
  it('with NEITHER a pending change nor an open request → 409, tick untouched', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    const res = await upload(ex.token, 'gst');
    expect(res.status).toBe(409);
    const org = await Organisation.findById(ex.org._id).lean();
    expect(org.kycStatus).toBe('verified');
  });

  it('an open request enables ONLY its named docTypes; fulfilment auto-marks; kycStatus never moves', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });
    await request(app)
      .post(`/employee/exporters/${ex.org._id}/kyc/request-documents`)
      .set(bearer(reviewer.token))
      .send({ docTypes: ['gst'], note: 'GST mismatch against the registered address.' });

    // a docType the request did not name is still refused
    expect((await upload(ex.token, 'registration')).status).toBe(409);

    const ok = await upload(ex.token, 'gst');
    expect(ok.status).toBe(201);
    expect(ok.body.kyc.kycStatus).toBe('verified'); // the tick never blinked

    const org = await Organisation.findById(ex.org._id).select('+kycDocuments').lean();
    expect(org.kycStatus).toBe('verified');
    const doc = org.kycDocuments.find((d) => d.docType === 'gst');
    expect(String(doc.requestId)).toBe(String(org.documentRequests[0]._id));
    expect(org.documentRequests[0].fulfilledAt).toBeTruthy();
  });

  it('a pending change round accepts the upload, tags it, and flips awaiting_documents → awaiting_review', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    const roundId = await seedPendingChange(ex.org._id, { values: { name: 'Renamed Exports Ltd' } });

    const res = await upload(ex.token, 'registration');
    expect(res.status).toBe(201);

    const org = await Organisation.findById(ex.org._id).select('+kycDocuments').lean();
    expect(org.kycStatus).toBe('verified');
    expect(org.pendingChanges.state).toBe('awaiting_review');
    const doc = org.kycDocuments.find((d) => d.docType === 'registration');
    expect(String(doc.roundId)).toBe(String(roundId));
  });

  it('an entityType-changing round validates docs against the NEW entity type', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    await seedPendingChange(ex.org._id, { values: { entityType: 'individual' } });

    // old-entity doc refused, new-entity doc accepted
    expect((await upload(ex.token, 'gst')).status).toBe(400);
    expect((await upload(ex.token, 'pan')).status).toBe(201);
  });
});

describe('the 20-doc cap counts CURRENT documents only', () => {
  it('20 superseded + 1 current still accepts an upload', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    const superseded = Array.from({ length: 20 }, (_, i) => ({
      docType: 'other',
      storageKey: `mpx/kyc/old/${i}`,
      uploadedAt: new Date(Date.now() - 86400000),
      supersededAt: new Date(),
    }));
    await Organisation.updateOne({ _id: ex.org._id }, { $set: { kycDocuments: superseded } });
    await seedPendingChange(ex.org._id, { values: { name: 'Still Uploading Ltd' } });

    expect((await upload(ex.token, 'registration')).status).toBe(201);
  });
});
