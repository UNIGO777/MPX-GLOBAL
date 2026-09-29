import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { ArrowRightIcon, BadgeCheckIcon, ChatIcon, SparkleIcon } from '../ui/icons.jsx';
import { INDIA_LONLAT, WORLD_LONLAT } from './worldDots.js';

/**
 * The dark band under the hero: a real globe rising out of the bottom of the
 * page, with the horizon lit in the brand red (owner's mockup, 2026-09-29 —
 * "need to make it like real globe").
 *
 * 🔴 **It is an actual sphere, not a picture of one.** Every point is a real
 * lon/lat from `worldDots.js` (Natural Earth, the same data the trade map
 * uses), rotated in 3D and projected orthographically each frame, so the
 * continents foreshorten toward the limb and disappear round the back the way
 * they do on a globe. That is the whole reason it reads as one; a flat dotted
 * map with a curved mask does not.
 *
 * 🔴 **Canvas, not SVG.** ~3,700 points re-projected per frame is nothing for
 * `fillRect` and far too much for 3,700 live DOM nodes.
 *
 * 🔴 **The copy here claims only what the platform does.** The mockup's band
 * advertised "smart-cleared escrow protocol", "$4.2B Cleared — SMART ESCROW
 * LIVE" and "escrow contracts live across 140+ jurisdictions". Escrow is
 * Bucket B / Phase 2 and the owner ruled on exactly that claim on 2026-09-29
 * ("okk then dont claim it now"), so none of it is here. What is here —
 * verified companies, direct enquiry and chat, AI match-making — is built.
 */

/* Geometry. The sphere is much wider than the band and its centre sits below
   it, so what you see is the top of a big globe and its lit horizon — the
   mockup's framing. All of it is expressed against the canvas size so it holds
   from a phone to a wide desktop. */
// Sphere radius as a fraction of the band's width. 🔴 It is deliberately WIDER
// than the band: at 0.78 the whole cap fitted on screen and the globe read as
// a dome sitting on the page. Past 1.0 the limb runs off both sides and what
// is left is a planet's horizon, which is the thing the mockup draws.
const RADIUS_OF_WIDTH = 1.35;
const HORIZON_INSET = 0.015; // how far the limb sits below the band's top edge
const TILT_DEG = 26; // lean the pole away, so mid-latitudes face the viewer
const SPIN_DEG_PER_SEC = 2.4; // a full turn every 2.5 minutes — barely a drift

/**
 * The corridors drawn on the globe. Each is a real great circle from India —
 * where the suppliers are — to a market this marketplace actually serves. They
 * are decoration, so they carry NO figure: the mockup labelled its arcs with
 * "$4.2B Cleared" and "+14% SLA", which are numbers nobody here can stand
 * behind.
 */
const ROUTES = [
  [[79, 22], [55, 25]], // UAE
  [[79, 22], [10, 51]], // EU
  [[79, 22], [-96, 38]], // USA
  [[79, 22], [139, 36]], // Japan
  [[79, 22], [134, -25]], // Australia
  [[79, 22], [-2, 54]], // UK
];

/**
 * The cards that float over the globe, and the strip along the bottom.
 *
 * 🔴 Every line is something the platform DOES. The mockup put "Verified Tier-1
 * OEM Hub · ISO 9001:2015 PROTOCOL", "$4.2B Cleared · SMART ESCROW LIVE" and
 * "+14% SLA · Transit Optimization" in these slots, plus a ticker claiming
 * escrow contracts live in 140+ jurisdictions. We hold no ISO register, move no
 * money and measure no SLA, so those are the shapes, not the words.
 */
const CARDS = [
  {
    icon: BadgeCheckIcon,
    title: 'Verified Suppliers',
    note: 'Business details checked.',
    place: 'left-4 top-36 sm:left-8 lg:left-16 lg:top-44',
  },
  {
    icon: ChatIcon,
    title: 'Direct Enquiries',
    note: 'Connect directly with suppliers.',
    place: 'right-4 top-36 sm:right-8 lg:right-16 lg:top-44',
  },
];

