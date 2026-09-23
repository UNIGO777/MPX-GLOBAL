/**
 * A company's icon — its uploaded logo, or its initials when it has none.
 *
 * 🔒 Companies, never people (M4-17). This is an ORGANISATION's mark: there are
 * no personal profile photos anywhere in this product, and the server does not
 * carry one to render.
 *
 * The monogram is not a placeholder to be replaced later — most companies will
 * never upload an icon, so it is a first-class state and has to look deliberate.
 */
const SIZES = {
  // For dense surfaces that show TWO companies at once — the admin list's
  // buyer × seller pair — where a 36px mark twice would crowd the row.
  xs: 'h-7 w-7 text-[10px] rounded-lg',
  sm: 'h-9 w-9 text-[12px] rounded-xl',
  md: 'h-10 w-10 text-[13px] rounded-xl',
  lg: 'h-11 w-11 text-sm rounded-xl',
};

export function initialsOf(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  );
}

/**
 * A muted colour PER COMPANY for the monogram (owner, 2026-09-24: "the chats
 * cannot be differentiated"). Every company used to get the same pink square, so
 * a list of chats was a column of identical marks. Now each name hashes to one
 * of eight soft tints — stable (same company, same colour, every screen),
 * quiet (tint + dark text, never a saturated block), and never the only
 * identifier (the name is always written beside it).
 *
 * Class strings are written out in full so Tailwind's scanner keeps them.
 */
const MONOGRAM_TONES = [
  'bg-sky-50 text-sky-800 ring-sky-200',
  'bg-teal-50 text-teal-800 ring-teal-200',
  'bg-violet-50 text-violet-800 ring-violet-200',
  'bg-amber-50 text-amber-800 ring-amber-200',
  'bg-emerald-50 text-emerald-800 ring-emerald-200',
  'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'bg-rose-50 text-rose-800 ring-rose-200',
  'bg-slate-100 text-slate-700 ring-slate-300',
];

export function monogramTone(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return MONOGRAM_TONES[h % MONOGRAM_TONES.length];
}

export function CompanyAvatar({ name, logo, size = 'md', className = '' }) {
  const box = `${SIZES[size] ?? SIZES.md} shrink-0 overflow-hidden ${className}`;

  if (logo) {
    return (
      <img
        src={logo}
        // Decorative: the company name is always written beside this, so
        // repeating it here would make a screen reader say it twice.
        alt=""
        loading="lazy"
        // 🔴 `object-contain`, not cover. A company mark is usually a WORDMARK on
        // a transparent or white canvas — cover fills the tile by cropping, which
        // eats the ends of the word and turns a logo into a smear. Contained and
        // padded, any aspect ratio lands intact; the ring keeps the tile visible
        // when the row behind it is white (the selected state).
        className={`${box} bg-white object-contain p-1 ring-1 ring-inset ring-ink-200`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${box} flex items-center justify-center font-bold ring-1 ring-inset ${monogramTone(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}
