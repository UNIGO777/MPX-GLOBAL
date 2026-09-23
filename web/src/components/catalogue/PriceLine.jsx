/**
 * A product's price, in the seller's own terms.
 *
 * 🔴 THREE MODES, ALL EQUALLY NORMAL. `on_request` is the default for most
 * services and for any seller who quotes per order — it renders as ordinary
 * INFORMATION (primary blue, medium weight), never greyed or dimmed. Styling it
 * as an absence would make a large slice of the catalogue look broken.
 *
 * 🔴 NO CURRENCY CONVERSION EXISTS IN PHASE 1 (§A27.1). The ISO code is printed
 * exactly as the seller set it — never assume ₹, never convert, never guess a
 * symbol. A price is `{ mode, min, max, currency }` and `currency` is one of the
 * server's ISO-4217 allowlist.
 *
 * Money is never float-formatted here beyond thousands separators: no
 * arithmetic happens on a price anywhere in the client.
 */
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);

/**
 * ⚠️ A `tone="dark"` variant existed briefly on 2026-09-24, for a dark "deal
 * rail" on the search list-card. The owner had the black removed the same day,
 * leaving it unused, so it went with it. If a dark surface ever needs this
 * again: the defaults are unreadable there — `text-ink-900` on near-black is
 * invisible and `primary-600` measures ~2.3:1 — so it needs white amounts,
 * `ink-300` units and `primary-300` for the on-request line.
 */
export function PriceLine({ price, unit, size = 'md', className = '' }) {
  const { mode, min, max, currency } = price ?? {};

  const amountClass =
    size === 'lg'
      ? 'text-3xl font-bold text-ink-900'
      : size === 'sm'
        ? 'text-sm font-semibold text-ink-900'
        : size === 'base'
          ? 'text-base font-bold text-ink-900'
          : 'text-xl font-bold text-ink-900';
  const unitClass = size === 'lg' ? 'text-base font-normal text-muted' : 'text-sm font-normal text-muted';

  if (mode === 'on_request' || (min == null && max == null)) {
    return (
      <p className={`font-medium text-primary-600 ${size === 'lg' ? 'text-xl' : 'text-sm'} ${className}`}>
        Price on request
      </p>
    );
  }

  if (mode === 'range') {
    return (
      <p className={`${amountClass} ${className}`}>
        {currency} {fmt(min)} – {fmt(max)}
      </p>
    );
  }

  return (
    <p className={`${amountClass} ${className}`}>
      {currency} {fmt(min)}
      {unit && <span className={`ml-1.5 ${unitClass}`}>/ {unit}</span>}
    </p>
  );
}
