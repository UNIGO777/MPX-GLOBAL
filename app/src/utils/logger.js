/**
 * The app's only logging surface (G3).
 *
 * Two jobs:
 *  1. Redact before anything reaches the console or a future crash reporter.
 *     Tokens, OTPs, passwords, bank fields and KYC values must never appear in
 *     a log line, a breadcrumb or a crash report.
 *  2. Stay quiet in release builds. `debug`/`info` compile out via `__DEV__`;
 *     `warn`/`error` survive because a silent failure in production is worse
 *     than a redacted one — but they go through the same redactor.
 *
 * Redaction is the safety net, not a licence to log. Do not log a request body
 * "just to check" — the correct value to log is an identifier, not a payload.
 */

// Matched case-insensitively against object keys, as a substring: `accessToken`,
// `refresh_token`, `otpCode`, `bankAccountNumber` all hit.
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'auth',
  'cookie',
  'session',
  'otp',
  'code',
  'pin',
  'account',
  'accountnumber',
  'ifsc',
  'pan',
  'aadhaar',
  'aadhar',
  'gst',
  'tax',
  'kyc',
  'document',
  'signature',
  'apikey',
  'credential',
];

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

function isSensitiveKey(key) {
  const k = String(key).toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((p) => k.includes(p));
}

// A bare JWT or a long opaque token can arrive as a *value* with an innocent key
// (e.g. inside a URL or an error message), so values are scrubbed too.
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const LONG_OPAQUE = /\b[A-Fa-f0-9]{32,}\b/g;

function scrubString(value) {
  return value.replace(JWT, REDACTED).replace(BEARER, `Bearer ${REDACTED}`).replace(LONG_OPAQUE, REDACTED);
}

/**
 * Deep-copies `value` with sensitive keys and token-shaped strings replaced.
 * Cycles, depth and array length are all bounded so a logger call can never
 * become the thing that hangs the app.
 */
export function redact(value, depth = 0, seen = new WeakSet()) {
  if (value == null) return value;

  if (typeof value === 'string') return scrubString(value);
  if (typeof value !== 'object') return value;

  if (depth >= MAX_DEPTH) return '[truncated]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, depth + 1, seen));
  }

  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message) };
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1, seen);
  }
  return out;
}

function emit(level, message, context) {
  const args = context === undefined ? [message] : [message, redact(context)];
  // eslint-disable-next-line no-console -- this module IS the console boundary
  console[level](...args);
}

export const logger = {
  debug(message, context) {
    if (__DEV__) emit('log', message, context);
  },
  info(message, context) {
    if (__DEV__) emit('info', message, context);
  },
  // Kept in release builds: these are the lines a support ticket depends on.
  warn(message, context) {
    emit('warn', message, context);
  },
  error(message, context) {
    emit('error', message, context);
  },
};
