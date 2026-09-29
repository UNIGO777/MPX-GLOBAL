import { Link } from 'react-router-dom';

import { demoSuppliers } from '../../lib/demoSuppliers.js';
import { SupplierMark } from '../suppliers/SupplierLogo.jsx';
import { ArrowRightIcon, BadgeCheckIcon, SparkleIcon } from '../ui/icons.jsx';

/**
 * The hero's right half: an ILLUSTRATIVE preview of AI match-making — a buyer's
 * request and the suppliers it matches (2026-09-29, the split hero from
 * Claude's design review: "the top section looks too centralised").
 *
 * 🔴 It is plainly labelled "Example". The three companies are the hardcoded
 * SAMPLE suppliers from `lib/demoSuppliers.js` (the same fictional set the
 * /suppliers page previews) — they must never read as real search results. No
 * match percentages, no counts, no prices: nothing here is a claim.
 *
 * Decorative rows, not controls — the only link is "Try it with your own
 * request", which goes to the real AI search.
 */
const MATCH_IDS = ['demo-kesarvan', 'demo-nilvara', 'demo-ojasvi'];
const REQUEST = 'Organic turmeric powder, 5 tonnes to Dubai';

export function HeroMatchPreview({ className = '' }) {
  const all = demoSuppliers();
  const rows = MATCH_IDS.map((id) => all.find((s) => s.id === id)).filter(Boolean);

  return (
    <div className={`relative ${className}`}>
      {/* Soft glow behind the card — depth, not decoration for its own sake. */}
      <span aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-primary-100/70 via-white/0 to-sand/60 blur-2xl" />

      <div className="rounded-3xl bg-white p-5 shadow-[0_30px_70px_-35px_rgb(0_5_23/0.45)] ring-1 ring-ink-900/[0.06] sm:p-6">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-900">
            <SparkleIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
            AI match-making
          </span>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-600">
            Example
          </span>
        </div>

        {/* The request */}
        <div className="mt-4 rounded-2xl bg-ink-50 px-4 py-3 ring-1 ring-ink-200/60">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">Buyer request</p>
          <p className="mt-1 text-[14.5px] font-medium leading-snug text-ink-900">“{REQUEST}”</p>
        </div>

        {/* The matches */}
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Matched suppliers</p>
        <ul className="mt-2 divide-y divide-ink-100">
          {rows.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <SupplierMark brand={s.brand} className="h-10 w-10" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold text-ink-900">{s.name}</span>
                  <BadgeCheckIcon className="h-4 w-4 shrink-0 text-success-700" aria-label="Verified" />
                </span>
                <span className="block truncate text-[12px] text-ink-500">
                  {s.city}, {s.region} · {s.category}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <Link
          to="/ai-search"
          className="group mt-3 flex items-center justify-between rounded-2xl bg-ink-900 px-4 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-ink-800"
        >
          Try it with your own request
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </Link>
      </div>

    </div>
  );
}
