import { useEffect, useRef, useState } from 'react';

import { ChevronDownIcon } from '../ui/icons.jsx';
import { HEADING } from './SectionHeader.jsx';
import { TRADE_MAP_DOTS } from './tradeMapDots.js';

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
   2026-09-29 — the owner's india-trade-map.html, ported as-is: a dot grid in a
   Miller-style projection drawn on a canvas, India red with a shimmer sweep,
   Nepal and Bhutan pink, arcs to every partner with a travelling pulse, and a
   "Zoom to South Asia" toggle. Partner names and types still come from ENTRIES
   (the sourced list above) — PINS only says where each one sits on the map. */
const LON0 = -170;
const LON1 = 180;
const mil = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + (0.4 * lat * Math.PI) / 180)) * (180 / Math.PI);
const Y0 = mil(-57);
const Y1 = mil(80);
const RATIO = (Y1 - Y0) / (LON1 - LON0);
const HOME = { cx: (LON0 + LON1) / 2, cy: (Y0 + Y1) / 2, z: 1 };
const SOUTH_ASIA = { cx: 88, cy: mil(24), z: 3.1 };
const INDIA = [78.5, 22.5];

const COLOR = { dot: '#C9CCD8', india: '#CE061A', neighbour: '#E9A9B1', card: '#FFFFFF' };

/* [lon, lat], label side (l/r/t/b) and a pixel nudge — hand-placed in the HTML
   so the European and East-Asian clusters do not collide. */
const PINS = {
  'United States': { at: [-98, 38.5], side: 'l' },
  UK: { at: [-2, 54], side: 'l' },
  'European Union': { at: [7, 49.5], side: 'r', dy: -4 },
  EFTA: { at: [8.2, 46.9], side: 'l', dy: 8 },
  UAE: { at: [54.3, 24.2], side: 'l', dy: 4 },
  'South Korea': { at: [127.8, 36.5], side: 't', dx: -10, dy: -6 },
  Japan: { at: [138, 36.2], side: 'r', dy: 10 },
  ASEAN: { at: [103, 17], side: 'r' },
  Singapore: { at: [103.8, 1.4], side: 'b' },
  Australia: { at: [134, -25], side: 'l' },
  'New Zealand': { at: [172.5, -41], side: 'l' },
  Mauritius: { at: [57.5, -20.3], side: 'l' },
  Chile: { at: [-71, -33.5], side: 'b' },
  MERCOSUR: { at: [-58, -15.5], side: 'l' },
};
const NEIGHBOURS = [
  { name: 'Nepal', at: [84.1, 28.6] },
  { name: 'Bhutan', at: [90.4, 27.5] },
];
const SIDE_SHIFT = {
  l: ['calc(-100% - 10px)', '-50%'],
  r: ['10px', '-50%'],
  t: ['-50%', 'calc(-100% - 8px)'],
  b: ['-50%', '8px'],
};

function arcPoint(a, b, c, t) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function arcControl(a, b, width) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const lift = Math.min(len * 0.28, 170 * (width / 1068));
  let nx = -dy / len;
  let ny = dx / len;
  // Always bow upward on screen.
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return [(a[0] + b[0]) / 2 + nx * lift, (a[1] + b[1]) / 2 + ny * lift];
}

