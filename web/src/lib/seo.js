import { useEffect } from 'react';

/**
 * The two head tags every public screen owes (m3-seo.md §2 and §4), as hooks
 * so each page states its intent in one line instead of hand-rolling
 * `document.head` churn — which is exactly how four screens ended up with no
 * canonical at all (found by the M3 Phase 6 sweep, 2026-08-16).
 *
 * SPA caveat, unchanged: these run client-side. SSR/prerender is deferred
 * (m3-seo §8); emitting them correctly now is what keeps that migration cheap.
 */

/**
 * `<link rel="canonical">` → the absolute, CLEAN URL for this entity.
 *
 * 🔴 Pass the clean path only — never `location.search`. A filtered or paged
 * view canonicalises to its base URL, which is the whole point of the tag.
 * Pass `null` while the entity is still loading; nothing is emitted until
 * there is a real URL to point at.
 */
export function useCanonical(path) {
  useEffect(() => {
    if (!path) return undefined;
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = `${window.location.origin}${path}`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [path]);
}

/**
 * `<meta name="robots" content="noindex,follow">`.
 *
 * `follow` always: a page can be un-indexable while its outbound links still
 * carry crawlers on to the pages that ARE indexable (search results → product
 * pages). Pass `active=false` for a view that is only conditionally
 * unindexable, e.g. a category page with filters applied.
 */
export function useNoIndex(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,follow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [active]);
}
