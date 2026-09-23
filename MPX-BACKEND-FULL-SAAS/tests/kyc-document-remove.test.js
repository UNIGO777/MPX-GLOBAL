import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Storage mock — `deleteKycFile` is the one under test, so it is a spy rather
// than a no-op: several assertions below are about WHETHER and WITH WHAT it was
// called, not just the HTTP status.
const deleteKycFile = vi.fn(async () => 'ok');
vi.mock('../src/services/kyc.storage.service.js', () => ({
  uploadKycDocument: vi.fn(async ({ docType }) => ({
    storageKey: `mpx/kyc/fake/${docType}_${Math.random().toString(16).slice(2)}`,
    format: 'pdf',
  })),
  verifyKycFile: vi.fn(),
  deleteKycFile: (...a) => deleteKycFile(...a),
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
 * Per-document KYC removal (2026-09-23, owner). The FIRST path in this codebase
 * that destroys a stored KYC file — everything before it only ever MARKED rows.
 *
 * It exists for one scenario: a reviewer opens a PAN slot and finds an Aadhaar.
 * Aadhaar was retired as an accepted type the same day, but nothing could stop
 * us holding one that arrived mislabelled, and "we didn't ask for it" explains
 * how it got here, not why we still have it.
 *
 * What these tests protect, in rough order of what it costs to get wrong:
 *  - the delete ORDER (file first, row second) — reversed, a storage failure
 *    strands an unreferenced file we can no longer find;
 *  - permission gating on a WRITE, not the `kyc:view` read;
 *  - the audit record surviving the file, without carrying a storageKey;
 *  - blast radius: one document, never the org's status or its other files.
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
    name: `${role} Rm Co ${seq}`,
    type: isCompany ? 'business' : 'platform',
    buyerSide: role === 'buyer',
    exporterSide: role === 'exporter',
    kycStatus,
    country: 'IN',
    address: { line1: '1 Test Street', city: 'Mumbai', postalCode: '400001' },
    ...(entityType ? { entityType } : {}),
  });
  const user = await User.create({
    name: `${role}-rm-${seq}`,
    email: `rm_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `9${RUN}${seq}`, e164: `+919${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { user, org, token: signAccessToken(user) };
}

const upload = (token, docType) =>
  request(app)
    .post('/me/kyc/documents')
    .set(bearer(token))
    .attach('document', FILE, 'doc.pdf')
    .field('docType', docType);

/** Read the stored rows — kycDocuments is select:false. */
const docsOf = async (orgId) =>
  (await Organisation.findById(orgId).select('+kycDocuments')).kycDocuments ?? [];

const removeUrl = (side, orgId, docId) => `/employee/${side}/${orgId}/kyc/documents/${docId}/remove`;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('removing one KYC document', () => {
  it('destroys the file and drops the row, leaving the org and its other documents alone', async () => {
    deleteKycFile.mockClear();
    const ex = await makeUser('exporter', { entityType: 'business' });
    await upload(ex.token, 'gst');
    await upload(ex.token, 'registration');
    const before = await docsOf(ex.org._id);
    const target = before.find((d) => d.docType === 'gst');
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });

    const res = await request(app)
      .post(removeUrl('exporters', ex.org._id, target._id))
      .set(bearer(reviewer.token))
      .send({ reason: 'Aadhaar uploaded in place of the GST certificate — not accepted.' });
    expect(res.status).toBe(200);

    // The FILE, by its real storage key — not just the database row.
    expect(deleteKycFile).toHaveBeenCalledWith({ storageKey: target.storageKey });

    const after = await docsOf(ex.org._id);
    expect(after.map((d) => d.docType)).toEqual(['registration']);

    // Blast radius: status is a separate, deliberate decision (reject/revoke).
    const org = await Organisation.findById(ex.org._id);
    expect(org.kycStatus).toBe('submitted');
  });

  /**
   * The invariant that matters most. If the row were dropped first, a storage
   * failure would leave a file in Cloudinary with its only pointer deleted —
   * permanently held and unfindable, the exact outcome this feature exists to
   * prevent. Failing closed is the correct behaviour: the reviewer retries.
   */
  it('a storage failure aborts BEFORE the row is dropped, so nothing is stranded', async () => {
    deleteKycFile.mockClear();
    deleteKycFile.mockRejectedValueOnce(new Error('cloudinary is down'));
    const ex = await makeUser('exporter', { entityType: 'business' });
    await upload(ex.token, 'gst');
    const [doc] = await docsOf(ex.org._id);
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });

    const res = await request(app)
      .post(removeUrl('exporters', ex.org._id, doc._id))
      .set(bearer(reviewer.token))
      .send({ reason: 'Aadhaar in the GST slot.' });
    expect(res.status).toBeGreaterThanOrEqual(500);

    const after = await docsOf(ex.org._id);
    expect(after).toHaveLength(1); // still pointing at the file, which still exists
  });

  it('is a WRITE: kyc:view alone cannot delete, and the wrong side is 404 not 403', async () => {
    deleteKycFile.mockClear();
    const ex = await makeUser('exporter', { entityType: 'business' });
    await upload(ex.token, 'gst');
    const [doc] = await docsOf(ex.org._id);
    const body = { reason: 'Not an acceptable document.' };

    const viewer = await makeUser('employee', { permissions: ['kyc:view'] });
    expect(
      (await request(app).post(removeUrl('exporters', ex.org._id, doc._id)).set(bearer(viewer.token)).send(body))
        .status,
    ).toBe(403);

    // An exporter org addressed through the buyer route: 404, never 403 — a 403
    // would confirm the organisation exists (security-baseline 4).
    const buyerReviewer = await makeUser('employee', { permissions: ['buyer:approve'] });
    expect(
      (await request(app).post(removeUrl('buyers', ex.org._id, doc._id)).set(bearer(buyerReviewer.token)).send(body))
        .status,
    ).toBe(404);

    expect(deleteKycFile).not.toHaveBeenCalled();
    expect(await docsOf(ex.org._id)).toHaveLength(1);
  });

  it('demands a reason, and 404s an unknown document — neither touches storage', async () => {
    deleteKycFile.mockClear();
    const ex = await makeUser('exporter', { entityType: 'business' });
    await upload(ex.token, 'gst');
    const [doc] = await docsOf(ex.org._id);
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });
    const url = removeUrl('exporters', ex.org._id, doc._id);

    expect((await request(app).post(url).set(bearer(reviewer.token)).send({})).status).toBe(400);
    expect((await request(app).post(url).set(bearer(reviewer.token)).send({ reason: 'x' })).status).toBe(400);
    expect(
      (await request(app)
        .post(removeUrl('exporters', ex.org._id, new mongoose.Types.ObjectId()))
        .set(bearer(reviewer.token))
        .send({ reason: 'Aadhaar in the PAN slot.' })).status,
    ).toBe(404);

    expect(deleteKycFile).not.toHaveBeenCalled();
    expect(await docsOf(ex.org._id)).toHaveLength(1);
  });

  /**
   * CLAUDE.md #7 — the file is destroyed, the RECORD that it existed and was
   * destroyed is permanent. That record is the whole compliance story for an
   * Aadhaar we never wanted: it proves we deleted it, without keeping it.
   */
  it('leaves a permanent audit record carrying the reason but no storageKey', async () => {
    deleteKycFile.mockClear();
    const ex = await makeUser('exporter', { entityType: 'business' });
    await upload(ex.token, 'gst');
    const [doc] = await docsOf(ex.org._id);
    const reviewer = await makeUser('employee', { permissions: ['exporter:verify'] });
    const reason = 'Aadhaar card uploaded in the GST slot — we do not accept Aadhaar.';

    await request(app)
      .post(removeUrl('exporters', ex.org._id, doc._id))
      .set(bearer(reviewer.token))
      .send({ reason });

    const audit = await AuditLog.findOne({ action: 'kyc.document_remove', entityId: ex.org._id });
    expect(audit).toBeTruthy();
    expect(audit.actorId.toString()).toBe(reviewer.user._id.toString());
    expect(audit.before.docType).toBe('gst');
    expect(audit.after).toMatchObject({ removed: true, reason });
    // A pointer to a private asset — and after the destroy, a dangling one.
    expect(JSON.stringify(audit.toObject())).not.toContain(doc.storageKey);
  });
});
