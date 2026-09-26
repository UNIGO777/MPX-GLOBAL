import { Link } from 'react-router-dom';

/**
 * The three sector panels under the hero — one full-width, two halves
 * (owner, 2026-09-27, to the store layout they sent, with their three photos in
 * the order they gave: agriculture, garments, textiles).
 *
 * 🔴 **EVERY LINK IS A REAL DESTINATION.** The reference art has "Buy Now" and
 * "Learn More"; this platform sells nothing and has no product pages, so each
 * panel leads to the CATEGORY it shows — the slugs below are what
 * `src/seed/catalogue.data.js` produces through `slugify()`, not guesses — plus
 * one real second link each where there is a second place worth sending someone
 * (`web-ui-notes.md`: nothing that looks live and does nothing).
 *
 * 🔴 **The lead panel's second link is supplier search on purpose.**
 * `/search?type=supplier` is the ONLY way into supplier mode since the
 * Products|Suppliers toggle was removed from `/search`, and it lost its last
 * mobile entry point when the browse bar was hidden. This keeps it reachable.
 *
 * 🔴 **The subtitles describe the REAL listing fields.** Grade, packaging and
 * shelf life; size, fabric and colour; material, GSM and width — each one is an
 * attribute that category actually defines in `catalogue.data.js`. No prices, no
 * offers, no counts: the reference's "From ₹4,499" is the kind of line a buyer
 * acts on, and nothing here states anything the platform cannot back.
 *
 * 🔴 **RED OVERLAY** (owner, 2026-09-27: "image quality is not that much better
 * … make try red color overlay"). The source files are 740px wide against a
 * panel up to ~1310px, so they upscale and go soft; a brand wash hides that and
 * ties the block to the palette. The photograph still reads as texture and
 * shape underneath.
 *
 * 🔴 **The wash is /65, and EVERY WORD ON IT IS SOLID WHITE. Those two facts
 * are one decision.** The owner asked for a lighter wash; what bought the light
 * was not the alpha but the copy. With a dimmed subtitle (`white/80`) and
 * eyebrow (`white/70`), the dimmest word sets the floor and the wash could not
 * go below /80:
 *
 *   dimmed copy   /70 3.87 ✗   /75 4.36 ✗   /80 4.90 ✓   /85 5.46 ✓
 *   solid white   /60 4.44 ✗   /65 5.17 ✓   /70 6.04 ✓   /75 7.05 ✓
 *
 * Solid white let the wash drop twenty points — far more of the photograph — at
 * the SAME contrast. So if you ever dim the subtitle or the eyebrow again, the
 * wash has to go back up to /80 in the same edit.
 *
 * 🔴 **The shade itself is not a choice either.** `primary-800` fails at every
 * step up to /85 (4.48) and `primary-700` never passes 3.67, so a brighter brand
 * red is unavailable at any opacity. And with no overlay at all the copy
 * measures **1.00:1** — white text on a white sack, i.e. invisible.
 *
 * 🔴 **The veil went /65 → /40 by moving the darkening INTO the picture**
 * (owner, 2026-09-27: "more"). A flat veil could not go below /65 — /60 is
 * 4.44:1 — and the copy block is exactly as bright as the worst of the panel, so
 * there was no headroom to find there either. `brightness(.65) saturate(1.3)` on
 * the image supplies the same darkening while keeping the photograph's OWN
 * colours, which a red film flattens. Measured over all three files at 320–1920:
 * **5.06:1**, with ~9% more surviving texture than the flat /65 it replaced.
 *
 * ⚠️ Measured and REJECTED, so nobody re-tries them:
 *   · `mix-blend-multiply` — identical contrast at the same alpha but keeps LESS
 *     texture (0.016 vs 0.035), so it is strictly worse here;
 *   · a centred vignette — the copy fills ~55% of these short panels, leaving too
 *     little edge to lighten for the trade to pay;
 *   · lighter still (brightness .55 + /25) — 4.97:1 and more texture, but the
 *     veil is then too faint to read as brand red.
 *
 * The three numbers move together: brightness, saturate and the veil's alpha.
 * Change one and re-measure all of it. Re-measure if a photograph is replaced.
 *
 * ⚠️ **The source files are 740px wide.** That is fine for the two halves, but
 * the lead panel is up to ~1310px on a desktop, so it upscales about 1.8× and
 * goes soft. Raised with the owner — it wants a wider original.
 */
