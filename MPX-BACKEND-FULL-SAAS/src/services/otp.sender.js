import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Delivery adapter for OTP codes. Real SMS / email / WhatsApp providers (on MPX
// Global's accounts) are not wired yet.
//
// SECURITY: an OTP must NEVER be logged or returned in production (auth-sessions
// A3, security-baseline rule 4). The dev/test terminal print below is a temporary
// convenience while no provider exists, and is HARD-GATED to non-production — it
// can never run in a production build. Remove it once real delivery is wired.
export async function sendOtp({ channel, identifier, code, purpose }) {
  if (env.NODE_ENV === 'production') {
    // TODO: integrate the real provider here. Do NOT log or return `code`.
    logger.warn({ channel, purpose }, 'otp delivery provider not configured');
    return;
  }

  // DEV/TEST ONLY — surfaces the OTP on the terminal so login can be completed
  // locally. Never reached in production (guarded above).
  console.log(`\n🔑 [DEV OTP] ${purpose} for ${identifier}: ${code}  (dev only — never in production)\n`);
}
