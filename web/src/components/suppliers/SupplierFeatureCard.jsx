import { countryName } from '../../lib/countries.js';
import { formatMonth } from '../../lib/format.js';
import {
  BadgeCheckIcon,
  BoxIcon,
  BuildingIcon,
  CalendarIcon,
  ChartIcon,
  ChatIcon,
  MapPinIcon,
  TagIcon,
} from '../ui/icons.jsx';
import { SupplierLogo } from './SupplierLogo.jsx';
import { initialsOf } from './supplierModel.js';

/**
 * The featured supplier profile card on `/suppliers`. Two halves:
 *
 *   left  — a light stage: the person stands in a soft red glow inside two
 *           rings, with white chips around them (verified, the headline stat,
 *           the markets they ship to) and the company mark, unboxed;
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
      {/* 🔴 LIGHT stage (owner, 2026-09-28). The sample portraits are cut-outs
          with a pale fringe along the edge; on the old dark red stage that
          fringe drew a visible outline round every person. A near-white ground
          swallows it. */}
      <div className="relative isolate h-[260px] overflow-hidden bg-gradient-to-b from-white to-primary-50 sm:h-[420px] lg:h-auto lg:min-h-[450px]">
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_92%,theme(colors.primary.100),transparent_60%)]" />
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(0_5_23/0.07)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_72%)]"
        />
        <span aria-hidden="true" className="absolute left-[74%] top-[62%] -z-10 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-200/60 sm:left-1/2 sm:top-[58%] sm:h-[380px] sm:w-[380px]" />
        <span aria-hidden="true" className="absolute left-[74%] top-[62%] -z-10 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-200 bg-white/60 sm:left-1/2 sm:top-[58%] sm:h-[250px] sm:w-[250px]" />

        {/* PHONES are a profile banner (owner, 2026-09-28: "still not good for
            phone, make a better thing"): who they are on the left, the person
            on the right — nothing floats over them. Tablet and up keep the
            centred stage with chips around the person. */}
        <div key={s.key} className="absolute bottom-0 right-0 flex h-[92%] w-[48%] animate-fade-in justify-center motion-reduce:animate-none sm:inset-x-0 sm:h-[88%] sm:w-auto lg:h-[82%]">
          {person?.photo && (
            <img
              src={person.photo}
              alt={`${person.name}, ${person.role} at ${s.name}`}
              className="h-full max-h-[390px] w-auto object-contain object-bottom drop-shadow-[0_16px_24px_rgb(0_5_23/0.16)]"
            />
          )}
        </div>

        <div aria-hidden="true" className="absolute inset-y-0 left-0 flex w-[56%] flex-col py-4 pl-4 sm:hidden">
          {s.verified && (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200/70">
              <BadgeCheckIcon className="h-3.5 w-3.5 text-success-700" />
              Verified
            </span>
          )}
          <span className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-700">{s.category}</span>
          <span className="mt-1 text-[22px] font-extrabold leading-[1.05] tracking-tight text-ink-900">{person ? person.name : s.name}</span>
          {person && <span className="mt-1 text-[12px] leading-snug text-ink-600">{person.role}</span>}
          <span className="text-[12.5px] font-semibold leading-snug text-primary-700">{s.name}</span>
          <span className="mt-auto flex items-end gap-2">
            <span className="font-serif text-[28px] italic leading-none text-primary-700">{s.highlight.value}</span>
            <span className="pb-0.5 text-[9.5px] font-semibold uppercase leading-tight tracking-[0.1em] text-ink-600">{s.highlight.label}</span>
          </span>
        </div>

        {/* The company mark, quietly — no plate, no shadow (owner: "don't
            highlight the logo"). The company name is in the text beside. */}
        {/* Tablet and up only: on a phone its corner goes to the headline stat,
            which would otherwise sit on the centred person. */}
        <span className="absolute left-5 top-5 hidden sm:block">
          {s.brand ? (
            <span className="block opacity-90">
              <SupplierLogo name={s.name} brand={s.brand} />
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-xs font-extrabold text-primary-700">
              {initialsOf(s.name)}
            </span>
          )}
        </span>

        {s.verified && (
          <span className="absolute right-5 top-5 hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200/70 sm:inline-flex">
            <BadgeCheckIcon className="h-4 w-4 text-success-700" aria-hidden="true" />
            Verified
          </span>
        )}

        <span className="absolute bottom-8 left-5 hidden animate-hero-float-sm rounded-2xl bg-white/85 px-4 py-3 text-ink-900 shadow-card ring-1 ring-ink-200/70 backdrop-blur-md motion-reduce:animate-none sm:block">
          <span className="block font-serif text-[40px] italic leading-none text-primary-700">{s.highlight.value}</span>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-600">{s.highlight.label}</span>
        </span>

        {markets.length > 0 && (
          <span
            className="absolute bottom-20 right-5 hidden animate-hero-float rounded-2xl bg-white/85 px-3.5 py-2.5 text-ink-900 shadow-card ring-1 ring-ink-200/70 backdrop-blur-md motion-reduce:animate-none sm:block"
            style={{ animationDelay: '-2s' }}
          >
            <MarketDiscs codes={markets} tone="light" />
            <span className="mt-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-600">
              Ships to {markets.length} markets
            </span>
          </span>
        )}
      </div>

      {/* ── Who they are ──────────────────────────────────────────── */}
      <div className="flex flex-col p-5 sm:p-8 lg:p-10">
        {/* On phones the banner above shows these visually; kept here (sr-only)
            so the card still has its one real heading. */}
        <div className="sr-only sm:not-sr-only">
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
        </div>
        <p className="inline-flex items-center gap-1 text-[12.5px] text-ink-500 sm:hidden">
          <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {s.location}
        </p>
        <p className="mt-2 max-w-xl text-pretty text-[14.5px] leading-relaxed text-ink-600 sm:mt-4 sm:text-[15px]">{s.tagline}</p>

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
          {tiles.map((d, i) => {
            const Icon = DETAIL_ICONS[d.label] ?? TagIcon;
            /* An ODD number of tiles leaves the last one alone on its row, hard
               against the left edge — which is what "Languages spoken" looked
               like once the website tile was dropped. It spans both columns and
               centres itself instead; `justify-self-center` also stops it
               stretching to the full span, so it keeps a tile's proportions
               rather than becoming a wide bar. */
            const lonely = tiles.length % 2 === 1 && i === tiles.length - 1;
            return (
              <div
                key={d.label}
                className={`flex items-start gap-3 px-3.5 py-2.5 sm:rounded-2xl sm:bg-ink-50/80 sm:p-3.5 sm:ring-1 sm:ring-ink-200/60 ${
                  lonely ? 'sm:col-span-2 sm:justify-self-center' : ''
                }`}
              >
                <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 shadow-sm ring-1 ring-ink-200/70 sm:flex">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:block">
                  <dt className="shrink-0 text-[12.5px] text-ink-500 sm:text-[10.5px] sm:font-semibold sm:uppercase sm:tracking-[0.12em]">{d.label}</dt>
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
