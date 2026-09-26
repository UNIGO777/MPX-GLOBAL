import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The hero's backdrop: red pulses travelling inward along invisible circuit
 * traces and terminating on the search field (owner, 2026-09-26 — "remove that
 * box… make a search bar and connect all line with that also remove gray line
 * only red running line we will see").
 *
 * 🔴 **THE GEOMETRY IS MEASURED AT RUNTIME, IN CSS PIXELS.** The viewBox is the
 * host's own width and height, so one SVG unit is one CSS pixel and there is no
 * `preserveAspectRatio` scaling at all. The traces are then built to end on the
 * search field's ACTUAL rectangle, read from the DOM.
 *
 * This is the whole reason the file looks like this. It used to be a hand-written
 * list of paths inside a fixed `0 0 1200 720` viewBox drawn with `slice`, and the
 * field's position had to be converted back through that transform by hand. That
 * conversion was wrong twice — the pulses converged on the paragraph, and then
 * they stopped 70px short of the field while the lower ones ran up inside it —
 * and even once correct it was only correct at 1440×900. Every other viewport
 * scaled the viewBox differently and the convergence drifted off the field again.
 * A fixed viewBox cannot be responsive here; measuring can.
 *
 * 🔴 **The traces are NOT DRAWN.** The still grey traces, the vias and the chip
 * were removed on the owner's instruction — what renders is the pulses and
 * nothing else. The paths are rails, not artwork.
 *
 * ⚠️ **The comet tail is `strokeDasharray`, not a gradient.** The head dash is
 * longest and the ones behind it shorten, so a pulse reads as travelling with a
 * trail. A `linearGradient` was the wrong tool: gradient units are the path's
 * bounding box, so the bright point sat mid-frame and a pulse faded out as it
 * ARRIVED — backwards for a design about convergence, and unfixable for left-
 * and right-entering traces at once.
 *
 * 🔴 `prefers-reduced-motion` hides the pulses entirely (`web-design.md`). There
 * is no still layer to fall back to, so the band becomes plain cream — correct,
 * because every word in the hero is real DOM above this.
 */

/** Straight run before an elbow, and the shortest elbow worth drawing. */
const TAIL = 18;
const MIN_ELBOW = 14;

/** Per-trace motion. Indexed modulo, so the count can vary by viewport. */
const DURS = [5.6, 4.3, 6.1, 4.9, 5.2, 6.7, 4.6, 5.9, 4.1, 6.4, 5.0, 4.7, 6.2, 5.4, 4.4, 6.9, 5.1, 4.8];
const DELAYS = [0, 1.7, 0.8, 2.6, 1.1, 3.2, 0.4, 2.1, 1.4, 3.7, 0.6, 2.9, 1.9, 0.2, 3.4, 1.3, 2.4, 0.9];
const FADES = [0.9, 0.6, 1, 0.65, 0.85, 0.55, 0.95, 0.6, 0.8, 0.55, 0.9, 0.65, 0.85, 0.6, 0.95, 0.55, 0.8, 0.7];

/** Head dash first, shortening behind it — the trail. Sums to `pathLength`. */
const COMET = '11 3 6 4 3.5 5 2 65.5';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r = (n) => Math.round(n);

/**
 * How far a 45° elbow reaches, given the room on BOTH axes.
 *
 * 🔴 A 45° elbow spends the same distance horizontally as vertically, so it is
 * limited by whichever axis is tighter. The first version only looked at the
 * axis the trace travels along; on a phone, where the field is nearly the full
 * width, almost every elbow then overshot the frame and fell back to a straight
 * line — eighteen parallel verticals that read as rain, not as a circuit.
 *
 * Returns 0 when neither direction fits, and the caller draws a plain straight
 * line instead. That fallback is what keeps narrow screens safe rather than
 * producing paths that run off-canvas.
 */
function elbow(along, back, fwd) {
  const cap = along - TAIL - 6;
  if (cap < MIN_ELBOW) return [0, 0];
  // Prefer the roomier side, so an elbow survives near either frame edge.
  const dir = fwd > back ? 1 : -1;
  const across = Math.max(back, fwd) - 6;
  const d = clamp(r(Math.min(cap, across) * 0.7), 0, cap);
  return d < MIN_ELBOW ? [0, 0] : [d, dir];
}

/**
 * Build every trace for the measured box.
 *
 * `field` and `copy` are in host-relative CSS pixels. Traces always START on a
 * frame edge and END exactly on the field's perimeter — that direction is the
 * point of the section, so the motion converges on the search box.
 */
function buildTraces({ w, h, field, copy }) {
  const out = [];
  const fw = field.x1 - field.x0;
  const fh = field.y1 - field.y0;
  const room = { top: field.y0, bottom: h - field.y1, left: field.x0, right: w - field.x1 };

  // A side only takes traces if an arrival there can be seen at all.
  const sideCount = (space) => (space > 150 ? 3 : space > 80 ? 2 : 0);
  const nLeft = sideCount(room.left);
  const nRight = sideCount(room.right);
  // On a phone the field is nearly full-width, so both flanks are unusable.
  // Put those traces on the top and bottom edges instead of losing them.
  const bump = nLeft + nRight === 0 ? 2 : 0;
  const edgeCount = (fw > 520 ? 4 : fw > 300 ? 3 : 2) + bump;

  const spread = (a, b, n, i) => a + ((b - a) * (i + 1)) / (n + 1);

  for (let i = 0; i < edgeCount; i += 1) {
    const xe = r(spread(field.x0, field.x1, edgeCount, i));
    const [d, dir] = elbow(room.top, xe, w - xe);
    const xs = xe + dir * d;
    if (d) {
      const v1 = field.y0 - d - TAIL;
      out.push(`M${xs},0 V${r(v1)} L${xe},${r(v1 + d)} V${r(field.y0)}`);
    } else {
      out.push(`M${xe},0 V${r(field.y0)}`);
    }
  }

  for (let i = 0; i < edgeCount; i += 1) {
    const xe = r(spread(field.x0, field.x1, edgeCount, i));
    const [d, dir] = elbow(room.bottom, xe, w - xe);
    const xs = xe + dir * d;
    if (d) {
      const v1 = field.y1 + d + TAIL;
      out.push(`M${xs},${r(h)} V${r(v1)} L${xe},${r(v1 - d)} V${r(field.y1)}`);
    } else {
      out.push(`M${xe},${r(h)} V${r(field.y1)}`);
    }
  }

  for (let i = 0; i < nLeft; i += 1) {
    const ye = r(spread(field.y0, field.y1, nLeft, i));
    const [d, dir] = elbow(room.left, ye, h - ye);
    const ys = ye + dir * d;
    if (d) {
      const h1 = field.x0 - d - TAIL;
      out.push(`M0,${ys} H${r(h1)} L${r(h1 + d)},${ye} H${r(field.x0)}`);
    } else {
      out.push(`M0,${ye} H${r(field.x0)}`);
    }
  }

  for (let i = 0; i < nRight; i += 1) {
    const ye = r(spread(field.y0, field.y1, nRight, i));
    const [d, dir] = elbow(room.right, ye, h - ye);
    const ys = ye + dir * d;
    if (d) {
      const h1 = field.x1 + d + TAIL;
      out.push(`M${r(w)},${ys} H${r(h1)} L${r(h1 - d)},${ye} H${r(field.x1)}`);
    } else {
      out.push(`M${r(w)},${ye} H${r(field.x1)}`);
    }
  }

  /* Long sweeps: in from a frame flank, one 45° drop, then straight down into
     the field's top edge. They only exist where the copy leaves room for the
     drop, which is why they are last and conditional — on a short viewport the
     band is all copy and these would cut through it. */
  const gap = copy ? field.y0 - copy.y1 : 0;
  if (gap > 70 && room.left > 120) {
    const d = r(Math.min(gap - 20, room.left * 0.5));
    const xe = r(field.x0 + Math.min(fw * 0.25, 120));
    out.push(`M0,${r(field.y0 - d - 40)} H${r(xe - d)} L${xe},${r(field.y0 - 40)} V${r(field.y0)}`);
  }
  if (gap > 70 && room.right > 120) {
    const d = r(Math.min(gap - 20, room.right * 0.5));
    const xe = r(field.x1 - Math.min(fw * 0.25, 120));
    out.push(`M${r(w)},${r(field.y0 - d - 40)} H${r(xe + d)} L${xe},${r(field.y0 - 40)} V${r(field.y0)}`);
  }

  return { traces: out, fh };
}

/**
 * The cream veil over the copy.
 *
 * 🔴 Its bottom edge is CLAMPED to stay above the field. An earlier fixed
 * version ended below the field's top edge, so it covered the arrival itself and
 * every pulse entering from above appeared to stop in mid-air (owner, twice:
 * "upper lines are not comming to serch box"). Here the clamp makes that
 * impossible at any viewport.
 */
function buildVeil({ field, copy }) {
  if (!copy) return null;
  const limit = field.y0 - 14;
  const top = copy.y0 - 20;
  const bottom = Math.min(copy.y1 + 10, limit);
  if (bottom - top < 40) return null;
  return {
    cx: r((copy.x0 + copy.x1) / 2),
    cy: r((top + bottom) / 2),
    rx: r(((copy.x1 - copy.x0) / 2) * 1.25),
    ry: r((bottom - top) / 2),
  };
}

export function CircuitHero({ targetRef, copyRef, className = '' }) {
  const hostRef = useRef(null);
  const [geo, setGeo] = useState(null);

  const measure = useCallback(() => {
    const host = hostRef.current;
    const target = targetRef?.current;
    if (!host || !target) return;
    const hb = host.getBoundingClientRect();
    const tb = target.getBoundingClientRect();
    if (hb.width < 2 || hb.height < 2 || tb.width < 2) return;

    const rel = (b) => ({
      x0: b.left - hb.left,
      y0: b.top - hb.top,
      x1: b.right - hb.left,
      y1: b.bottom - hb.top,
    });
    const cb = copyRef?.current?.getBoundingClientRect();
    const box = { w: hb.width, h: hb.height, field: rel(tb), copy: cb ? rel(cb) : null };

    const { traces } = buildTraces(box);
    setGeo((prev) => {
      const next = { w: r(box.w), h: r(box.h), traces, veil: buildVeil(box) };
      // Skip the update when nothing moved — a ResizeObserver fires on every
      // frame of a drag, and re-rendering eighteen animated paths restarts them.
      return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
  }, [targetRef, copyRef]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (hostRef.current) observer.observe(hostRef.current);
    if (targetRef?.current) observer.observe(targetRef.current);
    if (copyRef?.current) observer.observe(copyRef.current);
    // Fonts land after first paint and change the copy's height, which moves
    // both the field and the veil.
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [measure, targetRef, copyRef]);

  return (
    <div
      ref={hostRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {geo && (
        <svg
          viewBox={`0 0 ${geo.w} ${geo.h}`}
          width={geo.w}
          height={geo.h}
          className="h-full w-full"
          role="presentation"
          focusable="false"
        >
          <defs>
            <radialGradient id="mpx-hero-veil">
              <stop offset="0%" stopColor="#F5F2EF" stopOpacity="0.93" />
              <stop offset="80%" stopColor="#F5F2EF" stopOpacity="0.90" />
              <stop offset="100%" stopColor="#F5F2EF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* `pathLength="100"` normalises every trace to one scale, so a single
              dash pattern and one keyframe range behave identically on a short
              trace and a long one — which matters far more now that the lengths
              change with the viewport. */}
          <g fill="none" stroke="#CE061A" strokeLinecap="round">
            {geo.traces.map((d, i) => (
              <path
                key={d}
                d={d}
                pathLength="100"
                strokeWidth={geo.w < 560 ? 1.7 : 2.25}
                strokeDasharray={COMET}
                opacity={FADES[i % FADES.length]}
                className="mpx-circuit-pulse"
                style={{
                  animationDuration: `${DURS[i % DURS.length]}s`,
                  animationDelay: `${DELAYS[i % DELAYS.length]}s`,
                }}
              />
            ))}
          </g>

          {/* A soft ellipse of the page's OWN cream, painted over the pulses and
              under the real DOM, so a pulse crossing the headline is veiled and
              returns to full as it leaves. Without it, red 45° streaks cut
              through "Connecting India's Suppliers to the World".

              ⚠️ Deliberately not an SVG `<mask>` (luminance interpolates
              differently across engines) and not a blur filter (a per-frame
              raster over eighteen running animations). One painted shape. */}
          {geo.veil && <ellipse {...geo.veil} fill="url(#mpx-hero-veil)" />}
        </svg>
      )}
    </div>
  );
}
