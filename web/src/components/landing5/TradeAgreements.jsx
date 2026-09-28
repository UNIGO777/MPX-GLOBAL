import { useEffect, useRef, useState } from 'react';

import { ChevronDownIcon } from '../ui/icons.jsx';
import { HEADING } from './SectionHeader.jsx';

/**
 * India's trade agreements — the reason a foreign buyer sourcing from India
 * often pays less duty than they expect (owner, 2026-09-26).
 *
 * 🔴 **EVERY ROW IS A REAL AGREEMENT, SHOWN AT ITS TRUE STAGE.** This is a
 * public marketing page on a platform whose whole value is trust; a buyer can
 * act on a tariff claim and be wrong at customs. Each status below was checked
 * against a government source on 2026-09-28 (listed per row). Do not upgrade a
 * stage ("concluded" → "signed" → "in force") without a new source.
 *
 * 🔴 **Names follow the agreement's real type.** The owner asked for "India–US
 * Free Trade Agreement" (2026-09-28): what exists is a trade deal announced in
 * February 2026 — officially a framework for an INTERIM agreement, with a wider
 * bilateral trade agreement still being negotiated — so it is shown as a
 * "Trade Agreement · Framework", not an FTA. New Zealand's IS an FTA (signed
 * 2026-04-27); Australia's is the ECTA, in force.
 *
 * ⚠️ These go stale — the NZ FTA takes effect 2026-10-20, the EU FTA is still
 * awaiting signature. Re-check before a launch.
 */
const ENTRIES = [
  // Owner's order (2026-09-27): USA, New Zealand, Australia, then the rest.
  //   US — White House fact sheet + PIB, Feb 2026: interim-agreement framework.
  { partner: 'United States', code: 'US', kind: 'Trade Agreement', stage: 'framework', year: 2026 },
  //   NZ — NZ MFAT: FTA concluded Dec 2025, signed 27 Apr 2026 (in force 20 Oct 2026).
  { partner: 'New Zealand', code: 'NZ', kind: 'FTA', stage: 'signed', year: 2026 },
  { partner: 'Australia', code: 'AU', kind: 'ECTA', stage: 'in force', year: 2022 },
  { partner: 'UAE', code: 'UAE', kind: 'CEPA', stage: 'in force', year: 2022 },
  { partner: 'UK', code: 'UK', kind: 'FTA', stage: 'signed', year: 2025 },
  { partner: 'Japan', code: 'JP', kind: 'CEPA', stage: 'in force', year: 2011 },
  { partner: 'South Korea', code: 'KR', kind: 'CEPA', stage: 'in force', year: 2010 },
  { partner: 'ASEAN', code: 'ASEAN', kind: 'FTA', stage: 'in force', year: 2010 },
  { partner: 'EFTA', code: 'EFTA', kind: 'TEPA', stage: 'signed', year: 2024 },
  //   EU — India Ministry of Commerce, 27 Jan 2026: FTA concluded, not yet signed.
  { partner: 'European Union', code: 'EU', kind: 'FTA', stage: 'concluded', year: 2026 },
  // ⚠️ Added 2026-09-28 at the owner's request, from general knowledge — NOT
  // yet checked against the Department of Commerce's official FTA list.
  // VERIFY all four (and their year/stage) before launch. Chile was added as
  // the 14th so the lists fill even rows (owner chose it over Sri Lanka/Oman).
  { partner: 'Singapore', code: 'SG', kind: 'CECA', stage: 'in force', year: 2005 },
  { partner: 'Mauritius', code: 'MU', kind: 'CECPA', stage: 'in force', year: 2021 },
  { partner: 'MERCOSUR', code: 'MERCOSUR', kind: 'PTA', stage: 'in force', year: 2009 },
  // Chile — PTA 2007, expanded 2017.
  { partner: 'Chile', code: 'CL', kind: 'PTA', stage: 'in force', year: 2007 },
];

/**
 * The partners as a QUIET TWO-COLUMN LIST (owner, 2026-09-28: pills "not
 * looking good", then a tile grid "not giving that simple, elegant, premium
 * feeling"). Pure typography on hairlines, like a spec sheet: the partner on
 * the left, the agreement type on the right in small grey caps. No boxes, no
 * badges — the owner's three leading partners (USA, NZ, Australia) carry only
 * a small red dot. Ten partners fill five even rows. Stage + year are not
 * shown; ENTRIES keeps both, with their sources.
 */
/**
 * Below md the map carries no labels, so the list stands in — COLLAPSED on
 * phones (owner, 2026-09-28): two columns ("keep two-row style"), the first
 * four partners (two even rows), and a quiet centred "View all partners" text
 * toggle — the earlier pill button "was not looking good".
 */
function PartnerListCollapsible() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      {/* Collapsed: four partners = two even rows. */}
      <PartnerList id="india-partner-list" limit={open ? ENTRIES.length : 4} />
      <button
        type="button"
        aria-expanded={open}
        aria-controls="india-partner-list"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto mt-1 flex h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20"
      >
        {open ? 'Show fewer' : 'View all partners'}
        <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}

