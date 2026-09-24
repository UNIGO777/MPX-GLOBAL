import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { featuredApi, featuredKeys } from '../../api/featured.js';
import { countryName } from '../../lib/countries.js';
import { LANDING_FEATURED_LIMITS } from '../../lib/featuredLimits.js';
import { VerifiedTick } from '../ui/VerifiedTick.jsx';
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons.jsx';

/**
 * M6 §4a — the landing page's curated content, fed by ONE public call
 * (`GET /public/featured`).
 *
 * 🆕 2026-09-25 — RESTORED to the landing (owner), no longer one block. It was
 * removed on 2026-08-23 after test curation reached the banner rotation; it now
 * comes back as pieces the landing places into its own sections, each with a
 * DEFAULT when nothing is curated (owner: "if no featured is there then
 * default"):
 *  - banners → a strip under the hero; none → no strip (the hero IS the default);
 *  - products → a "Featured products" row; none → "Recently listed" carries on;
 *  - categories → first in "Browse by category", topped up with the usual ones;
 *  - suppliers → a "Highlighted suppliers" row; none → nothing (the default
 *    suppliers section was removed by the owner on 2026-09-23).
 *
 * Rules from the brief, still load-bearing:
 *  - Self-healing is SILENT. The server already dropped anything taken down or
 *    blocked; nothing here renders an "unavailable" tile.
 *  - The cards are the SAME public cards as everywhere else. A featured card
 *    gets no extra fields; the payload is the same public projection.
 *  - Loading or an error yields EMPTY lists, i.e. the defaults — the landing
 *    never waits on, or breaks because of, curation.
 */
export function useLandingFeatured() {
  const featured = useQuery({
    queryKey: featuredKeys.landing,
    queryFn: featuredApi.landing,
    staleTime: 5 * 60 * 1000,
  });
  const d = featured.data;
  const L = LANDING_FEATURED_LIMITS;
  return {
    banners: (d?.banners ?? []).slice(0, L.banner),
    products: (d?.products ?? []).map((r) => r.product).slice(0, L.product),
    categories: (d?.categories ?? []).map((r) => r.category).slice(0, L.category),
    suppliers: (d?.suppliers ?? []).map((r) => r.supplier).slice(0, L.supplier),
  };
}

/** A banner's destination: relative → <Link>, absolute http(s) → <a>. */
function BannerShell({ linkUrl, className, children }) {
  if (!linkUrl) return <div className={className}>{children}</div>;
  return linkUrl.startsWith('/') ? (
    <Link to={linkUrl} className={className}>{children}</Link>
  ) : (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/**
 * ONE banner's picture + headline, shared by the landing strip and the admin
 * preview so the preview can never drift from what visitors see.
 *
 * `size` picks the class set. The landing uses 'responsive' (Tailwind
 * breakpoints follow the VIEWPORT). The preview needs 'desktop' / 'phone'
 * explicitly, because it draws both at once inside one window, where viewport
 * breakpoints would give both frames the same styling.
 */
const SLIDE = {
  responsive: {
    img: 'aspect-[16/7] w-full object-cover sm:aspect-auto sm:h-52 lg:h-56 2xl:h-64',
    band: 'p-4 pt-12 sm:p-7 sm:pt-16',
    title: 'text-base sm:text-2xl',
    sub: 'text-[13px] sm:text-sm',
  },
  desktop: { img: 'h-full w-full object-cover', band: 'p-7 pt-16', title: 'text-2xl', sub: 'text-sm' },
  phone: { img: 'h-full w-full object-cover', band: 'p-4 pt-12', title: 'text-base', sub: 'text-[13px]' },
};

export function BannerSlide({ banner, size = 'responsive' }) {
  const c = SLIDE[size];
  return (
    <>
      <img
        key={banner.id}
        src={banner.image}
        alt={banner.title ?? ''}
        // FIXED heights from sm up, not an aspect ratio (owner, 2026-09-25): a
        // ratio made the strip grow with the screen, ~340 px on a wide monitor.
        // Phones keep a ratio so the image isn't a sliver. Admin asks for a
        // 1800×400 image, which crops cleanly at every one of these.
        className={c.img}
        width={1800}
        height={400}
      />
      {(banner.title || banner.subtitle) && (
        <span className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/80 via-ink-900/35 to-transparent ${c.band}`}>
          {banner.title && <span className={`block font-extrabold leading-tight text-white ${c.title}`}>{banner.title}</span>}
          {banner.subtitle && <span className={`mt-1 block max-w-2xl text-white/85 ${c.sub}`}>{banner.subtitle}</span>}
        </span>
      )}
    </>
  );
}

/**
 * The banner rotation. Auto-advances every 6 s, but PAUSES while hovered or
 * focused and never runs under prefers-reduced-motion — moving content that a
 * reader cannot stop fails WCAG 2.2.2. Arrows and dots appear only with more
 * than one banner.
 */
export function BannerStrip({ banners }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const many = banners.length > 1;

  useEffect(() => {
    if (!many || paused) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [many, paused, banners.length]);

  const current = Math.min(index, banners.length - 1);
  const banner = banners[current];
  const go = (step) => setIndex((current + step + banners.length) % banners.length);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      <BannerShell
        linkUrl={banner.linkUrl}
        className="group relative block overflow-hidden rounded-2xl bg-ink-100 shadow-card"
      >
        <BannerSlide banner={banner} />
      </BannerShell>

      {many && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous banner"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-card hover:bg-white sm:flex"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next banner"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-card hover:bg-white sm:flex"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Choose a banner">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={`Banner ${i + 1} of ${banners.length}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all motion-reduce:transition-none ${
                  i === current ? 'w-6 bg-primary-600' : 'w-2 bg-ink-200 hover:bg-ink-300'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** A highlighted supplier: the public supplier card, identical fields. */
export function SupplierCard({ supplier: s }) {
  return (
    <Link
      to={`/supplier/${s.slug}`}
      className="group flex h-full items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-surface-border/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:ring-primary-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {s.logo ? (
        <img src={s.logo} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl border border-surface-border bg-white object-contain p-1" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-base font-bold text-primary-700">
          {s.name?.[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-bold text-ink-900 group-hover:text-primary-700">
          <span className="truncate">{s.name}</span>
          {s.verified && <VerifiedTick verified compact />}
        </span>
        <span className="block truncate text-xs text-ink-600">
          {[countryName(s.country) ?? s.country, `${s.productCount} listing${s.productCount === 1 ? '' : 's'}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </Link>
  );
}
