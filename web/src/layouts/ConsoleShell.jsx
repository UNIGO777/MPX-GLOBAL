import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { savedApi, savedKeys } from '../api/saved.js';
import { supportApi, supportKeys } from '../api/support.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useUnreadCount } from '../hooks/useUnreadCount.js';
import { ChevronRightIcon, GridIcon, LogOutIcon } from '../components/ui/icons.jsx';
import { Logo } from '../components/ui/Logo.jsx';

/**
 * THE dashboard shell — one design, used by the buyer, exporter AND admin
 * consoles (owner: "the dashboard design is standard everywhere"). Confirmed
 * identical in all three design files:
 *
 *   aside  w-[260px] · primary-800 · h-screen · 88px logo block · nav px-2 mt-4 space-y-1
 *   header h-[88px]  · primary-800 · justify-end (identity block only)
 *   main   flex-1 · canvas surface-subtle · rounded-tl-[32px] · inset shadow · scrolls
 *   wrap   max-w-[860px] · p-10
 *
 * The sidebar and the top bar are siblings (both primary-800), so they read as one bar
 * across the top with the wordmark at its left — that continuity is what makes
 * the curved canvas edge work. Do not put the logo in the header.
 *
 * 🔒 THE SHELL IS FIXED (owner, 2026-08-03). Sidebar width, bar height, curve,
 * canvas, padding and the content measure are identical on every screen in
 * every console — **only `children` changes**. Do not add a styling prop, a
 * per-console width or a one-off override here; if a screen needs a different
 * measure it caps its own content inside the wrap.
 *
 * `nav` items: { to, label, Icon, soon, disabled, dividerBefore }
 *   soon          → dimmed, non-interactive, SOON badge (design's disabled rows)
 *   disabled      → dimmed, non-interactive, NO badge (design's Settings row)
 *   dividerBefore → hairline rule + spacing above the row, closing the sidebar's
 *                   last group (owner, 2026-08-03 — the design used a bare 32px
 *                   gap; the rule makes the grouping explicit)
 * Both non-interactive kinds MUST have a row in docs/UiWebNotes.md.
 */
/**
 * Step 1b · tickets with a new support reply the company hasn't opened yet.
 * Polled gently — a reply also arrives by email, this is the in-portal cue.
 */
