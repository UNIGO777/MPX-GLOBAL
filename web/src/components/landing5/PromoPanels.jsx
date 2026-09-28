import { Link } from 'react-router-dom';

import { ArrowRightIcon } from '../ui/icons.jsx';
import { SectionHeader, SectionLink } from './SectionHeader.jsx';

/**
 * "Browse by sector" — the three sector tiles under the hero.
 *
 * 2026-09-27 redesign (owner: "super premium… liked by investors", landing
 * redone section by section). Desktop: "one and two" — agriculture tall on
 * the left half, the other two stacked on the right (see the grid comment for
 * the versions the owner rejected). Phone and tablet: agriculture full width,
 * the other two side by side. It replaces the red-washed, hairline-
 * joined panels.
 *
 * 🔴 **EVERY TILE IS A REAL DESTINATION** — the category it shows. The slugs are
 * what `src/seed/catalogue.data.js` produces through `slugify()`, not guesses.
 * The whole tile is the link, so there are no second links inside it (a link in
 * a link is invalid). The two that lived here before are elsewhere now:
 * supplier search is "Suppliers" in the header (phone menu included), and AI
 * search is the hero itself.
 *
 * 🔴 **The subtitles describe the REAL listing fields** each category defines in
 * `catalogue.data.js`. No prices, offers or counts — nothing the platform
 * cannot back.
 *
 * 🔴 **Legibility comes from the bottom fade, not a colour wash.** The copy sits
 * in the lower part of each tile, over a black gradient that is at its darkest
 * exactly there, so solid white text holds its contrast whatever the photo
 * does. The old flat red wash is gone — it flattened the photographs' own
 * colours. On desktop the lead tile is half the width, so the 740px-wide
 * source files upscale only slightly.
 */
const PROMOS = [
  {
    id: 'agriculture',
    eyebrow: 'Grains, pulses & spices',
    title: 'Agriculture',
    subtitle: 'Grade, packaging size and shelf life on every listing.',
    to: '/category/agriculture',
    image: '/promo-agriculture.avif',
  },
  {
    id: 'garments',
    eyebrow: 'Ready-made lines',
    title: 'Apparel & Garments',
    subtitle: 'Size, fabric, colour and gender on every listing.',
    to: '/category/apparel-garments',
    image: '/promo-garments.avif',
  },
  {
    id: 'textiles',
    eyebrow: 'Fabric & yarn',
    title: 'Textiles',
    subtitle: 'Material, GSM and width, stated up front.',
    to: '/category/textiles-fabrics-yarn',
    image: '/promo-textiles.avif',
  },
];


function Tile({ promo, lead = false }) {
  return (
    <Link
      to={promo.to}
      className={`group relative isolate flex flex-col overflow-hidden rounded-3xl bg-ink-900 shadow-card ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/40 ${
        lead
          ? 'col-span-2 h-64 sm:h-80 lg:col-span-1 lg:row-span-2 lg:h-auto'
          : 'col-span-1 h-48 sm:h-60 lg:h-auto'
      }`}
    >
      {/* Decorative: the heading names the category (`web-design.md`). */}
      <img
        src={promo.image}
        alt=""
        loading="lazy"
        className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/0"
      />

      <div className="mt-auto flex items-end justify-between gap-3 p-4 sm:gap-4 sm:p-6 lg:p-7">
        <div className="min-w-0">
          {/* Small tiles on a phone are ~170px wide: the title alone fits there. */}
          <p
            className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/85 sm:text-[11px] ${
              lead ? '' : 'hidden sm:block'
            }`}
          >
            {promo.eyebrow}
          </p>
          <h3
            className={`mt-1 text-balance font-bold leading-tight tracking-tight text-white ${
              lead ? 'text-2xl sm:text-3xl xl:text-4xl' : 'text-[17px] sm:text-2xl xl:text-[26px]'
            }`}
          >
            {promo.title}
          </h3>
          <p
            className={`mt-1.5 max-w-md text-pretty text-[13px] leading-relaxed text-white sm:text-sm ${
              lead ? '' : 'hidden sm:block'
            }`}
          >
            {promo.subtitle}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`${lead ? 'flex' : 'hidden sm:flex'} h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink-900 shadow-sm transition-colors duration-300 group-hover:bg-primary-600 group-hover:text-white sm:h-11 sm:w-11`}
        >
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-45 motion-reduce:transition-none" />
        </span>
      </div>
    </Link>
  );
}

export function PromoPanels() {
  const [lead, ...rest] = PROMOS;
  return (
    <section aria-labelledby="sectors-heading" className="w-full bg-white px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16 xl:px-16">
      <SectionHeader
        id="sectors-heading"
        eyebrow="Browse by sector"
        title="Sourcing, organised by industry"
        action={<SectionLink to="/categories">All categories</SectionLink>}
        className="mb-6 sm:mb-8"
      />

      {/* Phone and tablet: agriculture full width, the other two side by side.
          lg+: "one and two" (owner, 2026-09-27) — agriculture tall on the LEFT
          HALF, the other two stacked on the right half. History of this grid:
          a 60%-wide tall lead "took all the attention", three equal tiles "lost
          its essence"; half width keeps the feature tile without the weight. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:h-[500px] lg:grid-rows-2 xl:h-[540px]">
        <Tile promo={lead} lead />
        {rest.map((p) => (
          <Tile key={p.id} promo={p} />
        ))}
      </div>

      <SectionLink to="/categories" className="mt-4 flex w-full justify-between sm:hidden">
        All categories
      </SectionLink>
    </section>
  );
}
