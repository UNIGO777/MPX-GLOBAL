import { countryName } from '../../lib/countries.js';
import { formatMonth } from '../../lib/format.js';
import {
  BadgeCheckIcon,
  BoxIcon,
  BuildingIcon,
  CalendarIcon,
  ChartIcon,
  ChatIcon,
  GlobeIcon,
  MapPinIcon,
  TagIcon,
} from '../ui/icons.jsx';
import { SupplierLogo, SupplierMark } from './SupplierLogo.jsx';
import { initialsOf } from './supplierModel.js';

/**
 * The featured supplier profile card on `/suppliers`. Two halves:
 *
 *   left  — a dark stage: the person stands in a red spotlight inside two
 *           rings, with glass chips around them (logo, verified, the headline
 *           stat, the markets they ship to);
 *   right — who they are: location, name, role at the company, one line,
 *           specialities, the details as icon tiles, and the verified dates.
 *
 * Real markup throughout. The floating chips stop under reduced motion. The
 * sample portraits are cut from the Phoenix card artwork, which the owner
 * confirmed is AI-generated — see `lib/demoSuppliers.js`.
 */
const DETAIL_ICONS = {
  'Production capacity': BoxIcon,
  'Annual turnover': ChartIcon,
  'Languages spoken': ChatIcon,
  Website: GlobeIcon,
  'Entity type': BuildingIcon,
  Established: CalendarIcon,
  'Member since': BadgeCheckIcon,
  'Live listings': TagIcon,
};

