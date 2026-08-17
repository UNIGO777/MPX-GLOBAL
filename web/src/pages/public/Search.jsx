import { useEffect, useRef, useState } from 'react';
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
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import {
  BoxIcon,
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
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
 * 🆕 2026-08-16 (later) — restructured to standard search-page anatomy (owner):
 * left-aligned bar in a white header strip, UNDERLINE TABS on its border
 * ("Recommended" when nothing is searched → Products|Suppliers once a query
 * exists), and a status heading that narrates the search — "Analysing your
 * request…" while fetching, "Showing results for …", or "Did you mean …" on a
 * zero with a suggestion. No colour band, nothing centered.
 *
 * 🆕 2026-08-16 — M3 screen 3 (AI search, build-plan Phase 3) lands here too:
 * the `/ai-search` page converts its extraction into the SAME URL params this page
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

/** Curated starter searches (owner, 2026-08-16) — the same suggestion-chip
 *  pattern the AI modal's "Suggestions" row uses, but for plain keyword
 *  search. Keep these to terms the catalogue actually matches — a suggestion
 *  that lands on zero results reads as broken. */
const SUGGESTED_SEARCHES = ['cotton fabric', 'organic cotton', 'denim', 'cloud migration', 'medicines'];

/** Recent searches live in localStorage ONLY — plain search terms, nothing
 *  sensitive (web-frontend.md's storage ban covers tokens/PII, not these). */
const RECENT_KEY = 'mpx:recent-searches';
const RECENT_MAX = 5;

function readRecentSearches() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((t) => typeof t === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    // Private mode / disabled storage / corrupted value — start empty.
    return [];
  }
}

