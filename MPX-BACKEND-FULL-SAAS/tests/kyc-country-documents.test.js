import { describe, it, expect } from 'vitest';

import {
  KYC_DOC_TYPE,
  KYC_DOC_TYPE_REQUESTABLE,
  KYC_DOCS_DEFAULT,
  KYC_DOCS_BY_COUNTRY,
  kycDocsFor,
} from '../src/models/enums.js';
import { requestDocumentsSchema } from '../src/validators/verification.validators.js';

/**
 * Country-driven KYC document sets (owner, 2026-09-23) and the Aadhaar policy
 * that lives inside the Indian one.
 *
 * 🔴 Two design rules these tests exist to defend:
 *
 * 1. **DEFAULT + OVERRIDES, never a per-country table.** The picker offers 193
 *    countries and the server accepts any two-letter code, so a table would be
 *    permanently incomplete — an unknown country must fall THROUGH, never return
 *    nothing. A company facing an empty upload screen cannot get verified.
 *
 * 2. **The set keys off COUNTRY, never off buyerSide/exporterSide.** An
 *    Organisation may be both (CLAUDE.md), so a side-based rule would put GST and
 *    IEC in front of a German company that also sells. Exporters get the Indian
 *    set because they are Indian.
 *
 * No DB — pure list/schema invariants.
 */
describe('KYC · documents by country', () => {
  it('asks an Indian business for GST and IEC', () => {
    // IEC is the DGFT Import Export Code — mandatory to export from India and
    // the most relevant document on an export marketplace. It was missing
    // entirely until 2026-09-23.
    expect(kycDocsFor({ country: 'IN', entityType: 'business' })).toContain('iec');
    expect(kycDocsFor({ country: 'IN', entityType: 'business' })).toContain('gst');
  });

  it('asks every other country for the cross-border generics instead', () => {
    for (const c of ['DE', 'US', 'GB', 'AE', 'SG']) {
      const docs = kycDocsFor({ country: c, entityType: 'business' });
      expect(docs).toEqual(['registration', 'tax', 'licence', 'other']);
      // India's instruments must never be offered outside India — the upload
      // endpoint would refuse them and the company could not satisfy the form.
      for (const indian of ['gst', 'iec', 'pan', 'aadhaar']) expect(docs).not.toContain(indian);
    }
  });

  it('offers Indian individuals PAN/Aadhaar/passport and everyone else passport/ID/licence', () => {
    expect([...kycDocsFor({ country: 'IN', entityType: 'individual' })].sort()).toEqual([
      'aadhaar', 'pan', 'passport',
    ]);
    expect([...kycDocsFor({ country: 'FR', entityType: 'individual' })].sort()).toEqual([
      'driving_licence', 'national_id', 'passport',
    ]);
  });

  /**
   * The failure mode this guards is an EMPTY upload screen, which reads as "we
   * want nothing from you" and blocks verification outright.
   */
  it('falls through to the default set for an unknown, missing or odd country', () => {
    const expected = KYC_DOCS_DEFAULT.business;
    for (const c of ['ZZ', '', null, undefined, 'de', 'Xx']) {
      expect(kycDocsFor({ country: c, entityType: 'business' })).toEqual(expected);
    }
    expect(kycDocsFor({ country: 'de', entityType: 'business' })).toEqual(expected); // case-insensitive
  });

  it('returns nothing only when the entity type is unknown', () => {
    expect(kycDocsFor({ country: 'IN', entityType: null })).toEqual([]);
    expect(kycDocsFor({ country: 'IN', entityType: 'nonsense' })).toEqual([]);
  });

  /**
   * 🔴 `other` is the back door that has to stay shut for individuals. Labelled
   * "Other identity document" it is where an Aadhaar lands anyway — and a copy
   * stored under a catch-all is UNFINDABLE by query, strictly worse than the
   * named type. Business keeps it: VAT certificates and export licences have no
   * named slot and no Aadhaar failure mode.
   */
  it('gives individuals no catch-all in any country, and business one in every country', () => {
    const sets = [KYC_DOCS_DEFAULT, ...Object.values(KYC_DOCS_BY_COUNTRY)];
    for (const set of sets) {
      expect(set.individual).not.toContain('other');
      expect(set.business).toContain('other');
    }
  });

  it('requestable is exactly the union of every set — derived, never hand-written', () => {
    const union = [
      ...new Set([
        ...Object.values(KYC_DOCS_DEFAULT).flat(),
        ...Object.values(KYC_DOCS_BY_COUNTRY).flatMap((c) => Object.values(c).flat()),
      ]),
    ].sort();
    expect([...KYC_DOC_TYPE_REQUESTABLE].sort()).toEqual(union);
  });

  it('every offered type is storable, so nothing can be uploaded that fails validation', () => {
    for (const t of KYC_DOC_TYPE_REQUESTABLE) expect(KYC_DOC_TYPE).toContain(t);
  });

  /**
   * The country work ADDED `iec` and the international generics; it removed
   * nothing. `certificate` is the canary — it was already offered to Indian
   * businesses before this change and must still be, or every org holding one
   * loses the ability to re-send it.
   */
  it('removed nothing that was already offered to an Indian business', () => {
    const docs = kycDocsFor({ country: 'IN', entityType: 'business' });
    for (const t of ['registration', 'gst', 'certificate', 'other']) expect(docs).toContain(t);
  });

  it('the request schema accepts a type if and only if it is requestable', () => {
    for (const t of KYC_DOC_TYPE) {
      const parsed = requestDocumentsSchema.body.safeParse({ docTypes: [t], note: 'please send' });
      expect(parsed.success).toBe(KYC_DOC_TYPE_REQUESTABLE.includes(t));
    }
  });
});
