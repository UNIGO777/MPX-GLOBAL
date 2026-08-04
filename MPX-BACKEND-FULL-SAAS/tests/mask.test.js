import { describe, it, expect } from 'vitest';

import { maskMobile, maskEmail } from '../src/utils/mask.js';

/**
 * Masking of the contact details shown back to a user.
 *
 * The rule that matters: only the LAST 3 DIGITS survive, and the country code is
 * not echoed. This exists so a screen can say "we sent it to *********634"
 * without reprinting a number to anyone reading over the user's shoulder.
 */
describe('maskMobile — last 3 digits only', () => {
  it('keeps exactly the last three digits', () => {
    expect(maskMobile('+919876500634')).toBe('*********634');
  });

  it('never echoes the country code', () => {
    expect(maskMobile('+919876500634')).not.toContain('91');
    expect(maskMobile('+919876500634')).not.toContain('+');
  });

  it('reveals no more than 3 digits whatever the length', () => {
    for (const e164 of ['+919876500634', '+14155551234', '+447700900123', '9876500634']) {
      const digitsShown = maskMobile(e164).replace(/\*/g, '');
      expect(digitsShown).toHaveLength(3);
    }
  });

  it('does not leak a short or malformed value', () => {
    // Fewer digits than we would hide behind stars — show nothing at all rather
    // than effectively printing the whole thing.
    for (const bad of ['12', '', null, undefined, '+']) {
      expect(maskMobile(bad)).toBe('******');
    }
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('naman@gmail.com')).toBe('n****@gmail.com');
  });

  it('handles a malformed address without throwing', () => {
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail(undefined)).toBe('***');
  });
});
