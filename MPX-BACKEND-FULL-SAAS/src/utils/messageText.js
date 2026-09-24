/**
 * How stored chat text is PRESENTED (owner, 2026-09-24). Messages are
 * append-only (M4-13), so text written before a wording decision can never be
 * edited; these rules are applied where every client reads a message (the
 * message view and the inbox preview), so old and new threads read the same.
 */

// Step 1d · the notice staff routing leaves in a thread. ONE neutral line for
// both parties (owner, 2026-09-24) — it used to say "connected you with this
// supplier at your request", which is wrong on the seller's side.
export const ROUTED_NOTICE = 'MPX Global connected this buyer and supplier. Continue the conversation here as usual.';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** 'AU' → 'Australia'. Anything that is not a two-letter code passes through. */
export function countryName(code) {
  if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) return code;
  try {
    return regionNames.of(code) ?? code;
  } catch {
    // Intl throws on a malformed region code; the raw value is the honest fallback.
    return code;
  }
}

/**
 * An enquiry's composed first message used to store the country CODE
 * ("Delivery to: AU"). Show the name on the whole line only — a code inside a
 * user's own sentence is left alone.
 */
export function presentBody(body, { systemKind } = {}) {
  if (systemKind === 'routed') return ROUTED_NOTICE;
  if (typeof body !== 'string' || !body.includes('Delivery to: ')) return body;
  return body.replace(/^Delivery to: ([A-Z]{2})$/gm, (_m, code) => `Delivery to: ${countryName(code)}`);
}
