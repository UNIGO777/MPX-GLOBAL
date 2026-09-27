import { countryName } from '../../lib/countries.js';
import { formatMonth } from '../../lib/format.js';
import { BadgeCheckIcon, CalendarIcon, GlobeIcon } from '../ui/icons.jsx';
import { SupplierMark } from './SupplierLogo.jsx';
import { initialsOf } from './supplierModel.js';

/**
 * The featured supplier card on `/suppliers`, built to the client's reference
 * (the Phoenix card, 2026-09-28) in MPX colours: a compact centred card —
 * brand bar with a pill, a status rule, location / NAME / company line on the
 * left with the person's cut-out portrait standing on the right, a red stat
 * band the portrait overlaps, then grey info boxes with a verified seal and a
 * dates box, as the reference's bottom row.
 *
 * The sample portraits are cut from the Phoenix card artwork, which the owner
 * confirmed is AI-generated — see `lib/demoSuppliers.js`. Without a photo the
 * card draws a neutral silhouette.
 */

function PortraitPlaceholder() {
  return (
    <svg viewBox="0 0 200 260" className="h-full w-auto" aria-hidden="true">
      <circle cx="100" cy="78" r="44" fill="#D5D8DF" />
      <path d="M14 260c4-70 40-110 86-110s82 40 86 110z" fill="#AEB5C2" />
    </svg>
  );
}

/** The round "verified" seal — the reference's "approved" stamp, in MPX red. */
function Seal() {
  return (
    <span aria-hidden="true" className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full text-primary-600">
        <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path id="seal-arc" d="M14 32a18 18 0 0 1 36 0" fill="none" />
        <text fontSize="6.5" fontWeight="700" letterSpacing="1.5" fill="currentColor">
          <textPath href="#seal-arc" startOffset="50%" textAnchor="middle">VERIFIED</textPath>
        </text>
      </svg>
      <BadgeCheckIcon className="relative mt-2 h-6 w-6 text-primary-600" />
    </span>
  );
}

export function SupplierFeatureCard({ supplier: s }) {
  const person = s.person;
  const detail = (label) => s.details.find((d) => d.label === label)?.value;

  return (
    <article
      aria-labelledby="featured-supplier-name"
      className="mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-30px_rgb(0_5_23/0.35)] ring-1 ring-ink-200/70"
    >
      {/* Brand bar */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary-700 to-primary-600 px-5 py-3 sm:px-7">
        <span className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-white">MPX Global</span>
        <span className="shrink-0 rounded-full bg-white/15 px-4 py-1 text-[13px] font-bold uppercase tracking-wide text-white ring-1 ring-white/30">
          Verified supplier
        </span>
      </div>

      <div className="px-5 pt-5 sm:px-7 sm:pt-6">
        {/* Status rule */}
        <div className="flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-600">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success-500" />
            Documents checked
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-ink-300" />
          <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-0.5 text-ink-700">MPX verified</span>
        </div>

        {/* Identity (left) + portrait (right, standing on the band below). */}
        <div className="relative">
          <div className="min-h-[150px] pb-4 pr-[40%] pt-4 sm:min-h-[170px] sm:pr-[42%]">
            <p className="text-[14px] text-ink-500 sm:text-[15px]">{s.location}</p>
            <h2
              id="featured-supplier-name"
              className="mt-0.5 text-[22px] font-bold uppercase leading-tight tracking-tight text-ink-900 sm:text-[28px]"
            >
              {person ? person.name : s.name}
            </h2>
            <p className="mt-2 text-[13px] leading-snug text-ink-600 sm:text-[14px]">
              {person ? (
                <>
                  <span className="font-semibold text-ink-800">{s.name}</span> — {s.tagline.charAt(0).toLowerCase()}
                  {s.tagline.slice(1)}
                </>
              ) : (
                s.tagline
              )}
            </p>
          </div>

          {/* Red stat band — the reference's green panel. */}
          <div className="relative flex items-stretch rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white">
            <div className="flex flex-col justify-center px-4 py-3.5 sm:px-6 sm:py-4">
              <span className="font-serif text-[46px] italic leading-none sm:text-[64px]">{s.highlight.value}</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">{s.highlight.label}</span>
            </div>
            <div aria-hidden="true" className="my-4 w-px bg-white/30" />
            <div className="flex min-w-0 flex-col justify-center py-3.5 pl-4 pr-[40%] text-[12px] leading-snug sm:pl-6 sm:pr-[42%] sm:text-[13px]">
              <span className="font-bold uppercase tracking-wide">{s.category}</span>
              <span className="mt-0.5 text-white/85">{detail('Production capacity')}</span>
            </div>
          </div>

          {/* The portrait: bottom on the band's bottom edge, rising above it. */}
          {person && (
            <div className="pointer-events-none absolute bottom-0 right-2 flex h-[210px] items-end sm:right-4 sm:h-[270px]">
              {person.photo ? (
                <img
                  src={person.photo}
                  alt={`${person.name}, ${person.role} at ${s.name}`}
                  className="h-full w-auto object-contain object-bottom"
                />
              ) : (
                <PortraitPlaceholder />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row — the reference's grey info boxes. */}
      <div className="grid gap-3 p-5 sm:grid-cols-[1.4fr_1fr] sm:p-7">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-4 py-3.5 ring-1 ring-ink-200/70">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">Annual turnover</p>
            <p className="mt-0.5 font-serif text-[26px] italic leading-tight text-ink-900">{detail('Annual turnover')}</p>
            <p className="mt-0.5 text-[11.5px] font-medium uppercase leading-snug tracking-wide text-ink-600">
              {['IN', ...s.presence].map((c) => countryName(c) ?? c).join(' · ')}
            </p>
          </div>
          <Seal />
        </div>
        <div className="relative rounded-2xl bg-ink-50 px-4 py-3.5 text-[12px] ring-1 ring-ink-200/70">
          <span aria-hidden="true" className="absolute -top-2.5 left-4 flex h-5 w-5 items-center justify-center rounded-md bg-primary-600 text-white">
            <CalendarIcon className="h-3 w-3" />
          </span>
          <p className="text-ink-500">Verified on</p>
          <p className="font-semibold text-ink-900">{formatMonth(s.verifiedSince)}</p>
          <p className="mt-1.5 text-ink-500">Speaks</p>
          <p className="font-semibold text-ink-900">{detail('Languages spoken')}</p>
        </div>
      </div>

      {/* Company line: logo, website, established. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5 sm:px-7">
        <span className="flex items-center gap-2.5">
          {s.brand ? (
            <SupplierMark brand={s.brand} className="h-8 w-8" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-[12px] font-extrabold text-primary-700">
              {initialsOf(s.name)}
            </span>
          )}
          <span className="text-[13px] font-semibold text-ink-900">{s.name}</span>
          {s.established && <span className="text-[12px] text-ink-500">· Est. {s.established}</span>}
        </span>
        {detail('Website') && (
          // Plain text on purpose — sample domains must never be live links.
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-600">
            <GlobeIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
            {detail('Website')}
          </span>
        )}
      </div>
    </article>
  );
}
