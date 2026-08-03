/**
 * Stable, machine-readable error codes returned as `error.code`.
 *
 * Why they exist: clients were branching on the English text of `error.message`
 * (`/too many attempts/i`, `/sign in again/i`). That couples a UI state — a
 * disabled OTP form, a "start over" panel — to copy that anyone may reword, and
 * it fails silently when they do.
 *
 * Rules:
 *  - A code is part of the API contract. Add one, never rename or repurpose one.
 *  - Codes carry NO detail beyond the discriminator — no user ids, no counts,
 *    no timing. `message` stays the only human-facing string, and both must stay
 *    generic enough not to reveal whether an account exists.
 *  - Only add a code where a client genuinely behaves differently. Most errors
 *    need nothing but their message.
 */
export const ERROR_CODES = {
  /** OTP attempt lock is in force (A3: five attempts, fifteen-minute lock). */
  OTP_LOCKED: 'OTP_LOCKED',
  /** The short-lived login-pending token is dead — the user must sign in again. */
  LOGIN_SESSION_EXPIRED: 'LOGIN_SESSION_EXPIRED',
  /** The pending signup is dead — the user must start signup again. */
  SIGNUP_SESSION_EXPIRED: 'SIGNUP_SESSION_EXPIRED',
  /** Refresh presented no token at all (no cookie, no body). */
  REFRESH_TOKEN_MISSING: 'REFRESH_TOKEN_MISSING',
  /** Refresh token unknown, reused, expired or revoked — the session is over. */
  SESSION_EXPIRED: 'SESSION_EXPIRED',
};
