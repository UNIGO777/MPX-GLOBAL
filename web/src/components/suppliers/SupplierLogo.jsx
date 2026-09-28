/**
 * Logos for the SAMPLE suppliers on `/suppliers` and the landing preview.
 *
 * 🔴 Invented marks for invented companies — never a real company's logo
 * (owner asked for "real logos", 2026-09-28): a real brand's mark on a
 * fictional "verified" supplier would misrepresent that business and use its
 * trademark. Instead each sample company has its own designed identity so it
 * does not read as a placeholder: a filled emblem that says what they make,
 * its own container shape, colour and lettering.
 *
 * `brand` = { mark, color, shape: 'tile'|'circle'|'free', type: 'serif'|'caps'|'italic'|'wide'|'lower' }
 */
const MARKS = {
  // Veltora Textiles — a woven V crossed by a thread.
  weaveV: (
    <>
      <path d="M7 9h7.5L20 24.5 25.5 9H33L23.2 32h-6.4z" />
      <path d="M5 19.5c7-3.5 23-3.5 30 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
    </>
  ),
  // Kesarvan Agro — a saffron crocus.
  saffron: (
    <>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="20" cy="11.5" rx="4.2" ry="8.2" transform={`rotate(${r} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="3.4" fill="#FFD27A" />
    </>
  ),
  // Rangreza Apparel — a block-print paisley.
  paisley: (
    <>
      <path d="M23.5 5.5c7.5 2.5 11 10.5 8.3 18.2-2.9 8.2-11.8 12.3-19 9.4-5.4-2.1-7.4-8.2-4.3-12.3 2.3-3 6.7-2.9 8.1.3 3-3.4 3.2-8.4.3-12.3-1-1.4 2.6-4.3 6.6-3.3z" />
      <circle cx="22.5" cy="19" r="3" fill="#fff" opacity="0.85" />
    </>
  ),
  // Aranya Leather — a stitched shield.
  shield: (
    <>
      <path d="M20 4l13 4.5v10.8c0 8.3-5.8 13.9-13 16.7C12.8 33.2 7 27.6 7 19.3V8.5z" />
      <path d="M20 7.6l10 3.4v8.3c0 6.4-4.4 10.8-10 13-5.6-2.2-10-6.6-10-13V11z" fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="2 1.8" opacity="0.8" />
      <path d="M15 25l5-13 5 13M16.8 20.5h6.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Tirthank Polymers — a pipe in cross-section.
  pipe: (
    <>
      <circle cx="20" cy="20" r="15" />
      <circle cx="20" cy="20" r="9.5" fill="#fff" />
      <circle cx="20" cy="20" r="5.5" />
    </>
  ),
  // Nilvara Spice — peppercorns on a leaf.
  pepper: (
    <>
      <path d="M8 31C8 18 16 9 32 8c0 15-9 23-24 23z" opacity="0.35" />
      <circle cx="15" cy="17" r="4.6" />
      <circle cx="24" cy="15" r="4.2" />
      <circle cx="20" cy="24" r="4.6" />
    </>
  ),
  // Surajmukhi Solar — a sun over a panel grid.
  sun: (
    <>
      <circle cx="20" cy="15" r="6.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
        <rect key={r} x="19" y="3.2" width="2" height="4.3" rx="1" transform={`rotate(${r} 20 15)`} />
      ))}
      <path d="M6 27h28l-3 8H9z" opacity="0.9" />
      <path d="M13 27l-1.3 8M20 27v8M27 27l1.3 8M7.5 31h25" stroke="#fff" strokeWidth="1" opacity="0.7" />
    </>
  ),
  // Devika Handloom — a loom arch with its warp.
  loom: (
    <>
      <path d="M7 34V19a13 13 0 0 1 26 0v15h-4.5V19.5a8.5 8.5 0 0 0-17 0V34z" />
      <path d="M16 15v19M20 13v21M24 15v19" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  // Marutam Tools — a hex nut.
  nut: (
    <>
      <path d="M20 4.5l13.4 7.75v15.5L20 35.5 6.6 27.75v-15.5z" />
      <circle cx="20" cy="20" r="6.2" fill="#fff" />
    </>
  ),
  // Ojasvi Herbals — a leaf-drop with a vein.
  drop: (
    <>
      <path d="M20 4c7 8.5 11 14 11 18.5a11 11 0 0 1-22 0C9 18 13 12.5 20 4z" />
      <path d="M20 31V16M20 23l-4-3.5M20 20l3.6-3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  // Sagarika Home — rolling waves.
  waves: (
    <>
      <path d="M4 15c4-4.5 8-4.5 12 0s8 4.5 12 0 6-3 8-1" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M4 22.5c4-4.5 8-4.5 12 0s8 4.5 12 0 6-3 8-1" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" opacity="0.7" />
      <path d="M4 30c4-4.5 8-4.5 12 0s8 4.5 12 0 6-3 8-1" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" opacity="0.45" />
    </>
  ),
  // Vistaar Packaging — an isometric carton.
  box: (
    <>
      <path d="M20 5l14 7-14 7-14-7z" />
      <path d="M6 12l14 7v16L6 28z" opacity="0.7" />
      <path d="M34 12l-14 7v16l14-7z" opacity="0.45" />
    </>
  ),
};

/** The emblem alone, in the brand's container style. */
export function SupplierMark({ brand, className = 'h-12 w-12' }) {
  const shape = brand.shape ?? 'tile';
  const onColour = shape !== 'free';
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'} ${
        onColour ? 'text-white shadow-sm' : ''
      } ${className}`}
      style={onColour ? { backgroundColor: brand.color } : { color: brand.color }}
    >
      <svg viewBox="0 0 40 40" className={shape === 'free' ? 'h-[92%] w-[92%]' : 'h-[64%] w-[64%]'} fill="currentColor">
        {MARKS[brand.mark] ?? MARKS.nut}
      </svg>
    </span>
  );
}

const TYPE = {
  serif: { first: 'font-serif text-[22px] font-semibold tracking-tight', rest: 'text-[9.5px] font-semibold uppercase tracking-[0.3em]' },
  caps: { first: 'text-[18px] font-extrabold uppercase tracking-tight', rest: 'text-[9.5px] font-semibold uppercase tracking-[0.26em]' },
  italic: { first: 'font-serif text-[22px] font-semibold italic tracking-tight', rest: 'text-[9.5px] font-medium uppercase tracking-[0.28em]' },
  wide: { first: 'text-[15px] font-bold uppercase tracking-[0.22em]', rest: 'text-[9px] font-medium uppercase tracking-[0.32em]' },
  lower: { first: 'text-[21px] font-bold lowercase tracking-tight', rest: 'text-[9.5px] font-medium lowercase tracking-[0.18em]' },
};

/** Emblem + wordmark. The first word carries the brand; the rest is the descriptor. */
export function SupplierLogo({ name, brand, tone = 'light' }) {
  const [first, ...rest] = name.split(/\s+/);
  const t = TYPE[brand.type] ?? TYPE.caps;
  return (
    <span className="inline-flex items-center gap-2.5">
      <SupplierMark brand={brand} className={brand.shape === 'free' ? 'h-11 w-11' : 'h-11 w-11'} />
      <span className={`leading-none ${tone === 'light' ? 'text-ink-900' : 'text-white'}`}>
        <span className={`block ${t.first}`} style={tone === 'light' ? { color: brand.color } : undefined}>
          {first}
        </span>
        {rest.length > 0 && <span className={`mt-1 block text-ink-600 ${t.rest}`}>{rest.join(' ')}</span>}
      </span>
    </span>
  );
}
