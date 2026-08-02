import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext.jsx';
import { can } from '../auth/roleHome.js';
import {
  HomeIcon,
  UsersIcon,
  ShieldIcon,
  UserIcon,
  ListIcon,
  SettingsIcon,
  LogOutIcon,
} from '../components/ui/icons.jsx';

/**
 * Staff console shell per the admin mockups: NAVY (#1A2E8F) 260px sidebar with
 * the brand at its top and "SOON" chips on future areas, and a navy top bar
 * holding the signed-in staffer. Deliberately its own layout, not PortalLayout
 * (no entanglement) — but the same brand navy: the mockups keep one chrome
 * colour across every console.
 *
 * The sidebar renders ONLY what the staffer's server-supplied permissions can
 * open (superadmin sees all). Hiding is presentation — every endpoint
 * re-checks (CLAUDE.md #2/#5).
 */
const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', Icon: HomeIcon, soon: true },
  { to: '/admin/users', label: 'Users', Icon: UsersIcon, perms: ['user:read'] },
  {
    to: '/admin/verification',
    label: 'Verification',
    Icon: ShieldIcon,
    perms: ['organisation:read', 'buyer:approve', 'exporter:verify', 'kyc:view'],
  },
  { to: '/admin/employees', label: 'Employees', Icon: UserIcon, superadminOnly: true },
  { to: '/admin/audit', label: 'Audit log', Icon: ListIcon, soon: true },
  { to: '/admin/settings', label: 'Settings', Icon: SettingsIcon, soon: true },
];

const ROLE_LABELS = { superadmin: 'Super Admin', employee: 'Employee' };

export function AdminLayout({ children }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const items = NAV.filter((item) => {
    if (item.superadminOnly) return user?.role === 'superadmin';
    if (item.perms) return can(user, ...item.perms);
    return true; // "Soon" items stay visible — the console must not look empty
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin/staff', { replace: true });
  };

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-surface-subtle">
      {/* Sidebar — mockup: 260px navy, brand on top, SOON chips right-aligned */}
      <aside className="hidden w-[260px] shrink-0 flex-col bg-primary-800 text-white md:flex">
        <div className="flex h-[88px] items-center px-6">
          <span className="text-lg font-bold tracking-tight">MPX Global</span>
        </div>
        <nav aria-label="Admin" className="mt-4 flex-1 space-y-1 px-4">
          {items.map(({ to, label, Icon, soon }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-opacity ${
                  isActive
                    ? 'bg-white/15 font-semibold text-white'
                    : 'font-medium opacity-70 hover:opacity-100'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
              {soon && (
                <span className="ml-auto rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                  Soon
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mockup: navy, user block right */}
        <header className="flex h-[88px] items-center justify-between bg-primary-800 px-4 sm:justify-end sm:px-12">
          <span className="text-lg font-bold text-white md:hidden">MPX Global</span>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight text-white">{user?.name}</p>
              <p className="text-xs text-white/60">{ROLE_LABELS[user?.role] ?? user?.role}</p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
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

        {/* Mobile nav strip */}
        <nav aria-label="Admin sections" className="bg-primary-800 px-2 pb-2 md:hidden">
          <ul className="flex overflow-x-auto">
            {items.map(({ to, label, soon }) => (
              <li key={label} className="shrink-0">
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive ? 'bg-white/15 text-white' : 'text-white/70'
                    }`
                  }
                >
                  {label}
                  {soon && (
                    <span className="rounded bg-white/20 px-1 py-0.5 text-[9px] font-semibold uppercase">
                      Soon
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
