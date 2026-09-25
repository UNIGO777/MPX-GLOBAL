import { describe, it, expect } from 'vitest';

import { amountInWords, isExpired, shippingStrip } from '../../src/lib/quotationPdf.js';

describe('quotation document helpers', () => {
  it('amount in words — Indian system for INR, with paise', () => {
    expect(amountInWords(248500000, 'INR')).toBe('Rupees Twenty-Four Lakh Eighty-Five Thousand Only');
    expect(amountInWords(100000050, 'INR')).toBe('Rupees Ten Lakh and Fifty Paise Only');
    expect(amountInWords(1000000000000, 'INR')).toMatch(/^Rupees One Thousand Crore/);
  });

  it('amount in words — international system otherwise, with cents', () => {
    expect(amountInWords(123456789, 'USD')).toBe('US Dollars One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven and Eighty-Nine Cents Only');
    expect(amountInWords(0, 'EUR')).toBe('Euros Zero Only');
    expect(amountInWords(null, 'USD')).toBe('');
  });

  it('expiry is stated from validUntil', () => {
    expect(isExpired({ validUntil: '2000-01-01' })).toBe(true);
    expect(isExpired({ validUntil: new Date(Date.now() + 86400000).toISOString() })).toBe(false);
    expect(isExpired({})).toBe(false);
  });

  it('shipping strip drops empty terms instead of dashing them', () => {
    expect(shippingStrip({ incoterm: 'CIF', portOfLoading: '', portOfDischarge: 'Jebel Ali', leadTime: null })).toEqual([
      ['Incoterm', 'CIF'],
      ['Discharge', 'Jebel Ali'],
    ]);
  });
});
