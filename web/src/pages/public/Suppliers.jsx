import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { demoSuppliers } from '../../lib/demoSuppliers.js';
import { useCanonical, useNoIndex } from '../../lib/seo.js';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { SupplierCardFan } from '../../components/suppliers/SupplierCardFan.jsx';
import { SupplierFeatureCard } from '../../components/suppliers/SupplierFeatureCard.jsx';
import { fromDemo } from '../../components/suppliers/supplierModel.js';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BuildingIcon,
  ChatIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  TagIcon,
} from '../../components/ui/icons.jsx';

/**
 * `/suppliers` — "Meet our verified suppliers" (client brief via owner,
 * 2026-09-28). A DIRECTORY page, not a second home page (owner: "you made it
 * like a home page"):
 *
 *   1. A compact page header — breadcrumb, title + count, search, industry chips.
 *   2. The featured supplier — the full-width profile card, prev / next,
 *      moving on every 6 s (pauses on hover/focus, never under reduced motion).
 *   3. "Request your sample today" — a slim bar right under the supplier, as
 *      the client's brief places it (on phones it closes the card instead).
 *   4. "100+ verified suppliers" — the card fan, filtered by the search and
 *      chips; picking a card features that supplier above.
 *   5. A compact "Are you a supplier?" join block.
 *
 * DATA — 🔴 HARDCODED SAMPLE SUPPLIERS, no fetch (owner: "put this dummy data
 * in hardcoded format, don't fetch there for now"). A small "Preview" label and
 * `noindex` stay so fictional companies are not indexed. To go live with real
 * data: map `/public/search?type=supplier&verifiedOnly=true` through `fromReal`.
 *
 * SAMPLE REQUESTS go through the enquiry flow — a real sample ORDER is Phase 2.
 */
const STEP_MS = 6000;

function SampleLink({ to, className = '' }) {
  return (
    <Link
      to={to}
      className={`group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary-500 to-primary-700 px-5 text-[14.5px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_10px_24px_-12px_theme(colors.primary.600/80%)] transition hover:from-primary-600 hover:to-primary-800 ${className}`}
    >
      Request a sample
      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </Link>
  );
}

