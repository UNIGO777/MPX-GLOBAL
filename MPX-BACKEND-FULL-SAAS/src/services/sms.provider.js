import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Fast2SMS OTP transport.
 *
 * 🔴 SECURITY (auth-sessions A3, security-baseline #4): this module handles OTP
 * codes. It must never log one, never put one in an error message, and never
 * return one to a caller. Only the provider's request id and status are logged.
 *
 * 🔴 ENDPOINT: `/dev/otp/send` — Fast2SMS's **OTP API**, NOT the `bulkV2` SMS
 * API. They are different products with different bodies, and this is the one
 * `FAST2SMS_OTP_ID` belongs to. An earlier implementation used `bulkV2` with the
 * DLT route and the gateway answered **"Invalid Sender ID"**, because DLT
 * additionally needs an approved sender id this account does not have. This
 * endpoint needs none — it renders the account's approved OTP template.
 * (Established against the live gateway, 2026-08-04.)
 *
 * 🔴 INDIA ONLY — confirmed empirically, not assumed: an 11-digit US number is
 * rejected with *"The mobile must be 10 digits."* `canDeliverTo()` is the guard
 * callers use BEFORE choosing this transport. Do not "improve" it by stripping
 * the country code off an arbitrary number and hoping — that silently posts an
 * international user's number as if it were Indian, and their code never arrives.
 *
 * Uses global fetch (Node >= 18) — no new dependency.
 */

const FAST2SMS_ENDPOINT = 'https://www.fast2sms.com/dev/otp/send';
const REQUEST_TIMEOUT_MS = 10_000;

export function isSmsConfigured() {
  return Boolean(env.FAST2SMS_API_KEY && env.FAST2SMS_OTP_ID);
}

/**
 * Fast2SMS reaches Indian numbers only.
 * @param {string} e164 e.g. "+919876543210"
 */
export function canDeliverTo(e164) {
  return /^\+91\d{10}$/.test(String(e164 ?? ''));
}

/**
 * The endpoint wants the bare 10-digit subscriber number. It does also accept
 * `+91…`, but the bare form is what the reference implementation sends and it
 * leaves nothing for the gateway to interpret.
 */
function toIndianSubscriberNumber(e164) {
  const match = /^\+91(\d{10})$/.exec(String(e164 ?? ''));
  if (!match) throw new Error('fast2sms: not an Indian mobile number');
  return match[1];
}

/**
 * Sends one OTP.
 *
 * @param {{ to: string, code: string }} params `to` is E.164.
 * @returns {Promise<{ requestId: string|null }>}
 * @throws when the gateway rejects — the caller must surface a failure rather
 *   than leave a user waiting for a code that was never sent.
 */
export async function sendSms({ to, code }) {
  if (!isSmsConfigured()) {
    throw new Error('fast2sms: FAST2SMS_API_KEY / FAST2SMS_OTP_ID are not configured');
  }

  const mobile = toIndianSubscriberNumber(to);

  // 🔴 `otp_expiry` and `otp_length` are DERIVED from the server's own OTP
  // settings, never configured separately (owner decision, 2026-08-04). They only
  // tell Fast2SMS how to render its template; the code, its real lifetime and its
  // attempt limit are all ours. A second set of knobs would let the SMS advertise
  // a validity window the server does not honour.
  const payload = {
    mobile,
    otp_id: env.FAST2SMS_OTP_ID,
    otp_expiry: Math.max(1, Math.round(env.OTP_TTL_SECONDS / 60)),
    otp_length: env.OTP_LENGTH,
    otp: code,
  };

  let response;
  try {
    response = await fetch(FAST2SMS_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: env.FAST2SMS_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      // So a hung gateway cannot hold an auth request open.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // Deliberate: a fetch error can carry the request init, and our request body
    // contains the OTP. Attaching `cause` would put the code on the error chain,
    // where a crash reporter or a `cause`-walking log would surface it (A3).
    logger.error({ reason: cause?.name ?? 'error' }, 'fast2sms: request failed');
    // eslint-disable-next-line preserve-caught-error -- see above: `cause` would carry the OTP
    throw new Error('fast2sms: request failed');
  }

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.return !== true) {
    // The provider's own message is a rejection reason ("The mobile must be 10
    // digits.", "Invalid OTP ID") and does not echo our code. Never the body.
    logger.error(
      { status: response.status, providerMessage: body?.message ?? null },
      'fast2sms: send rejected',
    );
    throw new Error('fast2sms: gateway rejected the message');
  }

  const requestId = body?.request_id ?? null;
  logger.info({ requestId }, 'fast2sms: otp accepted');
  return { requestId };
}
