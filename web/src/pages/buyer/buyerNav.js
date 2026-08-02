import {
  ShieldIcon,
  SearchIcon,
  ChatIcon,
  ListIcon,
  SettingsIcon,
} from '../../components/ui/icons.jsx';

/**
 * Buyer sidebar per the mockup. Everything except Verification is a later
 * milestone's screen — rendered as disabled "Soon" chips, each logged in
 * docs/UiWebNotes.md (strict rule).
 */
export const BUYER_NAV = [
  { to: '/buyer/verification', label: 'Verification', Icon: ShieldIcon },
  { label: 'Search suppliers', Icon: SearchIcon, soon: true },
  { label: 'Enquiries', Icon: ListIcon, soon: true },
  { label: 'Chat', Icon: ChatIcon, soon: true },
  { label: 'Settings', Icon: SettingsIcon, soon: true },
];
