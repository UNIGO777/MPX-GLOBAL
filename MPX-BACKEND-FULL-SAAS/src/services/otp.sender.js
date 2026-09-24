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
  quotation_accept: 'confirm your acceptance of a quotation on MPX Global',
};

/**
 * Rendered FROM the server's own OTP settings, so a message can never claim an
 * expiry the server does not honour.
 */
const EMAIL_SUBJECT = {
  claim_org_email: 'Someone is trying to join your company on MPX Global',
  quotation_accept: 'Confirm your acceptance of a quotation',
};

function expiryMinutes() {
  return Math.max(1, Math.round(env.OTP_TTL_SECONDS / 60));
}

/**
 * D7 rule 6 · the code that lets someone JOIN a company, sent to the member
 * already in it.
 *
 * 🔴 Worded as an alarm, not a verification: it reaches the real owner BEFORE
 * anything has happened, and for a recycled-SIM attempt it is the only warning
 * they get (the owner dropped the SMS alert). It must say plainly that ignoring
 * it is safe, and it must say that the seller account will manage the company's
 * details — the buyer is handing that over by passing the code on (rule 7).
 *
 * Carries NO detail about the person asking — no name, no email, no number.
 * The recipient learns which of the company's identifiers was used, nothing
 * about who used it.
 */
function claimEmailBody({ code, context }) {
  const org = context?.orgName ?? 'your company';
  const via = context?.matchedOn === 'email' ? 'email address' : 'phone number';
  const handover =
    context?.joiningRole === 'exporter'
      ? 'If you pass this code on, the new seller account will manage the company\'s name, logo and verification documents from then on. Your own account and password are not affected.'
      : 'If you pass this code on, they will join as the company\'s buyer account. Your own account and password are not affected.';
  return renderEmail({
    heading: `Someone is trying to join ${org}`,
    preheader: `A request to join ${org} on MPX Global`,
    status: { tone: 'warning', label: 'Join request' },
    code,
    expiryMinutes: expiryMinutes(),
    paragraphs: [
      `Someone is trying to join **${org}** on MPX Global using your company's registered ${via}.`,
      'They need this code to continue. Only give it to a colleague you trust.',
      handover,
    ],
    footerNote:
      "If that wasn't you or someone you know, ignore this email — without the code nobody can join, and nothing changes.",
  });
}

/**
 * Confirming a quotation.
 *
 * 🔴 The email states WHAT is being confirmed — the quotation number, the other
 * company and the agreed figure. A bare "here is your code" would have someone
 * confirm a commercial commitment without ever seeing the number they are
 * agreeing to, which is the whole reason a second factor is here at all.
 *
 * 🔴 Never the word "sign" or "signature" (owner, 2026-09-25). This is an
 * acceptance record, not a digital signature under the IT Act — see the
 * `quotation_accept` note in models/enums.js.
 */
function quotationAcceptEmailBody({ code, context }) {
  const number = context?.number ?? 'a quotation';
  const counterparty = context?.counterpartyName;
  const amount = context?.amountText;
  return renderEmail({
    heading: 'Confirm your acceptance',
    preheader: `Your code to confirm quotation ${number}`,
    status: { tone: 'info', label: 'Quotation' },
    code,
    expiryMinutes: expiryMinutes(),
    paragraphs: [
      counterparty
        ? `You are confirming your acceptance of quotation **${number}** with **${counterparty}**.`
        : `You are confirming your acceptance of quotation **${number}**.`,
      ...(amount ? [`Agreed total: **${amount}**.`] : []),
      'Entering this code records your acceptance on both sides of the conversation. Do not enter it if any of the above is not what you agreed.',
    ],
    footerNote:
      'If you did not request this, ignore this email — without the code nothing is confirmed. MPX Global will never ask you for this code.',
  });
}

