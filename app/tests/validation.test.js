import { describe, it, expect, vi } from 'vitest';

// validation.js takes its minimum from the strength meter, which renders with
// react-native; only the number matters here.
vi.mock('../src/components/PasswordStrength.jsx', () => ({ PASSWORD_MIN_LENGTH: 8 }));

const v = await import('../src/utils/validation.js');

describe('app form validation (the server re-checks everything)', () => {
  it('email is permissive but not empty or malformed', () => {
    expect(v.validateEmail('a+b@example.co')).toBeNull();
    expect(v.validateEmail('')).toMatch(/Enter your email/);
    expect(v.validateEmail('no-at-sign')).toMatch(/valid email/);
  });

  it('password length and confirmation', () => {
    expect(v.validatePassword('short')).toMatch(/at least 8/);
    expect(v.validatePassword('longenough')).toBeNull();
    expect(v.validateConfirmPassword('longenough', 'different')).toMatch(/do not match/);
  });

  it('mobile, OTP and country', () => {
    expect(v.validateMobile({ country: '+91', number: '9876543210' })).toBeNull();
    expect(v.validateMobile({ country: '', number: '98' })).toMatch(/country code/);
    expect(v.validateOtp('12345')).toMatch(/all 6 digits/);
    expect(v.validateCountry({ code: 'IN' })).toBeNull();
    expect(v.validateCountry({ code: 'India' })).toMatch(/Select a country/);
  });

  it('collectErrors keeps only real messages', () => {
    expect(v.collectErrors({ a: null, b: 'Bad', c: undefined })).toEqual({ b: 'Bad' });
  });
});
