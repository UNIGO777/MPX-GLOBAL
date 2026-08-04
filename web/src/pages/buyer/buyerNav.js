import {
  ShieldIcon,
  SearchIcon,
  ChatIcon,
  ListIcon,
  SettingsIcon,
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
  { label: 'Search suppliers', Icon: SearchIcon, soon: true },
  { label: 'Enquiries', Icon: ListIcon, soon: true },
  { label: 'Chat', Icon: ChatIcon, soon: true },
  { label: 'Settings', Icon: SettingsIcon, disabled: true, dividerBefore: true },
];