function TradeMap({ zoomed }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const labelRefs = useRef([]);
  const neighbourRefs = useRef([]);
  const hoverRef = useRef(-1);
  const targetRef = useRef(HOME);

  useEffect(() => {
    targetRef.current = zoomed ? SOUTH_ASIA : HOME;
  }, [zoomed]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const view = { ...HOME };
    const start = performance.now();
    let W = 0;
    let H = 0;
    let frame = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = stage.clientWidth;
      H = Math.round(W * RATIO);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const scale = () => (W / (LON1 - LON0)) * view.z;
    const proj = (lon, lat) => {
      const s = scale();
      return [W / 2 + (lon - view.cx) * s, H / 2 - (mil(lat) - view.cy) * s];
    };

    const placeLabels = () => {
      ENTRIES.forEach((e, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        const pin = PINS[e.partner];
        const [x, y] = proj(...pin.at);
        const [tx, ty] = SIDE_SHIFT[pin.side];
        el.style.left = `${x + (pin.dx ?? 0)}px`;
        el.style.top = `${y + (pin.dy ?? 0)}px`;
        el.style.transform = `translate(${tx}, ${ty})`;
        el.style.visibility = x > -40 && x < W + 40 && y > -20 && y < H + 20 ? 'visible' : 'hidden';
      });
      NEIGHBOURS.forEach((n, i) => {
        const el = neighbourRefs.current[i];
        if (!el) return;
        const [x, y] = proj(...n.at);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.visibility = view.z > 1.6 ? 'visible' : 'hidden';
      });
    };

    const dots = (list, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const [lon, lat] of list) {
        const [x, y] = proj(lon, lat);
        if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    const draw = (now) => {
      const T = (now - start) / 1000;
      const target = targetRef.current;
      const k = reduce ? 1 : 0.09;
      view.cx += (target.cx - view.cx) * k;
      view.cy += (target.cy - view.cy) * k;
      view.z += (target.z - view.z) * k;
      ctx.clearRect(0, 0, W, H);
      const s = scale();
      const hover = hoverRef.current;

      dots(TRADE_MAP_DOTS.w, COLOR.dot, Math.max(1.1, 1.9 * s * 0.3));
      dots(TRADE_MAP_DOTS.n, COLOR.neighbour, Math.max(0.8, 0.4 * s * 0.36));

      // India, with a soft shimmer sweeping across it.
      const rI = Math.max(0.8, 0.4 * s * 0.4);
      const sweep = reduce ? -1 : ((T * 0.18) % 1.6) - 0.3;
      ctx.fillStyle = COLOR.india;
      for (const [lon, lat] of TRADE_MAP_DOTS.i) {
        const [x, y] = proj(lon, lat);
        const f = (lon - 68) / 30 + ((lat - 6) / 60) * 0.4;
        const glow = Math.max(0, 1 - Math.abs(f - sweep) * 7);
        ctx.beginPath();
        ctx.arc(x, y, rI * (1 + glow * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }

      const o = proj(...INDIA);
      ENTRIES.forEach((e, i) => {
        const b = proj(...PINS[e.partner].at);
        const c = arcControl(o, b, W);
        const on = hover === i;
        const dim = hover >= 0 && !on;
        ctx.strokeStyle = COLOR.india;
        ctx.lineWidth = on ? 2 : 1.1;
        ctx.globalAlpha = dim ? 0.15 : on ? 0.95 : 0.55;
        ctx.beginPath();
        ctx.moveTo(o[0], o[1]);
        ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
        ctx.stroke();
        if (!reduce) {
          const phase = (T * 0.16 + i * 0.137) % 1;
          ctx.fillStyle = COLOR.india;
          for (let g = 0; g < 14; g += 1) {
            const t = phase - g * 0.011;
            if (t < 0 || t > 1) continue;
            const [x, y] = arcPoint(o, b, c, t);
            ctx.globalAlpha = (dim ? 0.15 : 1) * (1 - g / 14) * 0.95;
            ctx.beginPath();
            ctx.arc(x, y, (on ? 3 : 2.4) * (1 - g / 22), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.fillStyle = COLOR.card;
        ctx.strokeStyle = COLOR.india;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b[0], b[1], on ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (!reduce) {
          const rp = (T * 0.6 + i * 0.21) % 1;
          ctx.globalAlpha = (1 - rp) * 0.5 * (dim ? 0.3 : 1);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(b[0], b[1], 4 + rp * 10, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;

      if (!reduce) {
        ctx.strokeStyle = COLOR.india;
        ctx.lineWidth = 1.5;
        for (let r = 0; r < 2; r += 1) {
          const rp = (T * 0.5 + r * 0.5) % 1;
          ctx.globalAlpha = (1 - rp) * 0.45;
          ctx.beginPath();
          ctx.arc(o[0], o[1], 6 + rp * 22 * Math.min(view.z, 2), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = COLOR.india;
      ctx.beginPath();
      ctx.arc(o[0], o[1], 4.5, 0, Math.PI * 2);
      ctx.fill();

      placeLabels();
      frame = visible ? requestAnimationFrame(draw) : 0;
    };

    resize();
    frame = requestAnimationFrame(draw);

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    // Stop the loop while the map is off screen.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(draw);
    });
    io.observe(stage);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const setHover = (i) => {
    hoverRef.current = i;
  };

  return (
    <div ref={stageRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Dot map of the world with lines from India to its trade agreement partners"
        className="block w-full"
      />
      {/* Labels only where the map is wide enough for fourteen of them: md
          (the map runs full width) and xl+. Below md, and at lg (1024–1279,
          where the map shares its row with the photo), the collapsible list
          carries the names. */}
      {ENTRIES.map((e, i) => (
        <span
          key={e.partner}
          ref={(el) => {
            labelRefs.current[i] = el;
          }}
          aria-hidden="true"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(-1)}
          className="absolute hidden cursor-default whitespace-nowrap rounded-lg bg-white px-2 py-0.5 text-[12px] leading-normal text-ink-500 ring-1 ring-ink-200 transition-shadow hover:ring-2 hover:ring-primary-600/60 md:block lg:hidden xl:block"
        >
          <b className="font-semibold text-ink-900">{e.partner}</b> · {e.kind}
        </span>
      ))}
      {NEIGHBOURS.map((n, i) => (
        <span
          key={n.name}
          ref={(el) => {
            neighbourRefs.current[i] = el;
          }}
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap px-1.5 text-[11px] text-ink-500"
        >
          {n.name}
        </span>
      ))}
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
  const [zoomed, setZoomed] = useState(false);
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
              <TradeMap zoomed={zoomed} />
            </div>
            <div className="md:hidden lg:block xl:hidden">
              <PartnerListCollapsible />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                aria-pressed={zoomed}
                onClick={() => setZoomed((v) => !v)}
                className="inline-flex h-11 items-center rounded-full bg-white px-4 text-[13px] font-medium text-ink-900 ring-1 ring-ink-200 transition hover:ring-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20 sm:h-9"
              >
                {zoomed ? 'Show world' : 'Zoom to South Asia'}
              </button>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-500 sm:ml-auto">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary-600" />
                  India
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full border-2 border-primary-600 bg-white" />
                  Agreement partner
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#E9A9B1]" />
                  Nepal &amp; Bhutan
                </span>
              </div>
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
