import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { CategoryThumb } from '../../components/catalogue/CategoryThumb.jsx';
import { FilterSidebar } from '../../components/catalogue/FilterSidebar.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { ProductListCard } from '../../components/catalogue/ProductListCard.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import {
  BadgeCheckIcon,
  BoxIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
} from '../../components/ui/icons.jsx';
import { NotFound } from './NotFound.jsx';

/**
 * M2 web screen 2 — the products of one category (`/category/:slug`).
 *
 * Base layout (owner-directed, 2026-08-11, after several iterations):
 *
 *   left rail → the sub-categories as a STICKY SIDEBAR of photo rows (thumb ·
 *               name · chevron) — the approved row design, vertical. "All
 *               {top}" leads on sub pages; the current row is highlighted with
 *               a check (never colour alone). Below lg the same rows render as
 *               the 2-up grid above the products instead.
 *   header    → typographic: the category name and a muted context line.
 *   grid      → the products — the page's visual centre of gravity.
 *
 * 🔴 FILTERS ADDED 2026-08-11 (owner: "build the filter sidebar for real,
 * now" — explicitly bringing forward part of Module 3, confirmed, not
 * assumed). Real, backend-wired — `GET /public/search` + `GET /public/facets`,
 * both shipped and tested (m3-search.test.js, m3-facets.test.js). This
 * replaces the earlier "NO filters — all Module 3" stance for THIS page only;
 * `/public/products` (paging-only) is left as-is for any other surface still
 * using it.
 *
 * Scoped to what was actually asked for: verified-only, price range, and the
 * category's own filterable attributes (material, GSM, etc.). NOT built:
 * country/goods-vs-service facets (in the API, not part of this ask), a
 * full-screen filter modal (that's M3's own planned screen, a bigger UI than
 * this sidebar), enquiry/contact CTAs (M4, still not built), and no fabricated
 * content (social-proof counters, "featured" ribbons, badges) — none of that
 * is real data.
 *
 * Filter state lives in the URL (`useSearchParams`), same pattern already
 * used for `page` — shareable, back-button-safe, and it's what lets a
 * filtered view get `noindex,follow` + a clean canonical (m3-seo.md §4)
 * without a second state system to keep in sync.
 *
 * The slug may be a SUB or a TOP: the server resolves a top to its active
 * sub-categories (`resolveCategoryLeafIds`), so a top page aggregates its
 * children — identically for both `/public/products` and `/public/search`,
 * confirmed the same shared resolver.
 *
 * An unknown or deactivated slug 404s from the API and renders the shared
 * not-found page — deliberately indistinguishable from a category that never
 * existed, so the page is never an oracle for hidden rows.
 */
const PAGE_SIZE = 12;
// Vertical list (2026-08-11, owner: match the reference mockup's horizontal
// cards) — a horizontal card can't tile into columns the way the old
// photo-top grid card did, so this is a single stack, not a grid.
//
// 2026-08-13 (owner: "i need two cards in one row" on mobile) — the
// horizontal `ProductListCard` carries too much (description, seller
// footer, two buttons) to read at half-width, so mobile switches to a
// SEPARATE 2-up grid of the compact `ProductCard` instead of squeezing the
// same card narrower. Two parallel `<ul>`s, one hidden at each breakpoint,
// rather than one list whose card component changes shape mid-breakpoint.
// Responsive audit 2026-08-14: the horizontal card used to start at sm
// (640px) with a FIXED 400px image — ~200px left for every word. The 2-up
// compact grid now holds through sm; the list card starts at md, with an
// image column that scales to the room the rail leaves it (see
// ProductListCard).
const LIST_MOBILE = 'grid grid-cols-2 gap-3 md:hidden';
const LIST = 'hidden md:flex md:flex-col md:gap-5';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'priceDesc', label: 'Price: High to Low' },
];

const FILTER_KEY_RE = /^attr\[([^\]]+)\](?:\[(min|max)\])?$/;

