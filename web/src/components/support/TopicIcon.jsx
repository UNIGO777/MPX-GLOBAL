import { AlertIcon, BoxIcon, ChatIcon, HelpIcon, ShieldIcon, UserIcon } from '../ui/icons.jsx';

/** One icon + tint per ticket topic (Step 1b) — the list and the picker share it. */
export const TOPIC_META = {
  account: { Icon: UserIcon, tint: 'bg-sky-50 text-sky-700', hint: 'Signing in, password, account details' },
  verification: { Icon: ShieldIcon, tint: 'bg-emerald-50 text-emerald-700', hint: 'Documents, the verified tick' },
  products: { Icon: BoxIcon, tint: 'bg-amber-50 text-amber-700', hint: 'Listings, photos, visibility' },
  enquiries: { Icon: ChatIcon, tint: 'bg-violet-50 text-violet-700', hint: 'Enquiries and conversations' },
  technical: { Icon: AlertIcon, tint: 'bg-rose-50 text-rose-700', hint: 'An error or something not working' },
  other: { Icon: HelpIcon, tint: 'bg-slate-100 text-slate-700', hint: 'Anything else' },
};

export function TopicIcon({ category, size = 'md' }) {
  const meta = TOPIC_META[category] ?? TOPIC_META.other;
  const box = size === 'lg' ? 'h-11 w-11 rounded-xl' : 'h-10 w-10 rounded-xl';
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${box} ${meta.tint}`}>
      <meta.Icon className="h-5 w-5" />
    </span>
  );
}
