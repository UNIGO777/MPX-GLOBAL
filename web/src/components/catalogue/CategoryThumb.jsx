import { NoImagePanel } from './NoImagePanel.jsx';

/**
 * One category/sub-category thumbnail: the real photo, or the standard
 * neutral monogram fallback. Extracted 2026-08-11 so the category listing
 * rail and the navbar mega-menu (both render the same tree data) can't
 * quietly diverge on how a missing photo renders — same reasoning as every
 * other shared-copy extraction in this project.
 *
 * `size` is a raw Tailwind size string (e.g. `'h-9 w-9'`), not an aspect
 * ratio — a fixed square box, which is what a thumbnail badge needs.
 */
export function CategoryThumb({ image, label, size = 'h-12 w-12' }) {
  return image ? (
    <img
      src={image}
      alt=""
      loading="lazy"
      width={48}
      height={48}
      className={`${size} shrink-0 rounded-lg object-cover`}
    />
  ) : (
    <NoImagePanel label={label} monogram ratio={size} className="shrink-0 rounded-lg" />
  );
}
