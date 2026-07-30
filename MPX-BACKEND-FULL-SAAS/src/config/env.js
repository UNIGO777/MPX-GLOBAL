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
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  // Shared store for rate limiting so limits survive restarts and hold across
  // processes. Required in production (enforced in rateLimit.js).
  REDIS_URL: z.string().url().optional(),
  // Number of trusted proxy hops in front of the app (e.g. 1 behind nginx/ELB).
  // Set in production so req.ip is the real client and rate limiting works.
  TRUST_PROXY: z.coerce.number().int().nonnegative().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
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