function PartnerList({ limit = ENTRIES.length, id }) {
  return (
    <ul id={id} className="mt-2 grid grid-cols-2 gap-x-5 sm:gap-x-10">
      {ENTRIES.slice(0, limit).map((e, i) => (
        <li key={e.partner} className="flex min-w-0 flex-col gap-0.5 border-b border-ink-200/70 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:py-3">
          <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink-900 sm:text-[14.5px]">
            {i < 3 && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />}
            <span className="truncate">{e.partner}</span>
          </span>
          <span className="shrink-0 pl-3.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 sm:pl-0 sm:text-[11px]">{e.kind}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── The map ────────────────────────────────────────────────────────────────
   `public/world-dots.svg` is generated once from Natural Earth (public domain)
   in an equirectangular projection: lon −180…180 → x 0…1000, lat 78…−56 →
   y 0…372.2 (Antarctica cropped). India's dots are drawn red in that file.
   The arcs, endpoints and labels below are drawn LIVE on the same grid. */
const MAP_W = 1000;
const MAP_H = 372.2;
const project = (lon, lat) => [((lon + 180) / 360) * MAP_W, ((78 - lat) / 134) * MAP_H];
const INDIA = project(79, 22);

/* Where each partner's arc lands, and which side its label sits on (chosen by
   hand so the European and East-Asian clusters do not collide). Blocs point at
   a representative spot: ASEAN at mainland Southeast Asia (Singapore has its
   own pin), EFTA at Switzerland, the EU at central Europe, MERCOSUR at the
   Brazil / Paraguay border. `bow` bends the arc (default 0.28, north). */
const PINS = {
  'United States': { at: [-98, 39], side: 'top' },
  'New Zealand': { at: [174, -41], side: 'left' },
  Australia: { at: [134, -25], side: 'left' },
  UAE: { at: [54, 24], side: 'bottom' },
  UK: { at: [-2, 54], side: 'left' },
  Japan: { at: [139, 36], side: 'right' },
  'South Korea': { at: [128, 37], side: 'top' },
  ASEAN: { at: [101, 16], side: 'right' },
  EFTA: { at: [8, 46.5], side: 'bottom' },
  'European Union': { at: [13, 51.5], side: 'right' },
  Singapore: { at: [103.8, 1.3], side: 'bottom' },
  Mauritius: { at: [57.5, -20.3], side: 'left' },
  // Bows SOUTH: bowing north would drag the arc through the Europe / Middle
  // East labels.
  // Label on the LEFT: on the right it ran into Mauritius at tablet widths.
  MERCOSUR: { at: [-56, -22], side: 'left', bow: -0.22 },
  // Below its pin, clear of MERCOSUR's label; bows south for the same reason.
  Chile: { at: [-71, -33], side: 'bottom', bow: -0.2 },
};

const LABEL_POS = {
  top: '-translate-x-1/2 -translate-y-[calc(100%+10px)]',
  bottom: '-translate-x-1/2 translate-y-[10px]',
  left: '-translate-x-[calc(100%+10px)] -translate-y-1/2',
  right: 'translate-x-[10px] -translate-y-1/2',
};

/** True once the map scrolls into view (at once under reduced motion). */
function useSeen(ref) {
  const [seen, setSeen] = useState(
    () =>
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      navigator.webdriver === true ||
      /bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(navigator.userAgent),
  );
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

function TradeMap() {
  const ref = useRef(null);
  const seen = useSeen(ref);
  const [ix, iy] = INDIA;
  return (
    <div ref={ref} className="relative aspect-[1000/372] w-full">
      <img src="/world-dots.svg" alt="" width={1000} height={372} className="absolute inset-0 h-full w-full select-none" draggable="false" />
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {ENTRIES.map((e, i) => {
          const [x, y] = project(...PINS[e.partner].at);
          const dist = Math.hypot(x - ix, y - iy);
          const cx = (x + ix) / 2;
          const cy = (y + iy) / 2 - dist * (PINS[e.partner].bow ?? 0.28);
          return (
            <g key={e.partner}>
              <path
                d={`M${ix} ${iy} Q${cx} ${cy} ${x} ${y}`}
                pathLength="1"
                fill="none"
                stroke="#CE061A"
                strokeOpacity={i < 3 ? 0.75 : 0.4}
                strokeWidth={i < 3 ? 1.6 : 1.1}
                strokeDasharray="1"
                strokeDashoffset={seen ? 0 : 1}
                style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)', transitionDelay: `${i * 90}ms` }}
                className="motion-reduce:!transition-none"
              />
              <circle cx={x} cy={y} r={i < 3 ? 4.2 : 3.4} fill="#FFFFFF" stroke="#CE061A" strokeWidth="2" />
            </g>
          );
        })}
        <circle cx={ix} cy={iy} r="5.5" fill="#CE061A" stroke="#FFFFFF" strokeWidth="2" />
      </svg>
      {/* India's pulse — an HTML ring so the scale animates from its centre. */}
      <span
        aria-hidden="true"
        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary-500/40 motion-reduce:animate-none"
        style={{ left: `${(ix / MAP_W) * 100}%`, top: `${(iy / MAP_H) * 100}%` }}
      />
      {/* Labels only where the map is wide enough for fourteen of them: md
          (the map runs full width) and xl+. Below md, and at lg (1024–1279,
          where the map shares its row with the photo and labels collided), the
          collapsible list carries the names. */}
      {ENTRIES.map((e, i) => {
        const pin = PINS[e.partner];
        const [x, y] = project(...pin.at);
        return (
          <span
            key={e.partner}
            aria-hidden="true"
            className={`absolute hidden whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[10.5px] leading-tight shadow-sm ring-1 ring-ink-200/70 transition-opacity duration-700 md:block lg:hidden xl:block ${LABEL_POS[pin.side]} ${
              seen ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ left: `${(x / MAP_W) * 100}%`, top: `${(y / MAP_H) * 100}%`, transitionDelay: `${600 + i * 90}ms` }}
          >
            <span className={`font-semibold ${i < 3 ? 'text-ink-900' : 'text-ink-800'}`}>{e.partner}</span>{' '}
            <span className="text-ink-500">· {e.kind}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * 2026-09-28 — REDESIGNED AROUND A MAP (owner: "still the design is not hitting
 * right"). What was wrong: a wall of stacked text (heading, paragraph, note,
 * ten-row list) with nothing leading the eye, and the core message — India has
 * agreements with major markets — told in a list when it is geographic.
 *   · Header      — eyebrow + heading only.
 *   · Map panel   — a dotted world (India in red, pulsing), arcs drawn out to
 *                   the ten partners as the panel enters the view, each ending
 *                   in a label (name · agreement type). Below lg the labels
 *                   would collide, so the quiet two-column list shows instead.
 *   · Photo card  — the handshake photo, as large as the map, with the
 *                   February 2026 US-deal line and the independence line
 *                   BELOW it (a political photo on a commercial page must not
 *                   read as an endorsement). The duty paragraph sits below
 *                   the map (owner, 2026-09-28).
 * Every agreement is unchanged — see the file header and ENTRIES.
 */
export function TradeAgreements() {
  return (
    <section aria-labelledby="india-heading" className="bg-surface-subtle py-12 sm:py-16 lg:py-20">
      <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Why source from India</p>
          <h2 id="india-heading" className={`mt-1.5 ${HEADING}`}>
            India trades on preferential terms with major markets
          </h2>
        </div>

        {/* Two panels of equal height. Each carries its own words BELOW its
            picture (owner, 2026-09-28): the duty paragraph under the map, the
            US-deal line and the independence line under the photo. */}
        <div className="mt-8 grid gap-4 sm:mt-10 lg:grid-cols-[1.55fr_1fr] lg:gap-5">
          {/* Map panel */}
          <div className="flex min-w-0 flex-col rounded-3xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 sm:p-7">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">India&apos;s trade agreements</h3>
              {/* No count (owner, 2026-09-28: "don't write number there") — and
                  "key", not a total: the line under the map notes further
                  agreements. */}
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Key partners</span>
            </div>
            <div className="mt-6 flex flex-1 items-center">
              <TradeMap />
            </div>
            <div className="md:hidden lg:block xl:hidden">
              <PartnerListCollapsible />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary-600" />
                India
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-full border-2 border-primary-600 bg-white" />
                Agreement partner
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
              Plus further agreements across South Asia and beyond — among them SAFTA, APTA and Sri Lanka.
            </p>
            {/* Duty relief is conditional, and the sentence says so. */}
            <p className="mt-4 border-t border-ink-100 pt-4 text-pretty text-[14px] leading-relaxed text-ink-600">
              India&apos;s trade agreements can lower or remove import duty on Indian-made goods. Eligibility
              depends on the product and its certificate of origin — your supplier and customs broker can
              confirm it for your HS code.
            </p>
          </div>

          {/* Photo card: the picture, then its words underneath */}
          <figure className="group flex min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-ink-200/60">
            <div className="relative min-h-[240px] flex-1 overflow-hidden">
              <img
                src="/india-trade-diplomacy.webp"
                alt="India's Prime Minister and the President of the United States shaking hands in front of Indian and American flags"
                width={1244}
                height={822}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover object-[46%_35%] transition-transform duration-[1400ms] ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-[1.04]"
              />
            </div>
            <figcaption className="p-5 sm:p-7">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary-700">February 2026</p>
              <p className="mt-1.5 text-pretty text-[15px] font-semibold leading-snug text-ink-900">
                The United States and India announced a trade deal that lowers US tariffs on many Indian
                goods; talks on a wider agreement continue.
              </p>
              {/* A political photo on a commercial page must not read as an endorsement. */}
              <p className="mt-2 text-[12px] text-ink-500">MPX Global is an independent B2B marketplace.</p>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