const PROMOS = [
  {
    id: 'agriculture',
    eyebrow: 'Grains, pulses & spices',
    title: 'Agriculture',
    subtitle: 'Listed by Indian exporters with grade, packaging size and shelf life on every product.',
    cta: { label: 'Browse agriculture', to: '/category/agriculture' },
    secondary: { label: 'Verified exporters', to: '/search?type=supplier' },
    image: '/promo-agriculture.avif',
  },
  {
    id: 'garments',
    eyebrow: 'Ready-made lines',
    title: 'Apparel & Garments',
    subtitle: 'Size, fabric, colour and gender on every listing.',
    cta: { label: 'Browse garments', to: '/category/apparel-garments' },
    secondary: null,
    image: '/promo-garments.avif',
  },
  {
    id: 'textiles',
    eyebrow: 'Fabric & yarn',
    title: 'Textiles',
    subtitle: 'Material, GSM and width, stated up front.',
    cta: { label: 'Browse textiles', to: '/category/textiles-fabrics-yarn' },
    secondary: { label: 'Ask AI instead', to: '/ai-search' },
    image: '/promo-textiles.avif',
  },
];

/** A hash stays on this page; a path is a route. Never a bare `#`. */
function PromoLink({ to, className, children }) {
  if (to.startsWith('#')) return <a href={to} className={className}>{children}</a>;
  return <Link to={to} className={className}>{children}</Link>;
}

function Panel({ promo, big = false }) {
  return (
    <div
      className={`relative isolate flex flex-col items-center justify-center overflow-hidden bg-primary-900 px-5 py-8 text-center sm:px-8 sm:py-10 ${
        big ? 'min-h-[240px] sm:min-h-[280px] lg:min-h-[300px]' : 'min-h-[210px] sm:min-h-[240px]'
      }`}
    >
      <img
        src={promo.image}
        alt=""
        loading="lazy"
        /* Decorative: the heading names the category, so the picture adds
           nothing a screen reader needs (`web-design.md`). */
        className="absolute inset-0 -z-10 h-full w-full object-cover brightness-[.65] saturate-[1.3]"
      />
      {/* The wash. Flat, not a gradient: a gradient's lightest stop is the one
          that decides legibility, so the whole thing would have to sit at the
          safe value anyway and the variation would buy nothing. `bg-primary-900`
          also sits on the element itself, so a browser that cannot decode AVIF
          still shows a red panel with readable copy rather than bare wash. */}
      <span className="absolute inset-0 -z-10 bg-primary-900/40" />

      <p className="text-[11px] font-bold uppercase tracking-wider text-white">{promo.eyebrow}</p>
      <h3
        className={`mt-1 text-balance font-extrabold leading-tight tracking-tight text-white ${
          big ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-xl sm:text-2xl'
        }`}
      >
        {promo.title}
      </h3>
      <p className="mt-2 max-w-xl text-pretty text-[13px] leading-relaxed text-white sm:text-sm">
        {promo.subtitle}
      </p>

      {/* 44px tall — `web-design.md`'s touch-target floor — including the text
          link, which is still something people tap. */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <PromoLink
          to={promo.cta.to}
          className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-primary-800 transition hover:bg-primary-50"
        >
          {promo.cta.label}
        </PromoLink>
        {promo.secondary && (
          <PromoLink
            to={promo.secondary.to}
            className="inline-flex h-11 items-center text-sm font-semibold text-white underline decoration-white/50 underline-offset-4 transition hover:decoration-white"
          >
            {promo.secondary.label}
          </PromoLink>
        )}
      </div>
    </div>
  );
}

export function PromoPanels() {
  const [lead, ...rest] = PROMOS;
  return (
    <section
      aria-label="Browse by sector"
      /* Back inside the page's own gutters (owner, 2026-09-27: "make margis frm
         left and right also"). The full-bleed version ran to both screen edges;
         this now lines up with every other section on the page. */
      className="w-full bg-surface-canvas px-4 py-4 sm:px-6 sm:py-6 lg:px-10 xl:px-16"
    >
      {/* The three panels still BUTT TOGETHER — a 4px hairline, no gaps — which
          is what the owner asked for earlier. Rounding and clipping the wrapper
          rather than each panel keeps that join sharp while the block as a whole
          gets the same corner as the rest of the page. `bg-white` is what shows
          through the hairlines. */}
      <div className="grid gap-1 overflow-hidden rounded-2xl bg-white">
        <Panel promo={lead} big />
        {/* One column on a phone; the halves sit side by side only once there is
            width for both headlines to breathe. */}
        <div className="grid gap-1 sm:grid-cols-2">
          {rest.map((p) => (
            <Panel key={p.id} promo={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
