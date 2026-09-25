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
 * The SMTP server's own reply, with every email address removed.
 *
 * 🔴 Added 2026-09-25 after a production incident that could not be diagnosed
 * from the logs. A `554` was failing every OTP email; the code and responseCode
 * alone say "the server rejected the message" and nothing about WHY — the
 * reason ("Sender address rejected", "not owned by user", "domain not
 * verified") lives in this text, and we were throwing it away.
 *
 * Addresses are stripped because the reply routinely quotes the envelope, which
 * carries the recipient — a real person's address (security-baseline #4). What
 * is left is the provider's diagnosis, which is exactly what a debugger needs
 * and nobody's personal data. Truncated, because some servers reply with an
 * essay and a log line is not the place for it.
 */
const EMAIL_IN_TEXT = /[^\s<>@"]+@[^\s<>@",;]+/g;

function safeSmtpResponse(response) {
  if (typeof response !== 'string' || !response) return null;
  return response.replace(EMAIL_IN_TEXT, '<address>').slice(0, 300);
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
        // The SMTP command that failed (MAIL FROM / RCPT TO / DATA) — it alone
        // separates "sender not allowed" from "recipient refused".
        command: cause?.command ?? null,
        response: safeSmtpResponse(cause?.response),
        recipientDomain: domainOf(to),
      },
      'smtp: send failed',
    );
    // eslint-disable-next-line preserve-caught-error -- see above: `cause` would carry PII/the code
    throw new Error('smtp: message could not be sent');
  }
}

/**
 * Connects and authenticates WITHOUT sending, at boot.
 *
 * 🔴 It was written for "the startup self-check" and then never called by
 * anything — found on 2026-09-25, while a production SMTP failure was breaking
 * every OTP email and the boot log happily reported email as configured.
 * "Configured" and "working" are different facts and the log only had the first.
 *
 * ⚠️ Honest about its limit: `verify()` proves host, port, TLS and credentials.
 * It CANNOT catch a rejection that happens later, at message time — a provider
 * refusing the sender address (554) passes this check and still fails on every
 * send. For that, the send path's own `response` field is the diagnosis.
 */
export async function verifyEmailTransport() {
  if (!isEmailConfigured()) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch (cause) {
    logger.error(
      {
        code: cause?.code ?? null,
        responseCode: cause?.responseCode ?? null,
        response: safeSmtpResponse(cause?.response),
      },
      'smtp: transport verification failed — email OTP and notifications will not send',
    );
    return false;
  }
}
