import { describe, it, expect } from 'vitest';

import { formatMinor, fromMinor, minorToInput, toMinor } from '../../src/lib/money.js';

describe('money — integer minor units at the edge', () => {
  it('rounds instead of truncating float noise (4.505 → 451, not 450)', () => {
    expect(toMinor('4.505')).toBe(451);
    expect(toMinor('450.50')).toBe(45050);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it('turns junk into 0 rather than NaN', () => {
    expect(toMinor('abc')).toBe(0);
    expect(toMinor(undefined)).toBe(0);
    expect(fromMinor('x')).toBe(0);
  });

  it('never shows "0" for an empty input', () => {
    expect(minorToInput(null)).toBe('');
    expect(minorToInput('')).toBe('');
    expect(minorToInput(45050)).toBe('450.5');
  });

  it('formats with the ISO code and Indian grouping, no guessed symbol', () => {
    expect(formatMinor(248500000, 'INR')).toBe('INR 24,85,000');
    expect(formatMinor(45050, 'USD')).toBe('USD 450.50');
    expect(formatMinor(100, null)).toBe('1');
  });
});
