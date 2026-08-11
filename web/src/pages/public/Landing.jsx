import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';

import {
  BoxIcon,
  ChatIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  DocIcon,
  GlobeIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
} from '../../components/ui/icons.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';

/**
 * Public landing page (mockup: royal_blue_premium_landing_page). SEO surface —
 * semantic sections, one h1, anchor nav.
 *
 * Faithful to the mockup's design; the COPY diverges where the mockup claimed
 * features that don't exist in Phase 1 (escrow, shipment tracking, analytics,
 * trade credit, formal quotations — Bucket A/B). A public page must not
 * advertise what the product can't do, so those lines are rewritten to the
 * Phase-1 truth (verification, AI search, enquiries + chat, catalogue) and the
 * mockup's "Quotations" platform tab is dropped. Flagged to the owner.
 *
 * Non-operational elements (each in docs/UiWebNotes.md): store badges ("Coming
 * soon") and the footer directory (static text). The hero search bar and the
 * category section are REAL links now (2026-08-11): search → /categories (the
 * quick-find lives there; AI search stays Module 3), categories → live cards.
 * The hero match panel shows real listings, not invented suppliers.
 */

/* ---------------------------------- data ---------------------------------- */

const JOURNEYS = {
  buyer: [
    { title: 'Discover verified suppliers', body: 'Browse human-verified Indian exporters — free, no account needed.', Icon: SearchIcon },
    { title: 'Send an enquiry', body: 'Tell a supplier exactly what you need in a couple of clicks.', Icon: DocIcon },
    { title: 'Chat in real time', body: 'Talk directly with the supplier on the platform.', Icon: ChatIcon },
    { title: 'Deal with confidence', body: 'The verified tick and open conversation history keep both sides honest.', Icon: ShieldIcon },
  ],
  seller: [
    { title: 'Register free', body: 'Your public profile is live from day one.', Icon: UserIcon },
    { title: 'Get verified', body: 'Send your documents once; our team reviews and adds the tick.', Icon: ShieldIcon },
    { title: 'Publish your catalogue', body: 'Products and services, with photos, specs and pricing.', Icon: BoxIcon },
    { title: 'Receive enquiries', body: 'International buyers come to you — reply in real-time chat.', Icon: ChatIcon },
  ],
};

const PLATFORM_TABS = [
  {
    key: 'search',
    label: 'AI Search',
    title: 'AI-assisted search',
    body: 'Describe what you need in plain language and let the platform find matching suppliers and products.',
    points: ['Natural-language queries', 'Structured filters extracted automatically', 'Falls back to fast keyword search'],
  },
  {
    key: 'verified',
    label: 'Verified Sellers',
    title: 'Human-verified sellers',
    body: 'Every verified tick is a decision made by our team after checking real business documents — never an automated rubber stamp.',
    points: ['Document-based KYC review', 'One tick per company, carried everywhere', 'Absence of the tick is the only "no"'],
  },
  {
    key: 'chat',
    label: 'Real-Time Chat',
    title: 'Enquiries and real-time chat',
    body: 'Start with a structured enquiry, then continue in a live chat thread — no email chains, no lost context.',
    points: ['Enquiry history in one place', 'Live messaging with push notifications', 'Works on web and mobile'],
  },
  {
    key: 'catalogue',
    label: 'Catalogue',
    title: 'A catalogue built for trade',
    body: 'Products and services with categories, attributes, images and minimum order quantities — searchable by every one of them.',
    points: ['Category-specific attributes', 'Price or price-on-request', 'Goods and services both supported'],
  },
];

const TRUST_CARDS = [
  {
    tint: 'bg-primary-50',
    title: 'Human-verified sellers',
    body: 'Exporters submit real business documents; our team reviews each one before the tick appears.',
  },
  {
    tint: 'bg-success-50',
    title: 'AI-assisted search',
    body: 'Find the exact partners you need using natural-language discovery.',
  },
  {
    tint: 'bg-primary-100/60',
    title: 'Real-time chat',
    body: 'Talk to suppliers directly in a secure, integrated environment — every thread kept.',
  },
];

const WHY_CARDS = [
  { title: 'Not sure who to trust?', body: 'Every verified tick is decided by a human after checking documents.', Icon: ShieldIcon },
  { title: "Can't find the right supplier?", body: 'AI search understands plain language.', Icon: SearchIcon },
  { title: 'Deals stuck in email chains?', body: 'Enquiries and chat in one place.', Icon: ChatIcon },
  { title: 'Always on the move?', body: 'A full mobile app for buyers and sellers.', Icon: GlobeIcon },
];

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

