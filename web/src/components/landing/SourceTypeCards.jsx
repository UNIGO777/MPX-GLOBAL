import { Link } from 'react-router-dom';

import { ArrowRightIcon, BoxIcon, GridIcon } from '../ui/icons.jsx';

/**
 * Goods / services — the fork in the road (landing). Moved out of Landing.jsx
 * on 2026-09-28 when the pair were redesigned (owner: "too much empty space,
 * add some vectors to look good, redesign the two cards").
 *
 * Each card is TWO HALVES: the words on the left (label, title, one line,
 * example chips, "Browse …" link) and a PHOTOGRAPH on the right — an Indian
 * textile floor for goods, a team at work for services. (Hand-drawn vector art
 * was tried first; owner: "not good".) The floating tags are EXAMPLES of what
 * a listing carries (goods list MOQ and lead time; services are scoped per
 * engagement), not claims about any supplier.
 *
 * 🔴 Still a MATCHED PAIR (see the history in Landing.jsx): same card, told
 * apart by icon, illustration and copy — never by colour.
 */
const TYPES = [
  {
    to: '/categories?type=goods',
    Icon: BoxIcon,
    eyebrow: 'Goods',
    title: 'Physical products',
    body: 'Listed with MOQ, per-unit pricing and lead times.',
    chips: ['Fabric & yarn', 'Leather', 'Chemicals', 'Machinery'],
    cta: 'Browse goods',
    art: 'goods',
    image: '/supplier-veltora-factory.webp',
  },
  {
    to: '/categories?type=service',
    Icon: GridIcon,
    eyebrow: 'Services',
    title: 'Business services',
    body: 'Scoped per engagement, direct with the team that delivers.',
    chips: ['Software', 'AI / ML', 'Cloud', 'QC & inspection'],
    cta: 'Browse services',
    art: 'services',
    // Unsplash (free licence), a team at work — stored locally.
    image: '/services-team.webp',
  },
];

const TAGS = {
  goods: [
    ['MOQ 500 pcs', 'right-2 top-3 sm:right-3'],
    ['14-day lead time', 'bottom-3 left-2 sm:left-3'],
  ],
  services: [
    ['Scoped per project', 'right-2 top-3 sm:right-3'],
    ['Direct with the team', 'bottom-3 left-2 sm:left-3'],
  ],
};

export function SourceTypeCards() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-2">
      {TYPES.map(({ to, Icon, eyebrow, title, body, chips, cta, art, image }) => (
        <Link
          key={to}
          to={to}
          className="group relative isolate grid grid-cols-1 items-stretch gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-white to-ink-50/70 p-5 shadow-card ring-1 ring-ink-200/70 transition duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/30 motion-reduce:transition-none sm:grid-cols-[1.1fr_0.9fr] sm:p-7 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-lift motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
        >
          <span aria-hidden="true" className="absolute -right-16 -top-20 -z-10 h-56 w-56 rounded-full bg-primary-100/60 blur-3xl" />

          {/* The words */}
          <span className="order-2 flex min-w-0 flex-col sm:order-1">
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-white text-primary-600 shadow-sm ring-1 ring-primary-100">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">{eyebrow}</span>
            </span>
            <span className="mt-3 block text-[22px] font-bold leading-tight tracking-tight text-ink-900 sm:text-[26px]">{title}</span>
            <span className="mt-1.5 block text-[14px] leading-relaxed text-ink-600 sm:text-[15px]">{body}</span>
            <span className="mt-4 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink-700 shadow-sm ring-1 ring-ink-200/80 sm:text-[12px]">
                  {c}
                </span>
              ))}
            </span>
            <span className="mt-5 inline-flex items-center gap-2 self-start text-[14px] font-semibold text-ink-900 sm:mt-auto sm:pt-5">
              {cta}
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-white transition-colors duration-300 group-focus-visible:bg-primary-600 [@media(hover:hover)]:group-hover:bg-primary-600"
              >
                <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none [@media(hover:hover)]:group-hover:translate-x-0.5" />
              </span>
            </span>
          </span>

          {/* The picture — a real photograph, like the sector tiles above. */}
          <span aria-hidden="true" className="relative order-1 block h-44 overflow-hidden rounded-2xl ring-1 ring-black/5 sm:order-2 sm:h-full sm:min-h-[220px]">
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              width={960}
              height={640}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-[1.05]"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-ink-900/35 via-transparent to-transparent" />
            {TAGS[art].map(([label, pos]) => (
              <span key={label} className={`absolute ${pos} rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold text-ink-800 shadow-sm ring-1 ring-black/5 backdrop-blur-sm`}>
                {label}
              </span>
            ))}
          </span>
        </Link>
      ))}
    </div>
  );
}
