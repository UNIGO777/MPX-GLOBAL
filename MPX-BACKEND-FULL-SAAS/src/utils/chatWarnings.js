/**
 * Platform WARNINGS a staff member can post into a conversation (owner,
 * 2026-09-24 — a confirmed override of m4.md "admin can read, admin cannot
 * speak" and scope-of-work "monitoring (view-only)").
 *
 * 🔴 The override is NARROW, and this file is what keeps it narrow:
 *  - staff pick a KEY; the TEXT lives only here, on the server. There is no
 *    free-text path — staff never write into a thread (owner: "staff cannot
 *    write, just select the existing warning labels").
 *  - the notice speaks as the PLATFORM ("MPX Global"), never as a person
 *    (M4-17). Who sent it is in the audit log, not the thread.
 *  - a warning does not freeze anything; blocking stays a separate action.
 *
 * Adding or rewording a warning is a copy change, not a code change — but a
 * FREE-TEXT warning would be a new decision and needs its own alert.
 *
 * `tone` is what the warning IS, and decides how it looks (owner, 2026-09-24:
 * "change their colour to their nature"): reminder (calm slate) · caution
 * (amber) · serious (red) · final (deep red, "Final warning"). It travels as
 * the message's systemKind `warning_<tone>`, so a thread can tone each notice
 * without matching on its words.
 */
export const WARNING_TONES = ['reminder', 'caution', 'serious', 'final'];
export const CHAT_WARNINGS = {
  off_platform: {
    tone: 'reminder',
    label: 'Keep contact on the platform',
    body:
      'Please keep all communication, contact details and payments within MPX Global. Deals taken off the platform are not protected.',
  },
  conduct: {
    tone: 'caution',
    label: 'Respectful conduct',
    body:
      'Please keep this conversation professional and respectful. Continued abusive language may lead to this conversation being blocked.',
  },
  payment_safety: {
    tone: 'reminder',
    label: 'Payment safety',
    body:
      'For your safety, never pay a supplier through a link or account shared in chat. Confirm all terms in the enquiry first.',
  },
  suspicious: {
    tone: 'serious',
    label: 'Suspicious activity',
    body:
      "We've noticed activity in this conversation that may break our policies. Please review MPX Global's terms before continuing.",
  },
  accuracy: {
    tone: 'reminder',
    label: 'Accurate information',
    body:
      'Please make sure product details, prices and documents shared here are accurate. Misleading information may lead to action on your account.',
  },
  final: {
    tone: 'final',
    label: 'Final warning',
    body: 'This is a final warning. Further policy violations will result in this conversation being blocked.',
  },
};

export const CHAT_WARNING_KEYS = Object.keys(CHAT_WARNINGS);

/** The list as the admin UI shows it — key, label, the exact text that will post. */
export const chatWarningList = () =>
  CHAT_WARNING_KEYS.map((key) => ({
    key,
    tone: CHAT_WARNINGS[key].tone,
    label: CHAT_WARNINGS[key].label,
    body: CHAT_WARNINGS[key].body,
  }));
