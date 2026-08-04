import 'dotenv/config';
import { z } from 'zod';

// Validate process.env once, at startup. If a required variable is missing or
// malformed the process exits before the server can bind — a misconfigured
// payments-adjacent service must fail loudly, not run half-configured.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // Comma-separated list of allowed browser origins for CORS.
  CORS_ORIGINS: z.string().default(''),

  MONGODB_URI: z.string().min(1, 'is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  // Opaque refresh tokens live 7 days (auth-sessions A2). Absolute family
  // lifetime — rotation does not extend it. (A dead `JWT_REFRESH_TTL` var was
  // removed 2026-07-30 — this is the ONLY refresh-lifetime knob.)
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Feature integrations are optional until the step that wires each one, at
  // which point they should move up into the required set above.
  OTP_SECRET: z.string().optional(),
  OTP_STEP_SECONDS: z.coerce.number().int().positive().optional(),
  OTP_WINDOW: z.coerce.number().int().nonnegative().optional(),
  // Transactional OTP (auth-sessions A3): 6 digits, 5-min expiry, 5 attempts
  // then a 15-min lock.
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_LOCK_SECONDS: z.coerce.number().int().positive().default(900),
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  // KYC document size cap, in megabytes. ONE source of truth: both the multer
  // limit and the storage service read it, and the web client mirrors it for
  // copy only (VITE_KYC_MAX_MB) — the server is what actually enforces it.
  KYC_MAX_FILE_MB: z.coerce.number().int().positive().max(100).default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  // Shared store for rate limiting so limits survive restarts and hold across
  // processes. Required in production (enforced in rateLimit.js).
  REDIS_URL: z.string().url().optional(),
  // Number of trusted proxy hops in front of the app (e.g. 1 behind nginx/ELB).
  // Set in production so req.ip is the real client and rate limiting works.
  TRUST_PROXY: z.coerce.number().int().nonnegative().optional(),
  // M3: absolute origin of the PUBLIC WEB app — the sitemap emits
  // `${PUBLIC_WEB_URL}/product/<slug>` and robots.txt points at the sitemap, so
  // both are unusable without it. Defaulted for dev; set it in production.
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // M4-H · FCM push. The Firebase service account JSON, base64-encoded into a
  // single line so deployment needs only environment variables and no file.
  // Optional by design: with it absent the push layer is INERT — never a crash,
  // never a 5xx — the same posture as OPENAI_API_KEY.
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // --- OTP / notification delivery ------------------------------------------
  // Fast2SMS — transactional SMS for OTP codes.
  //
  // 🔴 INDIA ONLY. Fast2SMS delivers to Indian mobile numbers; its `numbers`
  // parameter takes 10-digit Indian MSISDNs. Our exporters are Indian, but our
  // BUYERS are international and their login is OTP-gated — so SMS alone cannot
  // carry the buyer path. `otp.sender.js` falls back to email for any non-+91
  // number, which is why SMTP is load-bearing rather than a nice-to-have.
  //
  // Optional by design: absent, the SMS path is INERT and the sender falls back
  // (dev prints to the terminal; production raises rather than silently
  // swallowing a code the user is waiting for). Same posture as OPENAI_API_KEY.
  FAST2SMS_API_KEY: z.string().optional(),
  // ⚠️ CURRENTLY UNUSED. We send on Fast2SMS's `route=otp`, which uses their own
  // approved OTP template and needs neither a template id nor a sender id — the
  // DLT route answered "Invalid Sender ID" on this account (verified against the
  // live gateway, 2026-08-04). Kept declared so an existing .env stays valid and
  // so the id is not lost: it becomes relevant only if a DLT sender id is
  // approved later, at which point `sms.provider.js` switches route and a
  // FAST2SMS_SENDER_ID joins it.
  FAST2SMS_OTP_ID: z.string().optional(),
  //
  // ⚠️ There is deliberately NO FAST2SMS_OTP_LENGTH / FAST2SMS_OTP_EXPIRY
  // (owner decision, 2026-08-04). `OTP_LENGTH` and `OTP_TTL_SECONDS` above are
  // the single source of truth for A3's 6-digit / 5-minute control, and the SMS
  // text is rendered FROM them — a second knob would let the message claim an
  // expiry the server does not honour. If those vars are still in your .env they
  // are ignored; delete them.

  // SMTP — transactional email (OTP by email, and the notification events the
  // owner un-deferred from D5 on 2026-08-04).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  // STARTTLS on 587 (secure=false) vs implicit TLS on 465 (secure=true).
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Public Cloudinary URLs for the email wordmark. Optional: when unset, the
  // template falls back to the text wordmark. WHITE = for the navy canopy (dark
  // bg); LOGO (coloured) = for light backgrounds (the footer).
  EMAIL_LOGO_URL: z.string().url().optional(),
  EMAIL_LOGO_WHITE_URL: z.string().url().optional(),

  PAYMENT_API_BASE_URL: z.string().url().optional(),
  PAYMENT_API_KEY: z.string().optional(),
  PAYMENT_API_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),

  // Used only by the superadmin seed script (npm run seed), not at runtime.
  SEED_SUPERADMIN_NAME: z.string().optional(),
  SEED_SUPERADMIN_EMAIL: z.string().optional(),
  SEED_SUPERADMIN_MOBILE_CC: z.string().optional(),
  SEED_SUPERADMIN_MOBILE_NUMBER: z.string().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Report which variables failed by name only — never their values, so a
  // secret can't leak into a crash log. The logger does not exist yet at this
  // point (it depends on validated env), so stderr is the only channel.
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`\nInvalid environment configuration:\n${details}\n`);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
