/**
 * The MPX Global wordmark — the ONLY place the brand lockup is built. Every
 * header, sidebar and auth panel renders this; nothing draws its own "M" tile
 * or types the name as text.
 *
 * Two files, one mark: the supplied logo's "GLOBAL" is near-black, so it
 * vanishes on the navy surfaces (primary-800 sidebars, top bars, auth panel).
 * `variant="light"` swaps to a copy whose neutral ink is white — the gold "MPX"
 * is untouched in both.
 *
 * Sizing is by HEIGHT only; width follows the 798x406 artwork so the mark can
 * never stretch, and both dimensions are set on the element to reserve space
 * before the image loads (no layout shift — web-design.md).
 */
const ASPECT = 798 / 406;

const HEIGHTS = {
  sm: 24, // dense bars (portal top bar, 56px tall)
  md: 32, // default — landing header, exporter signup bar
  lg: 40, // admin sidebar / 88px headers
  xl: 52, // auth panel brand
};

export function Logo({ size = 'md', variant = 'dark', className = '' }) {
  const height = HEIGHTS[size] ?? HEIGHTS.md;

  return (
    <img
      src={variant === 'light' ? '/logo-wordmark-light.png' : '/logo-wordmark.png'}
      alt="MPX Global"
      width={Math.round(height * ASPECT)}
      height={height}
      style={{ height, width: Math.round(height * ASPECT) }}
      className={`block max-w-full object-contain ${className}`}
    />
  );
}
