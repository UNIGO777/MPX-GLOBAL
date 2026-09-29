import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { useCanonical } from '../../lib/seo.js';
import { BannerStrip, useLandingFeatured } from '../../components/catalogue/FeaturedStrips.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { CategoryCircles } from '../../components/landing/CategoryCircles.jsx';
import { FaqAccordion } from '../../components/landing/FaqAccordion.jsx';
import { FaqExplorer } from '../../components/landing/FaqExplorer.jsx';
import { AiBandVideo } from '../../components/landing/AiBandVideo.jsx';
import { AudienceFork } from '../../components/landing/AudienceFork.jsx';
import { GlobeBand } from '../../components/landing/GlobeBand.jsx';
import { MpxFilm } from '../../components/landing/MpxFilm.jsx';
import { PlatformCards } from '../../components/landing/PlatformCards.jsx';
import { PromoPanels } from '../../components/landing/PromoPanels.jsx';
import { SourceTypeCards } from '../../components/landing/SourceTypeCards.jsx';
import { HEADING, SectionHeader, SectionLink } from '../../components/landing/SectionHeader.jsx';
import { TradeAgreements } from '../../components/landing/TradeAgreements.jsx';

import {
  ArrowRightIcon,
  ChatIcon,
  EnquiryIcon,
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
/** Landing blocks share ONE heading pattern — see `SectionHeader`. */
function BlockHead({ eyebrow, title, sub, to, cta = 'See all' }) {
  return (
    <SectionHeader
      eyebrow={eyebrow}
      title={title}
      sub={sub}
      action={to ? <SectionLink to={to}>{cta}</SectionLink> : null}
      className="mb-6 sm:mb-8"
    />
  );
}


/**
 * The hero's stat row.
 *
 * 🔴 **Every figure here is a COUNT THE SERVER ACTUALLY RETURNS** — the live
 * supplier total, the live product total, the category total. The owner's
 * mockup carried "2,400+ OEM Suppliers · 85+ Trade Corridors · 99.8% Customs
 * SLA"; none of those exist, and a "99.8% Customs SLA" is an operational
 * guarantee a client can be held to, not decoration. Owner chose real counts
 * (2026-09-29). **Never hard-code a number into this row.**
 *
 * A stat that comes back as 0 is dropped rather than shown: "0 Suppliers" is a
 * worse first impression than one fewer figure, and omitting is not claiming.
 * While the counts are loading the row reserves its height, so the buttons
 * above it do not jump when they land.
 */
function HeroStats() {
  // 🔴 `verifiedOnly` is REQUIRED for the label to be true: without it
  // `searchSuppliers` returns every active exporter-side org, verified or not
  // (backend `search.service.js` — verification is a query condition only on an
  // explicit opt-in, B7). Dropping this param silently turns the row into a
  // false claim, which is why the parameter and the word "Verified" belong in
  // the same edit.
  const suppliers = useQuery({
    queryKey: catalogueKeys.search({ type: 'supplier', verifiedOnly: true, limit: 1 }),
    queryFn: () => catalogueApi.search({ type: 'supplier', verifiedOnly: true, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  });
  const products = useQuery({
    queryKey: catalogueKeys.products({ limit: 1 }),
    queryFn: () => catalogueApi.products({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
  });
  const categories = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  /* ⚠️ TEMPORARY FIXED FIGURES (owner, 2026-09-29: "for now add these
     numbers" — after being told the row was live counts and that fixed
     figures are claims investors may check). Supplier and product figures are
     the owner's chosen display values, NOT platform counts. Replace them with
     the live `suppliers` / `products` totals below (rounded down, with "+")
     before launch — the queries are kept for exactly that. */
  const FIXED = { suppliers: 100, products: 1200 };
  const stats = [
    { value: FIXED.suppliers ?? suppliers.data?.total, label: 'Verified suppliers', dot: true, plus: true },
    { value: FIXED.products ?? products.data?.total, label: 'Products listed', plus: true },
    // "+" (owner, 2026-09-29): the live count, with sub-categories beyond it.
    { value: categories.data?.length, label: 'Categories', plus: true },
  ].filter((stat) => Number.isFinite(stat.value) && stat.value > 0);

  if (!stats.length) {
    // Loading, empty or failed — hold the space, claim nothing.
    return <div aria-hidden="true" className="mt-4 h-5" />;
  }

  return (
    // A <ul>, not a <dl>: a <div> inside a <dl> may contain only <dt>/<dd>, and
    // the separator and status dot are neither. The label reads as part of the
    // item, so the number and its word stay in one <li>.
    <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:mt-4 sm:gap-x-8">
      {stats.map((stat, i) => (
        <li key={stat.label} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="mr-3 h-1 w-1 rounded-full bg-ink-300 sm:mr-5" />}
          {stat.dot && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />}
          <span className="text-[15px] font-bold tracking-tight text-ink-900">
            {stat.value.toLocaleString()}
            {stat.plus && '+'}
          </span>
          <span className="text-[13.5px] text-ink-600">{stat.label}</span>
        </li>
      ))}
    </ul>
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
        {/* 🔴 DARK ground, and `HeroBackdrop` went with it (owner, 2026-09-29,
            with the reference HTML). That component was the white hero's grid,
            glow and drifting shapes, built 2026-09-27 for a light field; on
            ink-900 it has nothing to sit on. What replaces it is not decoration
            but the STORY itself — `HeroStory` tells the platform's whole job in
            five scenes. The file is deleted rather than left unrendered; git
            has it if the light hero ever comes back.

            🔴 The AI FIELD STAYS. The reference's hero offers only a button, and
            this hero's one job since 2026-09-26 has been to put a field in front
            of a visitor ("make a search bar"). The field, its phone-specific
            prompt-card layout and the example chips all carry over untouched —
            only their colours move to the dark ground. */}
        {/* 🔴 The hero runs UP BEHIND the sticky header, which is what makes the
              navbar transparent (owner, 2026-09-29). The header already paints
              `bg-white/0` until you scroll — the white strip people saw was the
              PAGE behind it, because a sticky element still takes its space in
              flow and the hero began underneath. The negative margin is exactly
              the header's height and the padding gives it straight back, so the
              copy sits where it did and only the cream and its grid move up. */}
        <section className="relative isolate -mt-16 overflow-hidden bg-surface-canvas pt-16 text-ink-900 lg:-mt-[72px] lg:pt-[72px]">
          {/* The mockup's faint engineering grid. Two hairline gradients rather
              than an image: it has to tile at any width, and it must not cost a
              request for something this quiet. It fades out at the bottom so it
              never fights the story band under it. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(0_5_23/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_5_23/0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,#000_0%,#000_55%,transparent_92%)]"
          />
          <div className="relative flex min-h-[46svh] w-full flex-col items-center justify-center px-4 pb-5 pt-5 sm:px-6 sm:pb-4 sm:pt-5 lg:px-10 lg:pb-4 lg:pt-5 xl:px-16">
            {/* Centred on a phone, left-aligned once the story sits beside it —
                a centred column next to an illustration reads as two unrelated
                blocks. */}
            {/* `min-w-0`: the chips strip below is deliberately full-bleed
                (`-mx-4 w-[calc(100%+2rem)]`), and without this the grid item's
                automatic minimum size grew to fit it, widening the single
                mobile track to ~700px and pushing the whole hero off-screen. */}
            <div className="flex w-full min-w-0 max-w-4xl flex-col items-center text-center">
              {/* The mockup's announcement pill: a solid tag, the line, an arrow.
                  🔴 It is a real Link, not a decorated <p>. The mockup's arrow
                  reads as "this goes somewhere", and a live-looking control that
                  does nothing is exactly what `web-ui-notes.md` forbids — so it
                  goes to the AI search it is describing. */}
              <Link
                to="/ai-search"
                className="group inline-flex items-center gap-2 rounded-full border border-ink-900/10 bg-white py-1 pl-1 pr-3 text-[12.5px] font-semibold text-ink-700 shadow-sm transition hover:border-ink-900/20 hover:shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20 sm:gap-2.5 sm:pr-4 sm:text-sm"
              >
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white">
                  <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white motion-reduce:animate-none" />
                  AI
                </span>
                Match-making for global buyers
                <ArrowRightIcon
                  className="h-3.5 w-3.5 text-primary-600 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </Link>

              <h1 className="mt-3.5 max-w-3xl text-balance text-[24px] font-extrabold leading-[1.05] max-[359px]:text-[23px] tracking-tight text-ink-900 sm:mt-5 sm:text-[32px] lg:text-[35px] xl:text-[38px]">
                Connecting India&apos;s Suppliers
                <br />
                <span className="relative inline-block pb-1">
                  <span className="text-primary-400">to the World</span>
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
                      className="animate-draw-line stroke-primary-400 motion-reduce:animate-none"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                {/* The mockup's four-point star beside the emphasised word. It is
                    punctuation, not information — hence `aria-hidden` and the
                    inline-block so it rides the line rather than wrapping alone. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="ml-2 inline-block h-[0.42em] w-[0.42em] align-baseline text-primary-500 sm:ml-3"
                  fill="currentColor"
                >
                  <path d="M12 0c.7 6.1 5.2 10.6 11.3 11.3v1.4C17.2 13.4 12.7 17.9 12 24c-.7-6.1-5.2-10.6-11.3-11.3v-1.4C6.8 10.6 11.3 6.1 12 0z" />
                </svg>
              </h1>

              {/* 🔴 Describes what the feature ACTUALLY does — it reads your
                  requirement and finds suppliers already on this platform. No
                  number of suppliers, no "instant", no accuracy claim: this is a
                  trust marketplace and the page may not promise what cannot be
                  shown (the same rule that kept invented testimonials off it). */}
              <p className="mt-2.5 max-w-lg text-pretty text-[13px] leading-relaxed text-ink-700 sm:mt-3 sm:text-[14px]">
                Describe what you need — material, quantity, specification, destination. Our AI
                matches you with{' '}
                <span className="font-semibold text-ink-900">verified Indian exporters</span> who can
                supply it.
              </p>

            {/* The AI field — the one thing the hero asks a visitor to use.
                Phones (owner, 2026-09-27: "think of better design for search and
                button"): an AI prompt card — the field on top, a slim bottom row
                with the hint and a compact pill — so it reads as ONE object, not
                two stacked slabs. sm+: one row, grey field + big button. The
                bottom row is `sm:contents`, which lifts the button into the row. */}
            <form
              role="search"
              onSubmit={onAiSearch}
              className="mx-auto mt-4 flex w-full max-w-[600px] flex-col rounded-3xl border border-surface-border bg-white p-1.5 shadow-[0_12px_34px_-18px_rgb(0_5_23/0.35)] transition-shadow focus-within:border-primary-600/40 focus-within:ring-4 focus-within:ring-primary-600/10 sm:mt-7 sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:p-1.5"
            >
              <label className="sr-only" htmlFor="hero-ai-q">
                Describe what you want to source
              </label>
              <div className="flex min-w-0 flex-1 items-center px-3 sm:rounded-full sm:bg-ink-50 sm:px-4">
                <SearchIcon className="mr-3 hidden h-5 w-5 shrink-0 text-ink-500 sm:block" aria-hidden="true" />
                <input
                  id="hero-ai-q"
                  type="search"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="Describe what you want to source…"
                  className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink-900 outline-none placeholder:text-ink-500 sm:h-11 sm:text-[14.5px]"
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
                  className="group inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-primary-500 to-primary-700 px-4 text-[14px] font-semibold tracking-tight text-white transition hover:from-primary-600 hover:to-primary-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/25 active:translate-y-px sm:h-11 sm:gap-2 sm:rounded-full sm:px-6 sm:text-[14px]"
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
                <span className="shrink-0 snap-start pr-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-600">Try</span>
                {HERO_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => askAi(example)}
                    className="flex h-7 shrink-0 snap-start items-center gap-1 whitespace-nowrap rounded-full border border-ink-900/10 bg-white px-2.5 text-[11.5px] text-ink-700 transition active:border-primary-600/40 active:bg-primary-50"
                  >
                    <SparkleIcon className="h-2.5 w-2.5 shrink-0 text-primary-600" aria-hidden="true" />
                    {example}
                  </button>
                ))}
              </div>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-surface-canvas via-surface-canvas/80 to-transparent"
              />
            </div>

            <div className="mt-3 hidden w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:flex">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-600">Try asking</p>
              <div className="flex flex-wrap justify-center gap-2">
                {HERO_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => askAi(example)}
                    className="group flex min-h-[34px] items-center gap-2 rounded-full border border-ink-900/10 bg-white px-3 text-[12.5px] text-ink-700 transition hover:border-primary-600/40 hover:bg-primary-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-400/25"
                  >
                    <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden="true" />
                    {example}
                    <ArrowRightIcon
                      className="-ml-1 h-3.5 w-0 shrink-0 text-primary-300 opacity-0 transition-all group-hover:ml-0 group-hover:w-3.5 group-hover:opacity-100 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>

              {/* The mockup's pair of buttons. They sit UNDER the AI field, not
                  instead of it (owner, 2026-09-29): the field is what the hero
                  exists for, and these are the two plain doors for anyone who
                  would rather browse than describe. Both are real destinations. */}
              <div className="mt-4 flex w-full flex-col items-center justify-center gap-2.5 sm:mt-4 sm:w-auto sm:flex-row">
                <Link
                  to="/categories"
                  className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary-500 to-primary-700 px-6 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition hover:from-primary-600 hover:to-primary-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/25 active:translate-y-px sm:w-auto"
                >
                  Explore marketplace
                  <ArrowRightIcon
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  to="/signup/exporter"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-ink-900/12 bg-white px-6 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-900 transition hover:border-ink-900/25 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-900/10 sm:w-auto"
                >
                  Join as supplier
                </Link>
              </div>

              <HeroStats />
            </div>
          </div>
        </section>

        <GlobeBand />

        {/* ═════════ BUYER / SUPPLIER FORK ═════════
            Straight after the hero (client brief, 2026-09-28): "Are you a
            buyer? | Are you a supplier?" → /suppliers or exporter signup. */}
        <AudienceFork />

        {/* ═════════ CATEGORIES ═════════
            Above the sector panels (owner, 2026-09-28). */}
        <section id="categories" className="w-full bg-surface-subtle px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
          <BlockHead
            eyebrow="Categories"
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

        {/* ═════════ THE MPX GLOBAL FILM ═════════
            Its own section (owner, 2026-09-28: "film not fitting in, make it a
            separate section") — after being tried inside "Why source from
            India" in three layouts. White, centred, the film large. */}
        <section aria-labelledby="film-heading" className="relative isolate overflow-hidden bg-white py-12 sm:py-12 lg:py-14">
          <span aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary-100/60 blur-3xl" />
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(0_5_23/0.07)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
          />
          {/* Cinema style from sm (owner, 2026-09-28): the film widens to
              ~1100px on large screens inside a thin gradient frame with a deeper
              shadow. Phones are unchanged — the owner called them perfect. */}
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:max-w-5xl xl:max-w-[1148px]">
            <SectionHeader
              id="film-heading"
              align="center"
              eyebrow="The MPX Global film"
              title="Ready to trade. Built to connect."
              sub="Two minutes on how MPX Global brings India’s manufacturers and the world’s buyers to one platform."
            />
            {/* Width is also capped by the screen's HEIGHT (owner: "not fitting
                inside my screen"): a 16:9 film is at most (100vh − ~400px of
                heading, spacing and the sticky header) tall, so the whole
                section fits in one screen below the header. */}
            <div className="mt-8 sm:mx-auto sm:mt-8 sm:w-[min(100%,calc((100vh-400px)*16/9))] sm:min-w-[min(100%,560px)] sm:rounded-[30px] sm:bg-gradient-to-b sm:from-white sm:to-ink-100/80 sm:p-2 sm:shadow-[0_50px_100px_-45px_rgb(0_5_23/0.6)] sm:ring-1 sm:ring-ink-200/70">
              <MpxFilm className="shadow-[0_40px_90px_-40px_rgb(0_5_23/0.55)] ring-[6px] ring-white sm:shadow-none sm:ring-0" />
            </div>
            <p aria-hidden="true" className="mt-6 flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500 sm:mt-5">
              <span>Manufacturers</span>
              <span className="h-1 w-1 rounded-full bg-primary-500" />
              <span>Exporters</span>
              <span className="h-1 w-1 rounded-full bg-primary-500" />
              <span>Buyers</span>
            </p>
          </div>
        </section>

        {/* ═════════ WHAT MAKES MPX GLOBAL DIFFERENT ═════════
            Replaced the three-item value strip on 2026-09-26 (owner). Sits BELOW
            "Why source from India" since 2026-09-28 (owner).

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
        {/* 2026-09-28 — rethought from scratch (owner: "completely rethink this
            whole section, the heading to presentation"). The heading now says
            what the buyer is spared — guesswork — and the eight points sit in a
            bento board (see PlatformCards). */}
        <section id="platform" aria-labelledby="platform-heading" className="bg-surface-subtle py-10 sm:py-12 lg:py-14">
          <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Why MPX Global</p>
                <h2 id="platform-heading" className={`mt-1.5 ${HEADING}`}>
                  Sourcing from India, without the guesswork
                </h2>
              </div>
              <p className="max-w-md text-pretty text-[14.5px] leading-relaxed text-ink-600 lg:pb-1 lg:text-right">
                From who you&apos;re dealing with to how you pay — built in, today.
              </p>
            </div>

            <PlatformCards />
          </div>
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
        {/* ⚠️ SUPERSEDED 2026-09-28 (owner, consistency pass: "fix the black
            goods/services cards"): the pair are now LIGHT cards — white with a
            soft red glow, dot texture and a line-art watermark, the same card
            language as "Why MPX Global". Red stays on the action (the round
            arrow turns red on hover). Still a MATCHED PAIR — same colour, told
            apart by icon and copy; the notes above about never giving them
            different colours still hold. */}
        <section aria-labelledby="fork-heading" className="w-full bg-white px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
          <SectionHeader
            id="fork-heading"
            eyebrow="Goods & services"
            title="Source products and services in one place"
            sub="Most platforms offer one or the other. Choose where you want to start."
          />

          <SourceTypeCards />
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
            <BlockHead eyebrow="Featured" title="Featured products" sub="Picked by the MPX Global team." to="/search" />
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
        <section id="how-it-works" aria-labelledby="how-heading" className="bg-surface-subtle">
          <div className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
            <SectionHeader
              id="how-heading"
              eyebrow="How it works"
              title="From first search to agreed quotation"
              sub="Four steps, all on the platform, all free for buyers."
            />

            {/* The numbered LINE structure (owner-kept), redesigned 2026-09-28
                ("fix how it works design"): no boxed panel — the steps sit on
                the section ground; from lg each step is CENTRED on its column;
                the connector runs only marker-to-marker and fades from soft red
                to grey (it shows direction); white number markers; icons in
                soft round badges. Phones: a vertical timeline. */}
            <ol className="relative mt-10 grid gap-0 sm:mt-12 lg:grid-cols-4 lg:gap-8">
              {[
                [SearchIcon, 'Find a supplier', 'Search or browse the catalogue — free, no account needed.'],
                [EnquiryIcon, 'Send an enquiry', 'Tell the supplier exactly what you need, in a couple of clicks.'],
                [ChatIcon, 'Chat in real time', 'Talk directly on the platform, with files and full history.'],
                [QuoteIcon, 'Agree the quotation', 'Receive a priced quotation, counter-offer, and confirm it together.'],
              ].map(([Icon, title, body], i) => (
                <li key={title} className="relative flex gap-5 pb-9 last:pb-0 lg:flex-col lg:items-center lg:gap-0 lg:pb-0 lg:text-center">
                  {/* Connector to the NEXT marker — down on a phone; from lg it
                      starts just right of this marker and ends just left of the
                      next (column width + 2rem gap − both marker radii). */}
                  {i < 3 && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[21px] top-12 bottom-1 w-0.5 rounded-full lg:bottom-auto lg:left-[calc(50%+30px)] lg:top-[21px] lg:h-0.5 lg:w-[calc(100%+2rem-60px)] ${
                        ['bg-gradient-to-b from-primary-300 to-primary-200 lg:bg-gradient-to-r', 'bg-gradient-to-b from-primary-200 to-ink-200 lg:bg-gradient-to-r', 'bg-gradient-to-b from-ink-200 to-ink-100 lg:bg-gradient-to-r'][i]
                      }`}
                    />
                  )}
                  <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[14px] font-bold tabular-nums text-ink-900 shadow-card ring-1 ring-ink-200/80">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex min-w-0 flex-col lg:items-center">
                    {/* Plain dark line icon — no badge, no pink (owner: the
                        gradient-badge icons looked "too artificial"). */}
                    <Icon className="h-8 w-8 text-primary-600 lg:mt-8 lg:h-9 lg:w-9" strokeWidth={1.4} aria-hidden="true" />
                    <span className="mt-4 block text-[17px] font-semibold tracking-tight text-ink-900 lg:mt-5 lg:text-[18px]">{title}</span>
                    <span className="mt-1.5 block max-w-[16rem] text-[14px] leading-relaxed text-ink-500">{body}</span>
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
          {/* 2026-09-28 (owner: "left side too much empty space"; no card to
              fill it; a full-width stacked list was "bad design"): the heading
              runs full width with "Get help" on its right; below it, on
              desktop, questions and answer sit SIDE BY SIDE (FaqExplorer) —
              both columns one height, nothing empty. Phones keep the
              accordion. */}
          <SectionHeader
            id="faq-heading"
            eyebrow="FAQ"
            title="Common questions"
            sub="Verification, cost, AI search, quotations and payments — the short answers."
            action={<SectionLink to="/help">Get help</SectionLink>}
          />
          <div className="mt-6 sm:mt-8">
            {/* Desktop: questions and answer side by side. Below lg: the accordion. */}
            <div className="hidden lg:block">
              <FaqExplorer items={FAQS} />
            </div>
            <div className="lg:hidden">
              <FaqAccordion items={FAQS} />
            </div>
            <Link
              to="/help"
              className="mt-6 flex h-11 items-center justify-between rounded-full border border-ink-200 bg-white pl-5 pr-1.5 text-sm font-semibold text-ink-900 shadow-sm sm:hidden"
            >
              Still have questions? Get help
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-white">
                <ArrowRightIcon className="h-4 w-4" />
              </span>
            </Link>
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
