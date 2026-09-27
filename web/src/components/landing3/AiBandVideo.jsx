/*
 * ⚠️ FROZEN COPY for the `/landing-page-3` snapshot. The live version is
 * `src/components/landing/` — change that one. Editing this file defeats the
 * snapshot. Delete with the route.
 */
import { useEffect, useState } from 'react';

/**
 * The looping clip behind the AI band (owner, 2026-09-27).
 *
 * 🔴 **It is NOT rendered below `lg`, and that is a data decision.** The file is
 * **7.7MB**. Shipping it to every phone visitor to tint one strip is not a
 * trade worth making, so a narrow screen keeps the solid band and downloads
 * nothing. `display: none` would not be enough — a `<video>` with `autoplay`
 * still fetches — which is why this is a mount check rather than a CSS class.
 *
 * 🔴 **It does not play under `prefers-reduced-motion`.** CSS cannot stop a
 * video, so the same check covers it: with reduced motion the element never
 * mounts and the band is simply solid (`web-design.md`).
 *
 * 🔴 **`muted` + `playsInline` are REQUIRED, not stylistic.** Without `muted`
 * every browser refuses to autoplay, and without `playsInline` iOS takes the
 * video fullscreen on play. The owner asked for no sound in any case.
 *
 * ⚠️ `poster` is a still pulled from the clip itself, so the band shows its
 * artwork immediately instead of flashing empty while 7.7MB arrives.
 *
 * 🔴 **The scrim ships WITH the video, and both together or neither.** It used
 * to be a red wash on the section; the owner asked for the red gone
 * (2026-09-27) because it flattened the clip's own purples and blues. It is now
 * neutral ink — the clip keeps its colours — and it lives here rather than on
 * the section so that a phone, which mounts no video, is not left with a dark
 * wash over a plain red band.
 *
 * 🔴 **It cannot simply be deleted.** Measured against a PURE WHITE frame, which
 * this clip really does produce — it is made of light streaks that reach 1.0 and
 * they move, and the brightest of them sweep the LEFT of the frame, exactly
 * where the copy sits:
 *
 *   no scrim  1.00:1 ✗   ink-900/30  2.07:1 ✗   ink-900/50  3.83:1 ✗
 *   ink-900/55  4.56:1 ✓   ink-900/60  5.47:1 ✓   ink-900/80 11.84:1 ✓
 *
 * So the gradient is /80 where the copy is and /30 on the right, where only the
 * white button sits and the clip can be seen almost bare.
 *
 * 🔴 Every stop is a MULTIPLE OF FIVE. Tailwind's opacity scale goes in fives
 * and anything else compiles to nothing — that bug shipped a fully transparent
 * overlay here once already (94/84/48), and twice more elsewhere on this page.
 */
export function AiBandVideo() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const calm = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const sync = () => setShow(wide.matches && calm.matches);
    sync();
    wide.addEventListener('change', sync);
    calm.addEventListener('change', sync);
    return () => {
      wide.removeEventListener('change', sync);
      calm.removeEventListener('change', sync);
    };
  }, []);

  if (!show) return null;

  return (
    <>
      <video
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        src="/ai-band.mp4"
        poster="/ai-band-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        /* Decoration: every word in the band is real DOM above it, and it is not
           focusable, so a keyboard never lands on a control with no purpose. */
        aria-hidden="true"
        tabIndex={-1}
      />
      <span className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-900/80 via-ink-900/60 to-ink-900/30" />
    </>
  );
}