/** Every `attr[...]` entry in the URL, both as raw key→value pairs (to
 *  forward verbatim to the API — the URL already uses the API's own bracket
 *  syntax) and parsed into `{ [attrKey]: string[] | {min,max} }` for
 *  rendering which options/ranges are currently checked. One scan, both
 *  shapes, so they can never drift apart. */
function readAttrParams(searchParams) {
  const raw = {};
  const selections = {};
  for (const [k, v] of searchParams.entries()) {
    const m = k.match(FILTER_KEY_RE);
    if (!m) continue;
    raw[k] = v;
    const [, key, bound] = m;
    if (bound) {
      selections[key] = { ...selections[key], [bound]: v };
    } else {
      selections[key] = v.split(',').filter(Boolean);
    }
  }
  return { raw, selections };
}

/**
 * Pure sort dropdown (2026-08-14, owner: "no text field") — three fixed
 * options never need the hybrid type-to-filter Combobox; a quiet text
 * button + listbox matches the flat toolbar. Full keyboard support:
 * ↑/↓ move, Enter picks, Esc closes.
 */
function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rootRef = useRef(null);
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open]);

  const pick = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
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
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
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
        <ChevronDownIcon
          className={`h-4 w-4 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul role="listbox" aria-label="Sort products" className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-surface-border bg-white py-1.5 shadow-lift">
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

/**
 * Full-height specialisation picker sheet, <lg (2026-08-14, owner: "same as
 * we show categories in admin panel mobile view") — the admin category
 * manager's phone pattern brought to the public page: selector card on the
 * page, this searchable sheet on tap. Search filters by NAME only — the
 * public projection carries no synonyms (search-only field, never public).
 */
function SpecialisationSheet({ open, top, currentId, onClose, onPick }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQ('');
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const items = [
    { id: top.id, slug: top.slug, name: `All ${top.name}`, image: top.image, isAll: true },
    ...(top.subs ?? []),
  ];
  const norm = q.trim().toLowerCase();
  const list = norm ? items.filter((i) => i.name.toLowerCase().includes(norm)) : items;

  return createPortal(
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a specialisation"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink-900/40" />
      <div className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-2xl bg-white shadow-lift">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
          <h2 className="text-[15px] font-bold text-ink-900">Choose a specialisation</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="relative border-b border-ink-100 px-4 py-2.5">
          <SearchIcon className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            ref={inputRef}
            type="search"
            aria-label="Search specialisations"
            placeholder={`Search ${top.subs?.length ?? 0} specialisations…`}
            className="h-10 w-full rounded-lg border border-surface-border bg-white pl-9 pr-3 text-sm outline-none placeholder:text-ink-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-surface-border overflow-y-auto overscroll-contain">
          {list.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted">
              No specialisation matches &ldquo;{q.trim()}&rdquo;.
            </li>
          )}
          {list.map((item) => {
            const on = item.id === currentId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  aria-current={on || undefined}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                    on ? 'bg-primary-50' : 'hover:bg-surface-subtle'
                  }`}
                >
                  <CategoryThumb image={item.image} label={item.name} size="h-9 w-9" />
                  <span
                    className={`min-w-0 flex-1 text-sm ${
                      on ? 'font-semibold text-primary-800' : item.isAll ? 'font-semibold text-ink-900' : 'font-medium text-ink-800'
                    }`}
                  >
                    {item.name}
                  </span>
                  {on ? (
                    <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
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
        <Skeleton className="h-3.5 w-4/5" />
      </div>
    </li>
  );
}

/** Loading state for the mobile 2-up grid — matches `ProductCard`'s own
 *  shape, not `CardSkeleton` above (that one's horizontal, matching
 *  `ProductListCard`, and would flash a mismatched full-width skeleton
 *  right before two half-width cards pop in). */
function CardSkeletonCompact() {
  return (
    <li className="flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex-1 space-y-2 p-3.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </li>
  );
}

function Crumb({ to, children, last }) {
  return (
    <>
      {to && !last ? (
        <Link to={to} className="hover:text-primary-700">{children}</Link>
      ) : (
        <span className={last ? 'font-medium text-ink-800' : undefined}>{children}</span>
      )}
      {!last && <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />}
    </>
  );
}

