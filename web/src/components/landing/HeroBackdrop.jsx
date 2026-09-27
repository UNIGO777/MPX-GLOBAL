/**
 * The landing hero's ground — the owner's reference, reproduced exactly in this
 * project's red (owner, 2026-09-27: "exactly same design").
 *
 * Layers: a barely-visible grid, a soft red glow from the top, two large still
 * blurred blobs in opposite corners, and three small shapes drifting slowly
 * (two dots float up and down, a small square floats and turns). Positions,
 * sizes, opacities and timings are the reference's own.
 *
 * 🔴 Nothing else moves. Red circuit lines used to run across this band; the
 * owner had them removed ("remove them"). Do not add moving lines, extra
 * shapes or animated blobs — the reference has none.
 *
 * Decoration only: `aria-hidden` and `pointer-events-none`. The shapes stop
 * under `prefers-reduced-motion` (`web-design.md`).
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="bg-hero-grid absolute inset-0" />
      <div className="bg-hero-glow absolute inset-0" />

      <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primary-600/[0.04] blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary-600/[0.03] blur-3xl" />

      {/* Desktop only, as in the reference: on smaller screens they would sit
          on the text. */}
      <span className="absolute left-[8%] top-32 hidden h-3 w-3 animate-hero-float rounded-full bg-primary-600/20 motion-reduce:animate-none lg:block" />
      <span className="absolute right-[12%] top-48 hidden h-2 w-2 animate-hero-float-sm rounded-full bg-primary-600/15 motion-reduce:animate-none lg:block" />
      <span className="absolute bottom-32 left-[15%] hidden h-4 w-4 rotate-45 animate-hero-drift rounded-sm bg-primary-600/10 motion-reduce:animate-none lg:block" />
    </div>
  );
}
