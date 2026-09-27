import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ArrowRightIcon, BadgeCheckIcon, BuildingIcon, CheckIcon, SearchIcon } from '../ui/icons.jsx';

/**
 * "Are you a buyer? | Are you a supplier?" — the section right after the hero
 * (client brief via owner, 2026-09-28). One switch, two panels:
 *
 *   buyer    → "Meet our verified suppliers"          → `/suppliers`
 *   supplier → "Join our verified supplier network"   → `/signup/exporter`
 *
 * A real ARIA tablist: arrow keys move between the two tabs, only the active
 * tab is in the tab order, and each panel is labelled by its tab.
 *
 * 🔴 Every bullet is true today: verification is a document check by a person,
 * a seller's profile is public from signup (the tick is not a gate), buyers
 * join free, enquiries and chat are built.
 */
const AUDIENCES = [
  {
    id: 'buyer',
    tab: 'Are you a buyer?',
    Icon: SearchIcon,
    eyebrow: 'For buyers',
    title: 'Source from verified Indian exporters',
    points: [
      'The verified tick means our team checked the company’s documents',
      'Enquire and chat directly with the supplier — no brokers',
      'Ask for samples before you commit to an order',
    ],
    cta: { label: 'Meet our verified suppliers', to: '/suppliers' },
    note: 'Free for buyers',
  },
  {
    id: 'supplier',
    tab: 'Are you a supplier?',
    Icon: BuildingIcon,
    eyebrow: 'For suppliers',
    title: 'Reach international buyers from India',
    points: [
      'Your public profile goes live the day you register',
      'Upload your documents to earn the verified tick',
      'Receive enquiries and send quotations on the platform',
    ],
    cta: { label: 'Join our verified supplier network', to: '/signup/exporter' },
    note: 'Takes a few minutes to start',
  },
];

export function AudienceFork() {
  const [active, setActive] = useState(0);
  const tabsRef = useRef([]);

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (active + (e.key === 'ArrowRight' ? 1 : -1) + AUDIENCES.length) % AUDIENCES.length;
    setActive(next);
    tabsRef.current[next]?.focus();
  };

  const a = AUDIENCES[active];

  return (
    <section aria-labelledby="fork-audience-heading" className="w-full bg-white px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Get started</p>
        <h2 id="fork-audience-heading" className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Tell us who you are
        </h2>

        {/* The switch */}
        <div
          role="tablist"
          aria-label="Choose your side"
          onKeyDown={onKeyDown}
          className="mx-auto mt-6 inline-flex w-full max-w-md rounded-full bg-ink-100 p-1 ring-1 ring-ink-200/70 sm:w-auto"
        >
          {AUDIENCES.map((x, i) => {
            const on = i === active;
            return (
              <button
                key={x.id}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`fork-tab-${x.id}`}
                aria-selected={on}
                aria-controls={`fork-panel-${x.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={`flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold min-[400px]:gap-2 min-[400px]:px-4 min-[400px]:text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/40 sm:flex-none sm:px-6 sm:text-[15px] ${
                  on ? 'bg-white text-ink-900 shadow-card' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                <x.Icon className={`h-4 w-4 shrink-0 max-[359px]:hidden ${on ? 'text-primary-600' : ''}`} aria-hidden="true" />
                {x.tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* The panel */}
      <div
        key={a.id}
        role="tabpanel"
        id={`fork-panel-${a.id}`}
        aria-labelledby={`fork-tab-${a.id}`}
        className="mx-auto mt-6 max-w-5xl animate-fade-in motion-reduce:animate-none sm:mt-8"
      >
        <div className="grid overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-ink-200/70 md:grid-cols-[1.3fr_1fr]">
          <div className="p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">{a.eyebrow}</p>
            <h3 className="mt-1.5 text-[22px] font-bold tracking-tight text-ink-900 sm:text-[26px]">{a.title}</h3>
            <ul className="mt-5 space-y-3">
              {a.points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[14.5px] leading-snug text-ink-700">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative isolate flex flex-col justify-center gap-4 overflow-hidden bg-ink-900 p-6 text-white sm:p-8">
            <span aria-hidden="true" className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-primary-600/30 blur-3xl" />
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <BadgeCheckIcon className="h-6 w-6 text-white" />
            </span>
            <Link
              to={a.cta.to}
              className="group inline-flex min-h-[52px] items-center justify-between gap-3 rounded-2xl bg-gradient-to-b from-primary-500 to-primary-700 px-5 text-left text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_12px_28px_-12px_theme(colors.primary.600/80%)] transition hover:from-primary-600 hover:to-primary-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              {a.cta.label}
              <ArrowRightIcon className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </Link>
            <p className="text-[12.5px] text-ink-300">{a.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