/**
 * Desktop: the left sub-category section. Redesigned 2026-08-12 (owner:
 * "sidebar is not looking good, redesign it, make it very professional") —
 * this used to be its own separate shadow-card box, stacked above
 * `FilterSidebar`'s separate shadow-card box with a visible gap between them,
 * and used a different heading style (small uppercase label in a tinted
 * band) than the filters below it (bold `text-lg` headings) — two mismatched
 * panels reading as an afterthought pairing, not one designed sidebar. Now:
 *  - renders BARE (no own border/shadow/rounding/padding) — the caller
 *    (`CategoryListing`) wraps this together with `FilterSidebar` in ONE
 *    shared card with a single divider between them;
 *  - the heading matches `FilterSidebar`'s own section-title style exactly
 *    (bold `text-lg primary-800` + a light count badge), so the whole card
 *    reads as one typographic system, not two;
 *  - names that don't fit on one line wrap to 2 lines (`line-clamp-2`)
 *    instead of getting cut mid-word with an ellipsis (was "All Textiles,
 *    Fabrics & …", "Home textiles (bedsh…" — real category names, ugly
 *    truncation);
 *  - dropped its own internal `max-h-[68vh] overflow-y-auto` — that was a
 *    SECOND, nested scroll region inside the outer sticky panel's own
 *    scroll area (`CategoryListing`'s wrapper). One sidebar should scroll
 *    as one region, not two independently-scrolling boxes.
 * Kept from the 2026-08-11 pass: every row is the same 3-column grid
 * (thumb · name · marker) so thumbs/names/icons still align to the pixel in
 * every state; the current row = soft tint + left accent bar + check.
 */
