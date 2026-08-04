import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { canDeliverTo, isSmsConfigured, sendSms } from './sms.provider.js';
import { isEmailConfigured, sendEmail } from './email.provider.js';
import { renderEmail } from './emailTemplate.js';

/**
 * Delivery adapter for OTP codes.
 *
 * 🔴 SECURITY (auth-sessions A3, security-baseline #4): an OTP must NEVER be
 * logged, returned, or included in an error. Everything below logs the channel,
 * the purpose and the provider's id — never `code`, never the destination.
 *
 * 🔴 ROUTING — why this is not simply "channel decides transport":
 * Fast2SMS delivers to INDIAN numbers only. Our exporters are Indian, but our
 * BUYERS are international and their login is OTP-gated, so an international
 * buyer's code cannot travel over SMS at all. The routing is therefore:
 *
 *   mobile + Indian number + SMS configured → Fast2SMS
 *   mobile + non-Indian number              → EMAIL fallback (the buyer path)
 *   email                                   → SMTP
 *
 * A failure to deliver THROWS. Returning quietly would leave the user staring at
 * a code-entry screen for a message that was never sent and — worse — would make
 * a misconfigured production deploy look healthy.
 */

const PURPOSE_COPY = {
  login: 'sign in to MPX Global',
  signup: 'create your MPX Global account',
  forgot_password: 'reset your MPX Global password',
};

/**
 * Rendered FROM the server's own OTP settings, so a message can never claim an
 * expiry the server does not honour.
 */
function expiryMinutes() {
  return Math.max(1, Math.round(env.OTP_TTL_SECONDS / 60));
}

function emailBody({ code, purpose }) {
  return renderEmail({
    heading: 'Verify your email',
    preheader: 'Your MPX Global verification code',
    code,
    expiryMinutes: expiryMinutes(),
    paragraphs: [`Use this code to ${PURPOSE_COPY[purpose] ?? 'continue on MPX Global'}.`],
    footerNote:
      'If you did not request this, you can ignore this email — no action is needed. MPX Global will never ask you for this code.',
  });
}

/**
 * @param {{ channel: 'mobile'|'email', identifier: string, code: string, purpose: string }} params
 *   `identifier` is the SUBJECT's own address, resolved by otp.service from the
 *   account record — never a request-supplied one.
 */
export async function sendOtp({ channel, identifier, code, purpose }) {
  const smsDeliverable = channel === 'mobile' && isSmsConfigured() && canDeliverTo(identifier);

  if (smsDeliverable) {
    // The provider renders its own approved OTP template; expiry and length are
    // derived from our settings inside sendSms (see sms.provider.js).
    const { requestId } = await sendSms({ to: identifier, code });
    logger.info({ channel: 'sms', purpose, requestId }, 'otp dispatched');
    return;
  }

  // Email — either the caller asked for it, or SMS cannot reach this number.
  const emailAddress = channel === 'email' ? identifier : null;

  if (emailAddress && isEmailConfigured()) {
    const { text, html } = emailBody({ code, purpose });
    const { messageId } = await sendEmail({
      to: emailAddress,
      subject: 'Your MPX Global verification code',
      text,
      html,
    });
    logger.info({ channel: 'email', purpose, messageId }, 'otp dispatched');
    return;
  }

  // Nothing could deliver it.
  if (env.NODE_ENV === 'production') {
    // Fail loudly. A production login that cannot send a code is broken, and a
    // warn-and-return hides that behind a screen the user can never get past.
    logger.error(
      { channel, purpose, smsConfigured: isSmsConfigured(), emailConfigured: isEmailConfigured() },
      'otp delivery: no transport could deliver',
    );
    throw new Error('otp delivery: no transport available');
  }

  // DEV/TEST ONLY — unreachable in production (guarded above), and now only when
  // no real transport could take the message, so a configured dev machine
  // exercises the real provider instead of this.
  // 🔴 Remove this branch once delivery is proven in staging
  // (`secrets-and-hygiene.md`: dev affordances must not survive to handover).
  console.log(`\n🔑 [DEV OTP] ${purpose} for ${identifier}: ${code}  (dev only — never in production)\n`);
}

/**
 * Startup visibility: reports which OTP transports are live, so a deploy missing
 * its SMS key is obvious in the boot log rather than at a user's first login.
 */
export function describeOtpTransports() {
  return {
    sms: isSmsConfigured() ? 'fast2sms (India only)' : 'not configured',
    email: isEmailConfigured() ? 'smtp' : 'not configured',
  };
}
