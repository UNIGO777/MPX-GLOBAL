import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { demoSuppliers } from '../../lib/demoSuppliers.js';
import { SupplierMark } from '../suppliers/SupplierLogo.jsx';
import { HEADING } from './SectionHeader.jsx';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BuildingIcon,
  ChatIcon,
  CheckIcon,
  DocIcon,
  SearchIcon,
  UserIcon,
} from '../ui/icons.jsx';

/**
 * "Are you a buyer? | Are you a supplier?" — right after the hero (client
 * brief via owner, 2026-09-28; redesigned the same day: "the section design
 * in home page is not good").
 *
 * A LIGHT panel since 2026-09-28 (owner, consistency pass: the dark band was
 * one of several visual languages on the page). One toggle, then the pitch +
 * CTA on the left and a preview on the right —
 *   buyer    → faces + three sample suppliers → "Meet our verified suppliers" (/suppliers)
 *   supplier → the four steps to the verified tick → "Join our verified supplier network"
 *
 * The buyer preview uses the SAME hardcoded sample suppliers as `/suppliers`
 * (owner's decision) — see `lib/demoSuppliers.js`. Every supplier-side step is
 * true today: the profile is public from signup, the tick follows a document
 * check, enquiries and quotations are built.
 *
 * A real ARIA tablist: arrow keys switch, only the active tab is tabbable.
 */
const AUDIENCES = [
  {
    id: 'buyer',
    tab: 'I’m a buyer',
    Icon: SearchIcon,
    eyebrow: 'For buyers',
    title: 'Source from verified Indian exporters',
    points: [
      'A person on our team checked every verified company’s documents',
      'Enquire and chat directly with the supplier — no brokers',
      'Ask for samples before you commit to an order',
    ],
    cta: { label: 'Meet our verified suppliers', to: '/suppliers' },
    note: 'Free for buyers',
  },
  {
    id: 'supplier',
    tab: 'I’m a supplier',
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

/** A head-and-shoulders crop of a full-length cut-out portrait. */
function Face({ photo }) {
  return (
    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-ink-800 ring-2 ring-white">
      {photo && (
        <img src={photo} alt="" className="absolute left-1/2 top-0.5 h-[260%] w-auto max-w-none -translate-x-1/2" />
      )}
    </span>
  );
}

function BuyerPreview() {
  const people = demoSuppliers();
  return (
    <div className="rounded-3xl bg-white p-5 text-ink-900 shadow-[0_24px_60px_-30px_rgb(0_5_23/0.35)] ring-1 ring-ink-200/60 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex -space-x-3">
          {people.slice(0, 5).map((p) => (
            <Face key={p.id} photo={p.person?.photo} />
          ))}
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[12px] font-bold text-white ring-2 ring-white">
            100+
          </span>
        </div>
        <span className="hidden items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700 min-[400px]:inline-flex">
          <BadgeCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Verified
        </span>
      </div>
      <p className="mt-4 text-[15px] font-bold tracking-tight">Verified supplier network</p>
      <ul className="mt-2 divide-y divide-ink-100">
        {people.slice(0, 3).map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <SupplierMark brand={r.brand} className="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{r.name}</span>
              <span className="block truncate text-[12px] text-ink-500">
                {r.city}, {r.region} · {r.category}
              </span>
            </span>
            <BadgeCheckIcon className="h-4 w-4 shrink-0 text-success-700" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = [
  [UserIcon, 'Register', 'Your public profile is live the same day'],
  [DocIcon, 'Upload documents', 'Company registration and ID'],
  [BadgeCheckIcon, 'Get the verified tick', 'Checked by a person on our team'],
  [ChatIcon, 'Receive enquiries', 'Chat and send quotations to buyers'],
];

function SupplierPreview() {
  return (
    <div className="rounded-3xl bg-white p-5 text-ink-900 shadow-[0_24px_60px_-30px_rgb(0_5_23/0.35)] ring-1 ring-ink-200/60 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Your path to verified</p>
      <ol className="relative mt-4 space-y-4">
        <span aria-hidden="true" className="absolute bottom-4 left-[17px] top-4 w-px bg-ink-200" />
        {STEPS.map(([Icon, title, body], i) => (
          <li key={title} className="relative flex items-start gap-3.5">
            <span
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                i === 2 ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-700'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-[14px] font-semibold">{title}</span>
              <span className="block text-[12.5px] text-ink-500">{body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

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
    <section aria-labelledby="fork-audience-heading" className="w-full bg-white">
      {/* 🔴 FULL-BLEED, square (owner, 2026-09-28: "full section dont take margin
          and remove border rounding"). The panel used to be a rounded card
          inset inside the section's gutters; it IS the section now — no
          `rounded`, no `ring`, no `shadow`, and the outer gutters are gone.

          ⚠️ The gutters moved INWARD rather than disappearing. `web-design.md`
          requires a side gutter so text never touches the screen edge on a
          phone, so the panel carries the page's own `px-4 sm:px-6 lg:px-10
          xl:px-16` itself. What runs edge to edge is the background, not the
          copy. */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-ink-50 via-white to-primary-50/50 px-4 py-10 text-ink-900 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
        <span aria-hidden="true" className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-primary-100/60 blur-3xl" />
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(0_5_23/0.05)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />

        <div className="flex flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Get started</p>
          <h2 id="fork-audience-heading" className={`mt-1.5 ${HEADING}`}>
            Are you a buyer or a supplier?
          </h2>

          <div
            role="tablist"
            aria-label="Choose your side"
            onKeyDown={onKeyDown}
            className="mt-6 inline-flex w-full max-w-sm rounded-full bg-white p-1 shadow-sm ring-1 ring-ink-200/80 sm:w-auto sm:max-w-none"
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
                  className={`flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/40 sm:flex-none sm:px-7 sm:text-[15px] ${
                    on ? 'bg-ink-900 text-white shadow-card' : 'text-ink-600 hover:text-ink-900'
                  }`}
                >
                  <x.Icon className={`h-4 w-4 shrink-0 ${on ? 'text-primary-300' : ''}`} aria-hidden="true" />
                  {x.tab}
                </button>
              );
            })}
          </div>
        </div>

        <div
          key={a.id}
          role="tabpanel"
          id={`fork-panel-${a.id}`}
          aria-labelledby={`fork-tab-${a.id}`}
          className="mt-8 grid animate-fade-in grid-cols-1 items-center gap-8 motion-reduce:animate-none sm:mt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">{a.eyebrow}</p>
            <h3 className="mt-1.5 text-balance text-[26px] font-bold leading-tight tracking-tight sm:text-[34px]">{a.title}</h3>
            <ul className="mt-6 space-y-3.5">
              {a.points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[15px] leading-snug text-ink-700">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                to={a.cta.to}
                className="group inline-flex min-h-[52px] items-center gap-3 rounded-full bg-gradient-to-b from-primary-500 to-primary-700 px-6 text-[15px] font-semibold text-white transition hover:from-primary-600 hover:to-primary-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/30"
              >
                {a.cta.label}
                <ArrowRightIcon className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </Link>
              <span className="text-[13px] text-ink-500">{a.note}</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md lg:max-w-none">
            {a.id === 'buyer' ? <BuyerPreview /> : <SupplierPreview />}
          </div>
        </div>
      </div>
    </section>
  );
}
