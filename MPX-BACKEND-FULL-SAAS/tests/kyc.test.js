import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Mock the Cloudinary-backed storage so endpoint tests never hit the network.
// Magic-byte verification is covered separately in kycStorage.test.js.
vi.mock('../src/services/kyc.storage.service.js', () => ({
  uploadKycDocument: vi.fn(async ({ docType }) => ({
    storageKey: `mpx/kyc/fake/${docType}_${Math.random().toString(16).slice(2)}`,
    format: 'pdf',
  })),
  verifyKycFile: vi.fn(),
  signedKycUrl: vi.fn(),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');

const app = createApp();
let seq = 0;

async function makeUser(role, { entityType, kycStatus = 'pending', permissions = [], isActive = true } = {}) {
  seq += 1;
  const type = role === 'buyer' ? 'buyer' : role === 'exporter' ? 'exporter' : 'platform';
  const org = await Organisation.create({
    name: `${role} Co`,
    type,
    kycStatus,
    isActive,
    ...(entityType ? { entityType } : {}),
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
const FILE = Buffer.from('%PDF-1.4 fake pdf bytes for the mock');

// Helper: multipart upload.
function upload(token, { docType, entityType }) {
  const req = request(app).post('/me/kyc/documents').set(bearer(token)).attach('document', FILE, 'doc.pdf');
  if (docType != null) req.field('docType', docType);
  if (entityType != null) req.field('entityType', entityType);
  return req;
}

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

describe('KYC document upload (M1-B)', () => {
  it('exporter uploads → submitted; doc persisted; audit carries docType not storageKey', async () => {
    const ex = await makeUser('exporter', { entityType: 'business' });
    const res = await upload(ex.token, { docType: 'gst' });
    expect(res.status).toBe(201);
    expect(res.body.kyc.kycStatus).toBe('submitted');

    const fresh = await Organisation.findById(ex.org._id).select('+kycDocuments');
    expect(fresh.kycStatus).toBe('submitted');
    expect(fresh.kycSubmittedAt).toBeInstanceOf(Date);
    expect(fresh.kycDocuments).toHaveLength(1);
    expect(fresh.kycDocuments[0].docType).toBe('gst');
    expect(fresh.kycDocuments[0].storageKey).toMatch(/^mpx\/kyc\/fake\/gst_/);

    const audit = await AuditLog.findOne({ action: 'kyc.submit' });
    expect(audit.after.docType).toBe('gst');
    expect(JSON.stringify(audit.after)).not.toContain('storageKey');
    expect(audit.before.kycStatus).toBe('pending');
  });

  it('buyer (no entityType at signup) must supply it; then it is set on the org', async () => {
    const buyer = await makeUser('buyer');
    const missing = await upload(buyer.token, { docType: 'pan' });
    expect(missing.status).toBe(400);

    const ok = await upload(buyer.token, { docType: 'pan', entityType: 'individual' });
    expect(ok.status).toBe(201);
    const fresh = await Organisation.findById(buyer.org._id);
    expect(fresh.entityType).toBe('individual');
    expect(fresh.kycStatus).toBe('submitted');
  });

  it('rejects a docType that is invalid for the entity type', async () => {
    const ex = await makeUser('exporter', { entityType: 'business' });
    const res = await upload(ex.token, { docType: 'pan' }); // pan is an individual doc
    expect(res.status).toBe(400);
  });

  it('rejects an entityType that mismatches the account', async () => {
    const ex = await makeUser('exporter', { entityType: 'business' });
    const res = await upload(ex.token, { docType: 'gst', entityType: 'individual' });
    expect(res.status).toBe(400);
  });

  it('resubmit after rejection returns to submitted and clears the rejection reason', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'rejected' });
    await Organisation.updateOne({ _id: ex.org._id }, { $set: { kycRejectionReason: 'blurry doc' } });

    const res = await upload(ex.token, { docType: 'registration' });
    expect(res.status).toBe(201);
    const fresh = await Organisation.findById(ex.org._id);
    expect(fresh.kycStatus).toBe('submitted');
    expect(fresh.kycRejectionReason ?? null).toBeNull();
  });

  it('cannot resubmit once verified (409)', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    const res = await upload(ex.token, { docType: 'gst' });
    expect(res.status).toBe(409);
  });

  it('rejects an unknown docType (validator, 400)', async () => {
    const ex = await makeUser('exporter', { entityType: 'business' });
    const res = await upload(ex.token, { docType: 'ssn' });
    expect(res.status).toBe(400);
  });

  it('requires a file (400 when none attached)', async () => {
    const ex = await makeUser('exporter', { entityType: 'business' });
    const res = await request(app)
      .post('/me/kyc/documents')
      .set(bearer(ex.token))
      .field('docType', 'gst');
    expect(res.status).toBe(400);
  });

  it('platform staff have no KYC to submit (403)', async () => {
    const emp = await makeUser('employee');
    const res = await upload(emp.token, { docType: 'gst', entityType: 'business' });
    expect(res.status).toBe(403);
  });

  it('unauthenticated upload is rejected (401)', async () => {
    const res = await request(app).post('/me/kyc/documents').attach('document', FILE, 'doc.pdf').field('docType', 'gst');
    expect(res.status).toBe(401);
  });
});

describe('GET /me/verification (self status, M1-C)', () => {
  it('returns own status + document metadata (no storageKey)', async () => {
    const ex = await makeUser('exporter', { entityType: 'business' });
    await upload(ex.token, { docType: 'gst' });

    const res = await request(app).get('/me/verification').set(bearer(ex.token));
    expect(res.status).toBe(200);
    expect(res.body.verification.kycStatus).toBe('submitted');
    expect(res.body.verification.entityType).toBe('business');
    expect(res.body.verification.documents).toHaveLength(1);
    expect(res.body.verification.documents[0].docType).toBe('gst');
    expect(JSON.stringify(res.body)).not.toContain('storageKey');
    expect(JSON.stringify(res.body)).not.toContain('mpx/kyc/fake');
  });

  it('shows the rejection reason to the owner when rejected', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'rejected' });
    await Organisation.updateOne({ _id: ex.org._id }, { $set: { kycRejectionReason: 'blurry doc' } });
    const res = await request(app).get('/me/verification').set(bearer(ex.token));
    expect(res.status).toBe(200);
    expect(res.body.verification.kycRejectionReason).toBe('blurry doc');
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get('/me/verification');
    expect(res.status).toBe(401);
  });
});

