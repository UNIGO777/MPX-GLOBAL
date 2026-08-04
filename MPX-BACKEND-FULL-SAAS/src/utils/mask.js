/**
 * Masking for contact details shown back to a user.
 *
 * ONE definition, used by signup and by login, so the two flows cannot drift
 * into showing the same number two different ways.
 *
 * 🔴 These are display helpers, NOT a secrecy boundary. Only ever mask a value
 * for someone who has already proved they own the account (a completed signup,
 * or a correct password). Never return a mask from an endpoint that must not
 * reveal whether an account exists — `forgot-password` answers the same generic
 * sentence either way, and attaching a masked number to it would turn it into
 * an account-enumeration oracle.
 */

/** Digits kept visible at the end. Enough to recognise your own number. */
const VISIBLE_TRAILING_DIGITS = 3;

/**
 * `+919876500634` → `*********634`
 *
 * The country code is deliberately NOT shown: the point is only to let someone
 * recognise which of their numbers we used, and a shorter mask reveals less to
 * anyone reading over their shoulder.
 *
 * @param {string} e164
 * @returns {string}
 */
export function maskMobile(e164) {
  const digits = String(e164 ?? '').replace(/\D/g, '');
  if (digits.length <= VISIBLE_TRAILING_DIGITS) return '*'.repeat(6);

  const tail = digits.slice(-VISIBLE_TRAILING_DIGITS);
  return `${'*'.repeat(digits.length - VISIBLE_TRAILING_DIGITS)}${tail}`;
}

/**
 * `naman@gmail.com` → `n****@gmail.com`
 *
 * The domain stays readable so the user can tell which address it went to; the
 * local part is what identifies the person.
 *
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  const [local, domain] = String(email ?? '').split('@');
  if (!domain) return '***';

  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}
