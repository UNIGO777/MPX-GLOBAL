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
  Organisation.create({ name: 'Exporter Co', type: 'exporter', entityType: 'business', ...extra });

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
