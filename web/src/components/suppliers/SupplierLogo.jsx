/**
 * A company logo for the SAMPLE suppliers on `/suppliers` (owner, 2026-09-28:
 * "add logo there"): an emblem plus the name set as a wordmark, drawn in SVG so
 * it is sharp at any size. The companies are fictional, so are the logos —
 * simple geometric marks, nothing modelled on a real brand.
 *
 * `brand.mark` picks the emblem; `brand.color` is the company's own colour
 * (sample data, not a design-system token).
 */
const MARKS = {
  // Three interlaced threads — textiles.
  weave: (
    <>
      <path d="M6 12c4-6 8 6 12 0s8 6 12 0" />
      <path d="M6 20c4-6 8 6 12 0s8 6 12 0" />
      <path d="M6 28c4-6 8 6 12 0s8 6 12 0" />
    </>
  ),
  // A leaf with its vein — agriculture, spices.
  leaf: (
    <>
      <path d="M9 30c0-12 8-21 22-22 0 14-9 22-21 22z" />
      <path d="M10 29l13-13" />
    </>
  ),
  // A sun — solar.
  sun: (
    <>
      <circle cx="20" cy="20" r="6" />
      <path d="M20 6v4M20 30v4M6 20h4M30 20h4M10 10l3 3M27 27l3 3M30 10l-3 3M13 27l-3 3" />
    </>
  ),
  // A gear — tools, machinery.
  gear: (
    <>
      <circle cx="20" cy="20" r="5" />
      <path d="M20 7v5M20 28v5M7 20h5M28 20h5M11 11l3.5 3.5M25.5 25.5L29 29M29 11l-3.5 3.5M14.5 25.5L11 29" />
    </>
  ),
  // A drop — herbal, extracts.
  drop: <path d="M20 7c6 8 9 12 9 16a9 9 0 0 1-18 0c0-4 3-8 9-16z" />,
  // A hexagon — pipes, packaging.
  hex: (
    <>
      <path d="M20 6l12 7v14l-12 7-12-7V13z" />
      <path d="M20 13l6 3.5v7L20 27l-6-3.5v-7z" />
    </>
  ),
  // A diamond — leather, craft.
  diamond: (
    <>
      <path d="M20 6l13 14-13 14L7 20z" />
      <path d="M13.5 13h13" />
    </>
  ),
};

/** The emblem alone, on a tile of the brand colour. */
export function SupplierMark({ brand, className = 'h-12 w-12' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${className}`}
      style={{ backgroundColor: brand.color }}
    >
      <svg viewBox="0 0 40 40" className="h-[62%] w-[62%]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {MARKS[brand.mark] ?? MARKS.hex}
      </svg>
    </span>
  );
}

/** Emblem + wordmark: the company name, first word bold, the rest spaced caps. */
export function SupplierLogo({ name, brand, tone = 'light' }) {
  const [first, ...rest] = name.split(/\s+/);
  const ink = tone === 'light' ? 'text-ink-900' : 'text-white';
  return (
    <span className="inline-flex items-center gap-3">
      <SupplierMark brand={brand} />
      <span className={`leading-none ${ink}`}>
        <span className="block text-[19px] font-extrabold uppercase tracking-tight" style={tone === 'light' ? { color: brand.color } : undefined}>
          {first}
        </span>
        {rest.length > 0 && (
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.28em] opacity-80">{rest.join(' ')}</span>
        )}
      </span>
    </span>
  );
}
