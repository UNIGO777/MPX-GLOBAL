import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';
import { CategoryMegaMenu } from './CategoryMegaMenu.jsx';
import { MenuIcon, SearchIcon, SparkleIcon, XIcon } from '../ui/icons.jsx';
import { Logo } from '../ui/Logo.jsx';

/**
 * The public chrome's top bar. ONE header for every guest-visible page —
 * landing, category browse, product detail, supplier profile. Copying it per
 * page is how two headers end up differing by accident (web-design.md).
 *
 * 2026-09-27 redesign (owner: "super premium… modern… liked by investors"):
 * one slim frosted row. It sits clear over the page at the top and gains a
 * blur, a hairline and a soft shadow once the page scrolls. The landing's
 * second "browse" row is gone — its real destinations live here now:
 *
 *   · "Categories" keeps the desktop mega-menu (`CategoryMegaMenu`); phones get
 *     the plain link, as before.
 *   · "Suppliers" → `/suppliers` (the verified-supplier page, 2026-09-28; it links
 *     on to `/search?type=supplier` for the full list). Originally
 *     `/search?type=supplier`. 🔴 This is also the fix for the
 *     one real loss logged when the browse row was hidden on phones: supplier
 *     search had no entry point there. It is in the phone menu too.
 *   · "Goods" / "Services" were dropped: both pointed at `/categories?type=…`,
 *     which that page never reads, so they duplicated "Categories".
 *
 * Links sit in the bar from xl (1280px); below that they are in the menu, since
 * at 1024px four links + three actions wrapped onto two lines.
 *
 * Search: a compact field on 2xl+ that submits to `/search` ("/" focuses it);
 * below 2xl an icon that opens `/search` (in the menu on phones). A page can still replace the centre
 * with its own bar via `centerSlot` (the /search results page does).
 *
 * Anchors only work as bare `#hash` on `/`; anywhere else they carry the path
 * or they resolve against the current URL and do nothing.
 */
const NAV = [
  { to: '/categories', label: 'Categories', megaMenu: true },
  { to: '/suppliers', label: 'Suppliers' },
  { hash: '#how-it-works', label: 'How it works' },
  { to: '/ai-search', label: 'AI Search', ai: true },
];

const linkBase =
  'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium transition-colors';

