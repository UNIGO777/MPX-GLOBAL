import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { featuredApi, featuredKeys } from '../../api/featured.js';
import { countryName } from '../../lib/countries.js';
import { CategoryThumb } from './CategoryThumb.jsx';
import { ProductCard } from './ProductCard.jsx';
import { VerifiedTick } from '../ui/VerifiedTick.jsx';
import { ChevronRightIcon } from '../ui/icons.jsx';

/**
 * M6 §4a — the landing page's curated strips, fed by ONE public call
 * (`GET /public/featured`): banner rotation · featured products · featured
 * categories · highlighted suppliers.
 *
 * Rules from the brief, each load-bearing:
 *  - An EMPTY group hides its section entirely — before the owner curates
 *    anything the landing must look complete, not gappy. No "nothing featured"
 *    placeholder on a public page. (While loading or on error this component
 *    renders nothing, for the same reason.)
 *  - Self-healing is SILENT. The server already dropped anything taken down or
 *    blocked; nothing here renders an "unavailable" tile.
 *  - The cards are the SAME public cards as everywhere else — the shared
 *    ProductCard, /categories-style photo tiles, supplier cards. A featured
 *    card gets no extra fields; the payload is the same public projection.
 *  - The only new visual is the banner (image + title + subtitle + link).
 */

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

function BannerStrip({ banners }) {
  const [index, setIndex] = useState(0);
  const many = banners.length > 1;

  // Auto-advance, respecting prefers-reduced-motion (a CSS class cannot stop a
  // JS timer, so the preference is read directly).
  useEffect(() => {
    if (!many) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [many, banners.length]);

  const banner = banners[Math.min(index, banners.length - 1)];

  return (
    <div>
      <BannerShell
        linkUrl={banner.linkUrl}
        className="group relative block overflow-hidden rounded-2xl border border-surface-border shadow-card"
      >
        <img
          src={banner.image}
          alt={banner.title ?? ''}
          className="aspect-[16/6] w-full object-cover sm:aspect-[16/5]"
          width={1280}
          height={400}
        />
        {(banner.title || banner.subtitle) && (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/75 via-ink-900/35 to-transparent p-5 pt-14 sm:p-7 sm:pt-16">
            {banner.title && (
              <span className="block text-lg font-bold leading-tight text-white sm:text-2xl">{banner.title}</span>
            )}
            {banner.subtitle && (
              <span className="mt-1 block max-w-2xl text-[13px] text-white/85 sm:text-sm">{banner.subtitle}</span>
            )}
          </span>
        )}
      </BannerShell>

      {many && (
        <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Banners">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-primary-600' : 'w-2 bg-ink-200 hover:bg-ink-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StripHeading({ children, to, toLabel }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">{children}</h2>
      {to && (
        <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
          {toLabel}
          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function FeaturedStrips() {
  const featured = useQuery({
    queryKey: featuredKeys.landing,
    queryFn: featuredApi.landing,
    staleTime: 5 * 60 * 1000,
  });

  const data = featured.data;
  // Loading and error render NOTHING — the landing looks complete without this
  // block, and a skeleton here would promise content that may not exist.
  if (!data) return null;

  const banners = data.banners ?? [];
  const products = (data.products ?? []).map((r) => r.product);
  const categories = (data.categories ?? []).map((r) => r.category);
  const suppliers = (data.suppliers ?? []).map((r) => r.supplier);
  if (!banners.length && !products.length && !categories.length && !suppliers.length) return null;

  return (
    <section className="bg-surface-subtle px-4 py-12 sm:px-6 md:py-16" aria-label="Featured">
      <div className="mx-auto grid max-w-7xl gap-12">
        {banners.length > 0 && <BannerStrip banners={banners} />}

        {products.length > 0 && (
          <div>
            <StripHeading to="/search" toLabel="All products">
              Featured <span className="text-primary-600">Products</span>
            </StripHeading>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {products.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} to={`/product/${p.slug}`} />
              ))}
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <StripHeading to="/categories" toLabel="All categories">
              Featured <span className="text-primary-600">Categories</span>
            </StripHeading>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {categories.slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  to={`/category/${c.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-surface-border bg-white p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <CategoryThumb image={c.image} label={c.name} size="h-11 w-11" />
                  <span className="min-w-0 truncate text-sm font-semibold text-ink-900 group-hover:text-primary-700">
                    {c.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {suppliers.length > 0 && (
          <div>
            <StripHeading to="/search?type=supplier" toLabel="All suppliers">
              Highlighted <span className="text-primary-600">Suppliers</span>
            </StripHeading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {suppliers.slice(0, 4).map((s) => (
                <Link
                  key={s.id}
                  to={`/supplier/${s.slug}`}
                  className="group rounded-2xl border border-surface-border bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-center gap-3">
                    {s.logo ? (
                      <img src={s.logo} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl border border-surface-border bg-white object-contain p-1" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-base font-bold text-primary-700">
                        {s.name?.[0] ?? '?'}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold text-ink-900 group-hover:text-primary-700">
                        <span className="truncate">{s.name}</span>
                        {s.verified && <VerifiedTick verified compact />}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {[countryName(s.country) ?? s.country, `${s.productCount} listing${s.productCount === 1 ? '' : 's'}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
