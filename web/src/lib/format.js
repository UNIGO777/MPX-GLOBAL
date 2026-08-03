// Small display helpers shared across screens.

import { config } from '../config.js';

const DATE_FMT = new Intl.DateTimeFormat(config.locale.dates, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const MONTH_FMT = new Intl.DateTimeFormat(config.locale.dates, { month: 'short', year: 'numeric' });

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

export function formatMonth(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : MONTH_FMT.format(d);
}

/**
 * Mask the identifier the user typed for the OTP screen ("+91 ••••• 43210" /
 * "ni••••@gmail.com"). The API never returns the destination, so this is
 * composed client-side from what the user entered.
 */
export function maskIdentifier(identifier) {
  const id = String(identifier ?? '').trim();
  if (!id) return 'your registered contact';
  if (id.includes('@')) {
    const [local, domain] = id.split('@');
    return `${local.slice(0, 2)}••••@${domain}`;
  }
  const digits = id.replace(/[^\d+]/g, '');
  if (digits.length >= 4) return `${digits.slice(0, 3)} ••••• ${digits.slice(-4)}`;
  return 'your registered contact';
}

/**
 * kycStatus → the shared four-state vocabulary. Raw status values never render
 * as-is anywhere a user sees them.
 */
export const KYC_STATUS_META = {
  pending: { label: 'Not submitted', tone: 'muted' },
  submitted: { label: 'In review', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Needs attention', tone: 'danger' },
};

/** The server's error envelope → a display message (+ requestId when present). */
export function apiError(err, fallback = 'Something went wrong. Please try again.') {
  const body = err?.response?.data?.error;
  return {
    message: body?.message ?? fallback,
    // Stable discriminator (server's ERROR_CODES) for the few states the UI must
    // react to. Branch on THIS, never on the wording of `message`.
    code: body?.code ?? null,
    requestId: body?.requestId ?? null,
    fields: body?.fields ?? [],
    status: err?.response?.status ?? null,
  };
}

/** Mirror of the server's src/utils/errorCodes.js — keep the two in step. */
export const ERROR_CODES = {
  OTP_LOCKED: 'OTP_LOCKED',
  LOGIN_SESSION_EXPIRED: 'LOGIN_SESSION_EXPIRED',
  SIGNUP_SESSION_EXPIRED: 'SIGNUP_SESSION_EXPIRED',
  REFRESH_TOKEN_MISSING: 'REFRESH_TOKEN_MISSING',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
};

/**
 * True when an error is `code`, tolerating a server that predates the code field
 * by falling back to the legacy prose match. The fallback is a migration
 * shim — delete it once every environment returns codes.
 */
export function isErrorCode(err, code, legacyPattern) {
  const { code: actual, message } = apiError(err, '');
  if (actual) return actual === code;
  return legacyPattern ? legacyPattern.test(message ?? '') : false;
}
