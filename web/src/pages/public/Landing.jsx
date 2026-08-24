import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { useCanonical } from '../../lib/seo.js';
import { countryName } from '../../lib/countries.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

import {
  AlertIcon,
  BoxIcon,
  ChatIcon,
  ChevronRightIcon,
  GridIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
} from '../../components/ui/icons.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';

/**
 * Public landing page (`/`) — SEO surface and the platform's front door.
 *
 * 🔴 CRIMSON TRIAL, 2026-08-23 (owner: "where we have implemented the blue color
 * there implement red, web only for now"). Every `primary-*` token on this page
 * was swapped for the parallel `crimson-*` shade — a mechanical swap, so
 * reverting is a find-and-replace back.
 *
 * ⚠️ THE REST OF THE PRODUCT IS STILL BLUE — the logo, the app, the admin
 * console and every other web page. On this page that means a royal-blue
 * wordmark sitting above a crimson hero. Flagged to the owner; this is a trial,
 * not an adopted brand.
 *
 * 🔵 `LandingBlue.jsx` is an EXACT copy of the blue version, kept so the two can
 * be compared side by side and so reverting never depends on git history. It is
 * mounted at `/landing-blue`. **The two files do not share code**: any content
 * fix made here must be repeated there, or the comparison stops being like for
 * like. Delete `LandingBlue.jsx` and its route once the colour is decided —
 * leaving a second landing page around is how one of them quietly rots.
 *
 * 🆕 2026-08-23 — REBUILT from a marketing landing page into a MARKETPLACE
 * landing page, against an approved mockup
 * (`design-plans/m3/web-buyer-home-mockup.html`, prompt
 * `web-buyer-home-parity-prompt.md`). Everything below this line supersedes the
 * previous nine-section brochure layout.
 *
 * The brief was "make the web home like the app's buyer home". The FIRST
 * attempt did that literally — circular category icons, an app bar carrying a
 * search pill, a sticky pill, single-column stacked blocks — and the owner
 * rejected it: "it's looking like we are opening app in web". So the app's
 * *section order and honesty rules* were kept and its *phone idiom* was
 * dropped for a web one:
 *
 * - **A three-column hero** (category rail · banner · contextual panel) instead
 *   of a stack. This is what actually uses a desktop's width, and it solves
 *   something the app could not: the app had to push the verification card
 *   BELOW the catalogue (a buyer is fully active from signup — verification
 *   gates nothing for them — so it must not sit above the marketplace). On web
 *   it goes in the side column: present, but not in the way.
 * - **Landscape category cards**, not circular app icons.
 * - **Wide grids** (up to 5 products across) rather than a 2-up phone grid.
 * - **"Load more", not the app's endless feed.** The app uses a virtualising
 *   FlatList and has no SEO surface; on web an infinite feed hurts indexing and
 *   keyboard users, and buries the footer for good.
 *
 * 🔴 KEPT DELIBERATELY, though the mockup had neither:
 * - `PublicHeader` / `PublicFooter` — the SHARED public chrome. The mockup drew
 *   its own masthead and a footer full of links to /help, /contact, /terms and
 *   /privacy; none of those routes exist, and `web-ui-notes.md` bans dead
 *   anchors. The shared footer already renders those as static text for exactly
 *   that reason. The masthead's search arrives through the header's existing
 *   `centerSlot` (built 2026-08-16 for /search) rather than by forking a second
 *   header that would then drift from the other five public pages.
 *
 * Copy discipline carried over from the app screen, and it is not cosmetic:
 * there is **no rating/review system**, so nothing here says "top-rated"; there
 * are no order counts, response rates, trending rails or supplier counts,
 * because no field or analytics pipeline computes them. The removed "NOW LIVE:
 * onboarding verified suppliers across 20+ categories" banner claimed a
 * milestone nobody measures.
 */

