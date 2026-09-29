import { useEffect, useRef, useState } from 'react';

/**
 * The MPX Global brand film as a FRAMED WINDOW — one piece of the "Why source
 * from India" picture, laid over the handshake photo (owner, 2026-09-28: "I
 * want this video to look like a part of why source from India", after a
 * full-width panel and a separate dark band were both rejected). The section
 * places it; this component is only the window.
 *
 * Weight (the source was a 232 MB, 1080p, 2-minute file):
 *   · `mpx-film-preview.mp4` — 24 s from 0:36 (the film opens on a pale logo
 *     card; this stretch is factories and "Ready to trade"), 960px, NO audio,
 *     ~1.1 MB. Plays
 *     muted on a loop, mounted only once the window is near the viewport.
 *   · `mpx-film.mp4` — the whole film, 720p with sound, ~16.5 MB. Mounted only
 *     when someone presses play, so nothing of it downloads before that.
 *   · `mpx-film-poster.jpg` — the "Ready to trade" frame at 0:41, ~65 KB.
 *
 * 🔴 Reduced motion: the preview never autoplays; the poster stands in, and the
 * film still plays on request (the visitor asked for it).
 */
export function MpxFilm({ className = '' }) {
  const boxRef = useRef(null);
  const filmRef = useRef(null);
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // No IntersectionObserver (very old browser): mount the preview straight away.
  const [near, setNear] = useState(() => !still && typeof IntersectionObserver === 'undefined');
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || still || near) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [still, near]);

  // Once the full film is mounted, start it and hand it keyboard focus so its
  // own controls are right there.
  useEffect(() => {
    if (!playing) return;
    const v = filmRef.current;
    v?.focus();
    v?.play().catch(() => {
      // Playing with sound can still be refused by a browser policy; the
      // native controls are visible, so the visitor can press play there.
    });
  }, [playing]);

  return (
    <figure ref={boxRef} className={`relative aspect-video overflow-hidden rounded-2xl bg-ink-900 sm:rounded-3xl ${className}`}>
      {playing ? (
        <video
          ref={filmRef}
          src="/mpx-film.mp4"
          poster="/mpx-film-poster.jpg"
          controls
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
      ) : (
        <>
          {near ? (
            <video
              src="/mpx-film-preview.mp4"
              poster="/mpx-film-poster.jpg"
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <img
              src="/mpx-film-poster.jpg"
              alt=""
              loading="lazy"
              width={1280}
              height={720}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink-900/55 via-transparent to-ink-900/10" />

          {/* The whole window is the play control. */}
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="Play the MPX Global film, 2 minutes"
            className="group absolute inset-0 focus-visible:outline-none"
          >
            <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary-600 shadow-lift ring-[6px] ring-white/25 transition-transform duration-300 group-hover:scale-110 group-focus-visible:ring-white/60 motion-reduce:transition-none sm:h-14 sm:w-14">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l10.5-6.5z" />
              </svg>
            </span>
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md sm:bottom-4 sm:left-4 sm:text-[12px]">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-primary-400 motion-reduce:animate-none" />
              {/* The button's own aria-label still says "2 minutes", so the
                  runtime is not lost to anyone who cannot see this badge. */}
              <span className="uppercase tracking-[0.08em]">Introducing MPX Global</span>
            </span>
          </button>
        </>
      )}
    </figure>
  );
}
