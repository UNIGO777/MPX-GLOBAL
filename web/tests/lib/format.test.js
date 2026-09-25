import { describe, it, expect } from 'vitest';

import {
  apiError,
  fieldErrorMap,
  formatBytes,
  formatMobile,
  isErrorCode,
  maskIdentifier,
} from '../../src/lib/format.js';

const axiosError = (status, error) => ({ response: { status, data: { error } } });

describe('apiError — the server envelope, and nothing invented', () => {
  it('takes message, code, requestId and fields from the server', () => {
    const e = apiError(axiosError(409, { message: 'Taken.', code: 'CLAIM_SEAT_TAKEN', requestId: 'r1', fields: [] }));
    expect(e).toEqual({ message: 'Taken.', code: 'CLAIM_SEAT_TAKEN', requestId: 'r1', fields: [], status: 409 });
  });

  it('falls back to a generic message on a network failure', () => {
    const e = apiError(new Error('Network Error'));
    expect(e.message).toMatch(/Something went wrong/);
    expect(e.status).toBeNull();
  });

  it('isErrorCode branches on the code, not the wording', () => {
    const err = axiosError(401, { message: 'whatever', code: 'OTP_LOCKED' });
    expect(isErrorCode(err, 'OTP_LOCKED')).toBe(true);
    expect(isErrorCode(err, 'SESSION_EXPIRED', /whatever/)).toBe(false);
  });

  it('fieldErrorMap strips the body. prefix and keeps the first message', () => {
    expect(
      fieldErrorMap([
        { field: 'body.email', message: 'Bad email' },
        { field: 'body.email', message: 'Second' },
        { field: 'name', message: 'Required' },
      ]),
    ).toEqual({ email: 'Bad email', name: 'Required' });
  });
});

describe('display helpers', () => {
  it('maskIdentifier never shows the full contact', () => {
    expect(maskIdentifier('nikita@gmail.com')).toBe('ni••••@gmail.com');
    expect(maskIdentifier('+91 98765 43210')).toBe('+91 ••••• 3210');
    expect(maskIdentifier('')).toBe('your registered contact');
  });

  it('formatMobile groups Indian numbers and leaves others as stored', () => {
    expect(formatMobile('+919876543210')).toBe('+91 98765 43210');
    expect(formatMobile('+447700900123')).toBe('+447700900123');
    expect(formatMobile(null)).toBeNull();
  });

  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(820 * 1024)).toBe('820 KB');
    expect(formatBytes(1.4 * 1024 * 1024)).toBe('1.4 MB');
    expect(formatBytes(NaN)).toBe('');
  });
});
