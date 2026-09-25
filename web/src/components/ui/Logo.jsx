/**
 * The MPX Global wordmark — the ONLY place the brand lockup is built. Every
 * header, sidebar and auth panel renders this; nothing draws its own tile or
 * types the name as text.
 *
 * 🔴 NEW ARTWORK, 2026-09-22 — the navy-and-red lockup the owner supplied.
 * `brand-logo-blue.png` (the old blue-only mark) is gone; the variant KEY is
 * still called `blue` so the six call sites did not have to change, but it now
 * serves the navy-and-red artwork. Rename the key only if you are also touching
 * every caller.
 *
 * Two variants, and the rule is simply background contrast:
 *   `variant="blue"`  → WHITE / light surfaces (navy wordmark, red X, as drawn)
 *   `variant="white"` → DARK surfaces (all white)
 *
 * ⚠️ `white` is not a nicety any more, it is REQUIRED on the consoles. The
 * sidebar and top bar are `primary-800`, which is now a deep RED (#8A0311) —
 * the logo's own navy (#1A2E8F) on that red is close to unreadable. Any new
 * dark surface must use `variant="white"`.
 *
 * Both are transparent PNGs — the white background of the supplied file was
 * converted to alpha — so neither shows a box on a tinted surface such as the
 * canvas (`surface.subtle`) behind the mobile auth card.
 *
 * Sizing is by HEIGHT only; width follows the artwork so the mark can never
 * stretch, and both dimensions are set on the element to reserve space before
 * the image loads (no layout shift — web-design.md).
 */
/**
 * Measured from each file, not guessed — and PER VARIANT since 2026-09-25,
 * because the two artworks stopped matching: the navy-and-red mark was replaced
 * (998×407, ratio 2.452) while the white one is still the older 1200×597
 * (2.010). One shared constant then reserved a box ~20% too wide for the red
 * mark, and `object-contain` quietly letterboxed it — no distortion, just a
 * gap that reads as bad spacing.
 *
 * 🔴 If either PNG is replaced, re-measure it here. `object-contain` hides a
 * wrong number rather than breaking, which is exactly why it goes unnoticed.
 */
const ASPECT = {
  blue: 998 / 407,
  white: 1200 / 597,
};

const HEIGHTS = {
  // The quotation's paper preview in chat — a miniature page whose body text is
  // 5–7px, where even `sm` reads as a banner across the top.
  xs: 18,
  sm: 24, // dense bars (portal top bar, 56px tall)
  md: 32, // default — landing header, exporter signup bar
  lg: 40, // admin sidebar / 88px headers
  xl: 52, // auth panel brand
};

const SRC = {
  blue: '/brand-logo.png',
  white: '/brand-logo-white.png',
};

export function Logo({ size = 'md', variant = 'blue', className = '' }) {
  const height = HEIGHTS[size] ?? HEIGHTS.md;
  const width = Math.round(height * (ASPECT[variant] ?? ASPECT.blue));

  return (
    <img
      src={SRC[variant] ?? SRC.blue}
      alt="MPX Global"
      width={width}
      height={height}
      style={{ height, width }}
      className={`block max-w-full object-contain ${className}`}
    />
  );
}
