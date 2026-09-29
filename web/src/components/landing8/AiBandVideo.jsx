import { useEffect, useRef, useState } from 'react';

/**
 * The looping clip behind the AI band (owner, 2026-09-27).
 *
 * 🔴 **Two files, chosen by screen width** (owner, 2026-09-28: the animation
 * "only visible in big screen — fix"). Both are the first 15 s of the owner's
 * original, with the silent audio track removed:
 *   · `ai-band.mp4` (lg+) — 960×540, ~0.9MB (was the 45 s original, 7.7MB);
 *   · `ai-band-mobile.mp4` — 640px, 24fps, ~0.3MB.
 * The 7.7MB original is not in the repo; re-encode from it if the clip changes.
 *
 * 🔴 **Nothing downloads until the band is near the screen** (owner asked how
 * heavy this is at launch). An IntersectionObserver mounts the video when the
 * band comes within ~300px of the viewport, and pauses it whenever it is off
 * screen, so a visitor who never scrolls this far pays nothing and a scrolled-
 * past clip does not keep burning CPU.
 * The choice is made in JS at mount, not with CSS: a hidden `<video>` with
 * `autoplay` still downloads, so both would be fetched.
 *
 * 🔴 **Reduced motion gets the still, not nothing.** CSS cannot stop a video,
 * so under `prefers-reduced-motion` no `<video>` mounts — the poster frame is
 * shown as an image instead, with the same scrim (`web-design.md`).
 *
 * 🔴 **`muted` + `playsInline` are REQUIRED, not stylistic.** Without `muted`
 * every browser refuses to autoplay, and without `playsInline` iOS takes the
 * video fullscreen on play. The owner asked for no sound in any case.
 *
 * 🔴 **The scrim is what makes the copy readable — do not delete it.** Measured
 * against a PURE WHITE frame, which this clip really produces (light streaks
 * that reach 1.0 and sweep the left, where the copy sits):
 *
 *   no scrim  1.00:1 ✗   ink-900/30  2.07:1 ✗   ink-900/50  3.83:1 ✗
 *   ink-900/55  4.56:1 ✓   ink-900/60  5.47:1 ✓   ink-900/80 11.84:1 ✓
 *
 * lg+: /80 where the copy is, /30 on the right where only the white button
 * sits. Below lg the copy spans the full width, so the lightest stop there is
 * /55 — never below the 4.5:1 line anywhere text can land.
 *
 * 🔴 Every stop is a MULTIPLE OF FIVE. Tailwind's opacity scale goes in fives
 * and anything else compiles to nothing — that bug shipped a fully transparent
 * overlay here once already.
 */
export function AiBandVideo() {
  // null until mounted AND near the viewport — then 'full' | 'mobile' | 'still'.
  const [mode, setMode] = useState(null);
  const [near, setNear] = useState(false);
  const anchorRef = useRef(null);
  const videoRef = useRef(null);

  // Which file (or the still) suits this screen and motion preference.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const calm = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const sync = () => setMode(!calm.matches ? 'still' : wide.matches ? 'full' : 'mobile');
    sync();
    wide.addEventListener('change', sync);
    calm.addEventListener('change', sync);
    return () => {
      wide.removeEventListener('change', sync);
      calm.removeEventListener('change', sync);
    };
  }, []);

  // Mount once the band is close; after that, play only while it is visible.
  useEffect(() => {
    const el = anchorRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
        const v = videoRef.current;
        if (!v) return;
        if (entry.isIntersecting) {
          // play() rejects if the browser blocks autoplay; the poster stays up.
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ready = mode && near;

  return (
    <>
      {/* The observer's target: fills the band, invisible, never interactive. */}
      <span ref={anchorRef} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-30" />
      {ready &&
        (mode === 'still' ? (
          <img
            src="/ai-band-poster.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            // `key` so a resize across lg swaps the source instead of keeping the old one.
            key={mode}
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            src={mode === 'full' ? '/ai-band.mp4' : '/ai-band-mobile.mp4'}
            poster="/ai-band-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            /* Decoration: every word in the band is real DOM above it, and it is
               not focusable, so a keyboard never lands on a control with no purpose. */
            aria-hidden="true"
            tabIndex={-1}
          />
        ))}
      {ready && (
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-900/80 via-ink-900/65 to-ink-900/55 lg:via-ink-900/60 lg:to-ink-900/30" />
      )}
    </>
  );
}
