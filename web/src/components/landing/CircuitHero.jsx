/**
 * The hero's backdrop: red pulses travelling inward along invisible circuit
 * traces and terminating on the search bar (owner, 2026-09-26 — "remove that
 * box… make a search bar and connect all line with that also remove gray line
 * only red running line we will see").
 *
 * 🔴 **THE TRACES ARE NOT DRAWN.** The still grey traces, the solder vias and
 * the chip were all removed on the owner's instruction — what renders is the
 * pulses and nothing else. The paths still exist because the pulses need a
 * geometry to run along; they are rails, not artwork. If you ever want the
 * board back, draw `TRACES` in `currentColor` again — the data is unchanged.
 *
 * 🔴 **Every trace ENDS on the search bar's perimeter**, and every pulse runs
 * START → END, i.e. frame edge → bar. That direction is the whole point: this
 * section sells AI match-making, so the motion has to converge on the search
 * field rather than radiate away from it. The geometry is generated and
 * machine-checked — every diagonal moves equal dx and dy, every path starts on
 * a frame edge and ends on the bar rectangle.
 *
 * ⚠️ **The bar zone is approximate, on purpose.** `slice` scales the viewBox to
 * cover the container, so the SVG's 600-unit bar zone only matches the real
 * search field's width at one viewport (~720px wide, which is what the field is
 * capped at). Elsewhere the pulses stop a little short of, or a little under,
 * the field. That is invisible in practice precisely BECAUSE the traces are not
 * drawn — there is no line left hanging to give the mismatch away. Do not spend
 * effort making it exact; drawing the traces again is what would make it matter.
 *
 * ⚠️ **The comet tail is `strokeDasharray`, not a gradient.** The head dash is
 * longest and the ones behind it shorten, so the pulse reads as travelling with
 * a trail. This replaced a `linearGradient`, which was the wrong tool: gradient
 * units are the PATH'S BOUNDING BOX, so the bright point sat mid-frame and a
 * pulse faded out as it ARRIVED — backwards for a design about convergence, and
 * unfixable for left- and right-entering traces at the same time. A dash
 * pattern travels with the dash, whichever way the path runs.
 *
 * 🔴 `prefers-reduced-motion` hides the pulses entirely (`web-design.md`). There
 * is no longer a still layer to fall back to, so the band simply becomes plain
 * cream — which is correct: every word in the hero is real DOM above this, so
 * nothing is lost but the decoration.
 */

/**
 * Frame edge → search bar. Straight, one 45° elbow, straight.
 *
 * 🔴 The bar zone (x 300–900, y 386–454) was MEASURED off a real 1440×900 render,
 * not guessed. The first version centred it at y=360 — the viewBox's own middle —
 * and the pulses visibly converged on the PARAGRAPH, about 60 units above the
 * field. The content block is vertically centred but the copy above the field is
 * taller than the chips below it, so the field sits below the band's midpoint.
 * If the hero's copy changes height, re-measure; do not re-derive from the
 * viewBox.
 */
const TRACES = [
  'M150,0 V90 L420,360 V386',
  'M470,0 V270 L560,360 V386',
  'M830,0 V170 L640,360 V386',
  'M1050,0 V90 L780,360 V386',
  'M190,720 V710 L420,480 V454',
  'M520,720 V520 L560,480 V454',
  'M760,720 V600 L640,480 V454',
  'M1000,720 V700 L780,480 V454',
  'M0,180 H20 L240,400 H300',
  'M0,560 H100 L240,420 H300',
  'M0,640 H40 L240,440 H300',
  'M1200,180 H1180 L960,400 H900',
  'M1200,340 H1040 L960,420 H900',
  'M1200,660 H1180 L960,440 H900',
  'M0,40 H160 L350,230 V386',
  'M0,210 H390 L490,310 V386',
  'M1200,700 H1030 L850,520 V454',
  'M1200,620 H830 L710,500 V454',
];

