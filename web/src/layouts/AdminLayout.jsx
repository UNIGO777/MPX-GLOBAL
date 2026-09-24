import { ConsoleShell } from './ConsoleShell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { cp } from '../lib/consolePath.js';
import { can } from '../auth/roleHome.js';
import { AlertIcon, BoxIcon, BuildingIcon, ChartIcon, ChatIcon, HandshakeIcon, HelpIcon, HomeIcon, ImageIcon, KeyIcon, ListIcon, SettingsIcon, ShieldIcon, UserIcon, UsersIcon } from '../components/ui/icons.jsx';

/**
 * Staff console. Same standard shell as the buyer/exporter panels
 * (`ConsoleShell`) — the admin design file uses identical chrome, so there is
 * no separate admin look to maintain.
 *
 * The sidebar renders ONLY what the staffer's server-supplied permissions can
 * open (superadmin sees everything). Hiding is presentation — every endpoint
 * re-checks (CLAUDE.md #2/#5). "Soon" rows route nowhere and are logged in
 * docs/UiWebNotes.md.
 */
const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', Icon: HomeIcon },
  {
    to: '/admin/organisations',
    label: 'Organisations',
    Icon: BuildingIcon,
    perms: ['organisation:read'],
  },
  { to: '/admin/users', label: 'Users', Icon: UsersIcon, perms: ['user:read'] },
  {
    to: '/admin/verification',
    label: 'Verification',
    Icon: ShieldIcon,
    perms: ['organisation:read', 'buyer:approve', 'exporter:verify', 'kyc:view'],
  },
  {
    to: '/admin/categories',
    label: 'Categories',
    Icon: BoxIcon,
    perms: ['category:read', 'category:manage'],
  },
  {
    to: '/admin/products',
    label: 'Products',
    Icon: ListIcon,
    perms: ['product:read', 'product:takedown'],
  },
  {
    to: '/admin/conversations',
    label: 'Conversations',
    Icon: ChatIcon,
    perms: ['conversation:read'],
  },
  // Step 1b · the support desk (grantable `support:read`).
  { to: '/admin/support', label: 'Support', Icon: HelpIcon, perms: ['support:read'] },
  // Step 1d · buyers' "find me a supplier" requests (grantable `lead:manage`).
  { to: '/admin/leads', label: 'Supplier requests', Icon: HandshakeIcon, perms: ['lead:manage'] },
  { to: '/admin/staff', label: 'Staff', Icon: UserIcon, superadminOnly: true },
  // Step 1e · every staff member sees their own report; superadmins the team.
  { to: '/admin/reports', label: 'Reports', Icon: ChartIcon, dividerBefore: true },
  { to: '/admin/audit', label: 'Audit log', Icon: ListIcon, perms: ['audit:read'] },
  { to: '/admin/errors', label: 'Errors', Icon: AlertIcon, perms: ['errorlog:read'] },
  { to: '/admin/featured', label: 'Featured', Icon: ImageIcon, perms: ['featured:manage'] },
  // Superadmin-only, matching the HARD role gate on the route — platform
  // governance is never a grantable employee permission. Without this flag an
  // employee saw a row that 403s.
  { to: '/admin/settings', label: 'Settings', Icon: SettingsIcon, superadminOnly: true },
  // Every staff member: profile, password, and what they can do.
  { to: '/admin/account', label: 'My account', Icon: KeyIcon, dividerBefore: true },
];

const ROLE_LABELS = { superadmin: 'Super Admin', employee: 'Employee' };

export function AdminLayout({ children }) {
  const { user } = useAuth();

  const nav = NAV.filter((item) => {
    if (item.superadminOnly) return user?.role === 'superadmin';
    if (item.perms) return can(user, ...item.perms);
    return true; // "Soon" rows stay — a narrowly granted employee still sees a finished console
  })
    // Links point into THIS person's console (/admin or /staff) — see consolePath.js.
    .map((item) => ({ ...item, to: cp(item.to) }));

  return (
    <ConsoleShell
      nav={nav}
      identity={`${ROLE_LABELS[user?.role] ?? user?.role} · MPX Global`}
      signOutTo="/signin/staff"
    >
      {children}
    </ConsoleShell>
  );
}
