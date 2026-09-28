/**
 * The hero's five-scene supply-chain animation: a supplier lists goods, they
 * travel by road, load at the port, cross the sea, and arrive with the buyer.
 * The owner supplied this as a standalone HTML file (2026-09-29); this is that
 * scene ported into the app.
 *
 * 🔴 **ONE CLOCK.** Every scene, prop and rail label runs on the same 20s loop
 * (`--story-loop` in `index.css`) and differs only by the percentages inside its
 * own keyframes. That is what keeps the truck leaving exactly as the port
 * arrives. The timing lives in CSS, not here — see the block in `index.css`.
 *
 * ⚠️ **Three things from the reference were deliberately NOT brought across:**
 *   · its `<nav>` — this app already has `PublicHeader`, and a second header
 *     would be two logos and two CTAs on one screen;
 *   · Sora, Poppins and Montserrat — three Google font families for one section,
 *     on a page that already loads Inter. The type here is the app's own;
 *   · its `#ec4747`. The brand red is `primary-400` (#EE4657) on dark, which is
 *     within a hair of it, and `web-design.md` makes the config the single
 *     source of colour.
 *
 * 🔴 **Every SVG id is prefixed `hs-`.** They are global to the document, and
 * this page already carries other inline SVGs; an unprefixed `#crate` or `#ship`
 * would be a collision waiting for the next illustration.
 *
 * ⚠️ **The whole stage is `aria-hidden`.** It is a decorative retelling of what
 * the copy beside it already says; a screen reader gets the heading and the
 * search field, not a narration of a cartoon truck. The step rail beneath it IS
 * readable, because those five words are real information.
 */

/** The phone's stacked edge layers — depth, drawn rather than faked with a shadow. */
const DEPTH = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const t = Math.round(150 - n * 4);
  return { key: n, background: `rgb(${t + 10},${t + 16},${t + 19})`, z: 6 - n * 1.4 };
});

const STEPS = ['List goods', 'By road', 'At port', 'At sea', 'Delivered'];

