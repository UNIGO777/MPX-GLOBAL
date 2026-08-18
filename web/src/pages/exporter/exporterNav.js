import {
  HomeIcon,
  ShieldIcon,
  BoxIcon,
  ChatIcon,
  BuildingIcon,
} from '../../components/ui/icons.jsx';

/**
 * Exporter sidebar, matching the design file: Verification is the only built
 * screen; the rest are later milestones. Settings carries no badge (design) and
 * renders dimmed + non-interactive. Every non-operational row is logged in
 * docs/UiWebNotes.md (strict rule).
 */
export const EXPORTER_NAV = [
  { label: 'Dashboard', Icon: HomeIcon, soon: true },
  { to: '/exporter/verification', label: 'Verification', Icon: ShieldIcon },
  { to: '/exporter/products', label: 'Products', Icon: BoxIcon },
  // M4 (2026-08-17): one chat item, replacing the "Enquiries" + "Chat" pair.
  // The seller's entry point is the FULL inbox (owner's call) — answering a
  // day's enquiries is inbox work, not something to do in a 380px window.
  { to: '/exporter/chat', label: 'Chat', Icon: ChatIcon, unreadBadge: true },
  { to: '/exporter/company', label: 'Company profile', Icon: BuildingIcon, dividerBefore: true },
];