function writeRecentSearches(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode) — recents stay session-only.
  }
}

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
        <ul role="listbox" aria-label="Sort results" className="absolute right-0 z-40 mt-1 w-52 rounded-xl border border-surface-border bg-white py-1.5 shadow-lift">
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
        className="absolute inset-0 hidden cursor-default bg-ink-900/40 xl:block"
      />
      <div className="relative flex h-full w-full flex-col bg-white xl:ml-auto xl:max-w-md xl:shadow-lift">
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
          {/* Category + country are owned by the page's own controls (the
              related-categories box/chips and the country chip row, both
              visible at EVERY width), so the drawer deliberately omits them —
              otherwise a phone showed each of those filters twice. What is
              left here is exactly what the desktop rail shows. */}
          <FilterSidebar {...filterSidebarProps} bare compact />
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
  // "Lift up" entrance for the search bar (hero hand-off, 2026-08-16).
  const [entered, setEntered] = useState(false);
  const searchInputRef = useRef(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    // Focus only on a query-less landing (the hero hand-off case) — focusing
    // on a results visit would scroll-jack a page the buyer came to read.
    if (!new URLSearchParams(window.location.search).get('q')) {
      searchInputRef.current?.focus({ preventScroll: true });
    }
    return () => cancelAnimationFrame(raf);
  }, []);
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
  // Recent searches: every query that reaches the URL is remembered (that
  // covers typed submits, suggestion chips, didYouMean and AI hand-offs
  // alike), newest first, deduped, capped.
  const [recent, setRecent] = useState(readRecentSearches);
  useEffect(() => {
    if (!q) return;
    setRecent((prev) => {
      const next = [q, ...prev.filter((t) => t !== q)].slice(0, RECENT_MAX);
      writeRecentSearches(next);
      return next;
    });
  }, [q]);
  const removeRecent = (term) =>
    setRecent((prev) => {
      const next = prev.filter((t) => t !== term);
      writeRecentSearches(next);
      return next;
    });
  const clearRecent = () => {
    setRecent([]);
    writeRecentSearches([]);
  };
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

  // 🔴 A NEW search starts CLEAN (owner, 2026-08-17): submitting used to keep
  // whatever category/verified/price/attribute filters were already applied,
  // so searching "cotton fabric" while Silk fabric + verified were set
  // answered "0 results" and read as broken search. `type` is NOT a filter —
  // it is which KIND of result you are looking at — so it survives.
  const submitQuery = (value) => {
    const next = new URLSearchParams();
    if (type === 'supplier') next.set('type', 'supplier');
    if (value.trim()) next.set('q', value.trim());
    setParams(next);
  };

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

  // 🔴 Runs in BOTH modes. It used to be `enabled: type === 'product'`, while
  // supplier mode still passed a country facet down to the filter panel — a
  // facet that was therefore always empty, so the supplier country filter
  // could never appear at all (found 2026-08-17). `/public/facets` accepts
  // `type=supplier` and answers with exactly what that mode can filter on:
  // country + verified.
  const facets = useQuery({
    queryKey: catalogueKeys.facets(searchParamsForApi),
    queryFn: () => catalogueApi.facets(searchParamsForApi),
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
    loading: facets.isPending,
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
          // supplier mode: Verified + country only — the API rejects the rest,
          // and the facets call itself returns just those two groups.
          selectedCountry: country,
          onCountryChange,
        }),
  };

  // What the DRAWER shows (<xl). Category is always the page's own control
  // (the related-categories box/chips), so it never appears here. Country is
  // the page's chip row in PRODUCT mode only — supplier mode has no chip row,
  // so the drawer must keep country or that filter has no control at all.
  const drawerSidebarProps = {
    ...filterSidebarProps,
    onCategoryChange: null,
    ...(type === 'product' ? { onCountryChange: null } : {}),
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
    // 🔴 Category and country are DELIBERATELY absent from this row in product
    // mode (owner, 2026-08-17: "why showing categories again in filters here").
    // Both already render their selection on the page — the Related Categories
    // chip highlights with an ×, the country chip highlights — so repeating
    // them here showed the same filter twice, one above the other. Supplier
    // mode has no country chip row, so there the chip is the only way to see
    // and clear it and it stays.
    selectedCategory: null,
    onCategoryChange: null,
    categoryFacet: facets.data?.facets?.category ?? [],
    selectedCountry: type === 'supplier' ? country : null,
    onCountryChange: type === 'supplier' ? onCountryChange : null,
    countryName,
    moqMin: type === 'product' ? moqMin : null,
    onMoqChange: type === 'product' ? onMoqChange : null,
  });

  // Two-mode page (owner, 2026-08-16 full redesign): no query and no explicit
  // type = the DISCOVERY STAGE (centered display heading, grand pill, chip
  // rows, Recommended feed); a query — or supplier mode — is the RESULTS
  // WORKSPACE (compact console, sticky under the nav on lg+, segmented
  // Products|Suppliers control on the bar's own row).
  const searchMode = Boolean(q) || type === 'supplier';

  // One pill, two sizes — icon, input, AI trigger and submit inside a single
  // control. Rendered exactly once per mode (modes are exclusive), so the
  // input ref/autofocus stay valid. Keeps the hero hand-off "lift up"
  // entrance; motion-reduce gets no movement.
  const searchPill = (heightClass, { withRef = true } = {}) => (
    <div
      className={`flex w-full items-center gap-2 transition-all duration-300 ease-out motion-reduce:transition-none ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100'
      }`}
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitQuery(draft);
        }}
        className={`flex min-w-0 flex-1 items-center overflow-hidden rounded-full border border-surface-border bg-white shadow-card focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600/20 ${heightClass}`}
      >
        <SearchIcon className="ml-3 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
        <input
          ref={withRef ? searchInputRef : undefined}
          type="search"
          aria-label="Search products and suppliers"
          placeholder="Search products or suppliers…"
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-left text-[15px] outline-none placeholder:text-ink-400"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {/* Big but harmonious (owner, 2026-08-16 redesign): a primary
            gradient pill inset 4px from the bar's border — reads as one
            family with the AI pill instead of a black slab cutting the bar. */}
        <button
          type="submit"
          className="m-1 flex h-[calc(100%-8px)] shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary-600 to-primary-800 px-4 text-sm font-semibold text-white shadow-card transition-all hover:from-primary-500 hover:to-primary-700 hover:shadow-lift sm:px-5"
        >
          <SearchIcon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
          Search
        </button>
      </form>
      {/* AI Search as its OWN pill beside the bar — a real link to the
          dedicated /ai-search page (owner, 2026-08-16). Guests can use AI
          search too; no sign-in gate. */}
      {/* The AI door gets the page's one animated moment: a slow gradient
          sheen sweeping the navy pill (motion-reduce: static), sparkle lifts
          on hover. */}
      <Link
        to="/ai-search"
        className={`group flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary-800 via-primary-500 to-primary-800 bg-[length:200%_200%] px-3.5 text-sm font-semibold text-white shadow-card transition-shadow animate-ai-sheen hover:shadow-lift motion-reduce:animate-none sm:px-4 ${heightClass}`}
      >
        <SparkleIcon className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:scale-110" aria-hidden="true" />
        <span className="hidden sm:inline">AI Search</span>
      </Link>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      <PublicHeader
        current="Categories"
        centerSlot={searchMode ? <div className="w-full lg:max-w-xl">{searchPill('h-10', { withRef: false })}</div> : null}
      />

      {/* White canvas (owner, 2026-08-16 TradeIndia reference — the tinted
          wash read dull); cards carry the separation instead. */}
      <main className="flex-1 bg-white">
        {/* Search mode: the bar lives IN the nav at every width (PublicHeader
            centerSlot — in-row lg+, its own header row <lg). The
            Products|Suppliers toggle is REMOVED (owner) — supplier mode still
            renders when the AI or a URL sets `type=supplier`, there is just
            no manual switch. */}
        {!searchMode && (
          /* ===== DISCOVERY STAGE — the page's opening move when nothing has
             been searched: display heading, grand pill, recent + suggested
             chips (the AI modal's chip anatomy), Recommended feed below. ===== */
          <section className="border-b border-surface-border bg-gradient-to-b from-primary-50/70 via-white to-white">
            <div className="mx-auto w-full max-w-2xl px-4 pb-9 pt-10 text-center sm:px-6 md:pb-11 md:pt-14">
              <h1 className="text-2xl font-bold tracking-tight text-ink-900 md:text-[34px] md:leading-tight">
                What are you looking to source?
              </h1>
              <p className="mt-2 text-sm text-ink-500 md:text-[15px]">
                Search products and suppliers from exporters across India.
              </p>

              <div className="mt-6">{searchPill('h-12 md:h-14')}</div>

              {/* recent + suggested searches — same chip anatomy as the AI
                  modal's "Suggestions" row (owner, 2026-08-16). Recent lives
                  in localStorage only; plain search terms, nothing sensitive. */}
              <div className="mt-5 flex flex-col gap-2.5">
                {recent.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Recent</span>
                    {recent.map((term) => (
                      <span
                        key={term}
                        className="inline-flex items-center overflow-hidden rounded-full border border-surface-border bg-white"
                      >
                        <button
                          type="button"
                          onClick={() => submitQuery(term)}
                          className="inline-flex items-center gap-1.5 py-1.5 pl-3 text-xs font-medium text-ink-600 transition-colors hover:text-primary-700"
                        >
                          <ClockIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                          {term}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecent(term)}
                          aria-label={`Remove “${term}” from recent searches`}
                          className="px-1.5 py-1.5 text-ink-300 transition-colors hover:text-ink-700"
                        >
                          <XIcon className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="text-xs font-medium text-muted hover:text-ink-700 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Suggestions</span>
                  {SUGGESTED_SEARCHES.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => submitQuery(term)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-primary-600 hover:text-primary-700"
                    >
                      <SearchIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="w-full px-4 py-6 sm:px-6 lg:px-10 xl:px-16">
          {/* --- post-search workspace (owner reference, 2026-08-16: TradeIndia
              results page): persistent LEFT RAIL on lg+ — Related Categories
              + the full FilterSidebar — beside the results column. The rail
              exists only in search mode; idle keeps the single column, and
              <lg keeps the Filters drawer. NOT copied from the reference: the
              "Tell Us Your Requirement" RFQ form — quotation is Bucket A. */}
          <div className={searchMode ? 'lg:flex lg:items-start lg:gap-8' : ''}>
            {searchMode && (
              <aside className="hidden shrink-0 space-y-4 lg:block lg:w-64 xl:w-72">
                {/* Its OWN box, kept out of the filter panel (owner,
                    2026-08-17) — browsing sideways is not filtering. */}
                {/* 🔴 STABLE KEYS. This block is conditional, so when the
                    facets land it appears and pushes the filter panel from
                    child index 0 to 1 — React reconciles by position and
                    REMOUNTS the panel, wiping its open/closed state (found
                    2026-08-17: "More filters" refused to stay open on a
                    category page). Keys pin identity across that shift. */}
                {type === 'product' && (facets.data?.facets?.subCategory?.length ?? 0) > 0 && (
                  <div key="categories" className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
                    <h2 className="border-b border-surface-border px-4 py-3.5 text-[15px] font-bold text-ink-900">
                      Related Categories
                    </h2>
                    <ul className="max-h-[300px] overflow-y-auto px-4 py-1.5">
                      {facets.data.facets.subCategory.map((cat) => {
                        const on = category === cat.slug;
                        return (
                          <li key={cat.id}>
                            <button
                              type="button"
                              onClick={() => onCategoryChange(on ? null : cat.slug)}
                              className={`flex min-h-[42px] w-full items-center justify-between gap-2 border-b border-surface-border/60 py-2 text-left text-sm transition-colors last:border-0 ${
                                on ? 'font-semibold text-primary-700' : 'text-ink-700 hover:text-primary-700'
                              }`}
                            >
                              <span className="min-w-0 truncate">{cat.name}</span>
                              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                                {cat.count}
                                {on ? (
                                  <XIcon className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" />
                                ) : (
                                  <ChevronRightIcon className="h-3.5 w-3.5 text-ink-300" aria-hidden="true" />
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="border-t border-surface-border px-4 py-2.5">
                      <Link
                        to="/categories"
                        className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
                      >
                        Browse all categories
                        <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}

                <FilterSidebar key="filters" {...filterSidebarProps} onCategoryChange={null} onCountryChange={null} panel />
              </aside>
            )}

            <div className={searchMode ? 'min-w-0 flex-1' : ''}>
          {/* --- status + controls band (owner, 2026-08-16 alignment pass):
              ONE row — status heading left, Filters/Sort right, one shared
              bottom border (previously two stacked strips). Idle → count line;
              fetching a query → "Analysing your request…"; results →
              "Showing results for …"; zero + suggestion → "Did you mean …".
              This h1 is the page's one h1 — the band that held it is gone. */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-surface-border pb-3">
            <div className="min-w-0">
            {!q ? (
              <>
                {/* Idle product mode: the hero heading is the page h1, so the
                    Recommended feed title is an h2. Supplier browse has no
                    hero, so its title IS the h1. */}
                {type === 'supplier' ? (
                  <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Suppliers</h1>
                ) : (
                  <h2 className="text-lg font-bold text-ink-900 sm:text-xl">Recommended</h2>
                )}
                <p className="mt-0.5 text-sm text-muted" aria-live="polite">
                  {results.isSuccess
                    ? type === 'supplier'
                      ? `${total} supplier${total === 1 ? '' : 's'} on MPX`
                      : `${total} listing${total === 1 ? '' : 's'} from exporters on MPX`
                    : ' '}
                </p>
              </>
            ) : results.isFetching ? (
              <div className="flex items-center gap-2.5" aria-live="polite">
                <Spinner className="h-4 w-4 text-primary-600" />
                <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Analysing your request…</h1>
              </div>
            ) : results.isSuccess && total === 0 && didYouMean?.term ? (
              <>
                <h1 className="text-lg font-bold text-ink-900 sm:text-xl">
                  Did you mean{' '}
                  <button
                    type="button"
                    onClick={() => submitQuery(didYouMean.term)}
                    className="text-primary-700 underline underline-offset-4 hover:text-primary-800"
                  >
                    {didYouMean.term}
                  </button>
                  ?
                </h1>
                <p className="mt-0.5 text-sm text-muted" aria-live="polite">
                  No exact matches for “{q}”
                </p>
              </>
            ) : (
              <>
                <h1 className="truncate text-lg font-bold text-ink-900 sm:text-xl">
                  Results found for “{q}”
                </h1>
                <p className="mt-0.5 text-sm text-muted" aria-live="polite">
                  {results.isSuccess ? `${total} result${total === 1 ? '' : 's'}` : ' '}
                </p>
              </>
            )}
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className={`flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-primary-700 ${searchMode ? 'lg:hidden' : ''}`}
              >
                <FilterIcon className="h-4 w-4" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1 text-xs font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {type === 'product' && (
                <>
                  <span aria-hidden="true" className={`h-4 w-px bg-surface-border ${searchMode ? 'lg:hidden' : ''}`} />
                  <SortMenu value={sort} onChange={onSortChange} />
                </>
              )}
            </div>
          </div>

          {/* --- related categories, <lg (owner, 2026-08-17: the rail is
              lg-only, so phones lost them entirely). Same single-select
              behaviour as the rail — tapping sets/clears `category`. --- */}
          {searchMode && type === 'product' && (facets.data?.facets?.subCategory?.length ?? 0) > 0 && (
            <div className="-mx-4 mb-4 lg:hidden">
              <h2 className="mb-2 px-4 text-xs font-bold uppercase tracking-wide text-ink-400">
                Related categories
              </h2>
              <div className="flex gap-2 overflow-x-auto px-4 pb-1">
                {facets.data.facets.subCategory.map((cat) => {
                  const on = category === cat.slug;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onCategoryChange(on ? null : cat.slug)}
                      className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
                        on
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-surface-border bg-white text-ink-700'
                      }`}
                    >
                      {cat.name}
                      <span className="text-xs text-muted">{cat.count}</span>
                      {on && <XIcon className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- country chips (the reference's city-chip row, mapped to our
              supplier-country facet) — single-select, mirrors the `country`
              URL param; scrolls horizontally on phones. --- */}
          {searchMode && type === 'product' && (facets.data?.facets?.country?.length ?? 0) > 0 && (
            <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Supplier country">
              <button
                type="button"
                onClick={() => onCountryChange(null)}
                className={`inline-flex min-h-[38px] shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                  !country ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-transparent bg-surface-subtle/70 text-ink-700 hover:bg-surface-subtle'
                }`}
              >
                All countries
              </button>
              {facets.data.facets.country.map((c) => {
                const on = country === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onCountryChange(on ? null : c.value)}
                    className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
                      on ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-transparent bg-surface-subtle/70 text-ink-700 hover:bg-surface-subtle'
                    }`}
                  >
                    {countryName(c.value) ?? c.value}
                    <span className="text-xs text-muted">{c.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* --- AI answer panel (screen 3 result treatment) --- */}
          {aiInfo && (
            <div className="mb-5 flex w-full max-w-2xl items-start gap-2.5 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
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

          {appliedChips.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
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

          <FiltersOverlay
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            total={total}
            isPending={results.isPending}
            filterSidebarProps={drawerSidebarProps}
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
                {/* The "did you mean {term}" suggestion renders as the status
                    heading above, not here — this card only adds the category
                    browse path so the zero state is never a dead-end. */}
                {didYouMean?.categorySlug && (
                  <p className="mt-3 text-[15px]">
                    You can also browse{' '}
                    <Link
                      to={`/category/${didYouMean.categorySlug}`}
                      className="font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800"
                    >
                      the matching category
                    </Link>
                    .
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
              <div className="mt-6">
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
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
