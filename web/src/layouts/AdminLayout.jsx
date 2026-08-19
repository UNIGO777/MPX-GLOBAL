import { ConsoleShell } from './ConsoleShell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { can } from '../auth/roleHome.js';
import { AlertIcon, BoxIcon, BuildingIcon, ChatIcon, HomeIcon, ImageIcon, ListIcon, SettingsIcon, ShieldIcon, UserIcon, UsersIcon } from '../components/ui/icons.jsx';

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
  { to: '/admin/staff', label: 'Staff', Icon: UserIcon, superadminOnly: true },
  { to: '/admin/audit', label: 'Audit log', Icon: ListIcon, perms: ['audit:read'], dividerBefore: true },
  { to: '/admin/errors', label: 'Errors', Icon: AlertIcon, perms: ['errorlog:read'] },
  { to: '/admin/featured', label: 'Featured', Icon: ImageIcon, perms: ['featured:manage'] },
  { to: '/admin/settings', label: 'Settings', Icon: SettingsIcon },
];

const ROLE_LABELS = { superadmin: 'Super Admin', employee: 'Employee' };

export function AdminLayout({ children }) {
  const { user } = useAuth();

  const nav = NAV.filter((item) => {
    if (item.superadminOnly) return user?.role === 'superadmin';
    if (item.perms) return can(user, ...item.perms);
    return true; // "Soon" rows stay — a narrowly granted employee still sees a finished console
  });

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
