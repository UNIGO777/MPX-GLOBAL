import { Link } from 'react-router-dom';

import { ArrowRightIcon } from '../ui/icons.jsx';

/**
 * The ONE section-heading pattern for the landing page (owner, 2026-09-28:
 * consistency pass — headings were left/centred, 28–40px, some with an eyebrow
 * and some without, with two different "see more" buttons).
 *
 *   eyebrow — small red caps label
 *   title   — the h2, one size scale everywhere
 *   sub     — optional one-line lead-in
 *   action  — optional link on the right (a `SectionLink`)
 *
 * `align="center"` exists for the single deliberate exception, the film.
 * Headings carry NO red words — red is kept for actions and one accent per
 * section.
 */
export const HEADING = 'text-balance text-[26px] font-extrabold leading-[1.12] tracking-tight text-ink-900 sm:text-3xl lg:text-[34px]';

export function SectionHeader({ id, eyebrow, title, sub, action = null, align = 'left', className = '' }) {
  if (align === 'center') {
    return (
      <div className={`text-center ${className}`}>
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">{eyebrow}</p>}
        <h2 id={id} className={`mt-1.5 ${HEADING}`}>
          {title}
        </h2>
        {sub && <p className="mx-auto mt-2 max-w-xl text-pretty text-[14.5px] leading-relaxed text-ink-600 sm:text-[15px]">{sub}</p>}
      </div>
    );
  }
  return (
    <div className={`flex items-end justify-between gap-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">{eyebrow}</p>}
        <h2 id={id} className={`mt-1.5 ${HEADING}`}>
          {title}
        </h2>
        {sub && <p className="mt-2 max-w-2xl text-pretty text-[14.5px] leading-relaxed text-ink-600 sm:text-[15px]">{sub}</p>}
      </div>
      {action && <div className="hidden shrink-0 sm:block">{action}</div>}
    </div>
  );
}

/** The ONE "see more" link style: a white pill with a round dark arrow. */
export function SectionLink({ to, children, className = '' }) {
  return (
    <Link
      to={to}
      className={`group inline-flex h-11 items-center gap-2.5 rounded-full border border-ink-200 bg-white pl-5 pr-1.5 text-sm font-semibold text-ink-900 shadow-sm transition-colors hover:border-ink-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20 ${className}`}
    >
      {children}
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-white transition-colors duration-300 group-hover:bg-primary-600"
      >
        <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </Link>
  );
}
