import {
  HomeIcon,
  ShieldIcon,
  BoxIcon,
  ListIcon,
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
  { label: 'Enquiries', Icon: ListIcon, soon: true },
  { label: 'Chat', Icon: ChatIcon, soon: true },
  { to: '/exporter/company', label: 'Company profile', Icon: BuildingIcon, dividerBefore: true },
];