const TICKER = [
  "Every verified company's documents were checked by a person on our team",
  'Describe what you need and our AI matches you with exporters who can supply it',
  'Enquire and chat with suppliers directly — no brokers in between',
  'Public supplier profiles, with the verified tick earned by review',
];

/** Pulsing destinations. Real places this marketplace actually points at. */
const MARKERS = [
  { lon: 79, lat: 22, india: true }, // India — where the suppliers are
  { lon: 55, lat: 25 }, // UAE
  { lon: 10, lat: 51 }, // EU
  { lon: -96, lat: 38 }, // USA
  { lon: 139, lat: 36 }, // Japan
  { lon: 134, lat: -25 }, // Australia
];

export function GlobeBand() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let startedAt = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (spinDeg) => {
      if (!width || !height) return;
      ctx.clearRect(0, 0, width, height);

      const R = width * RADIUS_OF_WIDTH;
      const cx = width / 2;
      const cy = height * HORIZON_INSET + R; // limb sits just inside the top
      const tilt = (TILT_DEG * Math.PI) / 180;
      const sinT = Math.sin(tilt);
      const cosT = Math.cos(tilt);
      const spin = (spinDeg * Math.PI) / 180;

      // A point on the unit sphere, already spun. Kept separate from the
      // projection so great circles can be interpolated in 3D — slerping the
      // SCREEN positions instead would bend the arc off the globe.
      const toVec = (lonDeg, latDeg) => {
        const lat = (latDeg * Math.PI) / 180;
        const lon = (lonDeg * Math.PI) / 180 + spin;
        const cosLat = Math.cos(lat);
        return [cosLat * Math.sin(lon), Math.sin(lat), cosLat * Math.cos(lon)];
      };

      // unit vector -> screen. Returns null when the point is round the back or
      // outside the band, so nothing is drawn that cannot be seen.
      const projectVec = (x, y, z) => {
        const y2 = y * cosT - z * sinT;
        const z2 = y * sinT + z * cosT;
        if (z2 <= 0) return null; // the far side of the globe
        const sx = cx + R * x;
        const sy = cy - R * y2;
        if (sy > height + 8 || sx < -8 || sx > width + 8) return null;
        return [sx, sy, z2];
      };

      const project = (lonDeg, latDeg) => {
        const v = toVec(lonDeg, latDeg);
        return projectVec(v[0], v[1], v[2]);
      };

      // 1 · the sphere itself, so the dots sit on a body rather than in space
      // Light theme (owner, 2026-09-29). The sphere is a pale body lit from the
      // top; the land reads as dark grain on it. Inverting only the background
      // would have left light dots on a light ball — the two have to flip together.
      const body = ctx.createRadialGradient(cx, cy - R * 0.72, R * 0.04, cx, cy, R);
      body.addColorStop(0, 'rgba(255,250,250,1)');
      body.addColorStop(0.45, 'rgba(247,220,222,1)');
      body.addColorStop(1, 'rgba(213,152,159,1)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();

      // 2 · graticule — the giveaway that this is a sphere and not a disc
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(138,3,17,0.17)';
      for (let lat = -60; lat <= 80; lat += 20) {
        ctx.beginPath();
        let moved = false;
        for (let lon = -180; lon <= 180; lon += 3) {
          const p = project(lon, lat);
          if (!p) {
            moved = false;
            continue;
          }
          if (moved) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
          moved = true;
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 20) {
        ctx.beginPath();
        let moved = false;
        for (let lat = -80; lat <= 88; lat += 3) {
          const p = project(lon, lat);
          if (!p) {
            moved = false;
            continue;
          }
          if (moved) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
          moved = true;
        }
        ctx.stroke();
      }

      // 3 · the land. Points fade and shrink toward the limb, which is what
      //     makes the curvature readable rather than merely implied.
      const dot = width < 640 ? 1.7 : 2.1;
      const paint = (data, colour) => {
        for (let i = 0; i < data.length; i += 2) {
          const p = project(data[i], data[i + 1]);
          if (!p) continue;
          const depth = p[2];
          if (depth < 0.02) continue;
          // 🔴 A steep depth fade is wrong HERE. The band shows the top of a
          // very large sphere, so almost everything on screen sits near the
          // limb where depth is small — fading by depth alone dimmed exactly
          // the land the visitor can actually see. The floor is what keeps the
          // continents legible; the slope still gives the curvature away.
          ctx.globalAlpha = Math.min(1, 0.72 + depth * 0.45);
          const s = dot * (0.78 + depth * 0.32);
          ctx.fillStyle = colour;
          ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
        }
      };
      paint(WORLD_LONLAT, '#CE061A');
      paint(INDIA_LONLAT, '#66020C');
      ctx.globalAlpha = 1;

      // 4 · corridors. A great circle is the real path between two points on a
      //     sphere, so the arcs are slerped between the endpoints rather than
      //     bent by eye — that is what makes them sit ON the globe.
      ctx.save();
      ctx.setLineDash([2, 6]);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = 'rgba(138,3,17,0.5)';
      for (const [from, to] of ROUTES) {
        const a0 = toVec(from[0], from[1]);
        const b0 = toVec(to[0], to[1]);
        const dotp = Math.min(1, Math.max(-1, a0[0] * b0[0] + a0[1] * b0[1] + a0[2] * b0[2]));
        const omega = Math.acos(dotp);
        if (omega < 1e-3) continue;
        const sinOmega = Math.sin(omega);
        ctx.beginPath();
        let moved = false;
        for (let t = 0; t <= 1.0001; t += 1 / 64) {
          const k0 = Math.sin((1 - t) * omega) / sinOmega;
          const k1 = Math.sin(t * omega) / sinOmega;
          const p = projectVec(
            a0[0] * k0 + b0[0] * k1,
            a0[1] * k0 + b0[1] * k1,
            a0[2] * k0 + b0[2] * k1,
          );
          if (!p) {
            moved = false;
            continue;
          }
          if (moved) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
          moved = true;
        }
        ctx.stroke();
      }
      ctx.restore();

      // 5 · the lit horizon
      // 🔴 NO red glow (owner, 2026-09-29: "remove red light on the globe").
      // The edge still has to be readable or the sphere dissolves into the
      // cream page, so it keeps a NEUTRAL hairline and a faint shade just
      // inside it — that is the body's own terminator, not a light source.
      const edge = ctx.createRadialGradient(cx, cy, R * 0.93, cx, cy, R);
      edge.addColorStop(0, 'rgba(138,3,17,0)');
      edge.addColorStop(1, 'rgba(138,3,17,0.16)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = edge;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(138,3,17,0.26)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 6 · destinations
      for (const m of MARKERS) {
        const p = project(m.lon, m.lat);
        if (!p || p[2] < 0.2) continue;
        ctx.globalAlpha = Math.min(1, p[2] * 1.6);
        ctx.beginPath();
        ctx.arc(p[0], p[1], m.india ? 3.4 : 2.6, 0, Math.PI * 2);
        ctx.fillStyle = m.india ? '#8A0311' : '#CE061A';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p[0], p[1], m.india ? 8 : 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = m.india ? 'rgba(138,3,17,0.45)' : 'rgba(206,6,26,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now) => {
      if (!startedAt) startedAt = now;
      draw(((now - startedAt) / 1000) * SPIN_DEG_PER_SEC);
      frame = requestAnimationFrame(tick);
    };

    resize();
    if (still) draw(0);
    else frame = requestAnimationFrame(tick);

    const observer = new ResizeObserver(() => {
      resize();
      if (still) draw(0);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      aria-labelledby="globe-heading"
      className="relative isolate w-full overflow-hidden bg-surface-canvas text-ink-900"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* 🔴 A scrim behind the copy. The land dots are light (#c2c8d0), so any
          letter that crosses one loses its contrast against it — measured at
          1.5:1 in the worst case before this. Dimming the dots instead would
          cost the globe its legibility, so the text gets its own backing.
          It is a FULL-WIDTH linear gradient, not the prettier radial it started
          as: a radial fades at the horizontal edges, which is exactly where the
          last words of each line sit, so the worst pixel stayed at 1.9:1. The
          rim stroke crossing the heading was the other failure (2.4:1). ~0.88
          black is what puts a #c2c8d0 dot under the 4.5:1 threshold with room
          to spare. It paints after the canvas and before the copy. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-4 h-[24rem] bg-[linear-gradient(to_bottom,transparent_0%,rgba(252,250,248,0.74)_16%,rgba(252,250,248,0.78)_62%,rgba(252,250,248,0.42)_84%,transparent_100%)]"
      />

      {/* Static labels, not controls: they carry no handler and no hover state,
          so nothing here looks clickable when it is not (`web-ui-notes.md`).
          Hidden below sm — at phone width they would land on the headline. */}
      {CARDS.map(({ icon: Icon, title, note, place }) => (
        <div
          key={title}
          className={`absolute z-10 hidden items-center gap-3 rounded-2xl border border-ink-900/10 bg-white/80 px-4 py-3 shadow-[0_10px_30px_-18px_rgb(0_5_23/0.4)] backdrop-blur-md sm:flex ${place}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600/10 text-primary-600">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-left">
            <span className="block text-[13px] font-semibold leading-tight text-ink-900">{title}</span>
            <span className="mt-0.5 block text-[11px] text-ink-500">
              {note}
            </span>
          </span>
        </div>
      ))}

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
        <h2
          id="globe-heading"
          className="text-balance text-[22px] font-extrabold uppercase leading-[1.1] tracking-tight text-ink-900 sm:text-3xl lg:text-[38px]"
        >
          {/* Written in sentence case and uppercased in CSS on purpose: some
              screen readers spell out a run of capitals letter by letter. */}
          How MPX Global Works
        </h2>
        {/* 🔴 Still nothing the platform cannot back — no escrow, no clearing, no
            volume figure. See the note at the top of this file. */}
        <p className="mt-3 text-pretty text-[15px] font-medium text-ink-700 sm:mt-3.5 sm:text-lg">
          Indian Suppliers. Global Buyers.
        </p>

        {/* `/suppliers` is a real page — the same one the header's "Suppliers"
            link opens. It replaces the scroll cue: one clear action beats an
            arrow that only pointed further down the page. */}
        <Link
          to="/suppliers"
          className="group mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary-500 to-primary-700 px-7 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition hover:from-primary-600 hover:to-primary-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/25 active:translate-y-px sm:mt-9"
        >
          Explore suppliers
          <ArrowRightIcon
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </Link>
      </div>

      {/* The mockup's marquee. It scrolls with CSS on a duplicated list, so the
          loop has no seam; `aria-hidden` on the second copy keeps a screen
          reader from hearing everything twice, and the whole strip stops under
          `prefers-reduced-motion` (`.globe8-ticker` in index.css). */}
      <div className="relative border-t border-ink-900/10 bg-white/70 py-2.5 backdrop-blur-sm">
        <div className="flex overflow-hidden">
          {[false, true].map((clone) => (
            <ul
              key={String(clone)}
              aria-hidden={clone || undefined}
              className="globe8-ticker flex shrink-0 items-center gap-10 pr-10"
            >
              {TICKER.map((line) => (
                <li key={line} className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                  <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden="true" />
                  <span className="text-[12px] text-ink-600">{line}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
