import { env } from '../config/env.js';

/**
 * Secret redaction for text that gets PERSISTED and later shown to staff.
 *
 * Why this exists: `errorLogs` stores `err.message` and `err.stack` verbatim, and
 * F5's viewer now shows both to anyone holding `errorlog:read`. Some driver
 * errors embed a credential in their own message — a Mongo connection failure
 * quotes the connection string, which in production carries the database
 * username and password (§A26: self-hosted Mongo with auth on). Persisting that
 * would put a live credential into a collection staff can browse, which
 * `secrets-and-hygiene.md` forbids outright.
 *
 * Redaction runs at the WRITE site, never at the read site — the same reasoning
 * as the audit view's note: the write site is the only place the guarantee can be
 * complete, because a value redacted before storage cannot leak from a backup, a
 * `mongodump`, or a future second reader.
 *
 * This is a safety net, not a licence to log secrets deliberately.
 */

const REDACTED = '[redacted]';

// Matching the ACTUAL configured value is the only redaction an unexpected error
// format cannot defeat — a pattern can be evaded, an exact string cannot.
const SECRET_ENV_KEYS = [
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'OTP_SECRET',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'OPENAI_API_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'PAYMENT_API_KEY',
  'PAYMENT_API_SECRET',
  'PAYMENT_WEBHOOK_SECRET',
  'SEED_SUPERADMIN_PASSWORD',
];

// Below this length a "secret" is more likely to be a common substring, and
// replacing every occurrence of it would corrupt the message it is meant to
// protect. Real secrets on this project are far longer (JWT secrets are >= 32).
const MIN_SECRET_LENGTH = 8;

// `user:pass@host` inside any URI scheme. Catches a connection string even when
// the driver has rewritten it, and covers REDIS_URL and PAYMENT_API_BASE_URL too.
const URI_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi;

// A JWT — ours or a provider's. Three base64url segments after the `eyJ` that
// every JSON header encodes to.
const JWT_LIKE = /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g;

const BEARER = /(bearer\s+)[A-Za-z0-9._~+/-]{8,}=*/gi;

let cachedSecrets = null;

function secretValues() {
  if (cachedSecrets) return cachedSecrets;
  cachedSecrets = SECRET_ENV_KEYS.map((key) => env[key])
    .filter((value) => typeof value === 'string' && value.length >= MIN_SECRET_LENGTH)
    // Longest first: redact the full connection string before a secret that
    // happens to be a substring of it, or the leftover fragment survives.
    .sort((a, b) => b.length - a.length);
  return cachedSecrets;
}

/**
 * Remove known secrets from a free-text string. Returns the input unchanged when
 * it is not a non-empty string, so it is safe to call on an absent stack.
 */
export function redactSecrets(text) {
  if (typeof text !== 'string' || text.length === 0) return text;

  let out = text;
  // `replaceAll` with a string pattern is a LITERAL replace — a secret containing
  // regex metacharacters cannot turn into a pattern here.
  for (const secret of secretValues()) out = out.replaceAll(secret, REDACTED);

  out = out.replace(URI_CREDENTIALS, `$1${REDACTED}:${REDACTED}@`);
  out = out.replace(JWT_LIKE, REDACTED);
  out = out.replace(BEARER, `$1${REDACTED}`);
  return out;
}

// Tests only: env is read once and memoised, so a test that changes a secret
// after import needs a way to drop the cache.
export function resetRedactionCache() {
  cachedSecrets = null;
}
