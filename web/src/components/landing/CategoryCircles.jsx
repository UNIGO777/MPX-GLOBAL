import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons.jsx';

const UPLOAD = '/image/upload/';

const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
/**
 * The tile is 124 CSS px wide at most, so ask Cloudinary for a picture that
 * FITS 248×260 (2× for retina; `c_fit`, not a crop, so a cut-out keeps its
 * whole outline and its transparency) instead of the full upload — full-size originals were
 * arriving visibly late as the page scrolled (owner, 2026-09-28). Non-
 * Cloudinary URLs pass through untouched.
 */
function archUrl(url) {
  const cut = url.indexOf(UPLOAD);
  if (cut === -1) return url;
  const at = cut + UPLOAD.length;
  return `${url.slice(0, at)}c_fit,w_248,h_260,q_auto,f_auto/${url.slice(at)}`;
}

/**
 * Categories as ARCH tiles in a horizontal rail (client reference via owner,
 * 2026-09-28 — a soft tinted arch holding the picture, the name under it; was
 * circles, which replaced the twelve-card grid on 2026-09-26).
 *
 * The picture stands OUT of a low arch (owner: "the arch is low and image goes
 * out of it, giving a 3D kind of effect"). ⚠️ That only works with TRANSPARENT
 * cut-out images (PNG/WebP with alpha): an ordinary photo keeps its background
 * and shows as a rectangle standing on the arch. Category images uploaded for
 * this rail need to be cut-outs.
 *
 * 🔴 **The arrows report the real scroll position.** They disable at each end
 * and appear only when there is actually something to scroll — a dead-looking
 * arrow that still responds, or a live-looking one that cannot move, is the
 * thing `web-ui-notes.md` forbids. The state comes from the element's own
 * `scrollLeft`, not from a guess about how many items fit.
 *
 * 🔴 **The rail scrolls INSIDE its own container**, never the page
 * (`web-design.md`: no horizontal body scroll), and it stays within the
 * section's own gutters so there is always white space at both ends. It briefly
 * bled to the viewport edge with negative margins; see the note above the `<ul>`
 * for why that was reverted.
 *
 * Keyboard needs nothing special: each circle is a link, so tabbing through
 * them scrolls the rail natively. The arrows are an addition for pointer users,
 * who otherwise have no way to scroll horizontally on a desktop without a
 * trackpad.
 */
export function CategoryCircles({ categories, loading = false, skeletonCount = 10 }) {
  const railRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    // 1px of slack: fractional scroll widths mean `scrollLeft + clientWidth`
    // lands a hair short of `scrollWidth` at the true end, which would leave the
    // right arrow enabled forever.
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // Re-measure when the rail resizes — a window resize changes how many fit,
    // and images arriving changes the width.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure, categories, loading]);

  const nudge = (direction) => {
    const el = railRef.current;
    if (!el) return;
    // 80% of a screenful, so something stays visible to anchor the eye rather
    // than the whole row swapping out.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const rows = loading ? Array.from({ length: skeletonCount }, (_, i) => ({ id: `s${i}` })) : categories;

  return (
    <div className="relative">
      {/* Arrows: pointer affordance only, and only where there is room for them.
          They are `hidden` below lg because a touch device swipes. */}
      {['left', 'right'].map((side) => {
        const enabled = side === 'left' ? canLeft : canRight;
        if (!canLeft && !canRight) return null; // nothing to scroll — no arrows at all
        const Icon = side === 'left' ? ChevronLeftIcon : ChevronRightIcon;
        return (
          <button
            key={side}
            type="button"
            onClick={() => nudge(side === 'left' ? -1 : 1)}
            disabled={!enabled}
            aria-label={side === 'left' ? 'Scroll categories left' : 'Scroll categories right'}
            className={`absolute top-[52px] z-10 hidden h-11 w-11 items-center justify-center rounded-full border border-surface-border bg-white shadow-card transition lg:flex ${
              side === 'left' ? '-left-5' : '-right-5'
            } ${enabled ? 'text-ink-900 hover:border-primary-600 hover:text-primary-700' : 'cursor-not-allowed text-ink-300'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}

      {/* 🔴 No negative-margin bleed. It used to be `-mx-4 px-4 …`, which pulled
          the rail out to the viewport edge so a circle could sit half-cut as a
          "there is more" hint — but once scrolled, circles ran flush into both
          screen edges and the row lost the page's gutter entirely (owner,
          2026-09-26: "make some space right and left"). The rail now sits inside
          the section's own padding, so there is always white on both sides and
          the arrows have somewhere to live. Items still clip at the container
          edge, which reads as continuation without touching the screen. */}
      <ul
        ref={railRef}
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1.5 sm:gap-5"
      >
        {rows.map((c) => {
          return (
            <li key={c.id} className="w-[104px] shrink-0 snap-start sm:w-[124px]">
              {loading ? (
                <>
                  <div className="mt-[28%] aspect-[20/15] w-full animate-pulse rounded-t-full rounded-b-2xl bg-ink-100 motion-reduce:animate-none" />
                  <div className="mx-auto mt-3 h-3 w-3/4 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
                </>
              ) : (
                <Link
                  to={`/category/${c.slug ?? c.id}`}
                  className="group block rounded-2xl text-center focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                >
                  {/* 🔴 Hover is a LIFT, not a coloured ring. It was
                      `group-hover:ring-2 group-hover:ring-primary-500` — a 2px
                      red circle drawn around a photograph, which read as
                      "selected" or "error" rather than "hoverable", and matched
                      nothing else on the page (every other card lifts and takes
                      a shadow). Red is this product's ACTION colour; spending it
                      on a hover state is the same kind of dilution as the green
                      card that had to be removed from the goods/services pair.

                      The hairline stays constant so a product shot on white
                      still has an edge; what changes is elevation, a slight zoom
                      on the image, and the label colour — three signals, none of
                      them a new colour. */}
                  {/* The arch is LOW (the bottom ~72% of the tile) and the
                      picture is the full tile height, anchored to the bottom —
                      so the product rises out of the arch's top (client
                      reference, owner 2026-09-28: "the arch is low and image
                      goes out of it"). On hover the picture lifts while the arch
                      stays put, which is what sells the depth. */}
                  <span className="relative block aspect-[20/21] w-full">
                    {/* Arch colour (owner, 2026-09-28): a LIGHT CORAL red —
                        primary-200 → primary-300 — after grey ("not fitting the
                        theme"), primary-50 ("looking pink"), 600 → 800 and
                        400 → 500 (both "too dark") were rejected.
                        It does NOT change on hover; depth comes from the
                        picture lifting. Cut-outs stand out strongly on it. */}
                    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[72%] rounded-t-full rounded-b-2xl bg-gradient-to-b from-primary-200 to-primary-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]" />
                    {c.image ? (
                      <img
                        src={archUrl(c.image)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={248}
                        height={260}
                        className="absolute inset-0 h-full w-full object-contain object-bottom drop-shadow-[0_8px_10px_rgb(0_5_23/0.12)] transition duration-300 group-hover:-translate-y-1.5 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100"
                      />
                    ) : (
                      /* No photograph is normal: the initials sit on the arch. */
                      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex h-[72%] items-center justify-center text-[24px] font-extrabold tracking-tight text-primary-800/70">
                        {initialsOf(c.name)}
                      </span>
                    )}
                  </span>
                  <span className="mt-2.5 line-clamp-2 block px-0.5 text-[13px] font-medium leading-snug text-ink-800 group-hover:text-primary-700">
                    {c.name}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