const FAQS = [
  {
    q: 'What is MPX Global?',
    a: 'MPX Global is a B2B marketplace connecting verified Indian exporters with international buyers. Discovery, verification, enquiries and real-time chat live on one platform, on web and mobile.',
  },
  {
    q: 'How does seller verification work?',
    a: 'An exporter submits business documents (registration, GST or personal ID, depending on the entity). Our team reviews them by hand and, once approved, a verified tick appears on the public profile. A profile is public from signup either way — verification adds trust, it never hides anyone.',
  },
  {
    q: 'Is there a fee to join as a buyer?',
    a: 'No. Joining as a buyer is free, and your account works in full from the moment you sign up.',
  },
  {
    q: 'How does the AI search work?',
    a: 'You type what you need in plain language; the platform extracts what matters (category, specs, price range) and matches it against the catalogue. If the AI step is ever unavailable, you still get fast keyword results.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'A mobile app for both buyers and sellers is part of the platform, sharing the same backend as the web — catalogue, enquiries and chat stay in sync across devices.',
  },
];

/**
 * The hero cluster's price line.
 *
 * 🔴 `PriceLine` is the shared renderer everywhere else, but it hard-codes
 * light-theme colours (`text-ink-900`, `text-primary-600`) and would vanish on
 * the black hero. This follows its RULES exactly rather than its markup:
 * **the ISO code is printed as the seller set it — never a ₹, never converted,
 * never guessed** (§A27.1, no currency conversion exists in Phase 1), and
 * "Price on request" is ordinary information, not an absence.
 */
const fmtAmount = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);

function heroPrice(price) {
  const { mode, min, max, currency } = price ?? {};
  if (mode === 'on_request' || (min == null && max == null)) return 'Price on request';
  if (mode === 'range') return `${currency} ${fmtAmount(min)} – ${fmtAmount(max)}`;
  return `${currency} ${fmtAmount(min)}`;
}

const FEED_PAGE_SIZE = 10;
const SUPPLIER_COUNT = 6;
/** Top-level categories in the hero rail and the browse grid. */
const RAIL_COUNT = 9;
const GRID_COUNT = 12;

/* --------------------------------- pieces --------------------------------- */

/** Section heading + optional "see all" — the one definition, so headings can't drift. */
function BlockHead({ title, sub, to, cta = 'See all' }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h2>
        {sub && <p className="mt-1 text-sm text-ink-600">{sub}</p>}
      </div>
      {to && (
        <Link
          to={to}
          className="hidden shrink-0 rounded-xl border border-surface-border px-4 py-2 text-sm font-semibold text-crimson-700 hover:bg-crimson-50 sm:inline-block"
        >
          {cta} ›
        </Link>
      )}
    </div>
  );
}

/** Fixed-ratio placeholder used while a grid loads — a skeleton, never a spinner. */
function CardSkeleton({ ratio = 'aspect-square' }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-white">
      <div className={`${ratio} w-full animate-pulse bg-ink-100`} />
      <div className="space-y-2 p-3.5">
        <div className="h-3 w-4/5 animate-pulse rounded bg-ink-100" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
      </div>
    </div>
  );
}

