import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * SMTP transport for transactional email.
 *
 * 🔴 SECURITY (auth-sessions A3, security-baseline #4): this module carries OTP
 * codes and, later, KYC-adjacent status mail. It must never log a subject line
 * that could contain a code, never log a body, and never echo SMTP credentials.
 * Only the message id and the recipient's DOMAIN are logged — not the local
 * part, which is personal data.
 *
 * The transport is created lazily and reused: nodemailer pools connections, and
 * building one per send would make every login pay a TLS handshake.
 */

let transporter = null;

export function isEmailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isEmailConfigured()) throw new Error('smtp: transport is not configured');

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // false on 587 = STARTTLS upgrade; true on 465 = implicit TLS.
    secure: env.SMTP_SECURE ?? false,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // Never fall back to an unencrypted session: these credentials and the
    // codes they carry must not cross the wire in the clear.
    requireTLS: true,
    tls: { minVersion: 'TLSv1.2' },
    pool: true,
    maxConnections: 3,
  });

  return transporter;
}

/** Logged instead of the address itself — enough to debug delivery, not PII. */
function domainOf(address) {
  const at = String(address ?? '').lastIndexOf('@');
  return at === -1 ? 'unknown' : String(address).slice(at + 1);
}

/**
 * Sends one transactional email.
 *
 * @param {{ to: string, subject: string, text: string, html?: string }} message
 * @returns {Promise<{ messageId: string|null }>}
 * @throws when SMTP rejects — the caller must surface the failure rather than
 *   leave a user waiting for mail that was never sent.
 */
export async function sendEmail({ to, subject, text, html }) {
  const mailer = getTransporter();

  try {
    const info = await mailer.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
    logger.info({ messageId: info.messageId, recipientDomain: domainOf(to) }, 'smtp: message accepted');
    return { messageId: info.messageId ?? null };
  } catch (cause) {
    // Deliberate: a nodemailer error carries the envelope (recipient PII) and,
    // on some failure paths, the message it tried to send — which for an OTP
    // mail is the code itself. Attaching `cause` would put both on the error
    // chain. The fields that actually help debugging are logged here instead.
    logger.error(
      {
        code: cause?.code ?? null,
        responseCode: cause?.responseCode ?? null,
        recipientDomain: domainOf(to),
      },
      'smtp: send failed',
    );
    // eslint-disable-next-line preserve-caught-error -- see above: `cause` would carry PII/the code
    throw new Error('smtp: message could not be sent');
  }
}

/** Verifies credentials without sending. Used by the startup self-check. */
export async function verifyEmailTransport() {
  if (!isEmailConfigured()) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch (cause) {
    logger.error({ code: cause?.code ?? null }, 'smtp: transport verification failed');
    return false;
  }
}
