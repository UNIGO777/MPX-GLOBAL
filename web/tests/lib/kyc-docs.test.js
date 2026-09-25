import { describe, it, expect } from 'vitest';

import { ALL_DOC_TYPES, checkKycFile, DOC_TYPE_LABELS, docTypesFor } from '../../src/lib/kycDocTypes.js';
import {
  KYC_DOC_LABELS,
  KYC_DOC_TYPE_REQUESTABLE,
  kycDocsFor,
} from '../../../MPX-BACKEND-FULL-SAAS/src/models/enums.js';

/**
 * The KYC upload screen must offer exactly the documents the server accepts
 * for that company — a slot the server refuses is a dead end for the user —
 * and name them the same way the "More documents needed" email does.
 */
describe('KYC documents — web matches the server', () => {
  const cases = [
    ['IN', 'business'],
    ['IN', 'individual'],
    ['in', 'business'],
    ['US', 'business'],
    ['AE', 'individual'],
    [undefined, 'business'],
    [null, 'individual'],
  ];

  it.each(cases)('country %s · %s: same document list as the server', (country, entityType) => {
    expect(docTypesFor({ country, entityType })).toEqual([...kycDocsFor({ country, entityType })]);
  });

  it('staff can request exactly what some country offers', () => {
    expect([...ALL_DOC_TYPES].sort()).toEqual([...KYC_DOC_TYPE_REQUESTABLE].sort());
  });

  it('document names match the email\'s names', () => {
    for (const type of ALL_DOC_TYPES) {
      expect(DOC_TYPE_LABELS[type], type).toBe(KYC_DOC_LABELS[type]);
    }
  });

  it('no entity type yet → nothing offered (the company picks one first)', () => {
    expect(docTypesFor({ country: 'IN' })).toEqual([]);
  });

  it('an individual in India is never offered "Other" (the Aadhaar back door)', () => {
    expect(docTypesFor({ country: 'IN', entityType: 'individual' })).not.toContain('other');
  });
});

describe('checkKycFile — the pre-check before an upload', () => {
  const file = (name, type, size = 1024) => ({ name, type, size });

  it('accepts PDF and common images', () => {
    expect(checkKycFile(file('gst.pdf', 'application/pdf'))).toBeNull();
    expect(checkKycFile(file('photo.JPG', 'image/jpeg'))).toBeNull();
  });

  it('refuses other types, oversized files and nothing at all', () => {
    expect(checkKycFile(file('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toMatch(/isn't supported/);
    expect(checkKycFile(file('huge.pdf', 'application/pdf', 1024 * 1024 * 1024))).toMatch(/isn't supported/);
    expect(checkKycFile(null)).toBe('No file selected.');
  });
});