export function PublicHeader({ centerSlot = null, current }) {
  const { user, restoring } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  // A signed-in visitor must not be sold a signup — every CTA collapses to one
  // "continue where you left off" link.
  const home = user ? roleHome(user) : null;
  const onLanding = pathname === '/';
  const href = (hash) => (onLanding ? hash : `/${hash}`);

  // The glass only appears once there is something under it to blur.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // "/" jumps to the search field, unless the visitor is already typing.
  useEffect(() => {
    if (centerSlot) return undefined;
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (!searchRef.current || searchRef.current.offsetParent === null) return;
      e.preventDefault();
      searchRef.current.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [centerSlot]);

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

  const onSearch = (e) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  };

  const linkClasses = (active) =>
    `${linkBase} ${active ? 'bg-ink-900 text-white shadow-[0_2px_8px_-2px_rgb(0_5_23/0.4)]' : 'text-ink-700 hover:bg-ink-900/[0.06] hover:text-ink-900'}`;

  const glass = scrolled || menuOpen;

  return (
    <header
      ref={rootRef}
      className={`sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none ${
        glass
          ? 'border-b border-ink-200/70 bg-white/80 shadow-[0_8px_30px_-12px_rgb(0_5_23/0.12)] backdrop-blur-xl backdrop-saturate-150'
          : 'border-b border-transparent bg-white/0'
      }`}
    >
      <div className="flex h-16 w-full items-center gap-4 px-4 max-[359px]:gap-2 sm:px-6 lg:h-[72px] lg:px-10 xl:px-16">
        <div className="flex flex-1 items-center">
          <Link to="/" aria-label="MPX Global — home" className="shrink-0">
            <Logo size="md" />
          </Link>
        </div>

        {centerSlot ? (
          // A page's own bar (the /search results page) replaces the centre on lg+.
          <div className="hidden min-w-0 flex-1 items-center justify-center px-6 lg:flex">{centerSlot}</div>
        ) : (
          /* The links sit in ONE floating pill, centred between the logo and the
             actions (owner's mockup, 2026-09-29). 🔴 The pill must NOT be
             `relative`: the category mega-menu panel is `absolute inset-x-0
             top-full` and resolves against the sticky header, so giving it a
             nearer positioned ancestor would shrink the panel to the pill's
             width — see the note at the top of `CategoryMegaMenu`. 🔴 The same
             goes for `backdrop-blur` / any `backdrop-filter`, `transform` or
             `filter`: each makes the pill the panel's containing block too
             (2026-09-29 — a `backdrop-blur-sm` here squeezed the menu to the
             pill's ~465px and cut off the sub-category column). */
          <nav aria-label="Main" className="hidden shrink-0 items-center justify-center px-4 xl:flex">
            <div className="flex items-center gap-1 rounded-full border border-ink-900/[0.06] bg-white/95 p-1.5 shadow-[0_8px_24px_-14px_rgb(0_5_23/0.35)]">
            {NAV.map((item) =>
              item.megaMenu ? (
                <CategoryMegaMenu key={item.label} current={current} linkClasses={linkClasses} />
              ) : item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={current === item.label ? 'page' : undefined}
                  className={linkClasses(current === item.label)}
                >
                  {item.ai && <SparkleIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />}
                  {item.label}
                </Link>
              ) : (
                <a key={item.label} href={href(item.hash)} className={linkClasses(false)}>
                  {item.label}
                </a>
              ),
            )}
            </div>
          </nav>
        )}

        <div className="ml-auto flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
          {!centerSlot && (
            <>
              {/* Compact search (2xl+ — at 1280px it squeezed the actions). A real form: it submits to /search.
                  Not on the landing page (2026-09-29 design review): the hero's AI
                  field is the search there, and two search boxes on one screen
                  split the visitor's attention. The landing keeps the icon. */}
              <form role="search" onSubmit={onSearch} className={`relative hidden ${onLanding ? '' : '2xl:block'}`}>
                <label className="sr-only" htmlFor="header-q">
                  Search products and suppliers
                </label>
                <SearchIcon
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  id="header-q"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className="h-10 w-56 rounded-full border border-ink-200 bg-white/70 pl-10 pr-10 text-[14px] text-ink-900 outline-none transition-[width,border-color,box-shadow] duration-200 placeholder:text-ink-500 hover:border-ink-300 focus:w-80 focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 motion-reduce:transition-none"
                />
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded border border-ink-200 bg-white px-1 font-sans text-[11px] font-medium text-ink-500"
                >
                  /
                </kbd>
              </form>
              <Link
                to="/search"
                aria-label="Search"
                className={`hidden h-10 w-10 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-ink-100 sm:flex ${onLanding ? '' : '2xl:hidden'}`}
              >
                <SearchIcon className="h-5 w-5" aria-hidden="true" />
              </Link>
            </>
          )}

          {restoring ? (
            // Session still being restored: hold the space, show neither the
            // guest CTAs nor the dashboard link (no flash either way on reload).
            <span aria-hidden="true" className="invisible inline-flex h-10 items-center px-5 text-sm">Log in Start selling</span>
          ) : home ? (
            <Link
              to={home}
              className="inline-flex h-10 items-center justify-center rounded-full bg-ink-900 px-4 text-sm font-semibold text-white transition hover:bg-ink-800 sm:px-5"
            >
              <span className="sm:hidden">Dashboard</span>
              <span className="hidden sm:inline">Go to your dashboard</span>
            </Link>
          ) : (
            <>
              {/* 🔴 THREE guest actions, each label matching where it goes:
                  buyer signup, login, EXPORTER signup. Login stays visible at
                  every width (owner asked for it); "Create account" (buyer)
                  lives in the menu below lg. "Start selling" is the highlighted
                  one (owner, 2026-09-27) — dark, not red, so it never competes
                  with the hero's red "Get matched", and it keeps the sweep. */}
              <Link
                to="/signup/buyer"
                className="hidden h-10 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900 lg:inline-flex"
              >
                Create account
              </Link>
              <Link
                to="/signin"
                className="inline-flex h-10 items-center whitespace-nowrap rounded-full px-2.5 text-[14px] font-semibold text-ink-900 transition-colors hover:bg-ink-100/70 max-[359px]:px-2 sm:px-3.5"
              >
                Log in
              </Link>
              {/* `relative` + `overflow-hidden` are what the sweep needs — see
                  `.mpx-shine` in index.css. */}
              <Link
                to="/signup/exporter"
                className="mpx-shine group relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-ink-900 px-4 max-[359px]:px-3 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_6px_16px_-8px_rgb(0_5_23/0.5)] transition hover:bg-ink-800 sm:px-5"
              >
                Start selling
              </Link>
            </>
          )}

          {/* Below xl the links live in the menu — this is their door. */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-ink-100 xl:hidden"
          >
            {menuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* <lg: the slot page's bar gets its own row INSIDE the sticky header
          (owner: "in phone view also fix inside nav"). */}
      {centerSlot && <div className="px-4 pb-3 sm:px-6 lg:hidden">{centerSlot}</div>}

      {menuOpen && (
        <nav id="public-mobile-nav" aria-label="Main" className="border-t border-ink-200/70 px-4 pb-5 pt-2 sm:px-6 lg:px-10 xl:hidden">
          <ul>
            {/* Phones: the header has no room for the search icon, so it is here. */}
            {!centerSlot && (
              <li className="sm:hidden">
                <Link
                  to="/search"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[52px] items-center gap-2 border-b border-ink-100 text-[16px] font-medium text-ink-900 hover:text-primary-700"
                >
                  <SearchIcon className="h-4 w-4 text-ink-500" aria-hidden="true" />
                  Search
                </Link>
              </li>
            )}
            {NAV.map((item) => (
              <li key={item.label}>
                {item.to ? (
                  <Link
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    aria-current={current === item.label ? 'page' : undefined}
                    className={`flex min-h-[52px] items-center gap-2 border-b border-ink-100 text-[16px] font-medium ${
                      current === item.label ? 'text-primary-700' : 'text-ink-900 hover:text-primary-700'
                    }`}
                  >
                    {item.ai && <SparkleIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />}
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={href(item.hash)}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[52px] items-center border-b border-ink-100 text-[16px] font-medium text-ink-900 hover:text-primary-700"
                  >
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          {/* Below lg the header has no room for buyer signup — this is its door. */}
          {!home && !restoring && (
            <Link
              to="/signup/buyer"
              onClick={() => setMenuOpen(false)}
              className="mt-4 flex h-12 items-center justify-center rounded-full border border-ink-300 text-[15px] font-semibold text-ink-900 transition-colors hover:border-ink-900 lg:hidden"
            >
              Create a buyer account
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
