import { Link } from 'react-router-dom';

import { BadgeCheckIcon, BoxIcon, GlobeIcon } from '../ui/icons.jsx';
import { countryName } from '../../lib/countries.js';

/**
 * A large "verified supplier" card, built to the layout the owner sent
 * (2026-09-27 — a Phoenix Business Advisory approval card).
 *
 * 🔴 **EVERY FIELD COMES FROM THE PUBLIC SUPPLIER PROJECTION.** name, slug,
 * country, description, logo, entityType, establishedYear, verified,
 * memberSince and productCount are exactly what `Organisation.PUBLIC_FIELDS` +
 * `PUBLIC_DERIVED` hand a guest. Nothing here is composed, inferred or filled in
 * — `m3-public-projection.md` guards that surface, and a card is not a reason to
 * widen it.
 *
 * 🔴 **`verified` is the DERIVED boolean, never `kycStatus`.** The public API
 * does not send the raw status at all, precisely so a `rejected` state cannot
 * leak. There is no "not verified" badge either: absence of the tick is the only
 * signal (`web-design.md`, CLAUDE.md → Roles).
 *
 * ⚠️ The reference card carries a person's photograph, an investment figure and
 * two approval dates. We hold none of those about a supplier and they are not on
 * the public projection, so the stat block shows what this platform actually
 * knows: how many listings the company has, and how long it has been a member.
 */
export function VerifiedSupplierCard({ supplier: s }) {
  const place = countryName(s.country) ?? s.country;
  const since = s.establishedYear ?? s.memberSince;

  return (
    <Link
      to={`/supplier/${s.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-surface-border/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:ring-primary-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* Header strip — the reference's coloured bar. */}
      <div className="flex items-center justify-between gap-3 bg-ink-900 px-4 py-2.5">
        <span className="truncate text-[10.5px] font-bold uppercase tracking-wider text-white/70">
          {s.entityType === 'individual' ? 'Individual seller' : 'Registered business'}
        </span>
        {s.verified && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-500 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">
            <BadgeCheckIcon className="h-3 w-3" aria-hidden="true" />
            Verified
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          {s.logo ? (
            <img
              src={s.logo}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-xl border border-surface-border bg-white object-contain p-1"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-base font-bold text-primary-700">
              {s.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
          <span className="min-w-0">
            {place && (
              <span className="flex items-center gap-1 text-[11.5px] text-ink-500">
                <GlobeIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{place}</span>
              </span>
            )}
            <span className="mt-0.5 block truncate text-[15px] font-extrabold uppercase tracking-tight text-ink-900 group-hover:text-primary-700">
              {s.name}
            </span>
          </span>
        </div>

        {s.description && (
          <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-600">{s.description}</p>
        )}

        {/* The stat block — the reference's big number panel, carrying the two
            things this platform can actually state about a company. */}
        <div className="mt-auto flex items-stretch gap-3 pt-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-primary-600 px-4 py-3 text-white">
            <span className="text-2xl font-extrabold leading-none sm:text-3xl">{s.productCount ?? 0}</span>
            <span className="min-w-0 text-[10.5px] font-bold uppercase leading-tight tracking-wider text-white/80">
              {s.productCount === 1 ? 'Listing' : 'Listings'}
              <br />
              published
            </span>
          </div>
          {since && (
            <div className="flex shrink-0 flex-col justify-center rounded-2xl bg-surface-subtle px-4 py-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                {s.establishedYear ? 'Established' : 'Member since'}
              </span>
              <span className="text-base font-extrabold text-ink-900">{since}</span>
            </div>
          )}
        </div>

        <span className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary-700">
          <BoxIcon className="h-3.5 w-3.5" aria-hidden="true" />
          View catalogue
          <span aria-hidden="true">›</span>
        </span>
      </div>
    </Link>
  );
}
