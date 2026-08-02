import {
  HomeIcon,
  ShieldIcon,
  BoxIcon,
  ListIcon,
  ChatIcon,
  SettingsIcon,
} from '../../components/ui/icons.jsx';

/**
 * Exporter sidebar per the mockup. Everything except Verification is a later
 * milestone's screen — disabled "Soon" chips, each logged in docs/UiWebNotes.md
 * (strict rule).
 */
export const EXPORTER_NAV = [
  { label: 'Dashboard', Icon: HomeIcon, soon: true },
  { to: '/exporter', label: 'Verification', Icon: ShieldIcon },
  { label: 'Products', Icon: BoxIcon, soon: true },
  { label: 'Enquiries', Icon: ListIcon, soon: true },
  { label: 'Chat', Icon: ChatIcon, soon: true },
  { label: 'Settings', Icon: SettingsIcon, soon: true },
];
