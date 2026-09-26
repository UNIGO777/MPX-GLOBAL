import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { useCanonical } from '../../lib/seo.js';
import { BannerStrip, SupplierCard, useLandingFeatured } from '../../components/catalogue/FeaturedStrips.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { CategoryCircles } from '../../components/landing/CategoryCircles.jsx';
import { CircuitHero } from '../../components/landing/CircuitHero.jsx';
import { PlatformCards } from '../../components/landing/PlatformCards.jsx';
import { PromoPanels } from '../../components/landing/PromoPanels.jsx';
import { TradeAgreements } from '../../components/landing/TradeAgreements.jsx';

import {
  ArrowRightIcon,
  BoxIcon,
  GridIcon,
  SearchIcon,
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


/* --------------------------------- pieces --------------------------------- */

/**
 * Example prompts for the hero's AI field.
 *
 * 🔴 Each one is the SHAPE of a real sourcing request — a product, a quantity,
 * a specification, a destination — because the thing a visitor cannot guess from
 * an empty box is how much detail the AI will actually take. They are not claims
 * that these exact goods are listed; clicking one runs the search and the page
 * reports honestly what it finds, including nothing.
 */
const HERO_EXAMPLES = [
  '500 kg organic turmeric powder',
  'cotton fabric, 120 GSM, shipped to Rotterdam',
  'stainless steel fasteners, ISO 898',
];

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

  /* The hero's AI field. Its own state, NOT the header's `query`: the two boxes
     are visible at the same time, and mirroring what you type from one into the
     other reads as a bug. They also go to different places — the header does a
     catalogue search, the hero asks the AI. */
  const [heroQuery, setHeroQuery] = useState('');

  /* 🔴 The backdrop measures these two boxes at runtime and builds its geometry
     from them, so the pulses converge on the field at EVERY viewport instead of
     only at the one the numbers were once read off. See CircuitHero. */
  const heroFieldRef = useRef(null);
  const heroCopyRef = useRef(null);

  const askAi = (text) => {
    const q = text.trim();
    navigate(q ? `/ai-search?q=${encodeURIComponent(q)}` : '/ai-search');
  };

  const onAiSearch = (e) => {
    e.preventDefault();
    askAi(heroQuery);
  };

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

          🔴 HIDDEN BELOW `sm` (owner, 2026-09-27: "remove this header in mobile
          version"). On a phone it was a scrolling strip with most of its items
          off-screen, and it cost ~46px of the fold the hero had just been cut to
          fit inside. Kept from `sm` up, where the row has room to be read.

          ⚠️ What that costs on a phone, checked link by link before hiding it:
            · "All categories" and "How it works" — still in the header's own
              hamburger menu (`PublicHeader`'s `NAV`), so nothing is lost;
            · "Goods" / "Services" — these point at `/categories?type=…`, and
              `Categories.jsx` never reads that param, so they already landed on
              the same page as "All categories". Nothing is lost here either, but
              the dead param is a pre-existing bug worth fixing separately;
            · "AI Search" — the hero's own field and its example chips go to
              `/ai-search`, so it is still one tap away;
            · 🔴 "Verified exporters" (`/search?type=supplier`) is the ONE real
              loss. Supplier mode has no other entry point since the owner had
              the Products|Suppliers toggle removed from `/search`, so on a phone
              that mode is now unreachable from this page. Raised with the owner.
          🆕 2026-09-23 — rebuilt to the owner's hero mockup. "Services" and
          "Verified exporters" are back (they were pulled on 2026-08-23), and
          "How it works" joins them; every one is a real destination. */}
      <div className="hidden border-b border-surface-border bg-white sm:block">
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
        {/* ═════════ HERO — AI MATCH-MAKING ═════════
            Rebuilt 2026-09-26 on the owner's brief: "we are making this section
            for reflecting our biggest fiture for ai match making… make a search
            bar and connect all line with that". The band's whole job is to put
            ONE field in front of a visitor and have every moving thing on the
            page point at it.

            Ground is `surface-canvas` — the token that already existed for this
            band ("the landing hero's page ground"), warm on purpose so it does
            not fight the red brand. Do not add a second cream.

            🔴 STILL MISSING from the pre-2026-09-26 hero, and still logged in
            `docs/UiWebNotes.md`: the guest signup cards ("Start sourcing" / "For
            exporters") and the always-open category rail. The signup cards were
            the only registration CTA a visitor met above the fold on a phone —
            nothing here replaces that yet. The old hero is intact at
            `/landing-2` and in git history. */}
        <section className="relative isolate overflow-hidden bg-surface-canvas text-ink-900">
          {/* Backdrop only — it draws the red pulses and nothing else, and it is
              `pointer-events-none`, so it can never intercept a click meant for
              the field sitting on top of it. */}
          <CircuitHero targetRef={heroFieldRef} copyRef={heroCopyRef} />

          {/* `max(560px, 76vh)` rather than a bare `vh`: on a short laptop 76vh
              is under 500px and the section stops feeling like a hero at all,
              which is the thing the owner asked to fix. The floor holds it. */}
          <div className="relative flex min-h-[56svh] w-full flex-col items-center justify-center px-4 py-8 text-center max-[359px]:py-5 sm:min-h-[min(820px,max(560px,74vh))] sm:px-6 sm:py-20 lg:px-10 xl:px-16">
            <div ref={heroCopyRef} className="flex w-full flex-col items-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary-600/25 bg-white/70 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-700 backdrop-blur-sm">
                <SparkleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                AI match-making
              </p>

              <h1 className="mt-4 max-w-4xl text-balance text-[27px] font-extrabold leading-[1.08] max-[359px]:text-[24px] tracking-tight text-ink-900 sm:mt-6 sm:text-5xl lg:text-6xl">
                Connecting India&apos;s Suppliers to the World
              </h1>

              {/* 🔴 Describes what the feature ACTUALLY does — it reads your
                  requirement and finds suppliers already on this platform. No
                  number of suppliers, no "instant", no accuracy claim: this is a
                  trust marketplace and the page may not promise what cannot be
                  shown (the same rule that kept invented testimonials off it). */}
              <p className="mt-3 max-w-2xl text-pretty text-[14.5px] leading-relaxed text-ink-600 max-[359px]:text-[13.5px] sm:mt-5 sm:text-lg">
                Describe what you need — material, quantity, specification, destination. Our AI
                matches you with verified Indian exporters who can supply it.
              </p>
            </div>

            {/* The field every trace on this page terminates on. Capped at
                720px because that is the width where the backdrop's own bar zone
                lines up with it (see CircuitHero). */}
            <form
              ref={heroFieldRef}
              role="search"
              onSubmit={onAiSearch}
              className="mt-7 flex w-full max-w-[720px] flex-col gap-2 sm:mt-20 sm:flex-row sm:items-center sm:gap-0 sm:rounded-2xl sm:border-2 sm:border-primary-600 sm:bg-white sm:p-1.5 sm:shadow-lift sm:focus-within:ring-4 sm:focus-within:ring-primary-600/15"
            >
              <label className="sr-only" htmlFor="hero-ai-q">
                Describe what you want to source
              </label>
              <div className="flex min-w-0 flex-1 items-center rounded-2xl border-2 border-primary-600 bg-white px-4 py-0 sm:rounded-none sm:border-0">
                <SearchIcon className="mr-3 h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
                <input
                  id="hero-ai-q"
                  type="search"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="500 kg organic turmeric powder, shipped to Dubai"
                  className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-400"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-7 text-sm font-extrabold text-white transition hover:bg-primary-700 sm:h-11 sm:rounded-xl"
              >
                Find suppliers
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            {/* Real controls: each one runs that search. They are examples of
                the KIND of sentence the AI handles, which is the part a visitor
                cannot guess from an empty box. */}
            <div className="scrollbar-none mt-4 flex w-full max-w-[720px] items-center gap-2 overflow-x-auto max-[359px]:hidden sm:mt-5 sm:w-auto sm:max-w-none sm:flex-wrap sm:justify-center sm:overflow-visible">
              <span className="shrink-0 text-[12.5px] text-ink-500">Try:</span>
              {HERO_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => askAi(example)}
                  className="shrink-0 whitespace-nowrap rounded-full border border-surface-border bg-white/80 px-3.5 py-1.5 text-[12.5px] text-ink-700 backdrop-blur-sm transition hover:border-primary-600 hover:text-primary-700"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ═════════ THREE PROMO PANELS ═════════
            Directly under the hero (owner, 2026-09-27, to the store layout they
            sent): one full-width panel over two halves. Fixed navigation into
            the platform's three entry points, NOT the admin banner strip — that
            still runs below this and holds up to 24 rotating banners.

            🔴 This also restores the only way into SUPPLIER search on a phone.
            `/search?type=supplier` lost its entry point when the browse bar was
            hidden on mobile (2026-09-27), because the Products|Suppliers toggle
            had already been removed from `/search`. The lead panel is that link. */}
        <PromoPanels />

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
            being true, delete the row.

            🆕 2026-09-27 — the six icon rows became picture cards
            (`PlatformCards.jsx`, to the layout the owner sent). The sentences
            moved across unchanged; the artwork is still to come. */}
        <section id="platform" className="border-y border-surface-border bg-white py-12 sm:py-16">
          <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              What makes MPX Global different
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-600 sm:text-base">
              Eight things that are true of this platform today — not a pitch about what it might
              become.
            </p>

            <PlatformCards />
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