describe('GET /exporters/:id (public tick, M1-C)', () => {
  it('is public and shows verified=true for a verified exporter (no raw kycStatus / contacts)', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified' });
    const res = await request(app).get(`/exporters/${ex.org._id}`); // no auth
    expect(res.status).toBe(200);
    expect(res.body.exporter.verified).toBe(true);
    expect(res.body.exporter).not.toHaveProperty('kycStatus');
    expect(res.body.exporter).not.toHaveProperty('kycDocuments');
    expect(JSON.stringify(res.body)).not.toContain('email');
  });

  it('does NOT leak a rejection: a rejected exporter is public with verified=false', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'rejected' });
    const res = await request(app).get(`/exporters/${ex.org._id}`);
    expect(res.status).toBe(200);
    expect(res.body.exporter.verified).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('rejected');
  });

  it('a buyer org is not reachable via the exporter route (404, type-constrained)', async () => {
    const buyer = await makeUser('buyer');
    const res = await request(app).get(`/exporters/${buyer.org._id}`);
    expect(res.status).toBe(404);
  });

  it('a deactivated exporter returns 404', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'verified', isActive: false });
    const res = await request(app).get(`/exporters/${ex.org._id}`);
    expect(res.status).toBe(404);
  });
});

describe('resubmit-after-rejection loop (M1-C)', () => {
  it('rejected → re-upload → submitted → employee verify → verified', async () => {
    const ex = await makeUser('exporter', { entityType: 'business', kycStatus: 'rejected' });
    await Organisation.updateOne({ _id: ex.org._id }, { $set: { kycRejectionReason: 'blurry' } });

    // Resubmit via the upload path → back to submitted, reason cleared.
    const reupload = await upload(ex.token, { docType: 'registration' });
    expect(reupload.status).toBe(201);
    let fresh = await Organisation.findById(ex.org._id);
    expect(fresh.kycStatus).toBe('submitted');
    expect(fresh.kycRejectionReason ?? null).toBeNull();

    // Employee verifies the now-submitted exporter.
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });
    const verify = await request(app)
      .post(`/employee/exporters/${ex.org._id}/verify`)
      .set(bearer(reviewer.token))
      .send({});
    expect(verify.status).toBe(200);
    fresh = await Organisation.findById(ex.org._id);
    expect(fresh.kycStatus).toBe('verified');
  });
});
