import {
  HomeIcon,
  ShieldIcon,
  BoxIcon,
  ChatIcon,
  BuildingIcon,
} from '../../components/ui/icons.jsx';

/**
 * Exporter sidebar. Every row here is now a REAL route — the "Dashboard" row
 * carried a dimmed `soon: true` chip from 2026-08-01 until the dashboard
 * shipped on 2026-09-22, and it was the last non-operational row in this nav
 * (docs/UiWebNotes.md row 30, now Done).
 *
 * Dashboard is the exporter's home (`/exporter` redirects to it); Verification
 * keeps the KYC detail the dashboard links into.
 */
export const EXPORTER_NAV = [
  { to: '/exporter/dashboard', label: 'Dashboard', Icon: HomeIcon },
  { to: '/exporter/verification', label: 'Verification', Icon: ShieldIcon },
  { to: '/exporter/products', label: 'Products', Icon: BoxIcon },
  // M4 (2026-08-17): one chat item, replacing the "Enquiries" + "Chat" pair.
  // The seller's entry point is the FULL inbox (owner's call) — answering a
  // day's enquiries is inbox work, not something to do in a 380px window.
  { to: '/exporter/chat', label: 'Chat', Icon: ChatIcon, unreadBadge: true },
  { to: '/exporter/company', label: 'Company profile', Icon: BuildingIcon, dividerBefore: true },
];