function MarketDiscs({ codes, tone = 'dark' }) {
  return (
    <span className="flex -space-x-1">
      {codes.map((c) => (
        <span
          key={c}
          title={countryName(c) ?? c}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ring-2 ${
            tone === 'dark' ? 'bg-white text-ink-900 ring-ink-900' : 'bg-ink-900 text-white ring-white'
          }`}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

export function SupplierFeatureCard({ supplier: s, footer = null }) {
  const person = s.person;
  const markets = s.presence ?? [];
  const tiles = s.details.filter((d) => d.label !== 'Product category');

  return (
    <article
      aria-labelledby="featured-supplier-name"
      className="grid overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-40px_rgb(0_5_23/0.45)] ring-1 ring-ink-200/70 lg:grid-cols-[0.92fr_1.08fr]"
    >
      {/* ── The stage ─────────────────────────────────────────────── */}
      <div className="relative isolate h-[270px] overflow-hidden bg-ink-900 sm:h-[420px] lg:h-auto lg:min-h-[450px]">
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_88%,theme(colors.primary.600/60%),transparent_62%)]" />
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_72%)]"
        />
        <span aria-hidden="true" className="absolute left-[68%] top-[60%] -z-10 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 sm:left-1/2 sm:top-[58%] sm:h-[380px] sm:w-[380px]" />
        <span aria-hidden="true" className="absolute left-[68%] top-[60%] -z-10 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-white/[0.04] sm:left-1/2 sm:top-[58%] sm:h-[250px] sm:w-[250px]" />

        <div key={s.key} className="absolute inset-x-0 bottom-0 flex h-[86%] animate-fade-in justify-end pr-2 motion-reduce:animate-none sm:h-[88%] sm:justify-center sm:pr-0 lg:h-[82%]">
          {person?.photo && (
            <img
              src={person.photo}
              alt={`${person.name}, ${person.role} at ${s.name}`}
              className="h-full max-h-[390px] w-auto object-contain object-bottom drop-shadow-[0_20px_30px_rgb(0_0_0/0.45)]"
            />
          )}
        </div>

        <span className="absolute left-4 top-4 rounded-2xl bg-white/95 p-2 shadow-card ring-1 ring-black/5 sm:left-5 sm:top-5 sm:px-3 sm:py-2.5">
          {s.brand ? (
            <>
              <span className="sm:hidden">
                <SupplierMark brand={s.brand} className="h-10 w-10" />
              </span>
              <span className="hidden sm:block">
                <SupplierLogo name={s.name} brand={s.brand} />
              </span>
            </>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-sm font-extrabold text-primary-700">
              {initialsOf(s.name)}
            </span>
          )}
        </span>

        {s.verified && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md sm:right-5 sm:top-5">
            <BadgeCheckIcon className="h-4 w-4 text-success-400" aria-hidden="true" />
            Verified
          </span>
        )}

        <span className="absolute bottom-4 left-4 animate-hero-float-sm rounded-2xl bg-white/10 px-3 py-2.5 text-white sm:px-4 sm:py-3 ring-1 ring-white/20 backdrop-blur-md motion-reduce:animate-none sm:bottom-8 sm:left-5">
          <span className="block font-serif text-[28px] italic leading-none sm:text-[40px]">{s.highlight.value}</span>
          <span className="mt-1 block max-w-[8.5rem] text-[9.5px] font-semibold uppercase leading-snug tracking-[0.12em] text-white/80 sm:max-w-none sm:text-[10px] sm:tracking-[0.14em]">{s.highlight.label}</span>
        </span>

        {markets.length > 0 && (
          <span
            className="absolute bottom-20 right-5 hidden animate-hero-float rounded-2xl bg-white/10 px-3.5 py-2.5 text-white ring-1 ring-white/20 backdrop-blur-md motion-reduce:animate-none sm:block"
            style={{ animationDelay: '-2s' }}
          >
            <MarketDiscs codes={markets} />
            <span className="mt-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/80">
              Ships to {markets.length} markets
            </span>
          </span>
        )}
      </div>

      {/* ── Who they are ──────────────────────────────────────────── */}
      <div className="flex flex-col p-5 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {s.category && <span className="rounded-full bg-primary-50 px-3 py-1 text-[12px] font-semibold text-primary-700">{s.category}</span>}
          <span className="inline-flex items-center gap-1 text-[13px] text-ink-500">
            <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {s.location}
          </span>
        </div>

        <h2 id="featured-supplier-name" className="mt-3 text-balance text-[28px] font-extrabold leading-[1.05] tracking-tight text-ink-900 sm:text-[40px]">
          {person ? person.name : s.name}
        </h2>
        {person && (
          <p className="mt-1.5 text-[14.5px] text-ink-600">
            {person.role} · <span className="font-semibold text-primary-700">{s.name}</span>
          </p>
        )}
        <p className="mt-3 max-w-xl text-pretty text-[14.5px] sm:mt-4 sm:text-[15px] leading-relaxed text-ink-600">{s.tagline}</p>

        {s.specialities.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {s.specialities.map((t) => (
              <li key={t} className="rounded-full bg-ink-50 px-3 py-1 text-[12.5px] font-medium text-ink-700 ring-1 ring-ink-200/70">
                {t}
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-5 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200/70 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-2.5 sm:divide-y-0 sm:rounded-none sm:ring-0">
          {tiles.map((d) => {
            const Icon = DETAIL_ICONS[d.label] ?? TagIcon;
            return (
              <div key={d.label} className="flex items-start gap-3 px-3.5 py-2.5 sm:rounded-2xl sm:bg-ink-50/80 sm:p-3.5 sm:ring-1 sm:ring-ink-200/60">
                <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 shadow-sm ring-1 ring-ink-200/70 sm:flex">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:block">
                  <dt className="shrink-0 text-[12.5px] text-ink-500 sm:text-[10.5px] sm:font-semibold sm:uppercase sm:tracking-[0.12em]">{d.label}</dt>
                  {/* Website is plain text on purpose — sample domains must never be live links. */}
                  <dd className="min-w-0 break-words text-right text-[13px] font-semibold leading-snug text-ink-900 sm:mt-0.5 sm:text-left sm:text-[14px]">{d.value}</dd>
                </span>
              </div>
            );
          })}
        </dl>

        {markets.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 sm:hidden">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Ships to</span>
            <MarketDiscs codes={markets} tone="light" />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-100 pt-4 text-[12px] sm:mt-6 sm:gap-x-5 sm:text-[12.5px] text-ink-600 lg:mt-auto">
          {s.verified && s.verifiedSince && (
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheckIcon className="h-4 w-4 text-success-700" aria-hidden="true" />
              Verified since {formatMonth(s.verifiedSince)}
            </span>
          )}
          {s.memberSince && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Member since {s.memberSince}
            </span>
          )}
          {s.established && <span>Est. {s.established}</span>}
        </div>
        {footer}
      </div>
    </article>
  );
}
