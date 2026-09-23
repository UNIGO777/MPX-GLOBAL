import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../src/services/kyc.storage.service.js', () => ({
  uploadKycDocument: vi.fn(async ({ docType }) => ({
    storageKey: `mpx/kyc/fake/${docType}_${Math.random().toString(16).slice(2)}`,
    format: 'pdf',
  })),
  verifyKycFile: vi.fn(),
  signedKycUrl: vi.fn(() => ({ url: 'https://signed.fake/x', expiresAt: new Date().toISOString() })),
}));
vi.mock('../src/services/image.storage.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(async ({ folder }) => ({
    url: `https://res.cloudinary.com/demo/image/upload/v1/${folder}/logo.png`,
    publicId: `${folder}/logo`,
  })),
  deletePublicImage: vi.fn(async () => {}),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { SavedItem } = await import('../src/models/SavedItem.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');

/**
 * D7 rule 7 (owner, 2026-09-23) — WHO controls the company profile — and the
 * 8e self guards that one-org-both-sides makes necessary.
 *
 * Rule 7: an organisation with an active exporter account → the exporter
 * controls the company profile and KYC; the buyer keeps only its own buyer
 * functions and password. No active exporter → the buyer controls it, exactly
 * as §A22 always worked. Enforced on the SERVER for every write; the `canEdit`
 * / `canManage` flags are presentation.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const FILE = Buffer.from('%PDF-1.4 fake pdf bytes for the mock');
let seq = 0;

async function member(org, role) {
  seq += 1;
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `pc_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `83${1000000 + seq}`, e164: `+9183${1000000 + seq}` },
    passwordHash: 'x'.repeat(20),
    role,
    orgId: org._id,
  });
  return { user, token: signAccessToken(user) };
}

function company({ exporterSide = false } = {}) {
  seq += 1;
  return Organisation.create({
    name: `Both Sides ${seq}`,
    type: 'business',
    buyerSide: true,
    exporterSide,
    country: 'IN',
    entityType: 'business',
    address: { line1: '1 Test Street', city: 'Mumbai', postalCode: '400001' },
  });
}

/** An org holding BOTH an active buyer and an active exporter. */
async function sharedCompany() {
  const org = await company({ exporterSide: true });
  const buyer = await member(org, 'buyer');
  const exporter = await member(org, 'exporter');
  return { org, buyer, exporter };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Organisation.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    SavedItem.deleteMany({}),
  ]);
  invalidateLeafCache();
});

const MANAGED = 'PROFILE_MANAGED_BY_EXPORTER';
const codeOf = (res) => res.body.error?.code ?? res.body.code;

describe('rule 7 · a company WITH an exporter — the exporter controls the profile', () => {
  it('the buyer sees the profile read-only (canEdit false) and every write is refused', async () => {
    const { buyer } = await sharedCompany();

    const view = await request(app).get('/me/organisation').set(bearer(buyer.token)).expect(200);
    expect(view.body.organisation.canEdit).toBe(false);

    const patch = await request(app)
      .patch('/me/organisation')
      .set(bearer(buyer.token))
      .send({ name: 'Renamed By Buyer' });
    expect(patch.status).toBe(403);
    expect(codeOf(patch)).toBe(MANAGED);

    const logo = await request(app)
      .post('/me/organisation/logo')
      .set(bearer(buyer.token))
      .attach('logo', Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'logo.png');
    expect(logo.status).toBe(403);
    expect(codeOf(logo)).toBe(MANAGED);

    const removeLogo = await request(app).delete('/me/organisation/logo').set(bearer(buyer.token));
    expect(removeLogo.status).toBe(403);
  });

  it('🔴 the buyer cannot upload KYC documents into the company file', async () => {
    const { buyer, org } = await sharedCompany();
    const res = await request(app)
      .post('/me/kyc/documents')
      .set(bearer(buyer.token))
      .attach('document', FILE, 'doc.pdf')
      .field('docType', 'gst')
      .field('entityType', 'business');
    expect(res.status).toBe(403);
    expect(codeOf(res)).toBe(MANAGED);
    const after = await Organisation.findById(org._id).select('+kycDocuments');
    expect(after.kycDocuments ?? []).toHaveLength(0);

    const status = await request(app).get('/me/verification').set(bearer(buyer.token)).expect(200);
    expect(status.body.verification.canManage).toBe(false);
  });

  it('the exporter edits freely', async () => {
    const { exporter, org } = await sharedCompany();
    const view = await request(app).get('/me/organisation').set(bearer(exporter.token)).expect(200);
    expect(view.body.organisation.canEdit).toBe(true);
    await request(app)
      .patch('/me/organisation')
      .set(bearer(exporter.token))
      .send({ name: 'Renamed By Exporter' })
      .expect(200);
    expect((await Organisation.findById(org._id)).name).toBe('Renamed By Exporter');
  });

  it('a pending change the buyer left in flight is the exporter\'s to cancel — never stuck', async () => {
    const { buyer, exporter, org } = await sharedCompany();
    await Organisation.updateOne(
      { _id: org._id },
      {
        $set: {
          pendingChanges: {
            values: { name: 'Buyer Proposed' },
            changedFields: ['name'],
            state: 'awaiting_documents',
            submittedAt: new Date(),
          },
        },
      },
    );
    await request(app).delete('/me/organisation/pending-changes').set(bearer(buyer.token)).expect(403);
    await request(app).delete('/me/organisation/pending-changes').set(bearer(exporter.token)).expect(200);
    expect((await Organisation.findById(org._id)).pendingChanges?.state).toBeFalsy();
  });
});

