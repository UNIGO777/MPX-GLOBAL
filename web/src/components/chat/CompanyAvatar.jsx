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
      className={`${box} flex items-center justify-center bg-primary-50 font-bold text-primary-800 ring-1 ring-inset ring-primary-200`}
    >
      {initialsOf(name)}
    </span>
  );
}
