import { Link } from 'react-router-dom';

import { CheckCircleIcon, BuildingIcon } from '../components/ui/icons.jsx';
import { Logo } from '../components/ui/Logo.jsx';

/**
 * The approved auth composition (sign-in / OTP / recovery mockups, verified
 * against the design images 2026-08-01): a 45% navy narrative panel on the
 * left, and the form sitting DIRECTLY on a white right pane at max-w-[400px]
 * — desktop shows no card border/shadow/radius. On mobile the panel hides and
 * the form becomes a white shadowed card on the canvas tint. A 4px accent bar
 * runs across the top (every auth mockup carries it).
 */
export function AuthLayout({
  headline,
  sub,
  // Optional narrative extras — the buyer-signup design adds a green-ticked
  // benefit list and its own closing line; the shorter screens pass neither.
  bullets,
  footNote = 'Trusted by exporters and buyers across 20+ categories.',
  wide = false,
  children,
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden border-t-4 border-primary-600">
      {/* Narrative panel */}
      <aside className="relative hidden h-full w-[45%] shrink-0 flex-col justify-between overflow-hidden bg-primary-800 p-12 text-white lg:flex xl:p-16">
        {/* Mockup: radial glow at BOTTOM right, not top (code.html .mpx-left-panel) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary-600/30 blur-3xl"
        />
        <Link to="/" className="relative z-10 inline-block" aria-label="MPX Global — home">
          <Logo size="lg" variant="white" />
        </Link>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-[36px] font-bold leading-tight">{headline}</h1>
          {sub && <p className="mt-4 text-[18px] font-normal leading-relaxed opacity-80">{sub}</p>}

          {bullets?.length > 0 && (
            <ul className="mt-8 space-y-3">
              {bullets.map((line) => (
                <li key={line} className="flex items-start gap-3 text-[15px]">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  {line}
                </li>
              ))}
            </ul>
          )}

          {/* Supplier teaser card — mockup .teaser-card: SOLID primary-700 with a
              hairline white border and a 2° tilt, not a translucent blur panel. */}
          <div className="mt-12 inline-flex rotate-2 flex-col gap-4 rounded-xl border border-white/10 bg-primary-700 p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                <BuildingIcon className="h-5 w-5 text-white/40" />
              </div>
              <div>
                <p className="text-[15px] font-semibold">Tirupur Knitwear Exports</p>
                <p className="text-[13px] text-white/60">Tirupur, India</p>
              </div>
            </div>
            <div className="flex items-center">
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                <CheckCircleIcon className="h-4 w-4 text-success" />
                Verified
              </span>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-[13px] font-medium text-white/60">{footNote}</p>
      </aside>

      {/* Form pane — the ONLY scroller, so the narrative panel stays pinned on
          long steps (the company step runs past the fold). `justify-center`
          would clip the top of an over-tall form, so it only centres when the
          content actually fits. */}
      <main className="flex flex-1 flex-col items-center overflow-y-auto bg-surface-subtle p-4 md:p-8 lg:bg-white">
        <Link to="/" className="mb-8 lg:hidden" aria-label="MPX Global — home">
          <Logo size="lg" />
        </Link>
        <div
          className={`my-auto w-full ${wide ? 'max-w-[480px]' : 'max-w-[400px]'} rounded-2xl bg-white p-8 shadow-xl lg:rounded-none lg:p-0 lg:shadow-none`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
