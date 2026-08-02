import { useState } from 'react';
import { Link } from 'react-router-dom';

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
 * Non-operational elements (each in docs/UiWebNotes.md): hero search (visibly
 * decorative), category lists (static text, not links), store badges ("Coming
 * soon"), footer directory (static text). Every auth CTA routes to the real
 * screens. Testimonials are PLACEHOLDER content — replace before launch.
 */

/* ---------------------------------- data ---------------------------------- */

const CATEGORY_GROUPS = [
  { title: 'Raw Materials', Icon: BoxIcon, items: ['Textiles & Fabrics', 'Chemicals', 'Agriculture', 'Metals & Ores'] },
  { title: 'Consumer Goods', Icon: GlobeIcon, items: ['Electronics', 'Home & Garden', 'Apparel', 'Beauty & Care'] },
  { title: 'Industrial Equipment', Icon: DocIcon, items: ['Heavy Machinery', 'Tools & Hardware', 'Power Systems', 'Construction'] },
];

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
    tint: 'bg-[#E7F0FF]',
    title: 'Human-verified sellers',
    body: 'Exporters submit real business documents; our team reviews each one before the tick appears.',
  },
  {
    tint: 'bg-[#E7F7EF]',
    title: 'AI-assisted search',
    body: 'Find the exact partners you need using natural-language discovery.',
  },
  {
    tint: 'bg-[#ECEBFF]',
    title: 'Real-time chat',
    body: 'Talk to suppliers directly in a secure, integrated environment — every thread kept.',
  },
];

