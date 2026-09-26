import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { useCanonical } from '../../lib/seo.js';
import { BannerStrip, SupplierCard, useLandingFeatured } from '../../components/catalogue/FeaturedStrips.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { CategoryCircles } from '../../components/landing/CategoryCircles.jsx';
import { TradeAgreements } from '../../components/landing/TradeAgreements.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

import {
  AlertIcon,
  BadgeCheckIcon,
  BoxIcon,
  ChatIcon,
  CreditCardIcon,
  GridIcon,
  QuoteIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
} from '../../components/ui/icons.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';

/**
 * Public landing page (`/`) — SEO surface and the platform's front door.
 *
 * ✅ The 2026-08-23 CRIMSON TRIAL is OVER — red was adopted platform-wide on
 * 2026-09-22, `primary` became that ramp, and on 2026-09-24 this page's 40
 * `crimson-*` classes were swept back to `primary-*` and the duplicate token
 * deleted. Nothing moved visually: every numbered shade of the two ramps was
 * byte-identical (verified before the sweep), which is exactly why a second
 * brand token was dangerous — two names for one colour that could silently
 * drift apart.
 *
 * ⚠️ The old warning here said "the rest of the product is still blue". It is
 * not: logo, app, admin console and every web page are red. Do not restore blue
 * to match an old mockup — `tailwind.config.js` is the colour authority.
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

/** Placeholder rows drawn while the rail loads — the rail itself shows ALL
 *  top-level categories (owner, 2026-09-23) and scrolls inside the hero's
 *  height, so this number only has to fill the visible area, not match 40. */
const RAIL_SKELETON_ROWS = 9;
/** Category tiles inside the hero panel — the mockup's 3×2 grid. */
const HERO_TILES = 6;

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
          className="hidden shrink-0 rounded-xl border border-surface-border px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 sm:inline-block"
        >
          {cta} ›
        </Link>
      )}
    </div>
  );
}


/* ---------------------------------- page ---------------------------------- */