function SubRail({ top, currentId, onSubPage }) {
  if (!top) return null;
  const subs = top.subs ?? [];
  if (!subs.length) return null;

  const ROW =
    'relative grid min-h-[48px] grid-cols-[36px_minmax(0,1fr)_16px] items-center gap-3 rounded-xl px-3 py-2';
  const NAME = 'line-clamp-2 min-w-0 flex-1 text-sm leading-snug';

  return (
    <div>
      {/* Quiet label (2026-08-14): with the filters gone from this card, a
          text-lg primary-800 heading out-shouted the masthead itself. */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">
          Specialisations
        </h2>
        <span className="text-xs font-medium text-muted">{subs.length}</span>
      </div>

      <ul className="space-y-0.5">
        {onSubPage && (
          <li className="mb-1.5 border-b border-ink-100 pb-1.5">
            <Link to={`/category/${top.slug}`} className={`${ROW} transition-colors hover:bg-surface-subtle`}>
              <CategoryThumb image={top.image} label={top.name} size="h-9 w-9" />
              <span className={`${NAME} font-semibold text-ink-900`}>All {top.name}</span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
            </Link>
          </li>
        )}
        {subs.map((sub) => {
          const current = sub.id === currentId;
          return (
            <li key={sub.id}>
              {current ? (
                <span aria-current="page" className={`${ROW} bg-primary-50`}>
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary-600"
                  />
                  <CategoryThumb image={sub.image} label={sub.name} size="h-9 w-9" />
                  <span className={`${NAME} font-semibold text-primary-800`}>{sub.name}</span>
                  <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                </span>
              ) : (
                <Link
                  to={`/category/${sub.slug}`}
                  className={`${ROW} transition-colors hover:bg-surface-subtle`}
                >
                  <CategoryThumb image={sub.image} label={sub.name} size="h-9 w-9" />
                  <span className={`${NAME} font-medium text-ink-800`}>{sub.name}</span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Below lg: the approved photo-row grid, above the products. */
function SubGrid({ top, currentId, onSubPage }) {
  if (!top) return null;
  const subs = top.subs ?? [];
  if (!subs.length) return null;

  const shell = (current) =>
    `flex items-center gap-3 rounded-xl border bg-white p-2 pr-3 transition-all ${
      current
        ? 'border-primary-600 ring-1 ring-primary-600'
        : 'border-surface-border hover:border-primary-500 hover:shadow-card'
    }`;

  return (
    <section className="mb-7">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Specialisations
      </h2>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {onSubPage && (
          <li>
            <Link to={`/category/${top.slug}`} className={shell(false)}>
              <CategoryThumb image={top.image} label={top.name} />
              <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-ink-900">
                All {top.name}
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
            </Link>
          </li>
        )}
        {subs.map((sub) => {
          const current = sub.id === currentId;
          const inner = (
            <>
              <CategoryThumb image={sub.image} label={sub.name} />
              <span
                className={`line-clamp-2 min-w-0 flex-1 text-sm leading-snug ${
                  current ? 'font-semibold text-primary-700' : 'font-medium text-ink-800'
                }`}
              >
                {sub.name}
              </span>
              {current ? (
                <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
              )}
            </>
          );
          return (
            <li key={sub.id}>
              {current ? (
                <span aria-current="page" className={shell(true)}>{inner}</span>
              ) : (
                <Link to={`/category/${sub.slug}`} className={shell(false)}>{inner}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Mobile "Filters" full-screen sheet (2026-08-13, owner: "for the mobile
 * version for the phone make a page for these all filters"). Before this,
 * every sub-category tile AND every filter control rendered inline, in
 * order, above the product list — on a phone that pushed the actual results
 * an entire screen or more below the fold before a buyer saw a single
 * product. Standard mobile-commerce pattern instead: a compact "Filters"
 * button opens this sheet; the results grid sits right under "Sort By" on
 * the page itself.
 *
 * Same modal mechanics as `ProductDetail.jsx`'s `Lightbox` (portalled to
 * `document.body`, Escape/backdrop/X close, focus trap, body-scroll lock) —
 * not extracted to a shared hook yet. This is the second occurrence of the
 * pattern, not the third; per CLAUDE.md ("duplicate twice before you
 * generalise") it stays self-contained here until a third use asks for it.
 *
 * Filters still apply LIVE as you touch them (same as desktop — there is no
 * separate "pending vs applied" filter state anywhere in this codebase to
 * plug into), so the footer button is just "Show N results": it closes the
 * sheet onto results that are already correct underneath it.
 */
function MobileFiltersSheet({ open, onClose, total, isPending, top, cat, onSubPage, filterSidebarProps }) {
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e) {
      if (e.key !== 'Tab') {
        if (e.key === 'Escape') onClose();
        return;
      }
      const focusable = document.querySelectorAll('[data-mobile-filters] button, [data-mobile-filters] input, [data-mobile-filters] a');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    document.querySelector('[data-mobile-filters-close]')?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      data-mobile-filters
      role="dialog"
      aria-modal="true"
      aria-label="Filters"
      className="fixed inset-0 z-50"
    >
      {/* Desktop (2026-08-14, owner: filters out of the sidebar): the same
          sheet renders as a right-side drawer over a dimmed backdrop; phones
          keep the full-screen takeover. One filter surface, every width. */}
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
            data-mobile-filters-close
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-surface-subtle"
          >
            <XIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {/* The rail already shows specialisations on lg+ — repeating them
              inside the drawer would be the same list twice on one screen. */}
          <div className="lg:hidden">
            <SubGrid top={top} currentId={cat?.id} onSubPage={onSubPage} />
          </div>
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

export function CategoryListing() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [specPickerOpen, setSpecPickerOpen] = useState(false); // <lg specialisation sheet
  const page = Math.max(1, Number(params.get('page')) || 1);
  const sort = params.get('sort') || 'newest';
  const verifiedOnly = params.get('verified') === '1';
  const priceMin = params.get('priceMin') ?? '';
  const priceMax = params.get('priceMax') ?? '';
  const { raw: attrRawParams, selections: attrSelections } = readAttrParams(params);

  // Every setter resets `page` — a changed filter invalidates whatever page
  // you were on, and re-fetching page 4 of a now-much-smaller result set
  // would just show an empty page instead of the new page 1.
  const updateParams = (mutate) => {
    const next = new URLSearchParams(params);
    mutate(next);
    next.delete('page');
    setParams(next);
  };

  const onToggleVerified = () =>
    updateParams((next) => (verifiedOnly ? next.delete('verified') : next.set('verified', '1')));

  const onPriceChange = (min, max) =>
    updateParams((next) => {
      min ? next.set('priceMin', min) : next.delete('priceMin');
      max ? next.set('priceMax', max) : next.delete('priceMax');
    });

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

  const onClearAllFilters = () =>
    updateParams((next) => {
      for (const k of [...next.keys()]) {
        if (k === 'verified' || k === 'priceMin' || k === 'priceMax' || FILTER_KEY_RE.test(k)) next.delete(k);
      }
    });

  const onSortChange = (val) => updateParams((next) => (val === 'newest' ? next.delete('sort') : next.set('sort', val)));

  const hasActiveFilters =
    verifiedOnly || priceMin || priceMax || Object.keys(attrSelections).length > 0 || sort !== 'newest';

  // The mobile "Filters" button's badge — deliberately NOT `hasActiveFilters`
  // above, which also counts `sort` (not a control inside the sheet at all).
  const activeFilterCount =
    (verifiedOnly ? 1 : 0) + (priceMin || priceMax ? 1 : 0) + Object.keys(attrSelections).length;

  const filterParams = {
    category: slug,
    ...(verifiedOnly ? { verifiedOnly: 'true' } : {}),
    ...(priceMin ? { priceMin } : {}),
    ...(priceMax ? { priceMax } : {}),
    ...attrRawParams,
  };

  const category = useQuery({
    queryKey: catalogueKeys.category(slug),
    queryFn: () => catalogueApi.category(slug),
    retry: false, // a 404 here is a real answer, not a blip
  });

  // The tree is already cached by the browse page; it supplies the parent's
  // name for the breadcrumb and the rail, neither of which is a field on a
  // category (the public projection is name/slug/image/parentId/type).
  const tree = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  const products = useQuery({
    queryKey: catalogueKeys.search({ ...filterParams, sort, page, pageSize: PAGE_SIZE }),
    queryFn: () => catalogueApi.search({ ...filterParams, sort, page, pageSize: PAGE_SIZE }),
    enabled: category.isSuccess,
    // Keeps the previous PAGE's cards on screen while the next loads, so paging
    // (or a filter tweak) doesn't flash the grid back to skeletons — but ONLY
    // within the same category. Unconditional carry-over flashed the PREVIOUS
    // category's products for a frame after clicking a sibling (owner-reported),
    // which reads as showing the wrong data.
    placeholderData: (prev, prevQuery) => {
      const prevCategory = prevQuery?.queryKey?.[2]?.category;
      return prevCategory === slug ? prev : undefined;
    },
  });

  // Facets don't need paging — same filter context, live counts. Excluded
  // from `enabled` gate's category dependency the same way as `products`: no
  // point asking for facets of a category that just 404'd.
  const facets = useQuery({
    queryKey: catalogueKeys.facets(filterParams),
    queryFn: () => catalogueApi.facets(filterParams),
    enabled: category.isSuccess,
  });

  const cat = category.data;
  useEffect(() => {
    if (!cat) return undefined;
    const previous = document.title;
    document.title = `${cat.name} — MPX Global`;
    return () => { document.title = previous; };
  }, [cat]);

  // m3-seo.md §4: a filtered view (any filter, or a non-default sort) is
  // noindex,follow with a canonical back to the clean base category URL —
  // the base URL stays the one that's actually indexable.
  useEffect(() => {
    if (!cat) return undefined;
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = `${window.location.origin}/category/${cat.slug}`;
    document.head.appendChild(canonical);

    let robots;
    if (hasActiveFilters) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'noindex,follow';
      document.head.appendChild(robots);
    }

    return () => {
      canonical.remove();
      robots?.remove();
    };
  }, [cat, hasActiveFilters]);

  if (category.isError) return <NotFound />;

  const top = cat?.parentId
    ? (tree.data ?? []).find((t) => t.id === cat.parentId)
    : (tree.data ?? []).find((t) => t.id === cat?.id);
  const total = products.data?.total ?? 0;
  const onSubPage = Boolean(cat?.parentId);

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
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      <PublicHeader current="Categories" />

      {/* Off-white canvas (2026-08-14 polish pass): white cards read as
          SURFACES against it instead of dissolving into a white page. */}
      <main className="flex-1 bg-surface-subtle/50">
        {/* Vertical scale (2026-08-14 finalise): py-8/10 left dead air under
            the sticky header and above the footer; left/right stay untouched
            (standing owner preference: full-bleed, slim side padding). */}
        <div className="w-full px-4 py-6 sm:px-6 md:py-8">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Crumb to="/categories">Categories</Crumb>
            {onSubPage && top && <Crumb to={`/category/${top.slug}`}>{top.name}</Crumb>}
            <Crumb last>{cat?.name ?? '…'}</Crumb>
          </nav>

          <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
            {/* --- Left: sticky SPECIALISATIONS rail (lg+) ---
                Filters moved OUT of this card and into the Filters drawer
                (2026-08-14, owner: "I don't like the position of these
                filters below the specialisation list") — the rail is now
                navigation only. Sticky + scroll stay on the wrapper (the
                original overlap bug: a child's own sticky had the whole
                <aside> as its containing block). */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-surface-border bg-white shadow-card">
                <div className="p-4">
                  {tree.isPending ? (
                    <Skeleton className="h-96 w-full rounded-2xl" />
                  ) : (
                    <SubRail top={top} currentId={cat?.id} onSubPage={onSubPage} />
                  )}
                </div>
              </div>
            </aside>

            {/* --- Right: header, (mobile subs + filters), products --- */}
            <div className="min-w-0">
              {/* MASTHEAD (2026-08-14, owner: "doesn't feel like an
                  international brand") — the category's identity is the
                  page's one brand moment: name in display weight, a single
                  promise line, real-data chips, and the category's own photo
                  dissolving in from the right (the device the 2026-08-11
                  approved design had, restored). The result COUNT moves down
                  to the flat toolbar — a category page leads with the
                  category, not its number of rows. */}
              {cat ? (
                <section className="relative overflow-hidden rounded-2xl border border-surface-border bg-gradient-to-r from-primary-50 via-primary-50/40 to-white shadow-card">
                  {(cat.image ?? top?.image) && (
                    <img
                      src={cat.image ?? top?.image}
                      alt=""
                      className="absolute inset-y-0 right-0 hidden h-full w-[45%] object-cover sm:block"
                      style={{
                        maskImage: 'linear-gradient(to left, black 55%, transparent)',
                        WebkitMaskImage: 'linear-gradient(to left, black 55%, transparent)',
                      }}
                    />
                  )}
                  <div className="relative p-5 sm:max-w-[58%] sm:p-8">
                    {/* Stepped display size — 3xl on a phone made long names
                        wrap to three lines and the masthead tower. */}
                    <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl lg:text-4xl">
                      {cat.name}
                    </h1>
                    <p className="mt-2 text-sm text-ink-600 sm:text-[15px]">
                      Sourced directly from Indian exporters — every verified tick is checked by MPX.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {!onSubPage && (top?.subs?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-primary-800 ring-1 ring-primary-200">
                          {top.subs.length} specialisations
                        </span>
                      )}
                      {onSubPage && top && (
                        <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-primary-800 ring-1 ring-primary-200">
                          Part of {top.name}
                        </span>
                      )}
                      {products.isSuccess && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink-700 ring-1 ring-surface-border">
                          <BadgeCheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                          {total} listing{total === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                <Skeleton className="h-40 w-full rounded-2xl" />
              )}

              {/* Specialisation selector, <lg only (owner, 2026-08-14: "same
                  as we show categories in admin panel mobile view") — the
                  admin category manager's phone pattern: a compact current-
                  selection CARD opening a full-height searchable sheet. The
                  rail covers lg+. */}
              {top && (top.subs?.length ?? 0) > 0 && (
                <div className="mt-4 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setSpecPickerOpen(true)}
                    aria-haspopup="dialog"
                    className="flex w-full items-center gap-3 rounded-2xl border border-surface-border bg-white p-3 text-left shadow-card active:bg-surface-subtle"
                  >
                    <CategoryThumb image={cat?.image ?? top.image} label={cat?.name ?? top.name} size="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {onSubPage ? cat.name : `All ${top.name}`}
                      </span>
                      <span className="block text-xs text-muted">
                        {onSubPage ? `in ${top.name}` : `${top.subs.length} specialisations`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary-700">
                      Change
                      <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                  <SpecialisationSheet
                    open={specPickerOpen}
                    top={top}
                    currentId={cat?.id}
                    onClose={() => setSpecPickerOpen(false)}
                    onPick={(item) => {
                      setSpecPickerOpen(false);
                      if (item.id !== cat?.id) navigate(`/category/${item.slug}`);
                    }}
                  />
                </div>
              )}

              {/* FLAT results toolbar (2026-08-14 rethink — a boxed bar was
                  border-noise): controls read as typography over one
                  hairline. Count lives HERE (metadata, not a headline);
                  "Filters" is a text-button opening the sheet (phones,
                  2026-08-13) or the right-side drawer (lg+). */}
              <div className="mb-5 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-surface-border pb-3">
                <div className="flex min-h-[44px] items-center gap-4">
                  <span className="text-sm text-muted" aria-live="polite">
                    {products.isSuccess ? `${total} product${total === 1 ? '' : 's'}` : ' '}
                  </span>
                  <span aria-hidden="true" className="h-4 w-px bg-surface-border" />
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
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
                <SortMenu value={sort} onChange={onSortChange} />
              </div>

              <MobileFiltersSheet
                open={mobileFiltersOpen}
                onClose={() => setMobileFiltersOpen(false)}
                total={total}
                isPending={products.isPending}
                top={top}
                cat={cat}
                onSubPage={onSubPage}
                filterSidebarProps={filterSidebarProps}
              />

              {(category.isPending || products.isPending) && (
                <>
                  <ul className={LIST_MOBILE} aria-busy="true" aria-label="Loading products">
                    {Array.from({ length: 4 }, (_, i) => <CardSkeletonCompact key={i} />)}
                  </ul>
                  <ul className={LIST} aria-busy="true" aria-label="Loading products">
                    {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
                  </ul>
                </>
              )}

              {products.isError && (
                <div className="rounded-2xl border border-surface-border bg-white shadow-card">
                  <ErrorState
                    title="We couldn't load these products"
                    requestId={products.error?.response?.data?.error?.requestId}
                    onRetry={products.refetch}
                  />
                </div>
              )}

              {/* Empty because the category genuinely has nothing yet, vs.
                  empty because the current filters matched nothing — two
                  different states, two different fixes to offer. */}
              {products.isSuccess && total === 0 && (
                <div className="rounded-2xl border border-surface-border bg-white shadow-card">
                  {hasActiveFilters ? (
                    <EmptyState icon={BoxIcon} title="No products match these filters">
                      Try removing a filter — the category's other listings might fit.
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={onClearAllFilters}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
                        >
                          Clear filters
                        </button>
                      </div>
                    </EmptyState>
                  ) : (
                    <EmptyState
                      icon={BoxIcon}
                      title="No products in this category yet"
                      action={
                        <Link
                          to="/categories"
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
                        >
                          Browse all categories
                        </Link>
                      }
                    >
                      We&apos;re still sourcing suppliers here. Try another category in the meantime.
                    </EmptyState>
                  )}
                </div>
              )}

              {products.isSuccess && total > 0 && (
                <>
                  {/* Mobile: compact 2-up grid (`ProductCard`, the same
                      card used for "More in category" on the product
                      detail page). sm+: the rich horizontal list card. */}
                  <ul className={LIST_MOBILE}>
                    {products.data.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        to={`/product/${product.slug}`}
                      />
                    ))}
                  </ul>
                  <ul className={LIST}>
                    {products.data.products.map((product) => (
                      <ProductListCard
                        key={product.id}
                        product={product}
                        to={`/product/${product.slug}`}
                      />
                    ))}
                  </ul>
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
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
