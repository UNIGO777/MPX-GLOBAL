import { useCallback, useEffect, useState } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons.jsx';

/**
 * The card fan the owner sent (2026-09-28), auto-advancing: the centre card is
 * full size and in front, and its neighbours step back, shrink and drop away on
 * either side.
 *
 * 🔴 **These cards are ARTWORK FROM PHOENIX BUSINESS ADVISORY**, the same
 * brand's other site — confirmed by the owner, which is what settled the
 * branding question. They are finished images: every word on them is baked into
 * the picture.
 *
 * 🔴 **They are real, named people.** That is why each one carries its own `alt`
 * rather than `alt=""` — a screen reader gets the name, not silence — and why
 * the section must not describe them as something they are not. What each card
 * records is a **US L1 visa approval**, not a supplier verification on this
 * platform. See the note at the call site in `Landing.jsx`.
 *
 * 🔴 **It PAUSES on hover and on focus, and never runs under
 * `prefers-reduced-motion`.** Moving content a reader cannot stop fails WCAG
 * 2.2.2, and the arrows are the manual control. This follows `BannerStrip`,
 * which already carries the same rule on this page — the pattern is settled
 * here, so it is not re-decided per component.
 *
 * ⚠️ **Text inside an image is invisible to search.** Every name, city and
 * figure here is pixels, so none of it is indexable and none of it can be
 * translated or resized by a reader who needs larger type. That is the cost of
 * finished artwork over markup, and the reason to rebuild these as components
 * if this section ever has to do SEO work.
 *
 * ⚠️ 17 images, ~876KB in total. Only the five around the centre are rendered at
 * any moment, and all are `loading="lazy"` — the section sits well down the
 * page, so nothing here is fetched before a visitor scrolls to it.
 */
const CARDS = [
  'amandeep-bhullar',
  'chetankumar-patel',
  'darpan-patel',
  'dipak-patel',
  'harmeet-singh-visa',
  'hasibur-rehman',
  'kalpesh-m-patel',
  'manas-biswas',
  'mehulkumar-patel',
  'nasir-maniar',
  'nikhil-pendalwar',
  'nirav-rabadiya',
  'rakesh-thakkar',
  'ronak-patel',
  'sandip-m-patel',
  'satvinder-singh',
  'vishal-khurmi',
];

/** How far out a card can sit before it stops being drawn at all. */
const VISIBLE = 2;
const STEP_MS = 3800;

/** `harmeet-singh-visa` → `Harmeet Singh`. The suffix is a file-naming artefact. */
const nameOf = (slug) =>
  slug
    .replace(/-visa$/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/**
 * Where a card sits, given how far it is from the centre.
 *
 * 🔴 **The `-50%` MUST be inside this transform.** Each card is `left-1/2`, and
 * a class like `-translate-x-1/2` cannot do the centring here: `transform` is a
 * single property, so an inline one replaces Tailwind's outright. That is
 * exactly what went wrong — the correction was silently dropped, every card's
 * LEFT EDGE sat on the centre line, and the whole fan stood half a card to the
 * right of where it belonged.
 *
 * 🔴 The three parts move TOGETHER and that is what reads as depth: a card that
 * only shrinks looks small, a card that only drops looks misplaced. Out from the
 * centre it steps sideways, scales down and falls.
 */
const place = (offset) => {
  const d = Math.abs(offset);
  return {
    transform: `translateX(calc(-50% + ${offset * 72}%)) translateY(${d * 34}px) scale(${1 - d * 0.1})`,
    zIndex: 30 - d,
    opacity: d > VISIBLE ? 0 : 1,
  };
};

export function SuccessShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = CARDS.length;

  const go = useCallback((step) => setIndex((i) => (i + step + n) % n), [n]);

  useEffect(() => {
    if (paused) return undefined;
    // Never auto-advance for someone who asked for less motion. Checked here
    // rather than in CSS because CSS cannot stop a timer.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => go(1), STEP_MS);
    return () => clearInterval(t);
  }, [paused, go]);

  return (
    <div
      className="relative mx-auto w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Approved cases"
    >
      {['left', 'right'].map((side) => {
        const Icon = side === 'left' ? ChevronLeftIcon : ChevronRightIcon;
        return (
          <button
            key={side}
            type="button"
            onClick={() => go(side === 'left' ? -1 : 1)}
            aria-label={side === 'left' ? 'Previous card' : 'Next card'}
            className={`absolute top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-surface-border bg-white/90 text-ink-900 shadow-card backdrop-blur-sm transition hover:bg-white hover:border-primary-600 hover:text-primary-700 ${
              side === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}

      {/* A fixed-height stage, because every card is absolutely positioned — with
          nothing in flow the container would collapse to zero. The height is the
          card's own ratio (826×786) at the widest step, plus the room the
          dropped side cards need. */}
      {/* 🔴 `overflow-hidden` is load-bearing. At this spread the outer cards run
          past the section — which is the reference's look, they are meant to be
          cut off — and without the clip that becomes horizontal scroll on the
          whole page, which `web-design.md` forbids outright. */}
      <div className="relative h-[290px] w-full overflow-hidden sm:h-[370px] lg:h-[440px]">
        {CARDS.map((slug, i) => {
          // Shortest way round the loop, so the fan wraps instead of unwinding.
          let offset = i - index;
          if (offset > n / 2) offset -= n;
          if (offset < -n / 2) offset += n;
          const d = Math.abs(offset);
          const hidden = d > VISIBLE;
          return (
            <div
              key={slug}
              aria-hidden={hidden}
              style={place(offset)}
              className={`absolute left-1/2 top-0 w-[230px] transition-all duration-500 ease-out sm:w-[300px] lg:w-[360px] ${
                hidden ? 'pointer-events-none' : ''
              } motion-reduce:transition-none`}
            >
              <img
                src={`/success/${slug}.webp`}
                /* A real name, not `alt=""`. These are identifiable people, and a
                   screen reader should hear who is on the card. */
                alt={`Approval card for ${nameOf(slug)}`}
                width={826}
                height={786}
                loading="lazy"
                className="w-full rounded-2xl bg-white shadow-lift ring-1 ring-surface-border/60"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
