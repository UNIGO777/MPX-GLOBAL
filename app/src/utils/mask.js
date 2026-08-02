/**
 * Masks the OTP destination for display: "sent to +91 ••••• 43210".
 *
 * The masking is cosmetic — the value being masked is one the user just typed,
 * so this is not a security control. It exists so a shoulder-surfer at a port
 * or a warehouse cannot read a full number off the screen, and so a screenshot
 * attached to a support ticket carries less.
 *
 * Never pass a value here that the user has NOT already seen; masking is not a
 * licence to display something private.
 */

export function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '•••';

  const head = local.slice(0, 1);
  const tail = local.length > 3 ? local.slice(-1) : '';
  return `${head}${'•'.repeat(Math.max(local.length - head.length - tail.length, 2))}${tail}@${domain}`;
}

export function maskMobile(mobile) {
  const digits = String(mobile).replace(/[^\d+]/g, '');
  if (digits.length < 4) return '•••';

  const last4 = digits.slice(-4);
  const dial = digits.startsWith('+') ? digits.slice(0, digits.length - 4).slice(0, 3) : '';
  return `${dial} ••••• ${last4}`.trim();
}

/** Picks the right mask for an identifier the user typed into a combined field. */
export function maskDestination(value) {
  if (!value) return '';
  return String(value).includes('@') ? maskEmail(value) : maskMobile(value);
}