function SupportReplyBadge() {
  const count = useQuery({
    queryKey: supportKeys.myUnread,
    queryFn: supportApi.myUnread,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const n = count.data ?? 0;
  if (!count.isSuccess || n === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
      {n > 99 ? '99+' : n}
      <span className="sr-only"> new support {n === 1 ? 'reply' : 'replies'}</span>
    </span>
  );
}

const NAV_BASE =
  'flex items-center gap-3 whitespace-nowrap rounded-r-lg border-l-4 px-4 py-3 text-[15px] font-medium';

/** Live saved-count badge (M3 Phase 5, owner's 🧱 call — recommended IN).
 *  Buyer-only by construction: only BUYER_NAV sets `savedBadge`, and the
 *  /saved endpoint is buyer-only anyway, so no other role ever fetches it. */
function SavedCountBadge() {
  const count = useQuery({
    queryKey: savedKeys.list({ page: 1, pageSize: 1 }),
    queryFn: () => savedApi.list({ page: 1, pageSize: 1 }),
    staleTime: 60_000,
  });
  const total = count.data?.total ?? 0;
  if (!count.isSuccess || total === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
      {total > 99 ? '99+' : total}
    </span>
  );
}

/**
 * Unread CHAT THREADS (M4). Not messages — the server keeps no per-thread
 * message count, so this badge counts conversations with something unread and
 * a "3 new messages" number could only ever be invented.
 */
function UnreadCountBadge() {
  const count = useUnreadCount();
  if (count === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread conversations</span>
    </span>
  );
}

function NavRows({ nav }) {
  return nav.map(({ to, label, Icon, soon, disabled, dividerBefore, savedBadge, unreadBadge, supportBadge }) => {
    const row = (
      <li key={label}>
        {soon || disabled ? (
          <span
            aria-disabled="true"
            className={`${NAV_BASE} border-transparent cursor-not-allowed ${soon ? 'text-white/50' : 'text-white/70'}`}
          >
            {Icon && <Icon className="h-5 w-5 shrink-0" />}
            {label}
            {soon && (
              <span className="ml-auto rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Soon
              </span>
            )}
          </span>
        ) : (
          <NavLink
            to={to}
            end
            className={({ isActive }) =>
              `${NAV_BASE} transition-colors ${
                isActive
                  ? 'border-white bg-white/10 font-semibold text-white'
                  : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {Icon && <Icon className="h-5 w-5 shrink-0" />}
            {label}
            {savedBadge && <SavedCountBadge />}
            {unreadBadge && <UnreadCountBadge />}
            {supportBadge && <SupportReplyBadge />}
          </NavLink>
        )}
      </li>
    );
    // `!my` beats the list's `space-y-1` margin, so the rule keeps its own air.
    return dividerBefore
      ? [
          <li
            key={`${label}-divider`}
            aria-hidden="true"
            className="!mb-4 !mt-6 border-t border-white/15"
          />,
          row,
        ]
      : row;
  });
}

/**
 * Name · role · company · avatar · sign-out.
 *
 * Moved to the SIDEBAR FOOTER at lg+ (owner, 2026-08-17) — it used to sit in the
 * top bar. Below lg there is no sidebar, so the same block stays in the header:
 * dropping it there would leave a phone with no way to sign out.
 *
 * `align` flips the text side because the two placements read differently — in
 * a 260px column the avatar leads and the text runs left; in the top bar the
 * block is flush right, so the text is right-aligned against the avatar.
 */
function IdentityBlock({ user, identity, initials, logo, onSignOut, align = 'left' }) {
  const leading = align === 'left';
  return (
    // Tight gaps in the sidebar: a 260px column has ~150px for the text once
    // the avatar and the sign-out button take their share, and the company name
    // is the first thing to be truncated away.
    <div className={`flex items-center ${leading ? 'gap-2.5' : 'gap-4'}`}>
      {leading && <Avatar initials={initials} logo={logo} compact />}
      <div className={`min-w-0 ${leading ? 'flex-1' : 'text-right'}`}>
        <p className="truncate text-sm font-semibold leading-none text-white">{user?.name}</p>
        {identity && <p className="mt-1 truncate text-xs font-normal text-white/70">{identity}</p>}
      </div>
      {!leading && <Avatar initials={initials} logo={logo} />}
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
        className="shrink-0 rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOutIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

/**
 * The company's own icon in its portal, falling back to initials.
 *
 * It is the ORGANISATION's mark, not a personal photo — there is no user avatar
 * anywhere in this product, and uploading one is not a thing a person can do.
 */
function Avatar({ initials, logo, compact = false }) {
  const size = compact ? 'h-9 w-9 text-[13px]' : 'h-10 w-10 text-sm';
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        className={`shrink-0 rounded-full bg-white object-cover ring-1 ring-inset ring-white/25 ${size}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-600 font-bold text-white ${size}`}
    >
      {initials}
    </span>
  );
}

export function ConsoleShell({ nav, identity, logo, signOutTo = '/signin', children }) {
  // Keep the current page's tab visible in the mobile strip — deep pages
  // (Staff, Settings) sat off-screen to the right with no hint they were there.
  const stripRef = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const active = stripRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate(signOutTo, { replace: true });
  };

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    // 🔴 `fixed inset-0`, not `h-screen` (2026-08-10). With h-screen the console
    // was one 100vh block INSIDE the document — so anything that nudged the
    // body taller than the viewport (zoom artefacts, extensions, scrollbar
    // gutters) let the WHOLE console scroll away, sidebar included. Pinning it
    // to the viewport makes document scroll irrelevant: only `main` scrolls,
    // which is the entire design of this shell. Public pages are untouched —
    // they scroll the body on purpose.
    <div className="fixed inset-0 flex overflow-hidden bg-primary-800">
      {/* Sidebar — desktop only; below lg the nav becomes a strip under the bar */}
      <aside className="hidden w-[260px] shrink-0 flex-col bg-primary-800 text-white lg:flex">
        <div className="flex h-[88px] shrink-0 items-center px-8">
          <Logo size="lg" variant="white" />
        </div>
        <nav aria-label="Main" className="mt-4 flex-1 overflow-y-auto pr-2">
          <ul className="space-y-1">
            <NavRows nav={nav} />
          </ul>
        </nav>

        {/* Identity, pinned to the bottom with a rule above it (owner,
            2026-08-17). `nav` carries flex-1, so this needs no margin trick to
            sit at the foot of the column. */}
        <div className="shrink-0 border-t border-white/15 px-3 py-3.5">
          <IdentityBlock
            user={user}
            identity={identity}
            initials={initials}
            logo={logo}
            onSignOut={handleSignOut}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-primary-800">
        {/* Top bar — the wordmark below lg, where the sidebar is hidden. The
            identity block lives in the SIDEBAR FOOTER at lg+ and only appears
            here on small screens, which have no sidebar to put it in. */}
        {/* `lg:justify-end` matters: the wordmark is hidden at lg+, so without
            it the remaining group is the only child and drifts to the LEFT.
            Explore belongs where the identity block used to sit — top right. */}
        <header className="flex h-[88px] shrink-0 items-center justify-between gap-4 px-4 sm:px-8 lg:justify-end lg:px-12">
          <span className="lg:hidden">
            <Logo size="sm" variant="white" />
          </span>
          <div className="flex items-center gap-3">
            {/* Explore — the way back out to the public catalogue from inside a
                console. It fills the space the identity block left at lg+
                (owner, 2026-08-17); below lg the bar already carries the
                wordmark and the identity, so it would only crowd them. */}
            <Link
              to="/categories"
              className="group hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-800 lg:inline-flex"
            >
              <GridIcon className="h-4 w-4" aria-hidden="true" />
              Explore categories
              {/* The nudge on hover says "this leaves the console" without
                  spending a permanent second icon on saying it. */}
              <ChevronRightIcon
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Link>

            <div className="lg:hidden">
              <IdentityBlock
                user={user}
                identity={identity}
                initials={initials}
                logo={logo}
                onSignOut={handleSignOut}
                align="right"
              />
            </div>
          </div>
        </header>

        {/* Mobile nav strip. Swipeable, with no visible scrollbar (it read as a
            brown line on the brand red); a fade on the right edge is the "more
            this way" cue instead, and the current page's tab is scrolled into
            view so it is never off-screen. */}
        <div className="relative shrink-0 lg:hidden">
          <nav ref={stripRef} aria-label="Main" className="scrollbar-none overflow-x-auto px-2 pb-2">
          <ul className="flex gap-1">
            {nav.map(({ to, label, soon, disabled }) => (
              <li key={label} className="shrink-0">
                {soon || disabled ? (
                  <span
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/50"
                  >
                    {label}
                    {soon && (
                      <span className="rounded bg-white/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                        Soon
                      </span>
                    )}
                  </span>
                ) : (
                  <NavLink
                    to={to}
                    end
                    className={({ isActive }) =>
                      `flex items-center rounded-lg px-3 py-2 text-sm font-medium ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/70'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
          </nav>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-primary-800 to-transparent"
          />
        </div>

        {/* Canvas — the curved top-left edge is the shell's signature */}
        <main className="flex-1 overflow-y-auto rounded-tl-[32px] bg-surface-subtle shadow-[inset_10px_10px_30px_rgba(0,5,23,0.05)]">
          {/* One fixed wrap everywhere. A screen that needs a narrower measure
              caps its own content (the panels' cards sit at max-w-[860px]);
              wide admin tables use the full 1360. */}
          <div className="w-full max-w-[1360px] p-6 sm:p-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