function SectionHeading({ children, sub, id }) {
  return (
    <div className="mb-10 text-center md:mb-14" id={id}>
      <h2 className="text-3xl font-bold tracking-tight text-primary-800 md:text-4xl">{children}</h2>
      {sub && <p className="mx-auto mt-3 max-w-2xl text-base text-muted md:text-lg">{sub}</p>}
    </div>
  );
}

const pill =
  'inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors';

/* Store brand marks — local to the landing badges; monochrome per the dark card. */
function AppleLogo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.49.96 1.39 2.1 2.94 3.6 2.89 1.45-.06 1.99-.93 3.74-.93 1.75 0 2.24.93 3.77.9 1.56-.03 2.54-1.41 3.49-2.8 1.1-1.61 1.55-3.17 1.58-3.25-.04-.02-3.03-1.16-3.06-4.6zM14.16 4.06c.8-.97 1.34-2.31 1.19-3.66-1.15.05-2.55.77-3.38 1.74-.74.85-1.39 2.22-1.22 3.53 1.29.1 2.6-.65 3.41-1.61z" />
    </svg>
  );
}
function PlayLogo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3.6 1.8c-.36.38-.6.97-.6 1.73v16.94c0 .76.24 1.35.6 1.73l.1.09 9.49-9.49v-.22L3.7 1.71l-.1.09zM16.35 15.05 13.19 11.89v-.22l3.16-3.16.07.04 3.75 2.13c1.07.6 1.07 1.6 0 2.21l-3.75 2.12-.07.04zM6.05 22.66l10.3-5.85-2.86-2.87-7.44 8.72zM6.05 1.34l7.44 8.72 2.86-2.87-10.3-5.85z" />
    </svg>
  );
}

/**
 * Roving-focus arrow keys for a `role="tablist"`. ARIA requires it: with
 * role="tab" a screen-reader user expects arrows to move between tabs, and Tab
 * to leave the set — without this the roles lie about the behaviour.
 */
function useTabKeys(keys, active, onSelect) {
  const refs = useRef({});
  const onKeyDown = (e) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = keys[(keys.indexOf(active) + delta + keys.length) % keys.length];
    onSelect(next);
    refs.current[next]?.focus();
  };
  return { refs, onKeyDown };
}

/* ---------------------------------- page ---------------------------------- */

