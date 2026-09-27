import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { demoSuppliers } from '../../lib/demoSuppliers.js';
import { useCanonical, useNoIndex } from '../../lib/seo.js';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { SuccessShowcase } from '../../components/landing/SuccessShowcase.jsx';
import { SupplierFeatureCard } from '../../components/suppliers/SupplierFeatureCard.jsx';
import { fromDemo } from '../../components/suppliers/supplierModel.js';
import { ArrowRightIcon, BadgeCheckIcon, ChatIcon, SparkleIcon } from '../../components/ui/icons.jsx';

/**
 * `/suppliers` — "Meet our verified suppliers" (client brief via owner,
 * 2026-09-28): the page a buyer reaches from the landing's "Are you a buyer?"
 * switch. A featured supplier card (the client's reference layout), then
 * "Request your sample today", then the landing's "Verified suppliers"
 * showcase (owner: "put this exact inside /suppliers").
 *
 * DATA — 🔴 HARDCODED SAMPLE SUPPLIERS, no fetch (owner, 2026-09-28: "put this
 * dummy data in hardcoded format, don't fetch there for now"). This supersedes
 * the earlier demo switch. The page keeps a small "Preview data" label and
 * `noindex` so fictional companies are not presented as real verified
 * suppliers or indexed. To go live with real data: map
 * `/public/search?type=supplier&verifiedOnly=true` through `fromReal`
 * (`supplierModel.js`) — see git history for the previous version.
 *
 * SAMPLE REQUESTS — "Request a sample" (owner chose this over a real sample
 * ORDER, which is Phase 2 / order management). Enquiries are always about a
 * product (M4-4), so for a real supplier the button opens their profile, where
 * the buyer picks the product and asks for a sample in the enquiry.
 */
const TRUST_POINTS = [
  [BadgeCheckIcon, 'Documents checked', 'The verified tick means a person on our team checked the company’s registration papers.'],
  [ChatIcon, 'Direct to the supplier', 'Enquire and chat with the exporter themselves — no brokers in between.'],
  [SparkleIcon, 'Samples on request', 'Ask for a sample in your enquiry before you commit to an order.'],
];

export function Suppliers() {
  const demo = true;
  useCanonical('/suppliers');
  // Fictional companies — keep them out of search indexes.
  useNoIndex(demo);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Verified Suppliers — MPX Global';
    return () => {
      document.title = previous;
    };
  }, []);

  const suppliers = demoSuppliers().map(fromDemo);
  const featured = suppliers[0];

  return (
    <div className="bg-white text-ink-900">
      <PublicHeader current="Suppliers" />

      <main>
        {/* ═════════ PAGE HERO ═════════ */}
        <section className="relative isolate overflow-hidden border-b border-ink-100 bg-white">
          <div aria-hidden="true" className="bg-hero-grid absolute inset-0 -z-10" />
          <div aria-hidden="true" className="bg-hero-glow absolute inset-0 -z-10" />
          <div className="w-full px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16 lg:px-10 xl:px-16">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-700 shadow-sm">
                <span aria-hidden="true" className="h-2 w-2 animate-pulse-soft rounded-full bg-success-500 motion-reduce:animate-none" />
                Verified supplier network
              </span>
              {demo && (
                <span className="rounded-full bg-warning-50 px-3 py-1.5 text-[12px] font-semibold text-warning-700 ring-1 ring-warning/30">
                  Preview data — sample suppliers
                </span>
              )}
            </div>
            <h1 className="mt-4 max-w-3xl text-balance text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Meet our <span className="text-gradient-brand">verified suppliers</span>
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-relaxed text-ink-600 sm:text-lg">
              Indian exporters whose documents a person on our team has checked. See what they make,
              where they ship, and request a sample directly.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {TRUST_POINTS.map(([Icon, title, body]) => (
                <li key={title} className="flex gap-3 rounded-2xl bg-white/80 p-4 shadow-card ring-1 ring-ink-200/70 backdrop-blur-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-ink-900">{title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-600">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {featured && (
          <>
            {/* ═════════ FEATURED SUPPLIER ═════════ */}
            <section aria-label="Featured supplier" className="w-full px-4 pt-10 sm:px-6 sm:pt-14 lg:px-10 xl:px-16">
              <SupplierFeatureCard key={featured.key} supplier={featured} />
            </section>

            {/* ═════════ REQUEST A SAMPLE ═════════ */}
            <section aria-labelledby="sample-heading" className="w-full px-4 pt-5 sm:px-6 sm:pt-6 lg:px-10 xl:px-16">
              <div className="flex flex-col gap-5 rounded-3xl bg-ink-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="min-w-0">
                  <h2 id="sample-heading" className="text-[22px] font-bold tracking-tight sm:text-[26px]">
                    Request your sample today
                  </h2>
                  <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-300">
                    {featured.isDemo
                      ? 'Create a free buyer account, then ask any verified supplier for a sample in your enquiry.'
                      : `Open ${featured.name}’s profile, pick the product, and ask for a sample in your enquiry.`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2.5">
                  <Link
                    to={featured.sampleTo}
                    className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-primary-500 to-primary-700 px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_10px_24px_-10px_theme(colors.primary.600/80%)] transition hover:from-primary-600 hover:to-primary-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                  >
                    Request a sample
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </Link>
                  {featured.profileTo && (
                    <Link
                      to={featured.profileTo}
                      className="inline-flex h-12 items-center rounded-xl px-5 text-[15px] font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10"
                    >
                      View profile
                    </Link>
                  )}
                </div>
              </div>
            </section>

            {/* ═════════ VERIFIED SUPPLIERS ═════════
                The landing page's "Verified suppliers" section, copied here
                exactly at the owner's instruction (2026-09-28: "put this exact
                inside /suppliers replacing the current carousel"). Same
                `SuccessShowcase`, same heading, strapline and "100+" line.
                🔴 The note on the landing page applies here too: the cards are
                Phoenix Business Advisory visa-approval artwork, not supplier
                verifications — the owner's wording and decision. */}
            <section className="w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-10 xl:px-16">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Verified suppliers</h2>
                  <p className="mt-1 text-sm text-ink-600">Companies whose documents a person on our team has checked.</p>
                </div>
                <Link
                  to="/search?type=supplier"
                  className="hidden shrink-0 rounded-xl border border-surface-border px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 sm:inline-block"
                >
                  See all ›
                </Link>
              </div>
              <SuccessShowcase />
              <p className="mt-8 text-center text-2xl font-extrabold tracking-tight text-ink-900 sm:mt-10 sm:text-3xl">
                <span className="text-primary-600">100+</span> verified suppliers
              </p>
            </section>
          </>
        )}

        {/* ═════════ JOIN THE NETWORK ═════════ */}
        <section aria-labelledby="join-heading" className="w-full px-4 pb-14 sm:px-6 sm:pb-16 lg:px-10 xl:px-16">
          <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 p-6 text-white sm:p-10">
            <span aria-hidden="true" className="absolute -right-20 -top-20 -z-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">Are you a supplier?</p>
            <h2 id="join-heading" className="mt-1.5 max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl">
              Join our verified supplier network
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white/90">
              Your profile goes live the day you register. Upload your documents to earn the verified tick
              and start receiving enquiries from international buyers.
            </p>
            <Link
              to="/signup/exporter"
              className="group mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-primary-700 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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
