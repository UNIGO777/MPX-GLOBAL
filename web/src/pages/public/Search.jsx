import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { buildAppliedChips, FilterSidebar } from '../../components/catalogue/FilterSidebar.jsx';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { ProductListCard } from '../../components/catalogue/ProductListCard.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { AiSearchModal } from '../../components/search/AiSearchModal.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import {
  BoxIcon,
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FilterIcon,
  MapPinIcon,
  SearchIcon,
  SearchOffIcon,
  SparkleIcon,
  XIcon,
} from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';

/**
 * M3 web screen 2 — search results (`/search?q=…&type=product|supplier`).
 *
 * Deliberately `/category/:slug` MINUS the category constraint (build-plan
 * Phase 2): same flat toolbar, same Filters sheet/drawer, same cards, same
 * URL-state pattern — plus the two facet groups that page omits (category +
 * supplier country, both SINGLE-valued per the API) and a Products|Suppliers
 * type toggle.
 *
 * 🔴 SEO: this page is `noindex,follow` ALWAYS (m3-seo §4) — search result
 * URLs never enter the index and never the sitemap. No canonical games.
 *
 * 🔴 Zero results is THE designed state here: native `$text` matches whole
 * words only ("cott" finds nothing, by design §A26). The server answers with
 * `didYouMean: { term, categorySlug }` — rendered as a re-search link plus a
 * "browse {category}" secondary path. Never a dead-end.
 *
 * Supplier mode: the API rejects product-only params and price sorts, so the
 * UI never sends them — filters collapse to Verified + country, and the sort
 * control hides (server relevance order only).
 *
 * 🆕 2026-08-16 — M3 screen 3 (AI search, build-plan Phase 3) lands here too:
 * `AiSearchModal` converts its extraction into the SAME URL params this page
 * already reads (AI results are normal results, never a separate view), plus
 * a one-time router-state `{ aiAnswer, aiFallback }` for the answer banner.
 * The applied-filter chip row (previously only visible inside the Filters
 * drawer) is now ALSO shown directly on the page — `buildAppliedChips` is
 * shared with `FilterSidebar` so both stay in agreement — because AI-derived
 * filters need a visible, removable trail and `moqMin` (which the AI can set
 * but no manual widget exists for yet) needs a way to be undone at all.
 */
const PAGE_SIZE = 12;
const LIST_MOBILE = 'grid grid-cols-2 gap-3 md:hidden';
const LIST = 'hidden md:flex md:flex-col md:gap-5';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'newest', label: 'Newest first' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'priceDesc', label: 'Price: High to Low' },
];

const FILTER_KEY_RE = /^attr\[([^\]]+)\](?:\[(min|max)\])?$/;

function readAttrParams(searchParams) {
  const raw = {};
  const selections = {};
  for (const [k, v] of searchParams.entries()) {
    const m = k.match(FILTER_KEY_RE);
    if (!m) continue;
    raw[k] = v;
    const [, key, bound] = m;
    if (bound) selections[key] = { ...selections[key], [bound]: v };
    else selections[key] = v.split(',').filter(Boolean);
  }
  return { raw, selections };
}

/** Pure sort dropdown — same anatomy as `/category`'s SortMenu, plus the
 *  "relevance" default this endpoint has. */