export function Landing() {
  const { user } = useAuth();
  const [journey, setJourney] = useState('buyer');
  const [tab, setTab] = useState('search');
  const [openFaq, setOpenFaq] = useState(0);
  const activeTab = PLATFORM_TABS.find((t) => t.key === tab);

  // Real categories, so the landing page stops advertising an invented taxonomy.
  // Shares its cache key with /categories, so that page loads instantly from here.
  const categories = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  // The hero's match panel shows REAL live listings (2026-08-11) — the old
  // hardcoded supplier names advertised companies that may not exist.
  const heroMatches = useQuery({
    queryKey: catalogueKeys.products({ page: 1, pageSize: 2 }),
    queryFn: () => catalogueApi.products({ page: 1, pageSize: 2 }),
  });

  const journeyKeys = useTabKeys(['buyer', 'seller'], journey, setJourney);
  const platformKeys = useTabKeys(
    PLATFORM_TABS.map((t) => t.key),
    tab,
    setTab,
  );

  // A signed-in visitor landing here must not be sold a signup. Every marketing
  // CTA collapses to one "continue where you left off" link instead.
  const home = user ? roleHome(user) : null;

  return (
    <div className="bg-surface-subtle text-ink-900">
      {/* Announcement bar — the signup nudge is dropped once you have an account */}
      <div className="flex flex-wrap items-center justify-center gap-3 bg-primary-800 px-4 py-2 text-white">
        <span className="text-xs font-semibold tracking-wide sm:text-sm">
          NOW LIVE: Onboarding verified suppliers across 20+ categories
        </span>
        {!user && (
          <Link
            to="/signup/buyer"
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-800 hover:bg-primary-50"
          >
            Get Early Access
          </Link>
        )}
      </div>

      <PublicHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary-50 py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-600">
                <span className="h-2 w-2 rounded-full bg-primary-600" />
                B2B Import &amp; Export Marketplace
              </span>
              <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
                Find Verified Suppliers.
                <br />
                <span className="text-primary-600">Close Deals Faster.</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-600">
                Connect with human-verified Indian exporters, send enquiries, and talk to them
                directly — discovery to deal on one secure platform.
              </p>

              {/* A real door, not a prop (2026-08-11): opens the catalogue,
                  where the quick-find filter actually works. AI search itself
                  is still Module 3. */}
              <Link to="/categories" className="mt-6 block w-full max-w-lg" aria-label="Browse the catalogue">
                <span className="flex items-center rounded-full border border-surface-border bg-white p-1.5 shadow-card transition-all hover:border-primary-400 hover:shadow-lift">
                  <span className="pl-3 text-ink-400"><SearchIcon className="h-5 w-5" /></span>
                  <span className="flex-1 truncate px-3 text-sm text-ink-500">
                    Find suppliers — fabrics, machinery, IT services&hellip;
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white">
                    <SearchIcon className="h-4 w-4" />
                  </span>
                </span>
                <span className="mt-1.5 block pl-4 text-xs text-ink-500">Browse 40 categories →</span>
              </Link>

              <div className="mt-6 flex flex-wrap gap-3">
                {home ? (
                  <Link to={home} className={`${pill} bg-ink-900 text-white shadow-md hover:bg-primary-800`}>
                    Go to your dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/signup/buyer" className={`${pill} bg-ink-900 text-white shadow-md hover:bg-primary-800`}>
                      Start Buying
                    </Link>
                    <Link
                      to="/signup/exporter"
                      className={`${pill} border border-ink-900 text-ink-900 hover:bg-white`}
                    >
                      Sell on MPX Global
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right visual — supplier match card */}
            <div className="hidden lg:block" aria-hidden="true">
              <div className="rotate-2 rounded-2xl border border-white/10 bg-primary-700 p-6 shadow-2xl transition-transform duration-500 hover:rotate-0">
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
                    <ShieldIcon className="h-4 w-4" /> Supplier Match Results
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
                  </span>
                </div>
                <div className="space-y-3">
                  {(heroMatches.data?.products ?? []).slice(0, 2).map((m) => (
                    <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-semibold text-white">{m.seller?.name ?? m.name}</p>
                        {m.seller?.verified && (
                          <span className="flex shrink-0 items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                            <CheckCircleIcon className="h-3.5 w-3.5" /> Verified
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-white/60">
                        {[m.seller?.country === 'IN' ? 'India' : m.seller?.country, m.name].filter(Boolean).join(' · ')}
                      </p>
                      {m.category?.name && (
                        <span className="mt-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
                          {m.category.name}
                        </span>
                      )}
                    </div>
                  ))}
                  {heroMatches.isPending &&
                    Array.from({ length: 2 }, (_, i) => (
                      <div key={i} className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                    ))}
                                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-y border-surface-border bg-white py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-wider text-muted">
              Built for trusted global trade
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                { Icon: ShieldIcon, label: 'Human-Verified Sellers' },
                { Icon: ChatIcon, label: 'Real-Time Chat' },
                { Icon: SearchIcon, label: 'AI-Assisted Search' },
                { Icon: GlobeIcon, label: 'Web + Mobile App' },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 rounded-full border border-surface-border bg-surface-subtle px-4 py-2 text-sm font-semibold text-ink-800"
                >
                  <Icon className="h-4 w-4 text-primary-600" /> {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Categories — REAL top categories from the catalogue. These were
            invented groupings ("Raw Materials", "Home & Garden") until the
            browse screens shipped; a public page must not advertise a taxonomy
            that does not exist. */}
        <section className="bg-white px-4 py-16 sm:px-6 md:py-24" id="categories">
          <div className="mx-auto max-w-7xl">
            <SectionHeading sub="Find specialised suppliers across 40 industries.">
              Browse by <span className="text-primary-600">Category</span>
            </SectionHeading>

            {categories.isPending && (
              <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-surface-border">
                    <div className="aspect-video animate-pulse bg-surface-subtle" />
                    <div className="space-y-2 p-3.5">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-surface-subtle" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-surface-subtle" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mirrors the /categories page cards (owner, 2026-08-11) — same
                photo-forward look, so the landing teaser and the full page read
                as one surface. */}
            {categories.isSuccess && (
              <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {categories.data.slice(0, 8).map((cat) => (
                  <li key={cat.id} className="h-full">
                    <Link
                      to={`/category/${cat.slug}`}
                      className="flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card transition-colors hover:border-primary-600"
                    >
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt=""
                          loading="lazy"
                          width={640}
                          height={360}
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <NoImagePanel label={cat.name} ratio="aspect-video" />
                      )}
                      <div className="flex flex-1 flex-col p-3.5">
                        <h3 className="text-sm font-bold leading-snug text-ink-900">{cat.name}</h3>
                        <p className="mt-auto pt-1.5 text-xs text-muted">
                          {cat.subs?.length ?? 0}{' '}
                          {(cat.subs?.length ?? 0) === 1 ? 'sub-category' : 'sub-categories'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* Always offered, even if the fetch failed — the destination is a
                real page and the button is the point of the section. */}
            <div className="mt-8 text-center">
              <Link
                to="/categories"
                className={`${pill} border border-ink-900 text-ink-900 hover:bg-surface-subtle`}
              >
                Browse all categories
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-surface-subtle px-4 py-16 sm:px-6 md:py-24" id="how-it-works">
          <div className="mx-auto max-w-7xl">
            <SectionHeading>
              One platform. <span className="text-primary-600">Two clear journeys.</span>
            </SectionHeading>

            <div className="mb-10 flex justify-center">
              <div
                role="tablist"
                aria-label="Journey"
                onKeyDown={journeyKeys.onKeyDown}
                className="inline-flex rounded-full border border-surface-border bg-white p-1 shadow-sm"
              >
                {[
                  { key: 'buyer', label: 'For Buyers' },
                  { key: 'seller', label: 'For Sellers' },
                ].map((j) => (
                  <button
                    key={j.key}
                    ref={(el) => (journeyKeys.refs.current[j.key] = el)}
                    role="tab"
                    id={`journey-tab-${j.key}`}
                    aria-controls="journey-panel"
                    aria-selected={journey === j.key}
                    tabIndex={journey === j.key ? 0 : -1}
                    onClick={() => setJourney(j.key)}
                    className={`inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors sm:px-6 ${
                      journey === j.key ? 'bg-primary-800 text-white' : 'text-ink-600 hover:text-primary-800'
                    }`}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              id="journey-panel"
              role="tabpanel"
              aria-labelledby={`journey-tab-${journey}`}
              className="grid gap-6 md:grid-cols-4"
            >
              {JOURNEYS[journey].map((step, i) => (
                <div
                  key={step.title}
                  className="flex flex-col items-center rounded-2xl border border-surface-border bg-white p-6 text-center shadow-card"
                >
                  <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-white">
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary-800 text-xs font-bold">
                      {i + 1}
                    </span>
                    <step.Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-1.5 text-lg font-semibold text-primary-800">{step.title}</h3>
                  <p className="text-sm text-ink-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform tabs */}
        <section className="bg-white px-4 py-16 sm:px-6 md:py-24" id="platform">
          <div className="mx-auto max-w-7xl">
            <SectionHeading sub="Everything you need to discover, connect and deal.">
              The MPX <span className="text-primary-600">Platform</span>
            </SectionHeading>

            <div
              role="tablist"
              aria-label="Platform features"
              onKeyDown={platformKeys.onKeyDown}
              className="mb-10 flex flex-wrap justify-center gap-2"
            >
              {PLATFORM_TABS.map((t) => (
                <button
                  key={t.key}
                  ref={(el) => (platformKeys.refs.current[t.key] = el)}
                  role="tab"
                  id={`platform-tab-${t.key}`}
                  aria-controls="platform-panel"
                  aria-selected={tab === t.key}
                  tabIndex={tab === t.key ? 0 : -1}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors sm:px-5 ${
                    tab === t.key ? 'bg-primary-800 text-white' : 'text-ink-600 hover:bg-surface-subtle hover:text-ink-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div
              id="platform-panel"
              role="tabpanel"
              aria-labelledby={`platform-tab-${tab}`}
              className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-surface-border shadow-card md:grid-cols-[5fr_7fr]"
            >
              <div className="flex flex-col justify-center border-b border-surface-border bg-white p-6 sm:p-8 md:border-b-0 md:border-r md:p-12">
                <h3 className="text-2xl font-semibold text-ink-900">{activeTab.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-ink-600">{activeTab.body}</p>
                <ul className="mt-6 space-y-3">
                  {activeTab.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-ink-800">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-center bg-surface-subtle p-6 sm:p-8" aria-hidden="true">
                <div className="w-full max-w-md rounded-xl border border-surface-border bg-white p-4 shadow-card sm:p-5">
                  <div className="flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2.5 text-sm text-ink-600">
                    <SearchIcon className="h-4 w-4 text-ink-500" />
                    <span className="truncate">I need a cotton knitwear supplier…</span>
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Top matches</p>
                  <div className="mt-2 space-y-2">
                    {['Tirupur Knitwear Exports', 'Coimbatore Cotton Mills'].map((n) => (
                      <div
                        key={n}
                        className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2.5"
                      >
                        <span className="text-sm font-medium">{n}</span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircleIcon className="h-3.5 w-3.5" /> Verified
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust cards */}
        <section className="bg-surface-subtle px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-7xl">
            <SectionHeading>
              Built on <span className="text-primary-600">trust</span>, not guesswork.
            </SectionHeading>
            <div className="grid gap-6 md:grid-cols-3">
              {TRUST_CARDS.map((c) => (
                <div key={c.title} className={`rounded-[20px] border border-surface-border/50 p-6 sm:p-8 ${c.tint}`}>
                  <h3 className="text-xl font-semibold text-primary-800">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why MPX */}
        <section className="bg-white px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-7xl">
            <SectionHeading>
              Global sourcing, without the <span className="text-primary-600">friction</span>.
            </SectionHeading>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {WHY_CARDS.map((c) => (
                <div
                  key={c.title}
                  className="flex h-full flex-col rounded-[20px] border border-surface-border/60 bg-white p-6 shadow-card transition-shadow hover:shadow-lg"
                >
                  <div className="mb-6 flex h-[100px] items-center justify-center rounded-lg bg-primary-50">
                    <c.Icon className="h-10 w-10 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-primary-800">{c.title}</h3>
                  <p className="mt-auto pt-2 text-sm text-ink-600">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mobile app */}
        <section className="relative overflow-hidden bg-primary-800 px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="max-w-xl text-3xl font-bold text-white md:text-4xl">
                The whole marketplace, in your <span className="text-primary-300">pocket.</span>
              </h2>
              <p className="mt-4 max-w-lg text-lg text-white/80">
                The mobile app and the web platform share one backend — products, enquiries and
                chat stay in sync across all your devices.
              </p>
              <ul className="mt-6 space-y-3">
                {['AI-assisted search', 'Real-time chat', 'Manage your catalogue from your phone', 'Push notifications'].map(
                  (f) => (
                    <li key={f} className="flex items-center gap-3 text-white">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <CheckIcon className="h-4 w-4 text-primary-300" />
                      </span>
                      <span className="text-sm md:text-base">{f}</span>
                    </li>
                  ),
                )}
              </ul>
              {/* Store badges — apps not published yet; visibly coming-soon */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {[
                  { store: 'Google Play', Logo: PlayLogo },
                  { store: 'App Store', Logo: AppleLogo },
                ].map(({ store, Logo }) => (
                  <span
                    key={store}
                    aria-disabled="true"
                    className="flex cursor-default items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-5 py-3 opacity-70"
                  >
                    <Logo className="h-7 w-7 text-white" />
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                        Coming soon on
                      </span>
                      <span className="text-sm font-semibold text-white">{store}</span>
                    </div>
                  </span>
                ))}
              </div>
            </div>
            {/* Decorative phone mockups — PLACEHOLDER content, no real data
                fetched; purely illustrative (2026-08-11: filled per owner). */}
            <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
              <div className="relative h-[480px] w-full max-w-md">
                {/* Phone 1 — the catalogue */}
                <div className="absolute left-[12%] top-[10%] flex aspect-[9/18] w-[42%] -rotate-6 flex-col overflow-hidden rounded-[2rem] border-4 border-white/10 bg-white p-3 shadow-2xl">
                  <div className="h-2 w-16 self-center rounded-full bg-ink-200" />
                  <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-primary-50 px-2 py-1.5">
                    <SearchIcon className="h-3 w-3 shrink-0 text-primary-600" />
                    <span className="truncate text-[9px] text-ink-500">cotton fabric…</span>
                  </div>
                  <div className="mt-2 flex-1 space-y-2">
                    {[
                      { name: 'Cotton Poplin, 120 GSM', price: '₹120 / meter', tint: 'bg-primary-100' },
                      { name: 'Selvedge Denim, 14oz', price: '₹520 / meter', tint: 'bg-primary-200' },
                      { name: 'Mulberry Silk', price: '₹1,450 / meter', tint: 'bg-primary-50' },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center gap-2 rounded-lg border border-surface-border p-1.5">
                        <span className={`h-9 w-9 shrink-0 rounded-md ${r.tint}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[9px] font-semibold text-ink-900">{r.name}</span>
                          <span className="block text-[9px] font-bold text-primary-700">{r.price}</span>
                          <span className="block text-[8px] text-ink-500">MOQ 200 · Verified ✓</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Phone 2 — the chat */}
                <div className="absolute right-[12%] top-[22%] flex aspect-[9/18] w-[42%] rotate-6 flex-col overflow-hidden rounded-[2rem] border-4 border-white/10 bg-white p-3 shadow-2xl">
                  <div className="h-2 w-16 self-center rounded-full bg-ink-200" />
                  <div className="mt-3 flex items-center gap-1.5 border-b border-surface-border pb-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[8px] font-bold text-primary-700">
                      TK
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[9px] font-semibold text-ink-900">Tirupur Knitwear ✓</span>
                      <span className="block text-[8px] text-success">Online</span>
                    </span>
                  </div>
                  <div className="mt-2 flex-1 space-y-1.5">
                    <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-tr-none bg-primary-600 px-2 py-1.5 text-[8px] leading-snug text-white">
                      Need 500 m denim, 14oz. Lead time?
                    </p>
                    <p className="w-fit max-w-[85%] rounded-xl rounded-tl-none bg-surface-subtle px-2 py-1.5 text-[8px] leading-snug text-ink-800">
                      2 weeks ex-factory. MOQ 200 m.
                    </p>
                    <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-tr-none bg-primary-600 px-2 py-1.5 text-[8px] leading-snug text-white">
                      Works. Share samples?
                    </p>
                    <p className="w-fit max-w-[85%] rounded-xl rounded-tl-none bg-surface-subtle px-2 py-1.5 text-[8px] leading-snug text-ink-800">
                      Couriering tomorrow 📦
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 rounded-full border border-surface-border px-2 py-1">
                    <span className="flex-1 text-[8px] text-ink-400">Message…</span>
                    <span className="h-4 w-4 rounded-full bg-primary-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24" id="faq">
          <SectionHeading sub="Everything you need to know about trading on MPX Global.">
            Frequently asked <span className="text-primary-600">questions</span>
          </SectionHeading>
          <div className="divide-y divide-surface-border border-t border-surface-border">
            {FAQS.map((f, i) => (
              <div key={f.q} className="py-5">
                <button
                  type="button"
                  id={`faq-q-${i}`}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-a-${i}`}
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-lg font-semibold text-primary-800">{f.q}</span>
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-primary-800 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <p
                    id={`faq-a-${i}`}
                    role="region"
                    aria-labelledby={`faq-q-${i}`}
                    className="mt-3 pr-8 text-base leading-relaxed text-ink-600"
                  >
                    {f.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-24">
          <div className="relative overflow-hidden rounded-[20px] bg-primary-700 p-8 shadow-2xl sm:p-10 md:p-16">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-600 opacity-20 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary-600 opacity-20 blur-[100px]" />
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold leading-tight text-white md:text-5xl">
                Start sourcing <span className="text-primary-300">smarter</span> today.
              </h2>
              <p className="mt-4 text-lg text-white/90">
                Join verified Indian exporters and international buyers on one trusted marketplace.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                {home ? (
                  <Link to={home} className={`${pill} w-full bg-white px-8 py-3.5 text-primary-700 hover:bg-primary-50 sm:w-auto`}>
                    Go to your dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/signup/buyer" className={`${pill} w-full bg-white px-8 py-3.5 text-primary-700 hover:bg-primary-50 sm:w-auto`}>
                      Join as Buyer
                    </Link>
                    <Link
                      to="/signup/exporter"
                      className={`${pill} w-full border-2 border-white/80 px-8 py-3.5 text-white hover:bg-white/10 sm:w-auto`}
                    >
                      Join as Seller
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
