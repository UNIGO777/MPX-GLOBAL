import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext.jsx';
import { LogOutIcon } from '../components/ui/icons.jsx';

/**
 * Shared shell for the buyer and exporter panels (the admin console gets its
 * own layout — no entanglement). Navy sidebar + top bar per the buyer/exporter
 * mockups. `nav` is [{to, label, Icon, soon}] — a `soon` item renders disabled
 * with a chip and MUST have a row in docs/UiWebNotes.md (strict rule).
 *
 * Header identity: the person's name + role from auth state. The company name
 * is deliberately absent when unknown — a buyer's own Organisation has no read
 * endpoint until A22 (plan §7.4), and we don't stub one. `subline` lets a panel
 * pass one when it legitimately has it (exporter home fetches its public
 * profile).
 */
const ROLE_LABELS = { buyer: 'Buyer', exporter: 'Exporter' };

export function PortalLayout({ nav, subline, children }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const identity = [ROLE_LABELS[user?.role] ?? user?.role, subline].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between bg-primary-800 px-4 sm:px-6">
        <span className="text-lg font-bold text-white">MPX Global</span>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-white">{user?.name}</p>
            <p className="text-xs text-white/60">{identity}</p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
          >
            {initials}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="md:flex">
        {/* Sidebar — collapses to a horizontal strip on small screens */}
        <nav
          aria-label="Main"
          className="w-full shrink-0 bg-primary-800 md:min-h-[calc(100vh-3.5rem)] md:w-56"
        >
          <ul className="flex overflow-x-auto px-2 py-2 md:flex-col md:space-y-1 md:py-4">
            {nav.map(({ to, label, Icon, soon }) => (
              <li key={label} className="shrink-0 md:shrink">
                {soon ? (
                  <span
                    aria-disabled="true"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/40"
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {label}
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Soon
                    </span>
                  </span>
                ) : (
                  <NavLink
                    to={to}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
