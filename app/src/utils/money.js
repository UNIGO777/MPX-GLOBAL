/**
 * Money at the app's edge — the same two rules the web client follows
 * (`web/src/lib/money.js`), because the two talk to one server.
 *
 * 🔴 The wire and the server speak INTEGER MINOR UNITS. A person types major
 * units ("450.50"), so the conversion happens HERE, once, and never inline in a
 * handler where the next one forgets.
 *
 * `toMinor` rounds rather than truncating: `4.505 × 100` is `450.49999…` in
 * binary floating point, and truncating would quietly lose a paisa on a value
 * somebody typed exactly.
 */
export function toMinor(major) {
  const n = Number(major);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromMinor(minor) {
  return Number.isFinite(Number(minor)) ? Number(minor) / 100 : 0;
}

/**
 * `INR 24,85,000`. The ISO code is printed as-is — there is no currency
 * conversion anywhere in Phase 1 (§A27.1) and no symbol is guessed.
 */
export function formatMinor(minor, currency) {
  const value = fromMinor(minor);
  const digits = Number(minor) % 100 === 0 ? 0 : 2;
  return `${currency ?? ''} ${value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  })}`.trim();
}

/**
 * The server's ceiling (`quotation.validators.js` MAX_MINOR), mirrored so a
 * typo is caught in the box instead of costing a round trip. The server stays
 * the authority.
 */
export const MAX_MINOR = 1_000_000_000_000;
