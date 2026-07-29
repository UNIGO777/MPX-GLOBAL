import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import '../src/models/index.js';
import { Organisation } from '../src/models/Organisation.js';

// M1-A: KYC data model. kycDocuments must never be returned by default
// (select:false, tracker A7/E3), stores a private storageKey (not a public URL),
// and each doc is typed by an enum docType.

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Organisation.deleteMany({});
});

const makeExporter = (extra = {}) =>
  Organisation.create({ name: 'Exporter Co', type: 'business', exporterSide: true, entityType: 'business', ...extra });

describe('Organisation KYC model (M1-A)', () => {
  it('kycDocuments is excluded by default and only returned with explicit select', async () => {
    const org = await makeExporter({
      kycDocuments: [{ docType: 'gst', storageKey: 'mpx/kyc/abc123', format: 'pdf' }],
      kycStatus: 'submitted',
      kycSubmittedAt: new Date(),
    });

    const defaultRead = await Organisation.findById(org._id);
    expect(defaultRead.kycDocuments).toBeUndefined();

    const withDocs = await Organisation.findById(org._id).select('+kycDocuments');
    expect(withDocs.kycDocuments).toHaveLength(1);
    expect(withDocs.kycDocuments[0].storageKey).toBe('mpx/kyc/abc123');
    expect(withDocs.kycDocuments[0].docType).toBe('gst');
    // uploadedAt defaults so the reviewer can order documents.
    expect(withDocs.kycDocuments[0].uploadedAt).toBeInstanceOf(Date);
  });

  it('a kyc document requires docType and storageKey', async () => {
    await expect(makeExporter({ kycDocuments: [{ format: 'pdf' }] })).rejects.toThrow();
  });

  it('rejects an unknown docType (enum-guarded)', async () => {
    await expect(
      makeExporter({ kycDocuments: [{ docType: 'ssn', storageKey: 'mpx/kyc/x' }] }),
    ).rejects.toThrow();
  });

  it('a fresh org has no kyc documents and pending status', async () => {
    const org = await makeExporter();
    const withDocs = await Organisation.findById(org._id).select('+kycDocuments');
    expect(withDocs.kycDocuments).toEqual([]);
    expect(withDocs.kycStatus).toBe('pending');
    expect(withDocs.kycSubmittedAt).toBeUndefined();
  });
});

describe('Organisation slug (A6 / SEO §1)', () => {
  it('generates a slug from the company name on create', async () => {
    const org = await makeExporter({ name: 'Textile Hub' });
    expect(org.slug).toBe('textile-hub');
  });

  it('lowercases, strips specials, and collapses spaces', async () => {
    const org = await makeExporter({ name: '  Acme  Co., Ltd.!!  ' });
    expect(org.slug).toBe('acme-co-ltd');
  });

  it('appends a short id suffix on collision so slugs stay unique', async () => {
    const a = await makeExporter({ name: 'Same Name' });
    const b = await makeExporter({ name: 'Same Name' });
    expect(a.slug).toBe('same-name');
    expect(b.slug).toMatch(/^same-name-[a-f0-9]{4}$/);
    expect(b.slug).not.toBe(a.slug);
  });

  it('is immutable — renaming the company does not change the slug', async () => {
    const org = await makeExporter({ name: 'Original Name' });
    expect(org.slug).toBe('original-name');
    org.name = 'Renamed Company';
    await org.save();
    expect(org.slug).toBe('original-name');
  });

  it('the partial-unique index rejects a duplicate explicit slug', async () => {
    await makeExporter({ name: 'One', slug: 'dup-slug' });
    await expect(makeExporter({ name: 'Two', slug: 'dup-slug' })).rejects.toThrow();
  });
});
