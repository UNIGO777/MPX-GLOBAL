import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';
import { MenuIcon, XIcon } from '../ui/icons.jsx';
import { Logo } from '../ui/Logo.jsx';

/**
 * The public chrome's top bar. ONE header for every guest-visible page —
 * landing, category browse, product detail, supplier profile. Copying it per
 * page is how two headers end up differing by accident (web-design.md).
 *
 * Nav is MIXED on purpose (2026-08-11): "Categories" is a REAL route — the
 * browse page exists, so sending visitors to a landing anchor undersold it —
 * while the marketing sections stay landing anchors. Anchors only work as bare
 * `#hash` on `/`; anywhere else they carry the path or they resolve against
 * the current URL and do nothing.
 */
const NAV = [
  { to: '/categories', label: 'Categories' },
  { hash: '#how-it-works', label: 'How it Works' },
  { hash: '#platform', label: 'Platform' },
  { hash: '#faq', label: 'FAQ' },
];

const pill =
  'inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors';

export function PublicHeader({ current }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  // A signed-in visitor must not be sold a signup — every CTA collapses to one
  // "continue where you left off" link.
  const home = user ? roleHome(user) : null;
  const onLanding = pathname === '/';
  const href = (hash) => (onLanding ? hash : `/${hash}`);

  // The open panel closes like any dropdown should: Esc, or a click/tap
  // anywhere outside the header.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    const onOutside = (e) => {
      if (!rootRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [menuOpen]);

  const linkClasses = (active) =>
    active
      ? 'border-b-2 border-primary-600 pb-0.5 text-sm font-semibold text-primary-700'
      : 'text-sm text-ink-600 hover:text-primary-700';

  return (
    <header ref={rootRef} className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="MPX Global — home">
          <Logo size="md" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {NAV.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                aria-current={current === item.label ? 'page' : undefined}
                className={linkClasses(current === item.label)}
              >
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={href(item.hash)} className={linkClasses(false)}>
                {item.label}
              </a>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Logo + two actions + burger overflows a 320–375px bar, so below sm
              the label shortens and "Sign In" moves into the menu panel. */}
          {home ? (
            <Link to={home} className={`${pill} bg-ink-900 px-4 py-2 text-white hover:bg-primary-800 sm:px-5`}>
              <span className="sm:hidden">Dashboard</span>
              <span className="hidden sm:inline">Go to your dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                to="/signin"
                className="hidden text-sm font-semibold text-ink-600 hover:text-primary-700 sm:block"
              >
                Sign In
              </Link>
              <Link to="/signup/buyer" className={`${pill} bg-ink-900 px-4 py-2 text-white hover:bg-primary-800 sm:px-5`}>
                Get Started
              </Link>
            </>
          )}
          {/* Below lg the nav has nowhere to go — this is its only door. */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 hover:bg-surface-subtle lg:hidden"
          >
            {menuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="public-mobile-nav"
          aria-label="Main"
          className="border-t border-surface-border bg-white px-4 pb-4 shadow-lift lg:hidden"
        >
          {NAV.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                aria-current={current === item.label ? 'page' : undefined}
                className={`flex min-h-[48px] items-center border-b border-surface-border/60 text-[15px] font-medium last:border-0 ${
                  current === item.label ? 'text-primary-700' : 'text-ink-700 hover:text-primary-700'
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={href(item.hash)}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[48px] items-center border-b border-surface-border/60 text-[15px] font-medium text-ink-700 last:border-0 hover:text-primary-700"
              >
                {item.label}
              </a>
            ),
          )}
          {/* Only below sm, where the header drops "Sign In". */}
          {!home && (
            <Link
              to="/signin"
              onClick={() => setMenuOpen(false)}
              className="mt-3 flex min-h-[44px] items-center justify-center rounded-full border border-ink-900 text-sm font-semibold text-ink-900 sm:hidden"
            >
              Sign In
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
