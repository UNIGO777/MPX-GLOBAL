/**
 * Client-side form validation.
 *
 * ⚠️ For UX only. The backend's zod schemas are authoritative and re-validate
 * everything (`auth.validators.js`); these mirror them so a user finds a typo
 * before a round trip, never so the server can trust the client.
 *
 * Kept deliberately in step with the server's limits:
 *   name      1–120      email  RFC-ish, 3–200
 *   password  8–200      company 1–200
 *   mobile    countryCode 1–5, number 4–15
 *   country   exactly 2 (ISO alpha-2)
 */

import { PASSWORD_MIN_LENGTH } from '../components/PasswordStrength.jsx';

// Intentionally permissive: the server is the authority, and an over-strict
// client regex rejects valid addresses (plus-addressing, long TLDs, unicode).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateName(value) {
  const v = value.trim();
  if (!v) return 'Enter your full name.';
  if (v.length > 120) return 'Name is too long.';
  return null;
}

export function validateEmail(value) {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  if (v.length > 200 || !EMAIL.test(v)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(value) {
  if (!value) return 'Enter a password.';
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (value.length > 200) return 'Password is too long.';
  return null;
}

export function validateConfirmPassword(password, confirm) {
  if (!confirm) return 'Re-enter your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export function validateMobile({ country, number }) {
  if (!country) return 'Select a country code.';
  if (!number) return 'Enter your mobile number.';
  if (number.length < 4 || number.length > 15) return 'Enter a valid mobile number.';
  return null;
}

export function validateCompany(value) {
  const v = value.trim();
  if (!v) return 'Enter your company name.';
  if (v.length > 200) return 'Company name is too long.';
  return null;
}

export function validateCountry(country) {
  if (!country?.code || country.code.length !== 2) return 'Select a country.';
  return null;
}

/**
 * Login and reset accept an email OR a mobile in one field, so this only checks
 * that something plausible was entered. Which form it is, and whether it exists,
 * is the server's business — and the server deliberately answers identically
 * either way.
 */
export function validateIdentifier(value) {
  const v = value.trim();
  if (!v) return 'Enter your email or mobile number.';
  if (v.length < 3 || v.length > 200) return 'Enter a valid email or mobile number.';
  return null;
}

export function validateOtp(code, length = 6) {
  if (!code) return 'Enter the code.';
  if (code.length !== length) return `Enter all ${length} digits.`;
  return null;
}

/** Drops null/undefined entries so a caller can test `Object.keys(errors).length`. */
export function collectErrors(map) {
  return Object.fromEntries(Object.entries(map).filter(([, message]) => Boolean(message)));
}
