/**
 * The MPX Global wordmark — the ONLY place the brand lockup is built. Every
 * header, sidebar and auth panel renders this; nothing draws its own tile or
 * types the name as text.
 *
 * Two supplied variants, and the rule is simply background contrast
 * (owner, 2026-08-03):
 *   `variant="blue"`  → for WHITE / light surfaces (blue mark, black "GLOBAL")
 *   `variant="white"` → for BLUE / dark surfaces (all white)
 * Both are transparent PNGs, so neither shows a box on a tinted surface such as
 * the canvas (#EAEEFF) behind the mobile auth card.
 *
 * Sizing is by HEIGHT only; width follows the artwork so the mark can never
 * stretch, and both dimensions are set on the element to reserve space before
 * the image loads (no layout shift — web-design.md).
 */
const ASPECT = 800 / 407;

const HEIGHTS = {
  sm: 24, // dense bars (portal top bar, 56px tall)
  md: 32, // default — landing header, exporter signup bar
  lg: 40, // admin sidebar / 88px headers
  xl: 52, // auth panel brand
};

const SRC = {
  blue: '/brand-logo-blue.png',
  white: '/brand-logo-white.png',
};

export function Logo({ size = 'md', variant = 'blue', className = '' }) {
  const height = HEIGHTS[size] ?? HEIGHTS.md;

  return (
    <img
      src={SRC[variant] ?? SRC.blue}
      alt="MPX Global"
      width={Math.round(height * ASPECT)}
      height={height}
      style={{ height, width: Math.round(height * ASPECT) }}
      className={`block max-w-full object-contain ${className}`}
    />
  );
}