export function Landing() {
  const { user, restoring } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  useCanonical('/');

  const categories = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  const topCategories = categories.data ?? [];
  const featured = useLandingFeatured();
  // Curated categories lead the grid; the usual ones top it up to a full grid,
  // so nothing curated means exactly the default grid (owner, 2026-09-25).
  const featuredCategoryIds = new Set(featured.categories.map((c) => c.id));
  /**
   * Curated categories lead, the rest follow — and NOTHING is sliced off.
   * The old grid cut this to twelve because twelve was all it could show; a
   * horizontal rail has no such limit, and a buyer looking for a trade we list
   * should not have to click "See all" to discover we list it. Images are
   * lazy-loaded, so the ones off-screen cost nothing until they scroll in.
   */
  const railCategories = [
    ...featured.categories,
    ...topCategories.filter((c) => !featuredCategoryIds.has(c.id)),
  ];

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
      className="flex h-11 w-full min-w-0 items-center overflow-hidden rounded-xl border-2 border-primary-600 bg-white focus-within:ring-2 focus-within:ring-primary-600/20"
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
        className="mr-1 hidden shrink-0 items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100 xl:flex"
      >
        <SparkleIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Ask AI instead
      </Link>
      <button
        type="submit"
        className="h-full shrink-0 bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700"
      >
        Search
      </button>
    </form>
  );

  return (
    <div className="bg-white text-ink-900">
      <PublicHeader centerSlot={headerSearch} />

      {/* Browse bar — the marketplace's own nav row, under the shared header.
          Scrolls horizontally rather than wrapping on a narrow phone.
          🆕 2026-09-23 — rebuilt to the owner's hero mockup. "Services" and
          "Verified exporters" are back (they were pulled on 2026-08-23), and
          "How it works" joins them; every one is a real destination. */}
      <div className="border-b border-surface-border bg-white">
        <nav
          aria-label="Browse"
          className="flex w-full items-center gap-1 overflow-x-auto px-4 py-2.5 text-sm sm:px-6 lg:px-10 xl:px-16"
        >
          <Link
            to="/categories"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-ink-900 px-4 py-2 font-bold text-white hover:bg-ink-800"
          >
            <GridIcon className="h-4 w-4" aria-hidden="true" />
            All categories
          </Link>
          <Link to="/categories?type=goods" className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 font-semibold text-ink-600 hover:bg-surface-subtle">
            Goods
          </Link>
          <Link to="/categories?type=service" className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 font-semibold text-ink-600 hover:bg-surface-subtle">
            Services
          </Link>
          <Link to="/search?type=supplier" className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 font-semibold text-ink-600 hover:bg-surface-subtle">
            Verified exporters
          </Link>
          <a href="#how-it-works" className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 font-semibold text-ink-600 hover:bg-surface-subtle">
            How it works
          </a>
          <Link
            to="/ai-search"
            className="ml-auto hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 font-bold text-primary-700 hover:bg-primary-50 md:flex"
          >
            <SparkleIcon className="h-4 w-4" aria-hidden="true" />
            AI Search
          </Link>
        </nav>
      </div>

      <main>
        {/* ═════════ HERO — category rail · banner · contextual panel ═════════
            🆕 2026-09-23 — rebuilt against the owner's mockup: a question as the
            headline, a serif face for it, six category tiles inside the panel,
            and the exporter pitch split into its own card.

            🔴 TWO THINGS IN THE MOCKUP WERE NOT BUILT AS DRAWN, both because
            they would have been false:

            1. Each tile read "[000] suppliers". That count does not exist on
               any public route, and the real numbers are worse than missing:
               of the 40 top categories, exactly THREE contain a supplier
               (Textiles 4, IT 2, Agriculture 1). Four of the six tiles drawn
               would have read "0 suppliers" on the front page. The line now
               carries the sub-category count, which is real, already in the
               tree, and needs no API change.
            2. The subhead read "Every supplier you contact is a real business,
               reviewed by our team." Only 3 of 11 companies are verified, and
               an UNVERIFIED seller is public and contactable by design (B7).
               Rewritten so the claim attaches to the tick, which is true.

            Tiles use the categories' REAL photographs rather than the mockup's
            line icons: the icon set here has no category-specific glyphs, so
            matching the drawing would have meant inventing forty of them. */}
        <section className="bg-surface-canvas py-4 sm:py-6">
          <div className="grid w-full grid-cols-1 gap-4 px-4 sm:gap-5 sm:px-6 lg:px-10 xl:px-16 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_320px]">
            {/* Always-open rail. Hidden below lg, where the category grid below
                and the browse bar above already serve the same purpose. */}
            {/* 🔴 The rail is ABSOLUTELY POSITIONED inside its grid cell, and that
                is the whole trick (owner, 2026-09-23: "only that much height we
                need, other categories come in scroll").
                A grid row is as tall as its TALLEST item, so while the rail was
                in normal flow its forty entries set the row height and the hero
                stretched to match — the opposite of what was wanted, and no
                amount of `overflow-y-auto` fixes it, because nothing was
                overflowing. Taking the panel out of flow means the rail
                contributes ZERO height: the row is sized by the hero alone, the
                stretched `aside` inherits exactly that height, and the list
                finally has something to overflow against.
                Only from `lg`, where the rail is visible at all. */}
            <aside className="relative hidden lg:block">
              <div className="absolute inset-0 flex flex-col rounded-2xl bg-white p-2 shadow-card">
              {categories.isPending ? (
                <div className="space-y-1 p-1">
                  {Array.from({ length: RAIL_SKELETON_ROWS }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-xl bg-ink-100" />
                  ))}
                </div>
              ) : (
                <>
                  {/* 🔴 EVERY top-level category, scrolling inside the hero's
                      own height (owner, 2026-09-23 — it used to show nine).
                      `min-h-0` is load-bearing: a flex child defaults to
                      min-height:auto, so without it the list refuses to shrink,
                      overflow never fires, and the rail just grows taller than
                      the hero instead of scrolling.
                      The "All N categories" link stays OUTSIDE this list so it
                      is reachable without scrolling to the bottom. */}
                  <ul className="min-h-0 flex-1 overflow-y-auto text-sm">
                    {topCategories.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/category/${c.slug ?? c.id}`}
                          className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 font-medium text-ink-900 hover:bg-primary-50 hover:text-primary-700"
                        >
                          {c.image ? (
                            <img
                              src={c.image}
                              alt=""
                              loading="lazy"
                              width={24}
                              height={24}
                              className="h-6 w-6 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <span className="h-6 w-6 shrink-0 rounded-md bg-ink-100" />
                          )}
                          <span className="truncate">{c.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 border-t border-surface-border pt-2">
                    <Link
                      to="/categories"
                      className="block rounded-xl px-2.5 py-2 text-sm font-bold text-primary-700 hover:bg-primary-50"
                    >
                      All {topCategories.length} categories →
                    </Link>
                  </div>
                </>
              )}
              </div>
            </aside>

            {/* The banner. One h1 on the page, and it lives here.
                `ink-900` (#000517), never #000000 — pure black is off the token
                scale, and this is the same fill the footer uses. */}
            <div className="rounded-2xl bg-ink-900 px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
              <p className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-primary-300">
                <ShieldIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Every tick checked by a person
              </p>
              {/* The headline is the owner's own line (2026-09-26), replacing
                  "What are you sourcing from India today?" — a question the
                  search box above already asks. This one says what the platform
                  IS, which is what a first-time visitor needs from an h1. */}
              <h1 className="max-w-2xl font-serif text-3xl leading-[1.15] text-white sm:text-4xl lg:text-[2.75rem]">
                Connecting India&apos;s Suppliers to the World
              </h1>
              {/* 🔴 NOT the mockup's "every supplier … reviewed by our team" —
                  see this section's note. The claim belongs to the tick.
                  ⚠️ "Pick a category or" was dropped with the Browse button
                  below: copy that names a control which is no longer there sends
                  people hunting for it. */}
              <p className="mt-4 max-w-xl text-sm text-ink-200 sm:text-base">
                Describe what you need and we will find it. Where you see the tick, a person on
                our team has checked that company&apos;s documents.
              </p>

              {/* 🔴 "Browse all categories" removed 2026-09-26 (owner). Browsing
                  is not lost — the sub-nav's "All categories" chip sits directly
                  above this banner and the category rail is one section below —
                  so the hero keeps ONE action instead of two competing ones. */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/ai-search"
                  className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700 sm:px-6"
                >
                  <SparkleIcon className="h-4 w-4" aria-hidden="true" />
                  Describe what you need
                </Link>
              </div>

              {/* Six real categories, straight into the catalogue. Hidden until
                  there are six to show, rather than rendering a grid with gaps.

                  🔴 NOT ON A PHONE (owner, 2026-09-25). Below `sm` the grid is a
                  single column, so six full-width tiles pushed the signup card
                  and everything after it a screen and a half down — the hero
                  became a category list. Nothing is lost: the page's own
                  categories section is one scroll away and shows twelve, two
                  across, and the browse bar sits above the hero. */}
              {topCategories.length >= HERO_TILES && (
                <ul className="mt-8 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                  {topCategories.slice(0, HERO_TILES).map((c) => {
                    const subs = c.subs?.length ?? 0;
                    return (
                      <li key={c.id}>
                        <Link
                          to={`/category/${c.slug ?? c.id}`}
                          className="flex h-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 transition hover:border-primary-300/40 hover:bg-white/[0.08]"
                        >
                          {c.image ? (
                            <img
                              src={c.image}
                              alt=""
                              loading="lazy"
                              width={40}
                              height={40}
                              className="h-10 w-10 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="h-10 w-10 shrink-0 rounded-lg bg-white/10" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-white">{c.name}</span>
                            {subs > 0 && (
                              <span className="block text-xs text-ink-400">
                                {subs} {subs === 1 ? 'subcategory' : 'subcategories'}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Contextual panel — the column that makes this a web layout rather
                than a stack. Below xl it drops under the banner at full width
                instead of being hidden: on a phone it carries the only signup
                CTA a guest sees above the fold. */}
            <aside className="space-y-4 xl:w-80">
              {/* While the session restores, a neutral placeholder — not the
                  guest signup cards, which a signed-in visitor must never see
                  flash on reload (owner, 2026-09-25). */}
              {restoring && (
                <div aria-hidden="true" className="h-56 animate-pulse rounded-2xl bg-white shadow-card motion-reduce:animate-none" />
              )}
              {!restoring && !user && (
                <>
                  <div className="rounded-2xl bg-white p-6 shadow-card">
                    <p className="text-base font-extrabold">Start sourcing</p>
                    <p className="mt-1.5 text-sm text-ink-600">
                      Free buyer account to save suppliers, send enquiries and chat.
                    </p>
                    <Link
                      to="/signup/buyer"
                      className="mt-4 block rounded-xl bg-primary-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-primary-700"
                    >
                      Create free account
                    </Link>
                    <Link
                      to="/signin"
                      className="mt-2 block rounded-xl border border-surface-border px-4 py-2.5 text-center text-sm font-bold text-ink-900 hover:bg-surface-subtle"
                    >
                      Sign in
                    </Link>
                  </div>

                  {/* Its own card now, as the mockup draws it — the exporter
                      pitch was buried under a rule inside the buyer card. */}
                  <div className="rounded-2xl bg-white p-6 shadow-card">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                      For exporters
                    </p>
                    <p className="mt-1 text-base font-extrabold">Sell to global buyers</p>
                    <p className="mt-1.5 text-sm text-ink-600">
                      Your public profile goes live the day you register. Get verified to lift
                      the listing limit.
                    </p>
                    <Link
                      to="/signup/exporter"
                      className="mt-4 inline-block text-sm font-bold text-primary-700 hover:underline"
                    >
                      Register as an exporter →
                    </Link>
                  </div>
                </>
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
                    <Link to="/buyer/verification" className="mt-2 inline-block text-xs font-bold text-primary-700 hover:underline">
                      View status ›
                    </Link>
                  </div>
                  <hr className="my-5 border-surface-border" />
                  <Link to="/buyer/chat" className="block py-1.5 text-sm font-semibold hover:text-primary-700">
                    Messages
                  </Link>
                  <Link to="/saved" className="block py-1.5 text-sm font-semibold hover:text-primary-700">
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
                    className="mt-4 block rounded-xl bg-primary-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-primary-700"
                  >
                    Manage listings
                  </Link>
                  <Link
                    to="/exporter/chat"
                    className="mt-2 block rounded-xl border border-surface-border px-4 py-2.5 text-center text-sm font-bold text-primary-700 hover:bg-primary-50"
                  >
                    Enquiries &amp; chat
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </section>

        {/* ═════════ FEATURED BANNERS — curated in /admin/featured ═════════
            Under the hero, never inside it (owner, 2026-09-25): the hero is the
            default and stays exactly as built. No live banner → no strip. */}
        {featured.banners.length > 0 && (
          <section className="w-full bg-surface-canvas px-4 pb-4 sm:px-6 sm:pb-6 lg:px-10 xl:px-16">
            <BannerStrip banners={featured.banners} />
          </section>
        )}

        {/* ═════════ WHAT MAKES MPX GLOBAL DIFFERENT ═════════
            Replaced the three-item value strip on 2026-09-26 (owner).

            🔴 It KEEPS `id="platform"`. The shared header links here, and an
            anchor with nothing to land on is a dead link (`web-ui-notes.md`) —
            so the id moves with the content, never gets dropped with it.

            🔴 Every line is something the platform ACTUALLY does today. No
            counts, no "trusted by", no promises about volume — this page has a
            standing rule against claims it cannot back (it is why the design's
            six invented testimonials were never built). If a row here stops
            being true, delete the row. */}
        <section id="platform" className="border-y border-surface-border bg-white py-12 sm:py-16">
          <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              What makes MPX Global different
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-600 sm:text-base">
              Six things that are true of this platform today — not a pitch about what it might
              become.
            </p>

            <ul className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  Icon: ShieldIcon,
                  title: 'A person reads the documents',
                  body: 'Verification is done by our team, not an automated stamp. The tick means someone checked that company\u2019s papers.',
                },
                {
                  Icon: BadgeCheckIcon,
                  title: 'Sellers are visible from day one',
                  body: 'An exporter\u2019s public profile goes live the moment they register. Verification adds the tick \u2014 it is not a gate to being found.',
                },
                {
                  Icon: SparkleIcon,
                  title: 'Describe it, don\u2019t guess keywords',
                  body: 'Write what you need in plain language and get matching suppliers back. No hunting for the exact term a seller happened to type.',
                },
                {
                  Icon: ChatIcon,
                  title: 'Talk to the supplier directly',
                  body: 'A structured enquiry, then live chat with files. No email chains, and the whole conversation stays in one place.',
                },
                {
                  Icon: QuoteIcon,
                  title: 'Real quotations, not chat messages',
                  body: 'Sellers send a priced PDF into the chat. Either side can counter-offer, and both confirm the final figure with a code sent to their email.',
                },
                {
                  /* 🔴 True TODAY. Escrow is a Phase-2 idea; if it ever ships,
                     this row has to change with it or it becomes a lie. */
                  Icon: CreditCardIcon,
                  title: 'You pay the supplier directly',
                  body: 'MPX Global does not hold or move your money. The quotation carries the seller\u2019s own bank details for you to pay against.',
                },
              ].map(({ Icon, title, body }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-ink-900">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-600">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* `FeaturedStrips` was removed from here on 2026-08-23 (test curation
            reached the banner rotation) and RESTORED on 2026-09-25 (owner) as
            pieces placed into this page's own sections — banners under the
            hero, featured categories leading the category grid, featured
            products above "Recently listed", highlighted suppliers below it.
            Each falls back to the page's default when nothing is curated. */}

        {/* ═════════ CATEGORIES ═════════ */}
        {/* Why India — the question a foreign buyer asks straight after "why
            this platform". Every agreement named in it is real; see the
            component, which also says plainly that there is no India–US FTA. */}
        <TradeAgreements />

        <section id="categories" className="w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-10 xl:px-16">
          <BlockHead
            title="Browse by category"
            sub="Goods and services, across every trade we list."
            to="/categories"
          />
          {/* 🔴 CIRCLES IN A SCROLLING RAIL since 2026-09-26 (owner), replacing a
              12-card grid. Two things the grid could not do: it showed twelve of
              forty categories and stopped, and on a wide screen it spent a third
              of the fold on photographs of things nobody had asked for. The rail
              carries EVERY top-level category and takes one row.

              The sub-count is REAL (`subs` from the live tree) — an invented
              second line is exactly what this page refuses to carry. */}
          <CategoryCircles categories={railCategories} loading={categories.isPending} />
        </section>

        {/* ═════════ GOODS / SERVICES — the fork in the road ═════════
            50/50 on purpose: the live catalogue is currently MOSTLY services, so
            a goods-led layout would misrepresent the platform to its first buyers.

            🔴 MATCHED PAIR — do not give these two cards different colours.
            Rebuilt 2026-09-24 (owner: "not matching and awkward") from a
            red-tinted card beside a GREEN one: two hues with no system behind
            them, and the green was the bigger problem, because `success` is this
            product's verified/approved colour and spending it on decoration
            thins the one signal buyers are meant to trust. They differ by ICON
            and COPY, which is what actually distinguishes them.

            🔴 MADE TO STAND OUT 2026-09-26 (owner: "its very very imp", then
            "naya rang laga kar dekho jo match bhi kare or stand out bhi kare").
            It was two flat white cards with a text link and NO HEADING, sitting
            after the category rail — so the page's single most important choice,
            goods or services, read as two leftover tiles.

            🔴 BLACK cards with a RED call to action (owner, 2026-09-26). Navy
            was tried first — it is the logo's own navy — but red on navy
            measures **2.00:1**, a dark blob on dark, the same failure that
            forced `danger` to move in September when it sat at 1.19:1 against
            the brand. On `ink-900` the same red measures **3.54:1**, which
            clears the 3:1 that a non-text component needs, and the button's own
            white-on-red is 5.73:1. Measured, not eyeballed.

            Black is already this page's second voice — the header's "Get
            Started" is `ink-900` — so two black cards read as the same product,
            not as a new idea. And it keeps RED where red belongs: the action.

            🔴 Do NOT give the two cards different colours. The earlier attempt
            at making this pair distinctive was a red card beside a GREEN one
            (owner: "not matching and awkward"), and green is worse than merely
            mismatched: `success` is this product's verified/approved colour, and
            spending it on decoration thins the one signal buyers must trust. */}
        <section className="w-full bg-surface-canvas px-4 py-12 sm:px-6 sm:py-14 lg:px-10 xl:px-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            Goods or services — both are here
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-600 sm:text-base">
            Most sourcing platforms carry one or the other. Pick the side you are buying from.
          </p>

          <div className="mt-7 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            {[
              {
                to: '/categories?type=goods',
                Icon: BoxIcon,
                title: 'Physical goods',
                body: 'Fabric, denim, leather, chemicals, machinery — with MOQ and per-unit pricing.',
                cta: 'Browse goods',
              },
              {
                to: '/categories?type=service',
                Icon: GridIcon,
                title: 'Business services',
                body: 'Software, AI/ML, cloud, marketing, QC and inspection — scoped per engagement.',
                cta: 'Browse services',
              },
            ].map(({ to, Icon, title, body, cta }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col rounded-2xl bg-ink-900 p-6 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-8"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </span>
                <span className="mt-5 block text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  {title}
                </span>
                {/* `ink-300` on black is 11.95:1 — body copy on a dark card has
                    to stay readable, not fade into it. */}
                <span className="mt-2 block flex-1 text-sm leading-relaxed text-ink-300 sm:text-[15px]">
                  {body}
                </span>
                {/* A button, not a text link: this is the action the section
                    exists for. It is a <span> because the whole card is already
                    the <Link> — a link inside a link is invalid and breaks
                    keyboard order. */}
                <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-primary-600/25 transition group-hover:bg-primary-700">
                  {cta}
                  <span aria-hidden="true">›</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ═════════ AI BAND — the page's one coloured band ═════════ */}
        <section className="bg-primary-600">
          <div className="flex w-full flex-col items-start gap-6 px-4 py-10 sm:px-6 sm:py-12 lg:flex-row lg:items-center lg:px-10 xl:px-16">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl lg:text-3xl">
                Describe what you need. We&apos;ll find it.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-primary-100 sm:text-base">
                Skip the filters — write it the way you&apos;d say it to a colleague, and the
                platform extracts the category, quantity and budget for you.
              </p>
            </div>
            <Link
              to="/ai-search"
              className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-primary-700 shadow-card hover:shadow-lift sm:px-7"
            >
              <SparkleIcon className="h-4 w-4" aria-hidden="true" />
              Try AI Search
            </Link>
          </div>
        </section>

        {/* ═════════ FEATURED PRODUCTS — curated; none → section absent ═════════ */}
        {featured.products.length > 0 && (
          <section className="w-full px-4 pt-10 sm:px-6 sm:pt-12 lg:px-10 xl:px-16">
            <BlockHead title="Featured products" sub="Picked by the MPX Global team." to="/search" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {/* ProductCard renders its own <li>. */}
              {featured.products.map((p) => (
                <ProductCard key={p.id} product={p} to={`/product/${p.slug ?? p.id}`} />
              ))}
            </ul>
          </section>
        )}

        {/* ═════════ RECENTLY LISTED — REMOVED 2026-09-26 (owner: "ye wala
            section abhi ke liye hata do") ═════════

            🔴 TEMPORARY, and the reason matters: the catalogue is still test
            data, so the newest-first feed was putting "Banna Chips — USD 2,000
            /kg" and "Lamborghini Mirrors" filed under Office furniture at the
            front of a public page. A feed of the newest listings is only as good
            as the listings; with real sellers on it this section earns its place
            back.

            Removing the markup alone left the `useInfiniteQuery` still firing a
            search request on every public landing load, feeding nothing — lint
            caught it via the orphaned `products` / `productTotal`. The query,
            `CardSkeleton` and `FEED_PAGE_SIZE` went with it. `ProductCard` stays:
            the curated "Featured products" strip uses it.

            To restore, bring the block back from git history — it had a working
            error state, a five-across cap and "Load more" rather than infinite
            scroll, none of which is worth rewriting from memory. */}

        {/* ═════════ HIGHLIGHTED SUPPLIERS — curated only ═════════
            There is deliberately NO default here: the default suppliers section
            is the one removed below, and curation must not bring it back by the
            side door when nothing is picked. */}
        {featured.suppliers.length > 0 && (
          <section className="w-full px-4 pb-10 sm:px-6 sm:pb-12 lg:px-10 xl:px-16">
            <BlockHead title="Highlighted suppliers" sub="Companies picked by the MPX Global team." to="/search?type=supplier" />
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {featured.suppliers.map((sup) => (
                <li key={sup.id}><SupplierCard supplier={sup} /></li>
              ))}
            </ul>
          </section>
        )}

        {/* 🔴 The "Verified suppliers" section was REMOVED from this page on the
            owner's instruction (2026-09-23).
            Nothing was orphaned: the browse bar's "Verified exporters" link and
            the supplier cards' own destination both still point at
            `/search?type=supplier`, which is where the full, filterable list
            lives. Its query, card component and page-size constant went with it
            rather than being left behind as dead code. */}
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
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
