import { describe, it, expect } from 'vitest';

import { formatMinor, fromMinor, toMinor } from '../src/utils/money.js';
import { maskDestination, maskEmail, maskMobile } from '../src/utils/mask.js';

describe('money — same rules as the web (integer minor units)', () => {
  it('rounds, never truncates, and never returns NaN', () => {
    expect(toMinor('4.505')).toBe(451);
    expect(toMinor('abc')).toBe(0);
    expect(fromMinor(45050)).toBe(450.5);
  });

  it('formats with the ISO code and Indian grouping', () => {
    expect(formatMinor(248500000, 'INR')).toBe('INR 24,85,000');
    expect(formatMinor(45050, 'USD')).toBe('USD 450.50');
  });
});

describe('masking — a screen never shows a full address or number', () => {
  it('email keeps first and last letter and the domain', () => {
    expect(maskEmail('nikita@example.com')).toBe('n••••a@example.com');
    expect(maskEmail('ab@x.io')).toBe('a••@x.io');
    expect(maskEmail('not-an-email')).toBe('•••');
  });

  it('mobile keeps the dial code and the last four digits', () => {
    expect(maskMobile('+91 98765 43210')).toBe('+91 ••••• 3210');
    expect(maskMobile('12')).toBe('•••');
  });

  it('picks the right mask for what was typed', () => {
    expect(maskDestination('nikita@example.com')).toContain('@example.com');
    expect(maskDestination('+919876543210')).toBe('+91 ••••• 3210');
    expect(maskDestination('')).toBe('');
  });
});
