import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { NoImagePanel } from '../catalogue/NoImagePanel.jsx';
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons.jsx';

/**
 * Categories as circles in a horizontal rail (owner, 2026-09-26 — replaced the
 * twelve-card grid).
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
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 sm:gap-5"
      >
        {rows.map((c) => {
          const subs = c.subs?.length ?? 0;
          return (
            <li key={c.id} className="w-[104px] shrink-0 snap-start sm:w-[124px]">
              {loading ? (
                <>
                  <div className="aspect-square w-full animate-pulse rounded-full bg-ink-100 motion-reduce:animate-none" />
                  <div className="mx-auto mt-3 h-3 w-3/4 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
                </>
              ) : (
                <Link to={`/category/${c.slug ?? c.id}`} className="group block text-center">
                  <span className="block overflow-hidden rounded-full bg-ink-100 ring-1 ring-surface-border/70 transition duration-200 group-hover:ring-2 group-hover:ring-primary-500">
                    {c.image ? (
                      <img
                        src={c.image}
                        alt=""
                        loading="lazy"
                        width={248}
                        height={248}
                        className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      /* Falls back to the shared monogram panel rather than a
                         blank circle — a category with no photograph is normal
                         and should still read as a category. */
                      <NoImagePanel label={c.name} monogram ratio="aspect-square" />
                    )}
                  </span>
                  <span className="mt-2.5 block px-0.5">
                    <span className="line-clamp-2 text-[13px] font-bold leading-snug text-ink-900 group-hover:text-primary-700">
                      {c.name}
                    </span>
                    {subs > 0 && (
                      <span className="mt-0.5 block text-[11.5px] text-ink-500">
                        {subs} {subs === 1 ? 'subcategory' : 'subcategories'}
                      </span>
                    )}
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
