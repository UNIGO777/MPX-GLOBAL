import { useCallback, useEffect, useState } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons.jsx';
import { SupplierMark } from './SupplierLogo.jsx';

/**
 * The "Verified suppliers" fan on `/suppliers` — OUR supplier cards, replacing
 * the Phoenix visa-approval artwork (client via owner, 2026-09-28). Same motion
 * as the landing's `SuccessShowcase`: the centre card full size in front, its
 * neighbours stepping back, shrinking and dropping away.
 *
 * Each card is the client's reference layout as real markup: brand bar, status
 * rule, location / NAME / company, a red stat band with the person standing
 * over it, and a details row. Choosing a card features that supplier in the
 * spotlight above (the page owns that).
 *
 * 🔴 Pauses on hover and focus; never auto-advances under reduced motion
 * (WCAG 2.2.2). Cards beyond two either side are hidden from AT and not
 * focusable. The stage clips — the outer cards are meant to be cut off, and
 * without the clip that would be page-level sideways scroll.
 */
const VISIBLE = 2;
const STEP_MS = 3800;

const place = (offset) => {
  const d = Math.abs(offset);
  return {
    // The -50% centring MUST live inside this transform (see SuccessShowcase).
    transform: `translateX(calc(-50% + ${offset * 72}%)) translateY(${d * 34}px) scale(${1 - d * 0.1})`,
    zIndex: 30 - d,
    opacity: d > VISIBLE ? 0 : 1,
  };
};

function FanCard({ s }) {
  const detail = (label) => s.details.find((d) => d.label === label)?.value;
  return (
    <div className="overflow-hidden rounded-2xl bg-white text-left shadow-lift ring-1 ring-ink-200/70">
      <div className="flex items-center justify-between bg-gradient-to-r from-primary-700 to-primary-600 px-4 py-2">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white">MPX Global</span>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/30">
          Verified supplier
        </span>
      </div>

      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-ink-600">
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-success-500" />
            Documents checked
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-ink-300" />
          <span className="rounded-full bg-ink-100 px-1.5 py-px text-ink-700">MPX verified</span>
        </div>

        <div className="relative">
          <div className="min-h-[96px] pr-[40%] pt-2.5">
            <p className="text-[11.5px] text-ink-500">{s.location}</p>
            <p className="text-[15px] font-bold uppercase leading-tight tracking-tight text-ink-900 sm:text-[16px]">
              {s.person?.name ?? s.name}
            </p>
            <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-ink-600">
              <span className="font-semibold text-ink-800">{s.name}</span> — {s.tagline}
            </p>
          </div>

          <div className="relative mt-2 flex items-stretch rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white">
            <div className="flex flex-col justify-center px-3 py-2.5">
              <span className="font-serif text-[32px] italic leading-none">{s.highlight.value}</span>
              <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/85">{s.highlight.label}</span>
            </div>
            <div aria-hidden="true" className="my-2.5 w-px bg-white/30" />
            <div className="flex min-w-0 flex-col justify-center py-2.5 pl-3 pr-[40%] text-[9.5px] leading-snug">
              <span className="font-bold uppercase">{s.category}</span>
              <span className="mt-0.5 text-white/85">{detail('Production capacity')}</span>
            </div>
          </div>

          {s.person?.photo && (
            <img
              src={s.person.photo}
              alt=""
              className="pointer-events-none absolute bottom-0 right-1 h-[150px] w-auto object-contain object-bottom sm:h-[165px]"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1.35fr_1fr] gap-2 p-4 pt-3">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2 ring-1 ring-ink-200/70">
          <span className="min-w-0">
            <span className="block text-[8px] font-semibold uppercase tracking-[0.12em] text-ink-500">Annual turnover</span>
            <span className="block truncate font-serif text-[15px] italic text-ink-900">{detail('Annual turnover')}</span>
          </span>
          {s.brand && <SupplierMark brand={s.brand} className="h-8 w-8" />}
        </div>
        <div className="rounded-xl bg-ink-50 px-3 py-2 text-[9px] ring-1 ring-ink-200/70">
          <span className="block text-ink-500">Speaks</span>
          <span className="block truncate font-semibold text-ink-900">{detail('Languages spoken')}</span>
          <span className="mt-0.5 block text-ink-500">Est. {s.established}</span>
        </div>
      </div>
    </div>
  );
}

export function SupplierCardFan({ suppliers, onSelect }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = suppliers.length;
  const go = useCallback((step) => setIndex((i) => (i + step + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => go(1), STEP_MS);
    return () => clearInterval(t);
  }, [paused, go, n]);

  return (
    <div
      className="relative mx-auto w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Verified suppliers"
    >
      {n > 1 && ['left', 'right'].map((side) => {
        const Icon = side === 'left' ? ChevronLeftIcon : ChevronRightIcon;
        return (
          <button
            key={side}
            type="button"
            onClick={() => go(side === 'left' ? -1 : 1)}
            aria-label={side === 'left' ? 'Previous supplier' : 'Next supplier'}
            className={`absolute top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-surface-border bg-white/90 text-ink-900 shadow-card backdrop-blur-sm transition hover:border-primary-600 hover:bg-white hover:text-primary-700 ${
              side === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}

      <div className="relative h-[400px] w-full overflow-hidden sm:h-[420px] lg:h-[430px]">
        {suppliers.map((s, i) => {
          let offset = i - index;
          if (offset > n / 2) offset -= n;
          if (offset < -n / 2) offset += n;
          const hidden = Math.abs(offset) > VISIBLE;
          return (
            <div
              key={s.key}
              aria-hidden={hidden}
              style={place(offset)}
              className={`absolute left-1/2 top-2 w-[280px] transition-all duration-500 ease-out motion-reduce:transition-none sm:w-[320px] lg:w-[350px] ${
                hidden ? 'pointer-events-none' : ''
              }`}
            >
              <button
                type="button"
                tabIndex={hidden ? -1 : 0}
                onClick={() => {
                  setIndex(i);
                  onSelect?.(s);
                }}
                aria-label={`Show ${s.person?.name ?? s.name} of ${s.name} in the spotlight`}
                className="block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/30"
              >
                <FanCard s={s} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
