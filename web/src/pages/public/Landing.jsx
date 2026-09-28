import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { useCanonical } from '../../lib/seo.js';
import { BannerStrip, useLandingFeatured } from '../../components/catalogue/FeaturedStrips.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { CategoryCircles } from '../../components/landing/CategoryCircles.jsx';
import { HeroBackdrop } from '../../components/landing/HeroBackdrop.jsx';
import { FaqAccordion } from '../../components/landing/FaqAccordion.jsx';
import { AiBandVideo } from '../../components/landing/AiBandVideo.jsx';
import { AudienceFork } from '../../components/landing/AudienceFork.jsx';
import { PlatformCards } from '../../components/landing/PlatformCards.jsx';
import { PromoPanels } from '../../components/landing/PromoPanels.jsx';
import { TradeAgreements } from '../../components/landing/TradeAgreements.jsx';

import {
  ArrowRightIcon,
  BoxIcon,
  ChatIcon,
  EnquiryIcon,
  GridIcon,
  QuoteIcon,
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
    /* True today: the quotation module is built (priced PDF into the chat,
       counter-offers, both sides confirm with an emailed code). */
    q: 'How do quotations work?',
    a: 'A seller sends a priced quotation as a PDF inside the chat. Either side can counter-offer, and both confirm the final figure with a code sent to their email — so the agreed price is on record for both of you.',
  },
  {
    /* 🔴 Must stay true: MPX Global holds no money (Phase 1). Do not turn this
       into a payment-protection promise — see PlatformCards' Payments note. */
    q: 'Does MPX Global handle payments?',
    a: 'No. You pay the supplier directly, against the bank details on their quotation. MPX Global does not hold or move money between buyers and sellers.',
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
// One realistic buyer request per industry (agri · textiles · industrial) —
// sentence case, short enough to read at a glance (owner, 2026-09-27).
const HERO_EXAMPLES = [
  'Organic turmeric powder, 5 tonnes to Dubai',
  '120 GSM cotton poplin for shirts',
  'ISO-certified stainless steel fasteners',
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

  /* The hero's AI field. Its own state, NOT the header search's: the two boxes
     are visible at the same time, and mirroring what you type from one into the
     other reads as a bug. They also go to different places — the header does a
     catalogue search, the hero asks the AI. */
  const [heroQuery, setHeroQuery] = useState('');

  const askAi = (text) => {
    const q = text.trim();
    navigate(q ? `/ai-search?q=${encodeURIComponent(q)}` : '/ai-search');
  };

  const onAiSearch = (e) => {
    e.preventDefault();
    askAi(heroQuery);
  };



  return (
    <div className="bg-white text-ink-900">
      <PublicHeader />

      {/* The second "browse" row that sat here was folded into the shared
          header on 2026-09-27 (owner: premium navbar redesign) — see
          `PublicHeader`. The masthead search moved there too, as a compact
          field; the hero keeps the big one. */}
      <main>
        {/* ═════════ HERO — AI MATCH-MAKING ═════════
            Rebuilt 2026-09-26 on the owner's brief: "we are making this section
            for reflecting our biggest fiture for ai match making… make a search
            bar and connect all line with that". The band's whole job is to put
            ONE field in front of a visitor.

            2026-09-27 (owner): restyled to the reference they sent, "exactly
            same design" — white ground, faint grid, soft red glow, still blobs
            and three small shapes drifting slowly (`HeroBackdrop`). The red
            circuit lines that ran into the field were REMOVED on the owner's
            instruction ("remove them") — do not bring moving lines back.

            🔴 STILL MISSING from the pre-2026-09-26 hero, and still logged in
            `docs/UiWebNotes.md`: the guest signup cards ("Start sourcing" / "For
            exporters") and the always-open category rail. The signup cards were
            the only registration CTA a visitor met above the fold on a phone —
            nothing here replaces that yet. The old hero is intact at
            `/landing-2` and in git history. */}
        <section className="relative isolate overflow-hidden bg-white text-ink-900">
          {/* Grid, glow, blobs and floating shapes (owner, 2026-09-27: "background
              is too plain", to their reference). */}
          <HeroBackdrop />

          {/* `max(560px, 76vh)` rather than a bare `vh`: on a short laptop 76vh
              is under 500px and the section stops feeling like a hero at all,
              which is the thing the owner asked to fix. The floor holds it. */}
          <div className="relative flex min-h-[56svh] w-full flex-col items-center justify-center px-4 py-8 text-center max-[359px]:py-5 sm:min-h-[min(820px,max(560px,74vh))] sm:px-6 sm:py-20 lg:px-10 xl:px-16">
            <div className="flex w-full flex-col items-center">
              <p className="inline-flex items-center gap-2.5 rounded-full border border-surface-border bg-white px-4 py-1.5 text-[12.5px] font-semibold text-ink-700 shadow-sm sm:px-5 sm:py-2 sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 animate-pulse-soft rounded-full bg-primary-600 motion-reduce:animate-none" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary-700">AI</span>
                </span>
                <span aria-hidden="true" className="h-4 w-px bg-surface-border" />
                Match-making for global buyers
              </p>

              <h1 className="mt-5 max-w-5xl text-balance text-[30px] font-extrabold leading-[1.06] max-[359px]:text-[26px] tracking-tight text-ink-900 sm:mt-8 sm:text-5xl lg:text-6xl xl:text-7xl">
                Connecting India&apos;s Suppliers
                <br />
                <span className="relative inline-block pb-1">
                  <span className="text-gradient-brand">to the World</span>
                  {/* Hand-drawn underline that draws itself once on load. */}
                  <svg
                    aria-hidden="true"
                    className="absolute -bottom-1 left-0 w-full sm:-bottom-2"
                    viewBox="0 0 300 12"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 8C50 2 100 4 150 6C200 8 250 4 298 7"
                      pathLength="1"
                      strokeDasharray="1"
                      className="animate-draw-line stroke-primary-600 motion-reduce:animate-none"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              {/* 🔴 Describes what the feature ACTUALLY does — it reads your
                  requirement and finds suppliers already on this platform. No
                  number of suppliers, no "instant", no accuracy claim: this is a
                  trust marketplace and the page may not promise what cannot be
                  shown (the same rule that kept invented testimonials off it). */}
              <p className="mt-3 max-w-2xl text-pretty text-[14.5px] leading-relaxed text-ink-600 max-[359px]:text-[13.5px] sm:mt-5 sm:text-lg">
                Describe what you need — material, quantity, specification, destination. Our AI
                matches you with{' '}
                <span className="font-semibold text-ink-900">verified Indian exporters</span> who can
                supply it.
              </p>
            </div>

            {/* The AI field — the one thing the hero asks a visitor to use.
                Phones (owner, 2026-09-27: "think of better design for search and
                button"): an AI prompt card — the field on top, a slim bottom row
                with the hint and a compact pill — so it reads as ONE object, not
                two stacked slabs. sm+: one row, grey field + big button. The
                bottom row is `sm:contents`, which lifts the button into the row. */}
            <form
              role="search"
              onSubmit={onAiSearch}
              className="mt-7 flex w-full max-w-[720px] flex-col rounded-3xl border border-surface-border bg-white p-2 shadow-lift transition-shadow focus-within:border-primary-600/40 focus-within:ring-4 focus-within:ring-primary-600/10 sm:mt-14 sm:flex-row sm:items-center sm:gap-2 sm:rounded-2xl sm:p-2.5"
            >
              <label className="sr-only" htmlFor="hero-ai-q">
                Describe what you want to source
              </label>
              <div className="flex min-w-0 flex-1 items-center px-3 sm:rounded-xl sm:bg-ink-50 sm:px-4">
                <SearchIcon className="mr-3 hidden h-5 w-5 shrink-0 text-ink-500 sm:block" aria-hidden="true" />
                <input
                  id="hero-ai-q"
                  type="search"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="Describe what you want to source…"
                  className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink-900 outline-none placeholder:text-ink-500 sm:h-14 sm:text-[15px]"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-ink-100 pl-3 pt-2 max-[359px]:justify-end sm:contents">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink-500 max-[359px]:hidden sm:hidden">
                  <SparkleIcon className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" />
                  AI match-making
                </span>
                {/* "Get matched" (owner, 2026-09-27: rename to something that
                    hooks more) — says what the AI does for you, not what you do. */}
                <button
                  type="submit"
                  className="group inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-primary-500 to-primary-700 px-4 text-[14px] font-semibold tracking-tight text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_10px_24px_-10px_theme(colors.primary.600/70%)] transition hover:from-primary-600 hover:to-primary-800 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_14px_28px_-10px_theme(colors.primary.600/80%)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/25 active:translate-y-px sm:h-14 sm:gap-2 sm:rounded-xl sm:px-8 sm:text-base"
                >
                  <SparkleIcon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                  Get matched
                  <ArrowRightIcon
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </form>

            {/* Real controls: each one runs that search — examples of the KIND
                of sentence the AI handles, the part a visitor cannot guess from
                an empty box. (owner, 2026-09-27) sm+: "Try asking" + sparkle
                pills in one row. Phones: the pills took three stacked rows and
                looked cheap there, so a single quiet text line that scrolls
                sideways under a fade. */}
            {/* Phones: ONE line of small chips in the desktop pills' style,
                scrolling sideways with snap, faded at the right edge. */}
            <div className="relative -mx-4 mt-3 w-[calc(100%+2rem)] sm:hidden">
              <div className="scrollbar-none flex snap-x snap-mandatory items-center gap-1.5 overflow-x-auto scroll-px-4 px-4 pr-10">
                <span className="shrink-0 snap-start pr-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">Try</span>
                {HERO_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => askAi(example)}
                    className="flex h-7 shrink-0 snap-start items-center gap-1 whitespace-nowrap rounded-full border border-ink-200/70 bg-white/80 px-2.5 text-[11.5px] text-ink-600 transition active:border-primary-600/40 active:bg-primary-50/60"
                  >
                    <SparkleIcon className="h-2.5 w-2.5 shrink-0 text-primary-600" aria-hidden="true" />
                    {example}
                  </button>
                ))}
              </div>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white via-white/70 to-transparent"
              />
            </div>

            <div className="mt-6 hidden w-full max-w-5xl flex-col items-center sm:flex">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Try asking</p>
              <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                {HERO_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => askAi(example)}
                    className="group flex min-h-[40px] items-center gap-2.5 rounded-full border border-ink-200/80 bg-white/80 px-3.5 text-[13px] text-ink-700 shadow-sm backdrop-blur-sm transition hover:border-primary-600/40 hover:bg-primary-50/60 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/15"
                  >
                    <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden="true" />
                    {example}
                    <ArrowRightIcon
                      className="-ml-1 h-3.5 w-0 shrink-0 text-primary-700 opacity-0 transition-all group-hover:ml-0 group-hover:w-3.5 group-hover:opacity-100 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═════════ BUYER / SUPPLIER FORK ═════════
            Straight after the hero (client brief, 2026-09-28): "Are you a
            buyer? | Are you a supplier?" → /suppliers or exporter signup. */}
        <AudienceFork />

        {/* ═════════ CATEGORIES ═════════
            Above the sector panels (owner, 2026-09-28). */}
        <section id="categories" className="w-full px-4 pb-2 pt-10 sm:px-6 sm:pb-2 sm:pt-14 lg:px-10 lg:pt-16 xl:px-16">
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

        {/* ═════════ BROWSE BY SECTOR ═════════
            Directly under the hero: a bento grid of the three sector tiles
            (redesigned 2026-09-27 — see PromoPanels). Fixed navigation, NOT the
            admin banner strip, which still runs below and holds up to 24
            rotating banners. Supplier search now lives in the header's
            "Suppliers" link (phone menu too), not in this block. */}
        <PromoPanels />

        {/* ═════════ FEATURED BANNERS — curated in /admin/featured ═════════
            Under the hero, never inside it (owner, 2026-09-25): the hero is the
            default and stays exactly as built. No live banner → no strip. */}
        {featured.banners.length > 0 && (
          <section className="w-full bg-white px-4 pb-10 sm:px-6 sm:pb-14 lg:px-10 lg:pb-16 xl:px-16">
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

            🆕 2026-09-27 — picture cards (`PlatformCards.jsx`); restyled the same
            day as clean feature cards (words below the picture, a swipeable row
            on phones). The sentences are unchanged. */}
        <section id="platform" aria-labelledby="platform-heading" className="bg-surface-subtle py-10 sm:py-14 lg:py-16">
          <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Why MPX Global</p>
            <h2 id="platform-heading" className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              What makes MPX Global different
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base">
              Eight things that are true of the platform today — not promises.
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

        {/* Why India — the question a foreign buyer asks straight after "why
            this platform". Every agreement named in it is real; see the
            component, which also says plainly that there is no India–US FTA. */}
        <TradeAgreements />


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
        {/* 2026-09-28 restyle (owner: premium, section by section): white
            ground like the sections around it, eyebrow + heading, and the black
            cards gain a soft red glow, a dot texture, example chips and the
            round arrow the sector tiles use. Still a MATCHED PAIR — same
            colour, told apart by icon and copy (see above). */}
        <section aria-labelledby="fork-heading" className="w-full bg-white px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Goods &amp; services</p>
          <h2 id="fork-heading" className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            Source products and services in one place
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base">
            Most platforms offer one or the other. Choose where you want to start.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-2">
            {[
              {
                to: '/categories?type=goods',
                Icon: BoxIcon,
                eyebrow: 'Goods',
                title: 'Physical products',
                body: 'Listed with MOQ, per-unit pricing and lead times.',
                chips: ['Fabric & yarn', 'Leather', 'Chemicals', 'Machinery'],
              },
              {
                to: '/categories?type=service',
                Icon: GridIcon,
                eyebrow: 'Services',
                title: 'Business services',
                body: 'Scoped per engagement, direct with the team that delivers.',
                chips: ['Software', 'AI / ML', 'Cloud', 'QC & inspection'],
              },
            ].map(({ to, Icon, eyebrow, title, body, chips }) => (
              <Link
                key={to}
                to={to}
                className="group relative isolate flex flex-col overflow-hidden rounded-3xl bg-ink-900 p-5 shadow-card ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/40 sm:p-8"
              >
                {/* Texture + glow: decoration only. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_70%)]"
                />
                <span
                  aria-hidden="true"
                  className="absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-primary-600/25 blur-3xl transition-opacity duration-500 group-hover:opacity-100 sm:opacity-70"
                />

                <span className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink-900 transition-colors duration-300 group-hover:bg-primary-600 group-hover:text-white sm:h-11 sm:w-11"
                  >
                    <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-45 motion-reduce:transition-none" />
                  </span>
                </span>

                <span className="mt-5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-300 sm:mt-8">
                  {eyebrow}
                </span>
                <span className="mt-1 block text-xl font-bold tracking-tight text-white sm:text-[28px]">{title}</span>
                {/* ink-300 on black is 11.95:1 — body stays readable. */}
                <span className="mt-1.5 block text-sm leading-relaxed text-ink-300 sm:text-[15px]">{body}</span>
                <span className="mt-4 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
                  {chips.map((c) => (
                    <span key={c} className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11.5px] font-medium text-white/85 ring-1 ring-white/10 sm:text-[12.5px]">
                      {c}
                    </span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ═════════ AI BAND — the page's one coloured band ═════════
            A muted looping clip sits behind it at every width — a light 0.3MB
            copy below lg (2026-09-28), the full clip above. See `AiBandVideo.jsx`. */}
        <section className="relative isolate overflow-hidden bg-primary-600">
          <AiBandVideo />
          {/* 🔴 The scrim that makes the copy readable lives INSIDE
              `AiBandVideo`, so it always ships with the clip. The measurements
              behind it are in that file. */}
          <div className="flex w-full flex-col items-start gap-6 px-4 py-10 sm:px-6 sm:py-12 lg:flex-row lg:items-center lg:px-10 xl:px-16">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl lg:text-3xl">
                Describe what you need. We&apos;ll find it.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white sm:text-base">
                Skip the filters — write it the way you&apos;d say it to a colleague, and the
                platform extracts the category, quantity and budget for you.
              </p>
            </div>
            {/* Hover (owner, 2026-09-28): lifts with a red glow, the sparkle
                turns and an arrow slides in. Stops under reduced motion. */}
            <Link
              to="/ai-search"
              className="group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-primary-700 shadow-card ring-1 ring-white/40 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-8px_rgb(206_6_26/0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-7"
            >
              <SparkleIcon
                className="h-4 w-4 transition-transform duration-500 group-hover:rotate-[20deg] group-hover:scale-125 motion-reduce:transition-none"
                aria-hidden="true"
              />
              Try AI Search
              <ArrowRightIcon
                className="-ml-1 h-4 w-0 opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:w-4 group-hover:opacity-100 motion-reduce:transition-none"
                aria-hidden="true"
              />
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

        {/* ═════════ VERIFIED SUPPLIERS — MOVED 2026-09-28 ═════════
            The "Verified suppliers" showcase now lives on `/suppliers`
            (owner: "remove verified supplier from landing page"). The
            landing reaches it through the buyer/supplier switch below the hero. */}

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
        {/* 2026-09-28 restyle (owner: premium, section by section): a step
            flow — desktop, four steps joined by a line with round markers and
            large numerals; phone, a vertical timeline. Still an `<ol>`: the
            order is the meaning. Step 4 names the quotation flow (built:
            priced PDF, counter-offers, both sides confirm with an emailed
            code) instead of the vaguer "Deal with confidence". Nothing here
            claims payment protection — MPX Global moves no money. */}
        <section id="how-it-works" aria-labelledby="how-heading" className="bg-white">
          <div className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">How it works</p>
            <h2 id="how-heading" className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              From first search to agreed quotation
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base">
              Four steps, all on the platform, all free for buyers.
            </p>

            <ol className="relative mt-8 grid gap-0 sm:mt-10 lg:grid-cols-4 lg:gap-8">
              {[
                [SearchIcon, 'Find a supplier', 'Search or browse the catalogue — free, no account needed.'],
                [EnquiryIcon, 'Send an enquiry', 'Tell the supplier exactly what you need, in a couple of clicks.'],
                [ChatIcon, 'Chat in real time', 'Talk directly on the platform, with files and full history.'],
                [QuoteIcon, 'Agree the quotation', 'Receive a priced quotation, counter-offer, and confirm it together.'],
              ].map(([Icon, title, body], i) => (
                <li key={title} className="relative flex gap-4 pb-7 last:pb-0 lg:flex-col lg:gap-0 lg:pb-0">
                  {/* Connector to the NEXT step (none after the last): down on a
                      phone, across to the next marker from lg. Decoration. */}
                  {i < 3 && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-[21px] top-11 w-px bg-ink-200 lg:bottom-auto lg:left-11 lg:right-[-2rem] lg:top-[22px] lg:h-px lg:w-auto"
                    />
                  )}
                  <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary-700 shadow-card ring-1 ring-ink-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 pt-1 lg:pt-0">
                    <span className="block text-[12px] font-semibold tabular-nums tracking-[0.14em] text-ink-400 lg:mt-6 lg:text-[40px] lg:font-extrabold lg:leading-none lg:tracking-tight lg:text-ink-200">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="mt-0.5 block text-[16px] font-semibold tracking-tight text-ink-900 lg:mt-3 lg:text-lg">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-600">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ═════════ FAQ — same reason as How it works: the header links to it ═════════ */}
        {/* ═════════ FAQ ═════════
            🆕 2026-09-27 — rebuilt to the two-column accordion layout the owner
            sent: a heading and a lead-in on the left, numbered expanding rows on
            the right.

            The rows live in `FaqAccordion.jsx`, which explains why they are no
            longer a native `<details>` (it cannot animate its height) and what
            the open/close transition is built from. */}
        <section id="faq" aria-labelledby="faq-heading" className="w-full bg-white px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
          {/* 2026-09-28 restyle (owner: premium, section by section): the same
              eyebrow + heading as every other section (the all-caps two-colour
              heading was the odd one out), a sticky intro column with a route
              to the Help page, and quiet divider rows. `id="faq"` kept — the
              footer links to it. */}
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">FAQ</p>
              <h2 id="faq-heading" className="mt-1.5 text-balance text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl lg:text-4xl">
                Common questions
              </h2>
              <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-ink-600 sm:text-base">
                Verification, cost, AI search, quotations and payments — the short answers.
              </p>
              <Link
                to="/help"
                className="group mt-6 hidden items-center gap-2.5 rounded-full border border-ink-200 bg-white py-1.5 pl-5 pr-1.5 text-sm font-semibold text-ink-900 shadow-sm transition-colors hover:border-ink-900 lg:inline-flex"
              >
                Still have questions? Get help
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-white transition-colors duration-300 group-hover:bg-primary-600">
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </Link>
            </div>

            <div className="min-w-0">
              <FaqAccordion items={FAQS} />
              <Link
                to="/help"
                className="mt-6 flex h-11 items-center justify-between rounded-full border border-ink-200 bg-white pl-5 pr-1.5 text-sm font-semibold text-ink-900 shadow-sm lg:hidden"
              >
                Still have questions? Get help
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-white">
                  <ArrowRightIcon className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
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
