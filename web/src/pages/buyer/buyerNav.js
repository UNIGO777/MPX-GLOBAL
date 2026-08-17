import {
  ShieldIcon,
  SearchIcon,
  HeartIcon,
  ChatIcon,
  ListIcon,
  BuildingIcon,
} from '../../components/ui/icons.jsx';

/**
 * Buyer sidebar, exactly as the design file orders and styles it: Verification
 * (the only built screen) then three SOON rows, a 32px gap, then Settings.
 *
 * Settings carries NO "Soon" badge in the design — it renders as a dimmed,
 * non-interactive row (`disabled`). It and the three SOON rows are all logged
 * in docs/UiWebNotes.md (strict rule).
 */
export const BUYER_NAV = [
  { to: '/buyer/verification', label: 'Verification', Icon: ShieldIcon },
  // M3 Phase 5 (2026-08-16): both are REAL routes now — "Search suppliers"
  // points at the public search page, "Saved" at the buyer's own list.
  { to: '/search', label: 'Search suppliers', Icon: SearchIcon },
  { to: '/saved', label: 'Saved', Icon: HeartIcon, savedBadge: true },
  { label: 'Enquiries', Icon: ListIcon, soon: true },
  { label: 'Chat', Icon: ChatIcon, soon: true },
  { to: '/buyer/company', label: 'Company profile', Icon: BuildingIcon, dividerBefore: true },
];
