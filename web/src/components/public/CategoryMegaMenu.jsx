import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { CategoryThumb } from '../catalogue/CategoryThumb.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';

/**
 * Navbar "Categories" hover mega-menu (design prompt:
 * `design-plans/m2/web-navbar-category-megamenu-prompt.md`). Desktop (`lg+`)
 * only — the mobile nav panel keeps its plain link to `/categories`
 * unchanged, per that prompt's explicit instruction not to build a touch
 * equivalent of this interaction.
 *
 * Two-column, always-visible layout (chosen over an inline cascading
 * flyout): all 40 tops on the left, the active one's subs on the right,
 * defaulting to the first top so the right column is never empty on open.
 * Real `<Link>`s throughout — nothing here is click-to-reveal-only, so nav
 * and SEO crawlability are unaffected regardless of hover/focus state.
 *
 * Reuses the exact same `catalogueKeys.tree` query the `/categories` and
 * `/category/:slug` pages already run — react-query shares the cache, so a
 * visitor who already loaded either page gets an instant-open menu; a first
 * hover on any OTHER page fetches it once and shows the skeleton below.
 *
 * 🔴 Panel positioning: `absolute` + `top-full`, deliberately NOT `fixed` with
 * a hardcoded offset. First cut used `fixed top-16` assuming the header sits
 * at y=0 — wrong the moment a page renders anything above it (the landing
 * page's promo banner does), which put the panel ON TOP of the header instead
 * of below it (caught visually, not from reading the markup). This root has
 * NO `position` of its own on purpose, so the panel's containing block is the
 * `<header>` itself (the nearest actually-positioned ancestor, via its own
 * `sticky`) — the panel always sits exactly at the header's bottom edge, and
 * tracks it correctly once the header sticks to the viewport on scroll too.
 * Don't add `position: relative` back to this root — that would shrink the
 * containing block down to this small trigger link and break it again.
 *
 * Accessibility (prompt §3, not optional): hover OR focus-within opens the
 * panel, so Tab reaches every tile with no mouse — `onFocus` bubbles from any
 * descendant link, `onBlur` only closes when focus truly leaves the whole
 * component (checked via `relatedTarget`). Escape closes and returns focus
 * to the trigger. A short close-delay (not instant) survives the diagonal
 * mouse move from the trigger into the panel — the single most common
 * mega-menu bug the prompt calls out.
 */
const CLOSE_DELAY_MS = 200;

export function CategoryMegaMenu({ current, linkClasses }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const closeTimer = useRef(null);
  const rootRef = useRef(null);

  const { data } = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });
  const tops = data ?? [];
  const activeTop = tops.find((t) => t.id === activeId) ?? tops[0] ?? null;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);

  // A route change is the real "did we navigate" signal — PublicHeader (and
  // this menu) never unmounts between pages, so without this the panel would
  // still be sitting open over whatever page a tile click landed on.
  //
  // Adjusted DURING RENDER rather than in an effect: React re-renders
  // immediately with the corrected value, so the panel is never painted open
  // over the new page for a frame before closing itself.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => cancelClose, [cancelClose]);

  const close = () => {
    cancelClose();
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      close();
      rootRef.current?.querySelector('a')?.focus();
    }
  };

  const onBlur = (e) => {
    if (!rootRef.current?.contains(e.relatedTarget)) {
      close();
    }
  };

  return (
    <div
      ref={rootRef}
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onFocus={openNow}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <Link
        to="/categories"
        aria-current={current === 'Categories' ? 'page' : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        className={linkClasses(current === 'Categories')}
      >
        Categories
      </Link>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 border-t border-surface-border bg-white shadow-lift">
          <div className="mx-auto flex max-w-6xl gap-6 px-6 py-6">
            {/* Left: every top category */}
            <ul className="max-h-[60vh] w-72 shrink-0 space-y-0.5 overflow-y-auto">
              {tops.length === 0
                ? Array.from({ length: 8 }, (_, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <Skeleton className="h-4 w-32" />
                    </li>
                  ))
                : tops.map((top) => {
                    const isActive = activeTop?.id === top.id;
                    return (
                      <li key={top.id}>
                        <Link
                          to={`/category/${top.slug}`}
                          onMouseEnter={() => setActiveId(top.id)}
                          onFocus={() => setActiveId(top.id)}
                          onClick={close}
                          className={`relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                            isActive ? 'bg-primary-50' : 'hover:bg-surface-subtle'
                          }`}
                        >
                          {isActive && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary-600"
                            />
                          )}
                          <CategoryThumb image={top.image} label={top.name} size="h-9 w-9" />
                          <span
                            className={`truncate text-sm ${
                              isActive ? 'font-semibold text-primary-800' : 'font-medium text-ink-800'
                            }`}
                          >
                            {top.name}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
            </ul>

            {/* Right: the active top's real sub-categories */}
            <div className="min-w-0 flex-1 border-l border-surface-border pl-6">
              {activeTop ? (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                    {activeTop.name}
                  </p>
                  {(activeTop.subs?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted">No sub-categories yet.</p>
                  ) : (
                    <ul className="grid max-h-[54vh] grid-cols-3 gap-x-6 gap-y-1 overflow-y-auto">
                      {activeTop.subs.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            to={`/category/${sub.slug}`}
                            onClick={close}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-surface-subtle hover:text-primary-700"
                          >
                            <CategoryThumb image={sub.image} label={sub.name} size="h-6 w-6" />
                            <span className="truncate">{sub.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