describe('rule 7 · a company WITHOUT an active exporter — the buyer controls it, as §A22 always did', () => {
  it('a buyer-only company edits normally', async () => {
    const org = await company();
    const buyer = await member(org, 'buyer');
    const view = await request(app).get('/me/organisation').set(bearer(buyer.token)).expect(200);
    expect(view.body.organisation.canEdit).toBe(true);
    await request(app).patch('/me/organisation').set(bearer(buyer.token)).send({ name: 'Buyer Edit' }).expect(200);
  });

  it('control returns to the buyer when support deactivates the exporter', async () => {
    const { buyer, exporter } = await sharedCompany();
    await User.updateOne({ _id: exporter.user._id }, { $set: { isActive: false } });
    await request(app).patch('/me/organisation').set(bearer(buyer.token)).send({ name: 'Back To Buyer' }).expect(200);
  });
});

describe('8e · a company never acts on its own listings through its buyer side', () => {
  async function catalogue(org) {
    const top = await Category.create({ name: 'Textiles', slug: `textiles-${seq}` });
    const leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
    return Product.create({
      exporterOrgId: org._id,
      categoryId: leaf._id,
      name: 'Own Cotton Roll',
      status: 'active',
      sellerCountry: 'IN',
    });
  }

  it('the buyer cannot save its own company\'s product or the company itself', async () => {
    const { org, buyer } = await sharedCompany();
    const product = await catalogue(org);

    const p = await request(app)
      .post('/saved')
      .set(bearer(buyer.token))
      .send({ targetType: 'product', targetId: String(product._id) });
    expect(p.status).toBe(400);

    const s = await request(app)
      .post('/saved')
      .set(bearer(buyer.token))
      .send({ targetType: 'supplier', targetId: String(org._id) });
    expect(s.status).toBe(400);
    expect(await SavedItem.countDocuments({})).toBe(0);
  });

  it('search leaves out the signed-in buyer\'s own company — guests still see it', async () => {
    const { org, buyer } = await sharedCompany();
    await catalogue(org);

    const guest = await request(app).get('/public/search').query({ type: 'product' }).expect(200);
    expect(guest.body.products.map((p) => p.name)).toContain('Own Cotton Roll');

    const own = await request(app)
      .get('/public/search')
      .query({ type: 'product' })
      .set(bearer(buyer.token))
      .expect(200);
    expect(own.body.products.map((p) => p.name)).not.toContain('Own Cotton Roll');

    const suppliers = await request(app)
      .get('/public/search')
      .query({ type: 'supplier' })
      .set(bearer(buyer.token))
      .expect(200);
    expect(suppliers.body.suppliers.map((s) => s.name)).not.toContain(org.name);
  });

  it('the exporter still sees its own listings in search', async () => {
    const { org, exporter } = await sharedCompany();
    await catalogue(org);
    const res = await request(app)
      .get('/public/search')
      .query({ type: 'product' })
      .set(bearer(exporter.token))
      .expect(200);
    expect(res.body.products.map((p) => p.name)).toContain('Own Cotton Roll');
  });
});