/**
 * One entry per trace — all eighteen run now, because with the still traces
 * gone an un-animated path is simply not on the page at all.
 *
 * ⚠️ The spread of `delay` and `dur` is doing real work. Eighteen pulses on the
 * same clock arrive together and read as a loading bar; these are deliberately
 * coprime-ish so the band never resolves into a pattern. `opacity` varies for
 * depth — red is this product's ACTION colour, and eighteen of them at full
 * strength on cream would out-shout the button they are pointing at.
 */
const PULSES = [
  { dur: 5.6, delay: 0.0, opacity: 0.9 },
  { dur: 4.3, delay: 1.7, opacity: 0.6 },
  { dur: 6.1, delay: 0.8, opacity: 1 },
  { dur: 4.9, delay: 2.6, opacity: 0.65 },
  { dur: 5.2, delay: 1.1, opacity: 0.85 },
  { dur: 6.7, delay: 3.2, opacity: 0.55 },
  { dur: 4.6, delay: 0.4, opacity: 0.95 },
  { dur: 5.9, delay: 2.1, opacity: 0.6 },
  { dur: 4.1, delay: 1.4, opacity: 0.8 },
  { dur: 6.4, delay: 3.7, opacity: 0.55 },
  { dur: 5.0, delay: 0.6, opacity: 0.9 },
  { dur: 4.7, delay: 2.9, opacity: 0.65 },
  { dur: 6.2, delay: 1.9, opacity: 0.85 },
  { dur: 5.4, delay: 0.2, opacity: 0.6 },
  { dur: 4.4, delay: 3.4, opacity: 0.95 },
  { dur: 6.9, delay: 1.3, opacity: 0.55 },
  { dur: 5.1, delay: 2.4, opacity: 0.8 },
  { dur: 4.8, delay: 0.9, opacity: 0.7 },
];

/** Head dash first, shortening behind it — the trail. Sums to `pathLength`. */
const COMET = '11 3 6 4 3.5 5 2 65.5';

export function CircuitHero({ className = '' }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1200 720"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="presentation"
        focusable="false"
      >
        {/* `pathLength="100"` normalises every trace to one scale, so a single
            dash pattern and a single keyframe range behave identically on a
            short trace and a long one. Without it each pulse would be a
            different size and speed. */}
        <defs>
          {/* The veil. See the note on `<ellipse>` below. */}
          <radialGradient id="mpx-hero-veil">
            <stop offset="0%" stopColor="#F5F2EF" stopOpacity="0.93" />
            <stop offset="70%" stopColor="#F5F2EF" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#F5F2EF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g fill="none" stroke="#CE061A" strokeLinecap="round">
          {TRACES.map((d, i) => (
            <path
              key={d}
              d={d}
              pathLength="100"
              strokeWidth="2.25"
              strokeDasharray={COMET}
              opacity={PULSES[i].opacity}
              className="mpx-circuit-pulse"
              style={{
                animationDuration: `${PULSES[i].dur}s`,
                animationDelay: `${PULSES[i].delay}s`,
              }}
            />
          ))}
        </g>

        {/* 🔴 Why the copy is readable: a soft ellipse of the page's OWN cream,
            painted OVER the pulses and UNDER the real DOM, so a pulse crossing
            the headline is veiled to roughly a tenth of its strength and comes
            back to full as it leaves. Without it, red 45° streaks cut straight
            through "Connecting India's Suppliers to the World" — seen on the
            first real render, not reasoned about.

            ⚠️ It is a plain gradient-filled ellipse, deliberately NOT an SVG
            `<mask>` and NOT a blur filter. A mask's luminance is interpolated
            differently across engines, and a filter is a per-frame raster on a
            layer with eighteen running animations. This is one painted shape and
            it composites for free.

            It is sized to clear the COPY, not the field: at the bar's own edges
            the veil has already fallen to zero, so the pulses arrive at full
            strength — which is the one moment that has to read. */}
        <ellipse cx="600" cy="245" rx="520" ry="150" fill="url(#mpx-hero-veil)" />
      </svg>
    </div>
  );
}
