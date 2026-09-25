import { describe, it, expect } from 'vitest';

import { redact } from '../src/utils/logger.js';

/** Tracker G3: nothing sensitive reaches device logs or crash output. */
describe('logger redaction (G3)', () => {
  it('redacts sensitive keys at any depth, whatever their case', () => {
    const out = redact({
      accessToken: 'abc',
      user: { name: 'Nikita', Password: 'x', otpCode: '123456' },
      bank: { accountNumber: '1234567890', ifsc: 'HDFC0001234' },
      kycDocument: { url: 'https://...' },
    });
    expect(out.accessToken).toBe('[redacted]');
    expect(out.user).toEqual({ name: 'Nikita', Password: '[redacted]', otpCode: '[redacted]' });
    expect(out.bank).toEqual({ accountNumber: '[redacted]', ifsc: '[redacted]' });
    expect(out.kycDocument).toBe('[redacted]');
  });

  it('scrubs tokens hiding in ordinary strings and error messages', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3OCJ9.c2lnbmF0dXJlMTIzNDU2';
    expect(redact(`failed with ${jwt}`)).toBe('failed with [redacted]');
    expect(redact('Authorization: Bearer abcdefgh12345678')).toBe('Authorization: Bearer [redacted]');
    const err = redact(new Error(`boom ${'a'.repeat(40)}`));
    expect(err).toEqual({ name: 'Error', message: 'boom [redacted]' });
  });

  it('survives circular and very deep objects', () => {
    const a = { name: 'x' };
    a.self = a;
    expect(redact(a).self).toBe('[circular]');
    let deep = { v: 1 };
    for (let i = 0; i < 10; i += 1) deep = { next: deep };
    expect(JSON.stringify(redact(deep))).toContain('[truncated]');
  });
});
