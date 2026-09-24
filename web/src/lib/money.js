/**
 * Money at the client edge.
 *
 * 🔴 The wire and the server speak INTEGER MINOR UNITS. A user types major units
 * ("450.50"), so the conversion happens HERE, once, in two functions — not
 * inline in a form handler where the next field forgets to do it.
 *
 * `toMinor` rounds rather than truncating: `4.505 × 100` is `450.49999…` in
 * binary floating point, and truncating would quietly lose a paisa on values a
 * user typed exactly.
 */
export function toMinor(major) {
  const n = Number(major);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromMinor(minor) {
  return Number.isFinite(Number(minor)) ? Number(minor) / 100 : 0;
}

/** For an input's value — never shows "0" for an empty field. */
export function minorToInput(minor) {
  if (minor == null || minor === '') return '';
  return String(fromMinor(minor));
}

/**
 * `INR 24,85,000.00`. The ISO code is printed as-is — there is no currency
 * conversion anywhere in Phase 1 (§A27.1) and no symbol is guessed.
 */
export function formatMinor(minor, currency) {
  const value = fromMinor(minor);
  const digits = minor % 100 === 0 ? 0 : 2;
  return `${currency ?? ''} ${value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  })}`.trim();
}