const WHY_CARDS = [
  { title: 'Not sure who to trust?', body: 'Every verified tick is decided by a human after checking documents.' },
  { title: "Can't find the right supplier?", body: 'AI search understands plain language.' },
  { title: 'Deals stuck in email chains?', body: 'Enquiries and chat in one place.' },
  { title: 'Always on the move?', body: 'A full mobile app for buyers and sellers.' },
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

/* ---------------------------------- page ---------------------------------- */

export function Landing() {
  const [journey, setJourney] = useState('buyer');
  const [tab, setTab] = useState('search');
  const [openFaq, setOpenFaq] = useState(0);
  const activeTab = PLATFORM_TABS.find((t) => t.key === tab);

  return (
    <div className="bg-surface-subtle text-ink-900">
      {/* Announcement bar */}
      <div className="flex flex-wrap items-center justify-center gap-3 bg-primary-800 px-4 py-2 text-white">
        <span className="text-xs font-semibold tracking-wide sm:text-sm">
          NOW LIVE: Onboarding verified suppliers across 20+ categories
        </span>
        <Link
          to="/signup/buyer"
          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-800 hover:bg-primary-50"
        >
          Get Early Access
        </Link>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-xl font-extrabold tracking-tight text-primary-800">
            MPX Global
          </Link>
          <nav aria-label="Landing" className="hidden items-center gap-6 lg:flex">
            <a href="#how-it-works" className="text-sm text-ink-600 hover:text-primary-700">How it Works</a>
            <a href="#categories" className="text-sm text-ink-600 hover:text-primary-700">Categories</a>
            <a href="#platform" className="text-sm text-ink-600 hover:text-primary-700">Platform</a>
            <a href="#faq" className="text-sm text-ink-600 hover:text-primary-700">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/signin" className="text-sm font-semibold text-ink-600 hover:text-primary-700">
              Sign In
            </Link>
            <Link to="/signup/buyer" className={`${pill} bg-ink-900 px-5 py-2 text-white hover:bg-primary-800`}>
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary-50 py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-600">
                <span className="h-2 w-2 rounded-full bg-primary-600" />
                B2B Import &amp; Export Marketplace
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                Find Verified Suppliers.
                <br />
                <span className="text-primary-600">Close Deals Faster.</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-600">
                Connect with human-verified Indian exporters, send enquiries, and talk to them
                directly — discovery to deal on one secure platform.
              </p>

              {/* Decorative search — real search ships with the discovery screens */}
              <div className="mt-6 w-full max-w-lg" aria-hidden="true">
                <div className="flex items-center rounded-full border border-surface-border bg-white p-1.5 opacity-90 shadow-card">
                  <span className="pl-3 text-ink-400"><SearchIcon className="h-5 w-5" /></span>
                  <span className="flex-1 truncate px-3 text-sm text-ink-500">
                    &ldquo;Cotton knitwear manufacturers in Tirupur&hellip;&rdquo;
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white">
                    <SearchIcon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-1.5 pl-4 text-xs text-ink-500">Search preview — opens with the catalogue.</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/signup/buyer" className={`${pill} bg-ink-900 text-white shadow-md hover:bg-primary-800`}>
                  Start Buying
                </Link>
                <Link
                  to="/signup/exporter"
                  className={`${pill} border border-ink-900 text-ink-900 hover:bg-white`}
                >
                  Sell on MPX Global
                </Link>
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
                  {[
                    { name: 'Tirupur Knitwear Exports', meta: 'Tirupur, India · Business', tag: 'Textiles' },
                    { name: 'Jaipur Craft Collective', meta: 'Jaipur, India · Business', tag: 'Handicrafts' },
                  ].map((s) => (
                    <div key={s.name} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-semibold text-white">{s.name}</p>
                        <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          <CheckCircleIcon className="h-3.5 w-3.5" /> Verified
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/60">{s.meta}</p>
                      <span className="mt-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
                        {s.tag}
                      </span>
                    </div>
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

        {/* Categories (static preview — the browsable tree ships with discovery) */}
        <section className="bg-white px-4 py-16 sm:px-6 md:py-24" id="categories">
          <div className="mx-auto max-w-7xl">
            <SectionHeading sub="Find specialised suppliers across top global industries.">
              Browse by <span className="text-primary-600">Category</span>
            </SectionHeading>
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
              {CATEGORY_GROUPS.map(({ title, Icon, items }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-surface-border bg-surface-subtle/50 p-6 transition-colors hover:border-primary-200"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-lg font-bold">{title}</span>
                  </div>
                  <ul className="ml-4 space-y-2.5 border-l-2 border-surface-border pl-4">
                    {items.map((item) => (
                      <li key={item} className="text-sm text-ink-600">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm font-medium text-muted">
              Category browsing opens with the catalogue — coming soon.
            </p>
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
                className="inline-flex rounded-full border border-surface-border bg-white p-1 shadow-sm"
              >
                {[
                  { key: 'buyer', label: 'For Buyers' },
                  { key: 'seller', label: 'For Sellers' },
                ].map((j) => (
                  <button
                    key={j.key}
                    role="tab"
                    aria-selected={journey === j.key}
                    onClick={() => setJourney(j.key)}
                    className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
                      journey === j.key ? 'bg-primary-800 text-white' : 'text-ink-600 hover:text-primary-800'
                    }`}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
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

            <div role="tablist" aria-label="Platform features" className="mb-10 flex flex-wrap justify-center gap-2">
              {PLATFORM_TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    tab === t.key ? 'bg-primary-800 text-white' : 'text-ink-600 hover:bg-surface-subtle hover:text-ink-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-surface-border shadow-card md:grid-cols-[5fr_7fr]">
              <div className="flex flex-col justify-center border-b border-surface-border bg-white p-8 md:border-b-0 md:border-r md:p-12">
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
              <div className="flex items-center justify-center bg-surface-subtle p-8" aria-hidden="true">
                <div className="w-full max-w-md rounded-xl border border-surface-border bg-white p-5 shadow-card">
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
                <div key={c.title} className={`rounded-[20px] border border-surface-border/50 p-8 ${c.tint}`}>
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
                    <CheckIcon className="h-12 w-12 text-primary-600" />
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
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
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
                {['Google Play', 'App Store'].map((store) => (
                  <span
                    key={store}
                    aria-disabled="true"
                    className="flex cursor-default items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-5 py-3 opacity-70"
                  >
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
            <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
              <div className="relative h-[480px] w-full max-w-md">
                <div className="absolute left-[12%] top-[10%] flex aspect-[9/18] w-[42%] -rotate-6 flex-col overflow-hidden rounded-[2rem] border-4 border-white/10 bg-white p-3 shadow-2xl">
                  <div className="h-2 w-16 self-center rounded-full bg-ink-200" />
                  <div className="mt-3 h-8 rounded-lg bg-primary-50" />
                  <div className="mt-2 flex-1 space-y-2">
                    <div className="h-16 rounded-lg bg-surface-subtle" />
                    <div className="h-16 rounded-lg bg-surface-subtle" />
                    <div className="h-16 rounded-lg bg-surface-subtle" />
                  </div>
                </div>
                <div className="absolute right-[12%] top-[22%] flex aspect-[9/18] w-[42%] rotate-6 flex-col overflow-hidden rounded-[2rem] border-4 border-white/10 bg-white p-3 shadow-2xl">
                  <div className="h-2 w-16 self-center rounded-full bg-ink-200" />
                  <div className="mt-3 flex-1 space-y-2">
                    <div className="ml-auto h-10 w-3/4 rounded-2xl rounded-tr-none bg-primary-100" />
                    <div className="h-10 w-3/4 rounded-2xl rounded-tl-none bg-surface-subtle" />
                    <div className="ml-auto h-10 w-2/3 rounded-2xl rounded-tr-none bg-primary-100" />
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
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-lg font-semibold text-primary-800">{f.q}</span>
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-primary-800 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && <p className="mt-3 pr-8 text-base leading-relaxed text-ink-600">{f.a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-24">
          <div className="relative overflow-hidden rounded-[20px] bg-primary-700 p-10 shadow-2xl md:p-16">
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
                <Link to="/signup/buyer" className={`${pill} w-full bg-white px-8 py-3.5 text-primary-700 hover:bg-primary-50 sm:w-auto`}>
                  Join as Buyer
                </Link>
                <Link
                  to="/signup/exporter"
                  className={`${pill} w-full border-2 border-white/80 px-8 py-3.5 text-white hover:bg-white/10 sm:w-auto`}
                >
                  Join as Seller
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer — directory pages don't exist yet; static labels, no dead links */}
      <footer className="bg-ink-900 px-4 py-14 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-12 md:flex-row">
          <div className="max-w-xs">
            <p className="text-lg font-bold">MPX Global</p>
            <p className="mt-3 text-sm text-white/60">
              The B2B marketplace connecting verified Indian exporters with international buyers.
            </p>
            <p className="mt-6 text-xs text-white/40">© 2026 MPX Global. All rights reserved.</p>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <h4 className="mb-3 text-sm font-semibold">Marketplace</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><a href="#categories" className="hover:text-white">Categories</a></li>
                <li><Link to="/signup/buyer" className="hover:text-white">For Buyers</Link></li>
                <li><Link to="/signup/exporter" className="hover:text-white">For Sellers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li>About Us</li>
                <li>Careers</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold">Resources</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li>Blog</li>
                <li>Help Center</li>
                <li>Trade Guides</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