export function HeroStory() {
  return (
    <div className="story relative w-full min-w-0">
      {/* 🔴 The stage CLIPS. Every scene paints far outside the viewBox on
          purpose — the road, the sea and the skylines are 3600 units wide so
          they can pan without ever showing an end — so without this the sea runs
          out under the copy and off the section. The reference did the same with
          `overflow:hidden` on its stage; the soft left mask is also its idea,
          and it is what stops the panning scenery ending in a hard vertical
          edge beside the text. */}
      <div
        aria-hidden="true"
        className="relative mx-auto aspect-[600/520] w-full max-w-[272px] overflow-hidden sm:max-w-[520px] lg:max-w-[640px] [mask-image:linear-gradient(90deg,transparent,#000_16%,#000_88%,transparent)]"
      >
        {/* The phone. `container-type: inline-size` is what lets the screen's
            type scale with the phone rather than with the viewport — the
            reference's `cqw` units depend on it. */}
        {/* The phone IS step one — "list your goods" happens on it — so it leaves
            with scene 1 and comes back when the loop does (owner, 2026-09-29).
            The class goes on this wrapper, not on `story-sway`, so the drop
            shadow leaves with the device instead of hanging under nothing. */}
        <div className="story-phone absolute left-[37%] top-[17.5%] z-[1] h-[50.4%] w-[26%] [perspective:900px]">
          <div className="absolute inset-x-[8%] -bottom-[7%] -right-[6%] h-[9%] bg-[radial-gradient(ellipse,rgb(0_0_0/0.28),transparent_70%)] blur-[4px]" />
          <div className="story-sway absolute inset-0 [container-type:inline-size] [transform-style:preserve-3d]">
            {DEPTH.map((d) => (
              <div
                key={d.key}
                className="absolute inset-0 rounded-[15cqw]"
                style={{ background: d.background, transform: `translateZ(${d.z}px)` }}
              />
            ))}
            <div
              className="absolute inset-0 rounded-[15cqw] bg-gradient-to-b from-[#c9cdcf] to-[#a3a9ac] p-[5cqw]"
              style={{ transform: 'translateZ(6px)' }}
            >
              <div className="relative flex h-full flex-col overflow-hidden rounded-[11cqw] bg-[var(--story-mist)] px-[8cqw] pb-[8cqw] pt-[9cqw] text-[#2a2c30]">
                <span className="story-glare absolute inset-0 z-[3] bg-[linear-gradient(115deg,transparent_42%,rgb(255_255_255/0.7)_50%,transparent_58%)]" />
                <span className="absolute left-1/2 top-[3cqw] ml-[-11cqw] h-[4.5cqw] w-[22cqw] rounded-[9cqw] bg-[#2a2c30]" />
                {/* ⚠️ The raw asset, not the `Logo` component, and on purpose:
                    `Logo` sets its own pixel height and width as an INLINE
                    style, which beats any class and so cannot scale with the
                    phone. The reference sizes this in `cqw` — a share of the
                    phone's own width — which is the only way it stays right as
                    the stage shrinks. Same file `Logo` serves. */}
                <img src="/brand-logo.png" alt="" className="mt-[1cqw] block w-[36cqw]" />
                <p className="my-[5cqw] text-[9cqw] font-semibold leading-tight">Your supply, matched.</p>
                <span className="mb-[3cqw] block h-[4cqw] rounded-[2cqw] bg-[#dcdfe1]" />
                <span className="mb-[3cqw] block h-[4cqw] w-[70%] rounded-[2cqw] bg-[#dcdfe1]" />
                <span className="mt-[6cqw] block rounded-[6cqw] bg-[#e6e8ea] p-[5cqw]">
                  <span className="story-fill block h-[4cqw] rounded-[2cqw] bg-[#8b9194]" />
                </span>
                <span className="story-tap mt-auto block rounded-full bg-primary-400 py-[5.5cqw] text-center text-[7.4cqw] font-semibold text-white">
                  Start Supplying
                </span>
              </div>
            </div>
          </div>
        </div>

        <svg viewBox="0 0 600 520" className="absolute inset-0 z-[2] h-full w-full overflow-visible">
          <defs>
            <linearGradient id="hs-metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e4e7e9" />
              <stop offset="1" stopColor="#8f9599" />
            </linearGradient>
            <linearGradient id="hs-sea" gradientUnits="userSpaceOnUse" x1="0" y1="330" x2="0" y2="560">
              <stop offset="0" stopColor="var(--story-deep)" />
              <stop offset="1" stopColor="var(--story-night)" />
            </linearGradient>
            <linearGradient id="hs-beam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--story-slate)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--story-slate)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hs-wake" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="var(--story-slate)" stopOpacity=".3" />
              <stop offset="1" stopColor="var(--story-slate)" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="hs-glow">
              <stop offset="0" stopColor="var(--story-slate)" stopOpacity=".26" />
              <stop offset="1" stopColor="var(--story-slate)" stopOpacity="0" />
            </radialGradient>

            <g id="hs-crate">
              <rect x="-12" y="-10" width="24" height="20" rx="2.5" fill="url(#hs-metal)" />
              <path d="M-12 0H12M0 -10V10" stroke="var(--story-slate)" strokeWidth="1.4" />
              <rect x="-12" y="-10" width="24" height="20" rx="2.5" fill="none" stroke="var(--story-slate)" strokeOpacity=".4" />
            </g>
            <g id="hs-container">
              <rect width="30" height="16" rx="1.5" fill="url(#hs-metal)" />
              <path d="M6 1V15M12 1V15M18 1V15M24 1V15" stroke="var(--story-slate)" strokeWidth="1" />
            </g>
            <g id="hs-truck">
              <rect x="40" y="318" width="80" height="6" rx="2" fill="var(--story-stone)" />
              <path d="M120 324V304q0-6 6-6h14l10 12v14z" fill="url(#hs-metal)" />
              <path d="M132 302h8l6 8h-14z" fill="#16171a" />
              <g fill="#2a2c31" stroke="var(--story-stone)" strokeWidth="1.5">
                <circle cx="58" cy="329" r="7" />
                <circle cx="100" cy="329" r="7" />
                <circle cx="138" cy="329" r="7" />
              </g>
            </g>
            <g id="hs-ship">
              <path d="M296 366H394L380 394H312Z" fill="url(#hs-metal)" />
              <path d="M304 376H388" stroke="var(--story-slate)" strokeWidth="1" />
              <rect x="364" y="346" width="18" height="20" rx="1.5" fill="var(--story-slate)" />
              <rect x="368" y="351" width="10" height="5" fill="#16171a" />
              <rect x="371" y="338" width="3" height="8" fill="var(--story-slate)" />
              <rect x="302" y="356" width="17" height="10" rx="1" fill="#c2c7ca" />
              <rect x="321" y="356" width="8" height="10" rx="1" fill="var(--story-stone)" />
            </g>
            <g id="hs-waves" stroke="var(--story-stone)" strokeOpacity=".42" fill="none" strokeWidth="1.4">
              <path d="M20 410q15-8 30 0t30 0t30 0t30 0" />
              <path d="M250 440q15-8 30 0t30 0t30 0t30 0" />
              <path d="M60 470q15-8 30 0t30 0t30 0" />
              <path d="M420 425q15-8 30 0t30 0t30 0" />
              <path d="M330 490q15-8 30 0t30 0t30 0" />
            </g>
            <g id="hs-skyline" fill="var(--story-far)">
              <rect x="0" y="292" width="60" height="40" />
              <rect x="70" y="270" width="40" height="62" />
              <rect x="82" y="248" width="6" height="22" />
              <rect x="118" y="298" width="80" height="34" />
              <rect x="210" y="262" width="30" height="70" />
              <rect x="250" y="286" width="90" height="46" />
              <rect x="352" y="274" width="44" height="58" />
              <rect x="408" y="298" width="70" height="34" />
              <rect x="490" y="266" width="36" height="66" />
              <rect x="536" y="290" width="64" height="42" />
            </g>
            <g id="hs-waverow">
              <use href="#hs-waves" x="-1200" />
              <use href="#hs-waves" x="-600" />
              <use href="#hs-waves" />
              <use href="#hs-waves" x="600" />
              <use href="#hs-waves" x="1200" />
            </g>
            <g id="hs-poles">
              <path d="M70 332V292h12M250 332V292h12M430 332V292h12" stroke="#4a4e52" strokeWidth="2" fill="none" />
              <circle cx="82" cy="294" r="14" fill="url(#hs-glow)" />
              <circle cx="262" cy="294" r="14" fill="url(#hs-glow)" />
              <circle cx="442" cy="294" r="14" fill="url(#hs-glow)" />
            </g>
          </defs>

          {/* 1 · the supplier lists goods */}
          <g className="story-k1">
            <circle className="story-ring" cx="300" cy="222" r="70" fill="none" stroke="var(--story-stone)" strokeWidth="1.2" />
            <circle className="story-ring" style={{ animationDelay: '.3s' }} cx="300" cy="222" r="70" fill="none" stroke="var(--story-stone)" strokeWidth="1" />
            <g className="story-chip">
              <rect x="60" y="180" width="106" height="28" rx="14" fill="#fff" stroke="var(--story-slate)" strokeOpacity=".28" />
              <circle cx="76" cy="194" r="3.5" fill="var(--story-stone)" />
              <text x="88" y="198" fill="var(--story-slate)" fontSize="12">Surat, GJ</text>
            </g>
            <g className="story-chip" style={{ animationDelay: '.35s' }}>
              <rect x="76" y="226" width="100" height="28" rx="14" fill="#fff" stroke="var(--story-slate)" strokeOpacity=".28" />
              <circle cx="92" cy="240" r="3.5" fill="var(--story-stone)" />
              <text x="104" y="244" fill="var(--story-slate)" fontSize="12">Tiruppur, TN</text>
            </g>
            <g className="story-a story-crate1">
              <circle r="30" fill="url(#hs-glow)" />
              <use href="#hs-crate" />
            </g>
          </g>

          {/* 2 · by road */}
          <g transform="translate(0,-40)">
            <g className="story-k2">
              {[-1200, -600, 0, 600, 1200, 1800].map((x) => (
                <use key={x} className="story-pan-slow" href="#hs-skyline" x={x} />
              ))}
              <rect x="-1500" y="332" width="3600" height="24" fill="#c6bdb4" />
              <rect x="-1500" y="356" width="3600" height="2000" fill="url(#hs-sea)" />
              <line x1="-1500" y1="344" x2="2100" y2="344" stroke="var(--story-stone)" strokeOpacity=".4" className="story-road" />
              {[-1200, -600, 0, 600, 1200, 1800].map((x) => (
                <use key={x} className="story-pan-fast" href="#hs-poles" x={x} />
              ))}
              <text x="20" y="384" fill="var(--story-stone)" fillOpacity=".75" fontSize="12">India</text>
              <g transform="translate(170,0)">
                <ellipse cx="95" cy="336" rx="64" ry="3" fill="#000" opacity=".2" />
                {[0, 0.4, 0.8].map((d) => (
                  <circle key={d} className="story-puff" style={{ animationDelay: `${d}s` }} cx="34" cy="326" r="5" fill="var(--story-stone)" />
                ))}
                <path d="M150 306L290 288V340L150 322Z" fill="url(#hs-beam)" />
                <g className="story-vib">
                  <rect x="40" y="318" width="80" height="6" rx="2" fill="var(--story-stone)" />
                  <path d="M120 324V304q0-6 6-6h14l10 12v14z" fill="url(#hs-metal)" />
                  <path d="M132 302h8l6 8h-14z" fill="#16171a" />
                  <circle cx="148" cy="316" r="2.2" fill="#fff" />
                  <use href="#hs-crate" x="78" y="306" />
                  {[58, 100, 138].map((cx) => (
                    <g key={cx} transform={`translate(${cx},329)`}>
                      <g className="story-spin">
                        <circle r="7" fill="#2a2c31" stroke="var(--story-stone)" strokeWidth="1.5" />
                        <path d="M-5 0H5M0-5V5" stroke="var(--story-stone)" />
                      </g>
                    </g>
                  ))}
                </g>
              </g>
            </g>
          </g>

          {/* 3 · loading at the port */}
          <g transform="translate(0,-40)">
            <g className="story-k3">
              <rect x="-1500" y="356" width="3600" height="2000" fill="url(#hs-sea)" />
              <rect x="-1500" y="332" width="1950" height="24" fill="#c6bdb4" />
              <use href="#hs-container" x="392" y="316" />
              <use href="#hs-container" x="392" y="300" />
              <use href="#hs-container" x="362" y="316" />
              <path d="M390 332V244M424 332V244M390 270H424M390 292H424" stroke="var(--story-stone)" strokeWidth="2.5" />
              <path d="M200 244H432" stroke="var(--story-stone)" strokeWidth="4" />
              <circle className="story-blink" cx="428" cy="238" r="2.5" fill="#EE4657" />
              <g className="story-a story-trolley">
                <g transform="translate(0,246)">
                  <rect className="story-a story-cable" x="-0.75" y="0" width="1.5" height="1" fill="var(--story-slate)" />
                </g>
              </g>
              <text x="16" y="322" fill="var(--story-stone)" fillOpacity=".75" fontSize="12">Port</text>
              <use href="#hs-truck" x="150" />
              <use href="#hs-ship" />
              <use className="story-a story-crate3" href="#hs-crate" />
            </g>
          </g>

          {/* 4 · at sea */}
          <g transform="translate(0,-40)">
            <g className="story-k4">
              <circle cx="300" cy="330" r="170" fill="url(#hs-glow)" opacity=".18" />
              <rect x="-1500" y="330" width="3600" height="2000" fill="url(#hs-sea)" />
              <g stroke="var(--story-stone)" strokeOpacity=".2" fill="none">
                <ellipse cx="300" cy="640" rx="540" ry="330" />
                <ellipse cx="300" cy="640" rx="420" ry="250" />
              </g>
              <use className="story-wave1" href="#hs-waverow" />
              <use className="story-wave2" href="#hs-waverow" y="-20" />
              <path className="story-route" d="M60 405 Q300 430 545 405" fill="none" stroke="var(--story-stone)" strokeOpacity=".4" strokeWidth="1.6" />
              <circle r="9" fill="url(#hs-glow)">
                <animateMotion dur="4s" repeatCount="indefinite" path="M60 405 Q300 430 545 405" />
              </circle>
              <circle r="3" fill="var(--story-mist)">
                <animateMotion dur="4s" repeatCount="indefinite" path="M60 405 Q300 430 545 405" />
              </circle>
              <rect x="540" y="338" width="1500" height="18" fill="#26282d" />
              <text x="560" y="330" fill="#EE4657" fontSize="13" fontWeight="600">USA</text>
              <g className="story-a story-ship4">
                <g className="story-bob">
                  <rect x="180" y="390" width="120" height="5" rx="2.5" fill="url(#hs-wake)" />
                  <use href="#hs-ship" />
                  <use href="#hs-crate" x="345" y="356" />
                </g>
              </g>
            </g>
          </g>

          {/* 5 · delivered to the buyer */}
          <g transform="translate(0,-40)">
            <g className="story-k5">
              <rect x="-1500" y="356" width="3600" height="2000" fill="url(#hs-sea)" />
              <use className="story-wave1" href="#hs-waverow" />
              <rect x="440" y="332" width="1500" height="24" fill="#26282d" />
              <rect x="470" y="250" width="50" height="82" fill="#1f2126" stroke="var(--story-stone)" strokeOpacity=".3" />
              <rect x="522" y="222" width="48" height="110" fill="#22242a" stroke="var(--story-stone)" strokeOpacity=".4" />
              <rect x="572" y="268" width="44" height="64" fill="#1f2126" stroke="var(--story-stone)" strokeOpacity=".3" />
              <g fill="var(--story-mist)" fillOpacity=".7">
                {[[530, 234, 0], [552, 234, 0.8], [530, 256, 1.6], [552, 278, 0.4], [480, 262, 1.2], [500, 290, 2], [582, 280, 0.6]].map(([x, y, d]) => (
                  <rect key={`${x}-${y}`} className="story-blink" style={{ animationDelay: `${d}s` }} x={x} y={y} width="8" height="8" />
                ))}
              </g>
              <rect x="534" y="312" width="18" height="20" fill="var(--story-night)" />
              <circle cx="546" cy="180" r="17" fill="none" stroke="#EE4657" strokeOpacity=".45" strokeWidth="1.5" />
              <path className="story-check" d="M537 181l7 7 12-14" fill="none" stroke="#EE4657" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <text className="story-done" x="546" y="214" textAnchor="middle" fill="#EE4657" fontSize="13" fontWeight="600">Delivered</text>
              <text x="452" y="384" fill="var(--story-stone)" fillOpacity=".8" fontSize="12">Buyer, USA</text>
              <g className="story-a story-ship5">
                <use href="#hs-ship" />
                <use className="story-a story-crate5" href="#hs-crate" />
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* 🔴 The rail is NOT aria-hidden. Those five words are the only plain
          statement of what the platform does end to end, and they are real
          information rather than a caption on a cartoon. */}
      <ol className="mx-auto mt-3 grid w-full max-w-[272px] grid-cols-5 gap-2 sm:mt-5 sm:max-w-[520px] sm:gap-2.5 lg:max-w-[640px]">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className="story-step relative pt-2.5 text-[11.5px] text-ink-600 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-ink-900/10 after:absolute after:inset-x-0 after:top-0 after:h-0.5 after:bg-ink-900 sm:text-[12.5px]"
            style={{ '--story-d': `${i * 4}s` }}
          >
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
