import { cp } from '../../lib/consolePath.js';
import {
  BadgeCheckIcon,
  BellIcon,
  BuildingIcon,
  ChatIcon,
  EnquiryIcon,
  HandshakeIcon,
  HelpIcon,
  ShieldIcon,
} from '../ui/icons.jsx';

/** The icon + tint for a notification type — by its group, the part before the dot. */
const GROUPS = {
  verification: { Icon: ShieldIcon, tint: 'bg-emerald-50 text-emerald-700' },
  profile_change: { Icon: BuildingIcon, tint: 'bg-sky-50 text-sky-700' },
  ticket: { Icon: HelpIcon, tint: 'bg-primary-50 text-primary-700' },
  lead: { Icon: HandshakeIcon, tint: 'bg-amber-50 text-amber-700' },
  enquiry: { Icon: EnquiryIcon, tint: 'bg-violet-50 text-violet-700' },
  chat: { Icon: ChatIcon, tint: 'bg-violet-50 text-violet-700' },
  // D6 · unblock requests on taken-down products.
  product: { Icon: ShieldIcon, tint: 'bg-rose-50 text-rose-700' },
};

export function metaFor(type) {
  const group = String(type ?? '').split('.')[0];
  if (type === 'verification.approved') return { Icon: BadgeCheckIcon, tint: GROUPS.verification.tint };
  return GROUPS[group] ?? { Icon: BellIcon, tint: 'bg-ink-100 text-ink-600' };
}

/**
 * Where a notification goes. Staff links are stored as `/admin/...` and moved
 * to the reader's own console (`/staff/...` for employees) at render time —
 * never at module level (see consolePath.js).
 */
export const linkFor = (link) => (link && link.startsWith('/admin/') ? cp(link) : link);
