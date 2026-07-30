import pino from 'pino';
import { env } from '../config/env.js';

// Fields that must never reach a log sink, in any shape. Paths cover the value
// at the top level and one level of nesting (`*.field`), plus the well-known
// request/response header locations. Extend this list before logging any new
// sensitive field — redaction is the control, not a convenience.
const REDACT_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'otp',
  '*.otp',
  'authorization',
  '*.authorization',
  'req.headers.authorization',
  'res.headers.authorization',
  'headers.authorization',
  'bankAccountNumber',
  '*.bankAccountNumber',
  'ifsc',
  '*.ifsc',
  'panNumber',
  '*.panNumber',
  'aadhaar',
  '*.aadhaar',
  'kyc',
  '*.kyc',
  // A19 backstop (M2): hash/KYC-reference/contact paths — redaction is the
  // safety net, not a licence to log these.
  'passwordHash',
  '*.passwordHash',
  'storageKey',
  '*.storageKey',
  'kycDocuments',
  '*.kycDocuments',
  'email',
  '*.email',
  'mobile',
  '*.mobile',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  // Pretty output in development only. Release builds emit newline-delimited
  // JSON with no pretty transport.
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});