export function Suppliers() {
  const demo = true;
  useCanonical('/suppliers');
  useNoIndex(demo);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Verified Suppliers — MPX Global';
    return () => {
      document.title = previous;
    };
  }, []);

  const suppliers = useMemo(() => demoSuppliers().map(fromDemo), []);
  const [index, setIndex] = useState(0);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  const categories = useMemo(() => ['All', ...new Set(suppliers.map((s) => s.category))], [suppliers]);
  const q = query.trim().toLowerCase();
  const shown = suppliers.filter(
    (s) =>
      (category === 'All' || s.category === category) &&
      (!q || [s.name, s.person?.name, s.location, s.category, ...(s.specialities ?? [])].some((v) => v?.toLowerCase().includes(q))),
  );

  const n = suppliers.length;
  const featured = suppliers[index];
  const go = (step) => setIndex((i) => (i + step + n) % n);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const auto = !paused && !reduced && n > 1;
  useEffect(() => {
    if (!auto) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % n), STEP_MS);
    return () => clearTimeout(t);
  }, [auto, index, n]);

  const feature = (picked) => {
    setIndex(suppliers.findIndex((s) => s.key === picked.key));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('featured')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const gutter = 'px-4 sm:px-6 lg:px-10 xl:px-16';

  return (
    <div className="bg-surface-subtle text-ink-900">
      <PublicHeader current="Suppliers" />

      <main>
        {/* ═════════ 1 · PAGE HEADER ═════════ */}
        <header className={`relative isolate overflow-hidden border-b border-ink-100 bg-gradient-to-b from-white to-primary-50/50 pb-6 pt-6 sm:pb-8 sm:pt-8 ${gutter}`}>
          <span aria-hidden="true" className="absolute -right-24 -top-32 -z-10 h-72 w-72 rounded-full bg-primary-100/50 blur-3xl" />
          <nav aria-label="Breadcrumb" className="text-[13px] text-ink-500">
            <Link to="/" className="-my-3 inline-block py-3 hover:text-primary-700">Home</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span className="font-medium text-ink-800">Suppliers</span>
          </nav>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[28px] font-extrabold tracking-tight sm:text-[34px]">
                Verified suppliers
                <span className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-primary-700 shadow-sm ring-1 ring-primary-100">100+</span>
              </h1>
              <p className="mt-1 text-[14.5px] text-ink-600">
                Indian exporters whose documents a person on our team has checked.
                {demo && <span className="ml-2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-500 ring-1 ring-ink-200/70">Preview · sample suppliers</span>}
              </p>
              {/* Three things that are true of every listing today — no counts,
                  no guarantees (this site's standing rule against claims). */}
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-ink-700">
                {[
                  [BadgeCheckIcon, 'Documents checked by our team'],
                  [ChatIcon, 'Enquire and chat directly'],
                  [TagIcon, 'Free for buyers'],
                ].map(([Icon, label]) => (
                  <li key={label} className="inline-flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-primary-600" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <label className="relative block w-full lg:w-80">
              <span className="sr-only">Search suppliers</span>
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by company, product or city"
                className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-10 pr-3 text-[14px] outline-none transition placeholder:text-ink-500 focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10"
              />
            </label>
          </div>
          <div role="group" aria-label="Filter by industry" className="scrollbar-none -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
            {categories.map((c) => {
              const on = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c)}
                  className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                    on ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-ink-700 ring-1 ring-ink-200 hover:ring-ink-400'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </header>

        {/* ═════════ 2 · FEATURED SUPPLIER ═════════ */}
        <section
          id="featured"
          aria-label="Featured supplier"
          className={`scroll-mt-20 pb-12 pt-8 sm:pb-16 sm:pt-10 ${gutter}`}
          // Mouse hover and keyboard focus only — see SupplierCardFan.
          onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}
          onFocus={(e) => e.target.matches(':focus-visible') && setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Featured supplier</p>
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold tabular-nums text-ink-500">
                <span className="text-ink-900">{String(index + 1).padStart(2, '0')}</span> / {String(n).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => go(-1)} aria-label="Previous featured supplier" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-ink-200 transition hover:ring-ink-900">
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Next featured supplier" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-ink-200 transition hover:ring-ink-900">
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <SupplierFeatureCard
            supplier={featured}
            footer={
              // Phones: the sample ask closes the card itself — a separate box there read as a stray block.
              <div className="-mx-5 -mb-5 mt-5 bg-primary-50/60 px-5 pb-5 pt-4 sm:hidden">
                <p className="text-[15px] font-bold tracking-tight">Request your sample today</p>
                <p className="mt-0.5 text-[12.5px] text-ink-600">Ask {featured.name} for a sample in your enquiry. Enquiring is free.</p>
                <SampleLink to={featured.sampleTo} className="mt-3 w-full" />
              </div>
            }
          />

          {/* ═════════ 3 · REQUEST A SAMPLE (tablet and up) ═════════ */}
          <div className="relative mt-3 hidden items-center justify-between gap-4 overflow-hidden rounded-2xl bg-white px-6 py-4 ring-1 ring-ink-200/70 sm:flex">
            {auto && (
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-ink-100">
                <span key={index} className="absolute inset-0 origin-left animate-banner-progress bg-primary-600" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[16px] font-bold tracking-tight">Request your sample today</p>
              <p className="mt-0.5 text-[13px] text-ink-600">
                Ask {featured.person?.name ?? featured.name} at {featured.name} for a sample in your enquiry. Enquiring is free for buyers.
              </p>
            </div>
            <SampleLink to={featured.sampleTo} />
          </div>
        </section>

        {/* ═════════ 4 · THE NETWORK ═════════ */}
        <section aria-labelledby="network-heading" className={`border-y border-ink-100 bg-white pb-6 pt-12 sm:pb-10 sm:pt-16 ${gutter}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Browse the network</p>
              <h2 id="network-heading" className="mt-2 text-[22px] font-extrabold tracking-tight sm:text-[26px]">
                <span className="text-primary-600">100+</span> verified suppliers
              </h2>
              <p className="mt-1 text-[13.5px] text-ink-600">
                {category === 'All' && !q
                  ? 'Pick any card to see the supplier in full above.'
                  : `${shown.length} matching ${shown.length === 1 ? 'supplier' : 'suppliers'} — pick one to see it in full above.`}
              </p>
            </div>
          </div>
          {shown.length > 0 ? (
            <div className="mt-4">
              <SupplierCardFan key={`${category}|${q}`} suppliers={shown} onSelect={feature} />
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-ink-200/70">
              <p className="font-semibold">No suppliers match that search</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('All');
                }}
                className="mt-3 text-[14px] font-semibold text-primary-700 underline underline-offset-4"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        {/* ═════════ 5 · SUPPLIER LINE ═════════ */}
        <section className={`py-12 sm:py-16 ${gutter}`}>
          <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-3xl bg-ink-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
            <span aria-hidden="true" className="absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-primary-600/35 blur-3xl" />
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <BuildingIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[18px] font-bold tracking-tight sm:text-[20px]">Are you a supplier?</p>
                <p className="mt-1 max-w-md text-[14px] leading-relaxed text-white/75">
                  Join our verified supplier network. Your profile goes live the day you register.
                </p>
              </div>
            </div>
            <Link
              to="/signup/exporter"
              className="group inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[14.5px] font-semibold text-ink-900 transition hover:bg-ink-100 sm:w-auto"
            >
              Join as a supplier
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