function SupplierCard({ supplier }) {
  return (
    <Link
      to={`/supplier/${supplier.slug ?? supplier.id}`}
      className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-card transition hover:shadow-lift sm:p-6"
    >
      <div className="flex items-center gap-3">
        {supplier.logo ? (
          <img
            src={supplier.logo}
            alt=""
            loading="lazy"
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-surface-border"
          />
        ) : (
          <NoImagePanel label={supplier.name} monogram ratio="h-14 w-14" className="shrink-0 rounded-full" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold text-ink-900">{supplier.name}</span>
            {/* Tick from the server-derived `verified` boolean only. There is no
                "unverified" badge — its absence is the only signal. */}
            <VerifiedTick verified={supplier.verified} compact />
          </div>
          {supplier.country && (
            <p className="mt-0.5 truncate text-xs text-ink-600">
              {countryName(supplier.country) ?? supplier.country}
            </p>
          )}
        </div>
      </div>
      {supplier.description && (
        <p className="mt-4 line-clamp-3 text-sm text-ink-600">{supplier.description}</p>
      )}
      <span className="mt-auto pt-5 text-sm font-semibold text-crimson-700">View profile ›</span>
    </Link>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  useCanonical('/');

  const categories = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  const suppliers = useQuery({
    queryKey: catalogueKeys.search({ type: 'supplier', verifiedOnly: 'true', pageSize: SUPPLIER_COUNT }),
    queryFn: () =>
      catalogueApi.search({
        type: 'supplier',
        sort: 'newest',
        verifiedOnly: 'true',
        pageSize: SUPPLIER_COUNT,
      }),
  });

  // "Load more" rather than infinite scroll — see the file note. `useInfiniteQuery`
  // accumulates pages without the manual de-duplication the app screen needs.
  const feed = useInfiniteQuery({
    queryKey: catalogueKeys.search({ type: 'product', sort: 'newest', pageSize: FEED_PAGE_SIZE }),
    queryFn: ({ pageParam }) =>
      catalogueApi.search({ type: 'product', sort: 'newest', page: pageParam, pageSize: FEED_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + (p.products?.length ?? 0), 0);
      return loaded < (last?.total ?? 0) ? pages.length + 1 : undefined;
    },
  });

  const topCategories = categories.data ?? [];
  const products = feed.data?.pages.flatMap((p) => p.products ?? []) ?? [];
  // The hero cluster. Exactly three, all photographed — all-or-nothing rather
  // than a stagger with a hole in it. See the hero's own note.
  const heroPicks = products.filter((p) => p.images?.[0]).slice(0, 3);
  const productTotal = feed.data?.pages[0]?.total ?? 0;
  const verifiedSuppliers = suppliers.data?.suppliers ?? [];

  const isBuyer = user?.role === 'buyer';
  const isExporter = user?.role === 'exporter';

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  /* The masthead search, handed to the shared header's existing centre slot.
     It is a real input: typing and submitting lands on /search?q=… (owner,
     2026-08-16) — the same behaviour the previous hero search shipped with. */
  const headerSearch = (
    <form
      role="search"
      onSubmit={onSearch}
      className="flex h-11 w-full min-w-0 items-center overflow-hidden rounded-xl border-2 border-crimson-600 bg-white focus-within:ring-2 focus-within:ring-crimson-600/20"
    >
      <label className="sr-only" htmlFor="landing-q">
        Search products, services or suppliers
      </label>
      <SearchIcon className="ml-3 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      <input
        id="landing-q"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="cotton fabric, 120 GSM…"
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-ink-400"
      />
      <Link
        to="/ai-search"
        className="mr-1 hidden shrink-0 items-center gap-1.5 rounded-lg bg-crimson-50 px-3 py-1.5 text-xs font-bold text-crimson-700 hover:bg-crimson-100 xl:flex"
      >
        <SparkleIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Ask AI instead
      </Link>
      <button
        type="submit"
        className="h-full shrink-0 bg-crimson-600 px-5 text-sm font-bold text-white hover:bg-crimson-700"
      >
        Search
      </button>
    </form>
  );

  return (
    <div className="bg-white text-ink-900">
      <PublicHeader centerSlot={headerSearch} />

      {/* Browse bar — the marketplace's own nav row, under the shared header.
          Scrolls horizontally rather than wrapping on a narrow phone. */}
      <div className="border-b border-surface-border bg-white">
        <nav
          aria-label="Browse"
          className="flex w-full items-center gap-1 overflow-x-auto px-4 py-2 text-sm sm:px-6 lg:px-10 xl:px-16"
        >
          <Link
            to="/categories"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-crimson-600 px-4 py-2 font-bold text-white hover:bg-crimson-700"
          >
            <GridIcon className="h-4 w-4" aria-hidden="true" />
            All categories
          </Link>
          <Link to="/categories?type=goods" className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 font-semibold text-ink-600 hover:bg-surface-subtle">
            Goods
          </Link>
          {/* "Services" and "Suppliers" removed from this bar on the owner's
              instruction (2026-08-23). Both destinations still exist and are
              still reachable: the Goods/Services split section below links to
              `?type=service`, and "Verified suppliers" links to
              `/search?type=supplier`. Nothing was orphaned. */}
          <Link
            to="/ai-search"
            className="ml-auto hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 font-bold text-crimson-700 hover:bg-crimson-50 md:flex"
          >
            <SparkleIcon className="h-4 w-4" aria-hidden="true" />
            AI Search
          </Link>
        </nav>
      </div>

      <main>
        {/* ═════════ HERO — category rail · banner · contextual panel ═════════ */}
        <section className="bg-ink-50 py-4 sm:py-6">
          <div className="grid w-full grid-cols-1 gap-4 px-4 sm:gap-5 sm:px-6 lg:px-10 xl:px-16 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_320px]">
            {/* Always-open rail. Hidden below lg, where the category grid below
                and the browse bar above already serve the same purpose. */}
            <aside className="hidden rounded-2xl bg-white p-2 shadow-card lg:block">
              {categories.isPending ? (
                <div className="space-y-1 p-1">
                  {Array.from({ length: RAIL_COUNT }).map((_, i) => (
                    <div key={i} className="h-9 animate-pulse rounded-xl bg-ink-100" />
                  ))}
                </div>
              ) : (
                <ul className="text-sm">
                  {topCategories.slice(0, RAIL_COUNT).map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/category/${c.slug ?? c.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 font-medium text-ink-900 hover:bg-crimson-50 hover:text-crimson-700"
                      >
                        <span className="truncate">{c.name}</span>
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                  <li className="mt-1 border-t border-surface-border pt-1">
                    <Link to="/categories" className="block rounded-xl px-3 py-2 font-bold text-crimson-700 hover:bg-crimson-50">
                      All categories ›
                    </Link>
                  </li>
                </ul>
              )}
            </aside>

            {/* Banner. One h1 on the page, and it lives here. */}
            {/* Black hero (owner, 2026-08-23). `ink-900` (#000517), not `#000000`
                — pure black is banned by the design tokens, and the ink scale's
                slight blue cast is what the rest of the product's darkest
                surfaces already use (the footer is the same fill).
                Red stays as the ACCENT against it: the badge, the "Browse
                categories" label and the AI band below. */}
            {/* 🔴 Two columns INSIDE the hero (2026-08-23). It was one column
                capped at `max-w-xl`, which left roughly half the panel as empty
                black on any wide screen — the owner's "not looking good".
                The filler is REAL: four recent listings that the feed query has
                already fetched, so this costs no extra request and is not
                decoration. It also does the one job the copy cannot — proving
                there is a live catalogue behind the promise.
                Self-sizing like every other block here: fewer than four
                photographed listings and the collage does not render at all,
                leaving the original single-column hero rather than a grid with
                holes in it. */}
            <div className="rounded-2xl bg-ink-900 px-6 py-10 sm:px-10 sm:py-14 lg:px-12 lg:py-16">
              <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="max-w-xl">
                <p className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-crimson-300">
                  <ShieldIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Every tick checked by a person
                </p>
                <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Source from verified Indian exporters
                </h1>
                <p className="mt-4 max-w-md text-sm text-ink-200 sm:text-base">
                  Goods and services, direct from the supplier. Search the catalogue, send an
                  enquiry, and talk to them in real time — free, no account needed to browse.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    to="/categories"
                    className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-crimson-700 shadow-card hover:shadow-lift sm:px-6"
                  >
                    Browse categories
                  </Link>
                  <Link
                    to="/ai-search"
                    className="flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 sm:px-6"
                  >
                    <SparkleIcon className="h-4 w-4" aria-hidden="true" />
                    Describe what you need
                  </Link>
                </div>
              </div>

              {/* Real listings, not stock imagery — and staggered rather than a
                  flat 2×2, so it reads as a catalogue rather than as wallpaper:
                  one tall card carrying its real name, price and tick, with two
                  squares beside it.
                  Only listings that HAVE a photo — a "no image" placeholder
                  belongs in a product grid, not in the hero. */}
              {heroPicks.length === 3 && (
                <div className="hidden shrink-0 lg:block">
                  <div className="grid w-[320px] grid-cols-2 grid-rows-2 gap-3 xl:w-[380px]">
                    <Link
                      to={`/product/${heroPicks[0].slug ?? heroPicks[0].id}`}
                      className="group relative row-span-2 overflow-hidden rounded-2xl ring-1 ring-white/15"
                    >
                      <img
                        src={heroPicks[0].images[0]}
                        alt={heroPicks[0].name}
                        loading="eager"
                        width={190}
                        height={253}
                        className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      {/* Solid scrim, not a gradient — gradients are off the
                          table on brand surfaces, and a flat bar reads cleaner
                          over a photograph anyway. */}
                      <span className="absolute inset-x-0 bottom-0 block bg-ink-900/85 px-3 py-2.5">
                        <span className="flex items-center gap-1">
                          <span className="truncate text-[11px] font-semibold text-white">
                            {heroPicks[0].seller?.name}
                          </span>
                          {heroPicks[0].seller?.verified && (
                            <VerifiedTick verified compact />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-bold text-crimson-300">
                          {heroPrice(heroPicks[0].price)}
                        </span>
                      </span>
                    </Link>

                    {heroPicks.slice(1).map((p) => (
                      <Link
                        key={p.id}
                        to={`/product/${p.slug ?? p.id}`}
                        className="group overflow-hidden rounded-2xl ring-1 ring-white/15"
                      >
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          loading="eager"
                          width={182}
                          height={182}
                          className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      </Link>
                    ))}
                  </div>

                  <Link
                    to="/search"
                    className="mt-3 inline-block text-xs font-semibold text-ink-400 hover:text-white"
                  >
                    Recently listed on MPX Global →
                  </Link>
                </div>
              )}
              </div>
            </div>

            {/* Contextual panel — the column that makes this a web layout rather
                than a stack. Below xl it drops under the banner at full width
                instead of being hidden: on a phone it carries the only signup
                CTA a guest sees above the fold. */}
            <aside className="xl:w-80">
              {!user && (
                <div className="rounded-2xl bg-white p-6 shadow-card">
                  <p className="text-sm font-extrabold">Start sourcing</p>
                  <p className="mt-1.5 text-sm text-ink-600">
                    Create a free buyer account to save suppliers, send enquiries and chat.
                  </p>
                  <Link
                    to="/signup/buyer"
                    className="mt-4 block rounded-xl bg-crimson-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-crimson-700"
                  >
                    Create free account
                  </Link>
                  <Link
                    to="/signin"
                    className="mt-2 block rounded-xl border border-surface-border px-4 py-2.5 text-center text-sm font-bold text-crimson-700 hover:bg-crimson-50"
                  >
                    Sign in
                  </Link>
                  <hr className="my-5 border-surface-border" />
                  <p className="text-sm font-extrabold">Are you an exporter?</p>
                  <p className="mt-1.5 text-sm text-ink-600">
                    Your public profile goes live the day you register.
                  </p>
                  <Link to="/signup/exporter" className="mt-3 inline-block text-sm font-bold text-crimson-700 hover:underline">
                    Register as an exporter ›
                  </Link>
                </div>
              )}

              {isBuyer && (
                <div className="rounded-2xl bg-white p-6 shadow-card">
                  <p className="text-sm font-extrabold">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
                  {/* 🔴 Verification lives HERE, not above the catalogue: a buyer
                      is fully active from signup and verification gates nothing
                      for them (D3). Its own status detail stays on
                      /buyer/verification — a self-scoped read, not a public one. */}
                  <div className="mt-4 rounded-xl bg-warning-50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-ink-900">
                      <AlertIcon className="h-4 w-4 text-warning" aria-hidden="true" />
                      Company verification
                    </p>
                    <p className="mt-1 text-xs text-ink-600">
                      Nothing is on hold — you can browse, enquire and chat as normal.
                    </p>
                    <Link to="/buyer/verification" className="mt-2 inline-block text-xs font-bold text-crimson-700 hover:underline">
                      View status ›
                    </Link>
                  </div>
                  <hr className="my-5 border-surface-border" />
                  <Link to="/buyer/chat" className="block py-1.5 text-sm font-semibold hover:text-crimson-700">
                    Messages
                  </Link>
                  <Link to="/saved" className="block py-1.5 text-sm font-semibold hover:text-crimson-700">
                    Saved items
                  </Link>
                </div>
              )}

              {isExporter && (
                <div className="rounded-2xl bg-white p-6 shadow-card">
                  <p className="text-sm font-extrabold">Your listings</p>
                  <p className="mt-1.5 text-sm text-ink-600">
                    Manage your catalogue and reply to buyer enquiries.
                  </p>
                  <Link
                    to="/exporter/products"
                    className="mt-4 block rounded-xl bg-crimson-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-crimson-700"
                  >
                    Manage listings
                  </Link>
                  <Link
                    to="/exporter/chat"
                    className="mt-2 block rounded-xl border border-surface-border px-4 py-2.5 text-center text-sm font-bold text-crimson-700 hover:bg-crimson-50"
                  >
                    Enquiries &amp; chat
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </section>

        {/* ═════════ VALUE STRIP — factual, no counts ═════════
            Carries `id="platform"`: the shared header links there, and this strip
            plus the AI band below are what replaced the old platform-tabs
            section. An anchor with nothing to land on is a dead link
            (`web-ui-notes.md`), so the id moves with the content. */}
        <section id="platform" className="border-y border-surface-border bg-white">
          <ul className="grid w-full grid-cols-1 gap-6 px-4 py-6 sm:grid-cols-3 sm:px-6 lg:px-10 xl:px-16">
            {[
              { Icon: ShieldIcon, title: 'Human-verified exporters', body: 'A person reads the documents. Never an automated stamp.' },
              { Icon: SparkleIcon, title: "Describe it, don't guess keywords", body: 'Plain language in, matching suppliers out.' },
              { Icon: ChatIcon, title: 'Talk to the supplier directly', body: 'Structured enquiry, then live chat. No email chains.' },
            ].map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crimson-50 text-crimson-700">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="block text-sm text-ink-600">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 🔴 `FeaturedStrips` was rendered here and was REMOVED on the owner's
            instruction (2026-08-23), after the banner rotation showed test
            curation ("sssd" / "dvsfv", with a screenshot uploaded as the banner
            image) on the rebuilt landing page.
            ⚠️ CONSEQUENCE, flagged to the owner: `/admin/featured` still exists
            and still writes `FeaturedItem` rows, but nothing on the site renders
            them any more — curating content there now has no visible effect.
            The component and its API are untouched, so restoring this is one
            line; the alternative fix was to clear the test rows in admin. */}

        {/* ═════════ CATEGORIES ═════════ */}
        <section id="categories" className="w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-10 xl:px-16">
          <BlockHead
            title="Browse by category"
            sub="Goods and services, across every trade we list."
            to="/categories"
          />
          {/* The photo sits INSET inside the card with its own radius rather than
              running to the card's edge. Two reasons: nested rounding reads as a
              card rather than as a cropped photo with a caption stuck under it,
              and the white margin stops twelve unrelated photographs from
              butting into one another across the row.
              The sub-count is REAL (`subs` from the live tree, 6–10 per top
              category) — the card needed a second line, and an invented one is
              exactly what this page refuses to carry. */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
            {categories.isPending
              ? Array.from({ length: GRID_COUNT }).map((_, i) => <li key={i}><CardSkeleton ratio="aspect-[4/3]" /></li>)
              : topCategories.slice(0, GRID_COUNT).map((c) => {
                  const subs = c.subs?.length ?? 0;
                  return (
                    <li key={c.id}>
                      <Link
                        to={`/category/${c.slug ?? c.id}`}
                        className="group flex h-full flex-col rounded-2xl bg-white p-2.5 shadow-card ring-1 ring-surface-border/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:ring-crimson-200"
                      >
                        <span className="block overflow-hidden rounded-xl bg-ink-100">
                          {c.image ? (
                            <img
                              src={c.image}
                              alt=""
                              loading="lazy"
                              width={400}
                              height={300}
                              className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <NoImagePanel label={c.name} monogram ratio="aspect-[4/3]" />
                          )}
                        </span>
                        <span className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
                          <span className="line-clamp-2 text-sm font-bold leading-snug text-ink-900 group-hover:text-crimson-700">
                            {c.name}
                          </span>
                          {subs > 0 && (
                            <span className="mt-1 text-xs text-ink-600">
                              {subs} {subs === 1 ? 'subcategory' : 'subcategories'}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </section>

        {/* ═════════ GOODS / SERVICES — equal weight ═════════
            50/50 on purpose: the live catalogue is currently MOSTLY services, so
            a goods-led layout would misrepresent the platform to its first buyers. */}
        <section className="grid w-full grid-cols-1 gap-4 px-4 pb-10 sm:gap-5 sm:px-6 sm:pb-12 lg:px-10 xl:px-16 lg:grid-cols-2">
          <Link
            to="/categories?type=goods"
            className="group flex items-center gap-6 rounded-2xl bg-crimson-50 p-6 transition hover:shadow-lift sm:p-8"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold tracking-tight text-crimson-700 sm:text-xl">Physical goods</span>
              <span className="mt-1.5 block text-sm text-ink-600">
                Fabric, denim, leather, chemicals, machinery — with MOQ and per-unit pricing.
              </span>
              <span className="mt-4 inline-block text-sm font-bold text-crimson-700 group-hover:underline">Browse goods ›</span>
            </span>
            <span className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white text-crimson-700 sm:flex">
              <BoxIcon className="h-9 w-9" aria-hidden="true" />
            </span>
          </Link>
          <Link
            to="/categories?type=service"
            className="group flex items-center gap-6 rounded-2xl bg-success-50 p-6 transition hover:shadow-lift sm:p-8"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold tracking-tight text-success-700 sm:text-xl">Business services</span>
              <span className="mt-1.5 block text-sm text-ink-600">
                Software, AI/ML, cloud, marketing, QC and inspection — scoped per engagement.
              </span>
              <span className="mt-4 inline-block text-sm font-bold text-success-700 group-hover:underline">Browse services ›</span>
            </span>
            <span className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white text-success-700 sm:flex">
              <GridIcon className="h-9 w-9" aria-hidden="true" />
            </span>
          </Link>
        </section>

        {/* ═════════ AI BAND — the page's one coloured band ═════════ */}
        <section className="bg-crimson-600">
          <div className="flex w-full flex-col items-start gap-6 px-4 py-10 sm:px-6 sm:py-12 lg:flex-row lg:items-center lg:px-10 xl:px-16">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl lg:text-3xl">
                Describe what you need. We&apos;ll find it.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-crimson-100 sm:text-base">
                Skip the filters — write it the way you&apos;d say it to a colleague, and the
                platform extracts the category, quantity and budget for you.
              </p>
            </div>
            <Link
              to="/ai-search"
              className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-crimson-700 shadow-card hover:shadow-lift sm:px-7"
            >
              <SparkleIcon className="h-4 w-4" aria-hidden="true" />
              Try AI Search
            </Link>
          </div>
        </section>

        {/* ═════════ RECENTLY LISTED ═════════ */}
        <section className="w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-10 xl:px-16">
          <BlockHead
            title="Recently listed"
            sub="The newest products and services on the platform."
            to="/search"
          />

          {feed.isError ? (
            <p className="rounded-2xl border border-surface-border bg-white p-8 text-center text-sm text-ink-600">
              Listings couldn&apos;t be loaded just now.{' '}
              <button type="button" onClick={() => feed.refetch()} className="font-bold text-crimson-700 hover:underline">
                Try again
              </button>
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {feed.isPending
                  ? Array.from({ length: FEED_PAGE_SIZE }).map((_, i) => <li key={i}><CardSkeleton /></li>)
                  : products.map((p) => (
                      <li key={p.id}>
                        <ProductCard product={p} to={`/product/${p.slug ?? p.id}`} />
                      </li>
                    ))}
              </ul>

              {/* Load more, not infinite scroll — see the file note. */}
              {!feed.isPending && products.length > 0 && (
                <div className="mt-8 flex flex-col items-center gap-2">
                  {feed.hasNextPage && (
                    <button
                      type="button"
                      onClick={() => feed.fetchNextPage()}
                      disabled={feed.isFetchingNextPage}
                      className="rounded-xl border border-surface-border bg-white px-8 py-3 text-sm font-bold text-crimson-700 shadow-card hover:bg-crimson-50 disabled:opacity-60"
                    >
                      {feed.isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                  <p className="text-xs text-ink-400">
                    {feed.hasNextPage
                      ? `Showing ${products.length} of ${productTotal}`
                      : "You've seen everything listed so far"}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* ═════════ VERIFIED SUPPLIERS ═════════
            Hides entirely when none are verified yet, rather than rendering an
            empty rail. 🔴 "Verified by our team", never "Top-rated" — there is no
            rating system, so there is nothing to rate a supplier on. */}
        {(suppliers.isPending || verifiedSuppliers.length > 0) && (
          <section className="border-t border-surface-border bg-ink-50">
            <div className="w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-10 xl:px-16">
              <BlockHead
                title="Verified suppliers"
                sub="Companies whose documents our team has checked in person."
                to="/search?type=supplier"
              />
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {suppliers.isPending
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <li key={i}>
                        <div className="h-44 animate-pulse rounded-2xl bg-white" />
                      </li>
                    ))
                  : verifiedSuppliers.map((s) => (
                      <li key={s.id}>
                        <SupplierCard supplier={s} />
                      </li>
                    ))}
              </ul>
            </div>
          </section>
        )}

        {/* ═════════ HOW IT WORKS ═════════
            🔴 KEPT from the previous layout, compressed. The mockup dropped it,
            but the shared header links to `#how-it-works` on every public page,
            and a first-time international buyer who has never heard of MPX still
            needs the platform to explain itself. Moved BELOW the marketplace
            rather than deleted — the marketplace still leads. */}
        <section id="how-it-works" className="border-t border-surface-border bg-ink-50">
          <div className="w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-10 xl:px-16">
            <h2 className="text-2xl font-extrabold tracking-tight">How it works</h2>
            <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Find a supplier', 'Search or browse the catalogue — free, no account needed.'],
                ['Send an enquiry', 'Tell them exactly what you need, in a couple of clicks.'],
                ['Chat in real time', 'Talk directly with the supplier on the platform.'],
                ['Deal with confidence', 'The verified tick and a full conversation history keep both sides honest.'],
              ].map(([title, body], i) => (
                <li key={title} className="rounded-2xl bg-white p-5 shadow-card">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-crimson-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="mt-3 text-sm font-bold">{title}</p>
                  <p className="mt-1 text-sm text-ink-600">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ═════════ FAQ — same reason as How it works: the header links to it ═════════ */}
        <section id="faq" className="w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-10 xl:px-16">
          <h2 className="text-2xl font-extrabold tracking-tight">Common questions</h2>
          {/* Two columns from lg. The page runs edge-to-edge, and a single
              full-width answer would be a 200-character line — unreadable. The
              column split keeps the measure sane without reintroducing a margin. */}
          <dl className="mt-6 grid grid-cols-1 gap-x-12 border-t border-surface-border lg:grid-cols-2">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="border-b border-surface-border py-4">
                <dt className="text-sm font-bold text-ink-900">{q}</dt>
                <dd className="mt-1.5 text-sm text-ink-600">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 🔴 The "Want to sell on MPX Global?" band was REMOVED on the owner's
            instruction (2026-08-23).
            Exporter signup is still reachable from this page — the hero's
            contextual panel carries "Register as an exporter →" for a guest —
            and from the footer's "For Sellers", so `/signup/exporter` is not
            orphaned by this. Kept as a note because a landing page with no
            seller-acquisition route at all would be a different decision. */}
      </main>

      <PublicFooter />
    </div>
  );
}
