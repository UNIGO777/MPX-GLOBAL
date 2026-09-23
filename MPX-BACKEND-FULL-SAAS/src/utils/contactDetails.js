/**
 * Does free text carry contact details — an email, a link or a phone number?
 *
 * Used on seller-written fields that reach the PUBLIC product page, where a
 * contact detail would route a buyer around the platform (and its enquiry
 * record) straight to the seller. It errs toward the obvious: a phone number is
 * a leading "+" followed by digits, or ten-plus digits in a run — so specs
 * like "Capacity 5000000", "2024-2025" or "ISO 9001" are not flagged.
 */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|in|net|org|io|co|biz|info|me|app)\b/i;
const PHONE = /\+\s*\d[\d\s().-]{6,}\d|\d(?:[\s().-]?\d){9,}/;

export function containsContactDetails(text) {
  const s = String(text ?? '');
  return EMAIL.test(s) || LINK.test(s) || PHONE.test(s);
}