function emailBody({ code, purpose, context }) {
  if (purpose === 'claim_org_email') return claimEmailBody({ code, context });
  if (purpose === 'quotation_accept') return quotationAcceptEmailBody({ code, context });
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
 * DEV ONLY — echo the code to the terminal so a developer can complete a login
 * without a real SMS or inbox.
 *
 * 🔴 TWO INDEPENDENT LOCKS, both required:
 *   1. `NODE_ENV === 'development'` — not merely "non-production": `test` is
 *      excluded too, or every suite run would print thousands of codes.
 *   2. `OTP_DEV_PRINT=true` — explicit opt-in, defaulting to OFF.
 *
 * Lock 2 exists because lock 1 alone proved insufficient in practice: on
 * 2026-08-07 the LIVE api was found running without `NODE_ENV=production` (its
 * refresh cookie had no `Secure` flag), which means `env.js` had defaulted it to
 * `development` — one missing variable on one server away from writing real
 * users' codes into production logs. Two locks means a single misconfiguration
 * is no longer enough.
 *
 * 🔴 `console.log`, deliberately, NOT the logger — and this is the one place the
 * project's no-console rule is waived. The logger ships to files and
 * aggregators; a code written there would outlive the terminal and become the
 * exact A3 leak this file exists to prevent. stdout in a dev shell does not.
 *
 * Remove once delivery is proven in staging (`secrets-and-hygiene.md`: dev
 * affordances must not survive to handover).
 */
function devPrintOtp({ identifier, code, purpose }) {
  if (env.NODE_ENV !== 'development' || !env.OTP_DEV_PRINT) return;
  console.log(`\n🔑 [DEV OTP] ${purpose} for ${identifier}: ${code}  (dev only — never in production)\n`);
}

/**
 * @param {{ channel: 'mobile'|'email', identifier: string, code: string, purpose: string }} params
 *   `identifier` is the SUBJECT's own address, resolved by otp.service from the
 *   account record — never a request-supplied one.
 */
export async function sendOtp({ channel, identifier, code, purpose, fallbackEmail, context }) {
  // Printed BEFORE any transport is attempted, and regardless of whether one
  // succeeds. Previously this was a last resort that only fired when nothing
  // could deliver, so configuring SMTP silently took the code away from the
  // terminal — and a provider outage left a developer with no code at all,
  // which is precisely when they need one.
  devPrintOtp({ identifier, code, purpose });

  // 🔴 Fixed-code mode: send NOTHING. Added 2026-09-21 with `OTP_DEV_FIXED_CODE`.
  //
  // Two reasons, both real rather than tidiness:
  //   1. A seeded test account carries a made-up mobile number. `canDeliverTo`
  //      accepts anything shaped `+91` + 10 digits, so a dev box with Fast2SMS
  //      configured would post a REAL SMS to whoever actually owns it.
  //   2. If the provider rejects it instead, `sendSms` throws — and that throw
  //      propagates out of `requestOtp` and fails the login outright, which is
  //      exactly the demo these accounts exist for.
  //
  // The code is a known run of zeros; there is nothing to deliver.
  if (env.NODE_ENV === 'development' && env.OTP_DEV_FIXED_CODE) {
    logger.info({ channel, purpose }, 'otp delivery skipped — fixed dev code');
    return;
  }

  const smsDeliverable = channel === 'mobile' && isSmsConfigured() && canDeliverTo(identifier);

  if (smsDeliverable) {
    // The provider renders its own approved OTP template; expiry and length are
    // derived from our settings inside sendSms (see sms.provider.js).
    const { requestId } = await sendSms({ to: identifier, code });
    logger.info({ channel: 'sms', purpose, requestId }, 'otp dispatched');
    return;
  }

  // Email — either the caller asked for it, or SMS cannot reach this number.
  //
  // 🔴 FIXED 2026-09-23. This read `channel === 'email' ? identifier : null`,
  // which implemented only the first half of the sentence above: a mobile-channel
  // send that SMS could not deliver fell straight through to "no transport" and,
  // in production, THREW. Because `smsDeliverable` includes `isSmsConfigured()`,
  // that covered three real cases — a non-`+91` number (Fast2SMS is India-only),
  // a missing or wrong SMS key, and a half-finished provider swap — and in the
  // last two it locked out EVERY user, not just international ones. Login and
  // forgot-password both hard-code `channel: 'mobile'`, so neither had a way out.
  //
  // `fallbackEmail` is the SUBJECT's own address, resolved by `requestOtp` from
  // the user/pendingSignup record — never from anything the caller typed (A3).
  const emailAddress = channel === 'email' ? identifier : (fallbackEmail ?? null);

  if (emailAddress && isEmailConfigured()) {
    const { text, html } = emailBody({ code, purpose, context });
    const { messageId } = await sendEmail({
      to: emailAddress,
      subject: EMAIL_SUBJECT[purpose] ?? 'Your MPX Global verification code',
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

  // Non-production with no transport: the code was already printed above (in
  // development), so there is nothing left to do but let the caller continue.
  // Deliberately NOT a logger line — a "delivery failed" record must not tempt
  // anyone into attaching the code to it.
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