function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (!e.target.closest?.('[data-sort-menu]')) setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open]);

  const pick = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHi(SORT_OPTIONS.indexOf(current));
      } else {
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setHi((h) => (h + d + SORT_OPTIONS.length) % SORT_OPTIONS.length);
      }
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      pick(SORT_OPTIONS[hi]);
    }
  };

  return (
    <div data-sort-menu className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setHi(SORT_OPTIONS.indexOf(current));
          setOpen((o) => !o);
        }}
        className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors hover:text-primary-700"
      >
        <span className="font-normal text-muted">Sort:</span>
        {current.label}
        <ChevronDownIcon className={`h-4 w-4 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" aria-label="Sort results" className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-surface-border bg-white py-1.5 shadow-lift">
          {SORT_OPTIONS.map((opt, i) => {
            const selected = opt.value === current.value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(opt)}
                  onPointerEnter={() => setHi(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm ${
                    i === hi ? 'bg-primary-50' : ''
                  } ${selected ? 'font-semibold text-primary-800' : 'text-ink-800'}`}
                >
                  {opt.label}
                  {selected && <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Supplier result row — the public seller projection only: logo/monogram,
 *  name + tick-or-nothing, country · entityType · member since, live listing
 *  count, one-line description. Whole row links to the profile. */
function SupplierRowCard({ supplier }) {
  return (
    <li>
      <Link
        to={`/supplier/${supplier.slug}`}
        className="flex items-center gap-4 rounded-xl border border-surface-border bg-white p-4 shadow-card transition-all hover:border-primary-600 hover:shadow-lift sm:p-5"
      >
        {supplier.logo ? (
          <img src={supplier.logo} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-surface-border" />
        ) : (
          <NoImagePanel label={supplier.name} monogram ratio="h-14 w-14" className="shrink-0 rounded-xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-bold text-ink-900">{supplier.name}</span>
            {supplier.verified && <VerifiedTick verified compact />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {supplier.country && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {countryName(supplier.country) ?? supplier.country}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <BuildingIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {supplier.entityType === 'individual' ? 'Individual' : 'Business'}
            </span>
            {supplier.memberSince && <span>Member since {supplier.memberSince}</span>}
            <span className="inline-flex items-center gap-1">
              <BoxIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {supplier.productCount} listing{supplier.productCount === 1 ? '' : 's'}
            </span>
          </div>
          {supplier.description && (
            <p className="mt-1.5 line-clamp-1 text-sm text-ink-600">{supplier.description}</p>
          )}
        </div>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
      </Link>
    </li>
  );
}

function CardSkeleton() {
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card md:flex-row">
      <Skeleton className="aspect-[4/3] w-full rounded-none md:aspect-auto md:h-56 md:w-[320px] lg:w-[300px] xl:w-[360px] 2xl:w-[400px]" />
      <div className="flex-1 space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-3.5 w-full" />
      </div>
    </li>
  );
}

function SupplierSkeleton() {
  return (
    <li className="flex items-center gap-4 rounded-xl border border-surface-border bg-white p-4 shadow-card sm:p-5">
      <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
    </li>
  );
}

/** Filters overlay — full-screen sheet <lg, right drawer lg+. Same mechanics
 *  as `/category`'s (2nd occurrence of that page-local pattern; a 3rd use
 *  should extract the shared hook per the duplicate-twice rule). */
function FiltersOverlay({ open, onClose, total, isPending, filterSidebarProps }) {
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.querySelector('[data-search-filters-close]')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Filters" className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 hidden cursor-default bg-ink-900/40 lg:block"
      />
      <div className="relative flex h-full w-full flex-col bg-white lg:ml-auto lg:max-w-md lg:shadow-lift">
        <header className="flex shrink-0 items-center justify-between border-b border-surface-border px-4 py-4">
          <h2 className="text-lg font-bold text-ink-900">Filters</h2>
          <button
            type="button"
            data-search-filters-close
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-surface-subtle"
          >
            <XIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <FilterSidebar {...filterSidebarProps} bare />
        </div>
        <footer className="shrink-0 border-t border-surface-border p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
          >
            {isPending ? 'Show results' : `Show ${total} result${total === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function Search() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  // AI search (screen 3) hands off its answer sentence via router state — a
  // fresh navigation, never URL-persisted (a cold reload of the SAME URL just
  // shows the normal filtered results; the sentence describes the moment the
  // AI ran, not a durable page state). Dismissible.
  //
  // 🔴 Must be an effect, not a lazy useState initializer: the AI trigger
  // lives ON this page, so submitting it is usually an IN-PLACE navigation
  // (same route — the component never remounts, only `location` changes). A
  // one-time initializer would miss every submission made from here.
  const [aiInfo, setAiInfo] = useState(null);
  useEffect(() => {
    if (location.state?.aiAnswer || location.state?.aiFallback) {
      setAiInfo({ answer: location.state.aiAnswer ?? null, fallback: Boolean(location.state.aiFallback) });
    }
    // Ordinary filter/sort navigations (setSearchParams) carry no state, so
    // they correctly leave whatever aiInfo is already showing untouched.
  }, [location.state]);
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const type = params.get('type') === 'supplier' ? 'supplier' : 'product';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const sort = params.get('sort') || 'relevance';
  const verifiedOnly = params.get('verified') === '1';
  const priceMin = params.get('priceMin') ?? '';
  const priceMax = params.get('priceMax') ?? '';
  const moqMin = params.get('moqMin') ?? '';
  const category = params.get('category');
  const country = params.get('country');
  const { raw: attrRawParams, selections: attrSelections } = readAttrParams(params);

  // The URL is the state — every setter drops `page` (a changed query
  // invalidates whatever page you were on). Same pattern as /category.
  const updateParams = (mutate) => {
    const next = new URLSearchParams(params);
    mutate(next);
    next.delete('page');
    setParams(next);
  };

  const submitQuery = (value) =>
    updateParams((next) => (value.trim() ? next.set('q', value.trim()) : next.delete('q')));

  const onTypeChange = (t) =>
    updateParams((next) => {
      t === 'supplier' ? next.set('type', 'supplier') : next.delete('type');
      // product-only params are REJECTED by the API in supplier mode — strip
      // them at the source instead of sending a 400.
      if (t === 'supplier') {
        for (const k of [...next.keys()]) {
          if (k === 'category' || k === 'priceMin' || k === 'priceMax' || k === 'moqMin' || FILTER_KEY_RE.test(k)) next.delete(k);
        }
        if (next.get('sort') === 'priceAsc' || next.get('sort') === 'priceDesc') next.delete('sort');
      }
    });

  const onToggleVerified = () =>
    updateParams((next) => (verifiedOnly ? next.delete('verified') : next.set('verified', '1')));
  const onPriceChange = (min, max) =>
    updateParams((next) => {
      min ? next.set('priceMin', min) : next.delete('priceMin');
      max ? next.set('priceMax', max) : next.delete('priceMax');
    });
  // No manual widget sets this yet (deferred — `FilterSidebar.jsx`'s own
  // comment on the prop) — AI search is currently the only thing that CAN
  // set it. Still needs a real setter so its chip is removable.
  const onMoqChange = (val) =>
    updateParams((next) => (val ? next.set('moqMin', val) : next.delete('moqMin')));
  const onAttrToggle = (key, value) =>
    updateParams((next) => {
      const current = (next.get(`attr[${key}]`) ?? '').split(',').filter(Boolean);
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      updated.length ? next.set(`attr[${key}]`, updated.join(',')) : next.delete(`attr[${key}]`);
    });
  const onAttrRangeChange = (key, min, max) =>
    updateParams((next) => {
      min ? next.set(`attr[${key}][min]`, min) : next.delete(`attr[${key}][min]`);
      max ? next.set(`attr[${key}][max]`, max) : next.delete(`attr[${key}][max]`);
    });
  const onCategoryChange = (slug) =>
    updateParams((next) => (slug ? next.set('category', slug) : next.delete('category')));
  const onCountryChange = (code) =>
    updateParams((next) => (code ? next.set('country', code) : next.delete('country')));
  const onClearAllFilters = () =>
    updateParams((next) => {
      for (const k of [...next.keys()]) {
        if (['verified', 'priceMin', 'priceMax', 'moqMin', 'category', 'country'].includes(k) || FILTER_KEY_RE.test(k)) next.delete(k);
      }
    });
  const onSortChange = (val) =>
    updateParams((next) => (val === 'relevance' ? next.delete('sort') : next.set('sort', val)));

  const activeFilterCount =
    (verifiedOnly ? 1 : 0) +
    (priceMin || priceMax ? 1 : 0) +
    (type === 'product' && moqMin ? 1 : 0) +
    (category ? 1 : 0) +
    (country ? 1 : 0) +
    Object.keys(attrSelections).length;
  const hasActiveFilters = activeFilterCount > 0;

  const searchParamsForApi = {
    ...(q ? { q } : {}),
    type,
    ...(type === 'product' && category ? { category } : {}),
    ...(country ? { country } : {}),
    ...(verifiedOnly ? { verifiedOnly: 'true' } : {}),
    ...(type === 'product' && priceMin ? { priceMin } : {}),
    ...(type === 'product' && priceMax ? { priceMax } : {}),
    ...(type === 'product' && moqMin ? { moqMin } : {}),
    ...(type === 'product' ? attrRawParams : {}),
  };

  const results = useQuery({
    queryKey: catalogueKeys.search({ ...searchParamsForApi, sort, page, pageSize: PAGE_SIZE }),
    queryFn: () => catalogueApi.search({ ...searchParamsForApi, sort, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev, prevQuery) => {
      // keep results on screen across filter tweaks, but never across a
      // type flip (product cards flashing behind supplier rows reads wrong)
      const prevType = prevQuery?.queryKey?.[2]?.type;
      return prevType === type ? prev : undefined;
    },
  });

  const facets = useQuery({
    queryKey: catalogueKeys.facets(searchParamsForApi),
    queryFn: () => catalogueApi.facets(searchParamsForApi),
    enabled: type === 'product',
  });

  // keep the input in sync when navigation changes q (back/forward, didYouMean)
  useEffect(() => setDraft(q), [q]);

  useEffect(() => {
    const previous = document.title;
    document.title = q ? `Search: ${q} — MPX Global` : 'Search — MPX Global';
    return () => { document.title = previous; };
  }, [q]);

  // m3-seo §4: search results are noindex,follow ALWAYS.
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,follow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  const data = results.data;
  const total = data?.total ?? 0;
  const rows = (type === 'supplier' ? data?.suppliers : data?.products) ?? [];
  const didYouMean = data?.didYouMean ?? null;

  const filterSidebarProps = {
    facets: facets.data?.facets,
    loading: type === 'product' && facets.isPending,
    verifiedOnly,
    priceMin,
    priceMax,
    attrSelections,
    onToggleVerified,
    onPriceChange,
    onAttrToggle,
    onAttrRangeChange,
    onClearAll: onClearAllFilters,
    ...(type === 'product'
      ? {
          selectedCategory: category,
          onCategoryChange,
          selectedCountry: country,
          onCountryChange,
          moqMin,
          onMoqChange,
        }
      : {
          // supplier mode: Verified + country only — the API rejects the rest
          selectedCountry: country,
          onCountryChange,
          facets: { country: facets.data?.facets?.country ?? [] },
          loading: false,
        }),
  };

  // Same chip list `FilterSidebar` renders inside its own drawer body, shown
  // here too so AI-derived filters (build-plan Phase 3's "extracted-filter
  // chip row") are visible without opening Filters — and so a moqMin the AI
  // set (no manual widget exists for it yet) is still removable at a glance.
  const appliedChips = buildAppliedChips({
    verifiedOnly,
    priceMin,
    priceMax,
    priceCurrency: facets.data?.facets?.price?.currency,
    attrSelections,
    attributes: facets.data?.facets?.attributes ?? [],
    onToggleVerified,
    onPriceChange,
    onAttrToggle,
    onAttrRangeChange,
    selectedCategory: type === 'product' ? category : null,
    onCategoryChange: type === 'product' ? onCategoryChange : null,
    categoryFacet: facets.data?.facets?.category ?? [],
    selectedCountry: country,
    onCountryChange,
    countryName,
    moqMin: type === 'product' ? moqMin : null,
    onMoqChange: type === 'product' ? onMoqChange : null,
  });

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1 bg-surface-subtle/50">
        <div className="w-full px-4 py-6 sm:px-6 md:py-8">
          {/* --- search bar --- */}
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
            <form
              role="search"
              className="relative flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitQuery(draft);
              }}
            >
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search products and suppliers"
                placeholder="Search products or suppliers…"
                className="h-12 w-full rounded-full border border-surface-border bg-white pl-11 pr-28 text-[15px] shadow-card outline-none placeholder:text-ink-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 flex h-9 -translate-y-1/2 items-center rounded-full bg-ink-900 px-5 text-sm font-semibold text-white hover:bg-primary-800"
              >
                Search
              </button>
            </form>
            {/* Guests can use AI search too — no sign-in gate on this button. */}
            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              className="flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-4 text-sm font-semibold text-primary-700 shadow-card transition-colors hover:border-primary-600 hover:bg-primary-100"
            >
              <SparkleIcon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">AI Search</span>
            </button>
          </div>

          {/* --- type toggle --- */}
          <div role="tablist" aria-label="Result type" className="mx-auto mt-4 flex w-fit rounded-full border border-surface-border bg-white p-1 shadow-sm">
            {[
              { key: 'product', label: 'Products' },
              { key: 'supplier', label: 'Suppliers' },
            ].map((t) => {
              const on = type === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => !on && onTypeChange(t.key)}
                  className={`min-h-[38px] rounded-full px-5 text-sm font-semibold transition-colors ${
                    on ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* --- AI answer panel (screen 3 result treatment) --- */}
          {aiInfo && (
            <div className="mx-auto mt-4 flex max-w-2xl items-start gap-2.5 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
              <SparkleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {/* Fallback: the AI step itself failed server-side — render as a
                  plain result, no apology, no error styling (m3 brief §3). */}
              <p className="flex-1">{aiInfo.fallback ? 'Showing keyword results.' : aiInfo.answer}</p>
              <button
                type="button"
                onClick={() => setAiInfo(null)}
                aria-label="Dismiss"
                className="shrink-0 text-primary-500 hover:text-primary-800"
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* --- flat toolbar --- */}
          <div className="mb-5 mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-surface-border pb-3">
            <div className="flex min-h-[44px] items-center gap-4">
              <span className="text-sm text-muted" aria-live="polite">
                {results.isSuccess
                  ? `${total} result${total === 1 ? '' : 's'}${q ? ` for “${q}”` : ''}`
                  : ' '}
              </span>
              <span aria-hidden="true" className="h-4 w-px bg-surface-border" />
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-primary-700"
              >
                <FilterIcon className="h-4 w-4" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1 text-xs font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            {type === 'product' && <SortMenu value={sort} onChange={onSortChange} />}
          </div>

          {appliedChips.length > 0 && (
            <div className="mb-5 -mt-2 flex flex-wrap items-center gap-2">
              {appliedChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 py-1 pl-3 pr-2 text-sm font-medium text-primary-700"
                >
                  {chip.label}
                  <XIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
              <button type="button" onClick={onClearAllFilters} className="text-sm font-medium text-primary-700 hover:underline">
                Clear all
              </button>
            </div>
          )}

          <AiSearchModal open={aiModalOpen} onClose={() => setAiModalOpen(false)} />

          <FiltersOverlay
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            total={total}
            isPending={results.isPending}
            filterSidebarProps={filterSidebarProps}
          />

          {/* --- states --- */}
          {results.isPending && (
            <>
              {type === 'product' ? (
                <>
                  <ul className={LIST_MOBILE} aria-busy="true" aria-label="Loading results">
                    {Array.from({ length: 4 }, (_, i) => (
                      <li key={i} className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
                        <Skeleton className="aspect-[4/3] w-full rounded-none" />
                        <div className="space-y-2 p-3.5">
                          <Skeleton className="h-4 w-4/5" />
                          <Skeleton className="h-5 w-2/3" />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <ul className={LIST} aria-busy="true" aria-label="Loading results">
                    {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
                  </ul>
                </>
              ) : (
                <ul className="flex flex-col gap-4" aria-busy="true" aria-label="Loading results">
                  {Array.from({ length: 4 }, (_, i) => <SupplierSkeleton key={i} />)}
                </ul>
              )}
            </>
          )}

          {results.isError && (
            <div className="rounded-2xl border border-surface-border bg-white shadow-card">
              <ErrorState
                title="We couldn't run this search"
                requestId={results.error?.response?.data?.error?.requestId}
                onRetry={results.refetch}
              />
            </div>
          )}

          {results.isSuccess && total === 0 && (
            <div className="rounded-2xl border border-surface-border bg-white shadow-card">
              <EmptyState
                icon={SearchOffIcon}
                title={q ? `No results for “${q}”` : 'No results'}
              >
                Search matches whole words — try a different word
                {hasActiveFilters ? ', or remove a filter' : ''}.
                {didYouMean?.term && (
                  <p className="mt-3 text-[15px]">
                    Did you mean{' '}
                    <button
                      type="button"
                      onClick={() => submitQuery(didYouMean.term)}
                      className="font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800"
                    >
                      {didYouMean.term}
                    </button>
                    ?
                    {didYouMean.categorySlug && (
                      <>
                        {' '}You can also browse{' '}
                        <Link
                          to={`/category/${didYouMean.categorySlug}`}
                          className="font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800"
                        >
                          the matching category
                        </Link>
                        .
                      </>
                    )}
                  </p>
                )}
                {hasActiveFilters && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={onClearAllFilters}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </EmptyState>
            </div>
          )}

          {results.isSuccess && total > 0 && (
            <>
              {type === 'product' ? (
                <>
                  <ul className={LIST_MOBILE}>
                    {rows.map((product) => (
                      <ProductCard key={product.id} product={product} to={`/product/${product.slug}`} />
                    ))}
                  </ul>
                  <ul className={LIST}>
                    {rows.map((product) => (
                      <ProductListCard key={product.id} product={product} to={`/product/${product.slug}`} />
                    ))}
                  </ul>
                </>
              ) : (
                <ul className="flex flex-col gap-4">
                  {rows.map((supplier) => (
                    <SupplierRowCard key={supplier.id} supplier={supplier} />
                  ))}
                </ul>
              )}
              <div className="mt-4">
                <Pagination
                  compact
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  onPage={(n) => setParams((prev) => {
                    const next = new URLSearchParams(prev);
                    n > 1 ? next.set('page', String(n)) : next.delete('page');
                    return next;
                  })}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
