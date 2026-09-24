import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';
import { useCanonical } from '../../lib/seo.js';
import { useSupportContact } from '../../hooks/useSupportContact.js';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BoxIcon,
  BuildingIcon,
  ChatIcon,
  HandshakeIcon,
  HelpIcon,
  ListIcon,
  LockIcon,
  MailIcon,
  PhoneIcon,
  SearchIcon,
  UserIcon,
} from '../../components/ui/icons.jsx';

/**
 * `/help` — Help & support (Step 1a; redesigned 2026-09-24).
 *
 * Public on purpose: someone locked out of their account is exactly who needs
 * it. The hero carries the one real action for the visitor (raise a ticket
 * when signed in, sign in to raise one otherwise) beside the contact a
 * superadmin published in Settings. Every topic links to a built page — no
 * placeholder articles, and no invented service promise (hours, reply times).
 */
export function Help() {
  const { user } = useAuth();
  useCanonical('/help');

  useEffect(() => {
    const previous = document.title;
    document.title = 'Help & support — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const side = user?.role === 'buyer' || user?.role === 'exporter' ? user.role : null;

  return (
    <div className="bg-white text-ink-900">
      <PublicHeader />

      <main className="w-full px-4 pb-14 pt-6 sm:px-6 sm:pt-8 lg:px-10 xl:px-16">
        <section className="grid gap-8 rounded-2xl bg-ink-900 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center lg:gap-12 lg:px-12 lg:py-12">
          <div className="min-w-0">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-primary-300">
              <HelpIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Help &amp; support
            </p>
            <h1 className="max-w-2xl font-serif text-3xl leading-[1.15] text-white sm:text-4xl lg:text-[2.75rem]">
              How can we help?
            </h1>
            <p className="mt-4 max-w-xl text-sm text-ink-200 sm:text-base">
              Questions about your account, verification or a conversation — a person on the
              MPX Global team reads every request.
            </p>
            <HeroActions user={user} side={side} />
          </div>
          <ContactPanel />
        </section>

        <section className="mt-12" aria-labelledby="topics-h">
          <h2 id="topics-h" className="text-2xl font-extrabold tracking-tight">Browse by topic</h2>
          <p className="mt-1 text-sm text-muted">Most questions are answered on one of these pages.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {topicsFor(side).map((t) => (
              <li key={t.title}>
                <TopicCard {...t} />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

const pill =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors';

function HeroActions({ user, side }) {
  if (side) {
    return (
      <div className="mt-7 flex flex-wrap gap-3">
        <Link to={`/${side}/support`} className={`${pill} bg-primary-600 text-white hover:bg-primary-700`}>
          Raise a support ticket
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
        {side === 'buyer' && (
          <Link to="/buyer/find-supplier" className={`${pill} border border-white/25 text-white hover:bg-white/10`}>
            <HandshakeIcon className="h-4 w-4" aria-hidden="true" />
            Help me find a supplier
          </Link>
        )}
      </div>
    );
  }
  if (user) {
    // Staff — tickets are answered in the console, not raised from here.
    return (
      <div className="mt-7">
        <Link to={roleHome(user)} className={`${pill} bg-primary-600 text-white hover:bg-primary-700`}>
          Open your console
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-7">
      <div className="flex flex-wrap gap-3">
        <Link to="/signin" className={`${pill} bg-primary-600 text-white hover:bg-primary-700`}>
          Sign in to raise a ticket
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link to="/signup/buyer" className={`${pill} border border-white/25 text-white hover:bg-white/10`}>
          Create a free account
        </Link>
      </div>
      <p className="mt-3 text-[13px] text-ink-300">
        Can&apos;t sign in? Email or call us — no account needed.
      </p>
    </div>
  );
}

function ContactPanel() {
  const { email, phone, hasAny, isLoading } = useSupportContact();
  const rows = [
    email && { Icon: MailIcon, label: 'Email us', value: email, href: `mailto:${email}` },
    phone && { Icon: PhoneIcon, label: 'Call us', value: phone, href: `tel:${phone.replace(/\s+/g, '')}` },
  ].filter(Boolean);

  return (
    <div className="rounded-2xl bg-white p-5 sm:p-6">
      <h2 className="text-[15px] font-bold text-ink-900">Talk to our team</h2>
      {isLoading && <div className="mt-4 h-28 animate-pulse rounded-xl bg-ink-100" aria-hidden="true" />}
      {!isLoading && !hasAny && (
        <p className="mt-2 text-sm text-muted">
          Our support email and phone will appear here once published. Signed-in buyers and
          sellers can raise a ticket in the meantime.
        </p>
      )}
      {!isLoading && hasAny && (
        <ul className="mt-4 space-y-3">
          {rows.map(({ Icon, label, value, href }) => (
            <li key={label}>
              <a
                href={href}
                className="group flex min-w-0 items-center gap-3.5 rounded-xl border border-surface-border p-3.5 transition-colors hover:border-primary-300 hover:bg-primary-50/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-muted">{label}</span>
                  <span className="block break-all text-[15px] font-bold text-ink-900 group-hover:text-primary-700">
                    {value}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function topicsFor(side) {
  const privacy = { to: '/privacy', Icon: LockIcon, title: 'Privacy', text: 'What we store, and how to ask for a copy or deletion.' };
  const faq = { href: '/#faq', Icon: ListIcon, title: 'Common questions', text: 'Short answers about accounts, verification and enquiries.' };
  if (!side) {
    return [
      { to: '/signup/buyer', Icon: UserIcon, title: 'Buying on MPX Global', text: 'Create a free buyer account to enquire and chat with suppliers.' },
      { to: '/signup/exporter', Icon: BoxIcon, title: 'Selling on MPX Global', text: 'Register as an exporter — your profile is public the day you join.' },
      { to: '/search', Icon: SearchIcon, title: 'Finding suppliers', text: 'Search products and suppliers, or describe what you need to AI search.' },
      { href: '/#how-it-works', Icon: BadgeCheckIcon, title: 'The verified tick', text: 'What the tick means, and how a person on our team checks it.' },
      faq,
      privacy,
    ];
  }
  return [
    { to: `/${side}/support`, Icon: HelpIcon, title: 'Your support tickets', text: 'Raise a ticket, see our replies and track its status.' },
    { to: `/${side}/verification`, Icon: BadgeCheckIcon, title: 'Verification', text: 'Where your verification stands and what to send next.' },
    { to: `/${side}/company`, Icon: BuildingIcon, title: 'Company profile', text: 'Your company details, and changing your password.' },
    { to: `/${side}/chat`, Icon: ChatIcon, title: 'Enquiries & chat', text: side === 'buyer' ? 'Your conversations with suppliers.' : 'Your conversations with buyers.' },
    side === 'buyer'
      ? { to: '/buyer/find-supplier', Icon: HandshakeIcon, title: 'Find a supplier', text: 'Tell us what you need — our team connects you with exporters.' }
      : faq,
    privacy,
  ];
}

function TopicCard({ to, href, Icon, title, text }) {
  const cls =
    'group flex h-full items-start gap-4 rounded-2xl border border-surface-border bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg motion-reduce:transform-none';
  const body = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-bold text-ink-900 group-hover:text-primary-700">
          {title}
          <ArrowRightIcon className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
        </span>
        <span className="mt-1 block text-[13.5px] leading-snug text-muted">{text}</span>
      </span>
    </>
  );
  // In-page landing sections are plain anchors so the browser scrolls to the hash.
  return href ? <a href={href} className={cls}>{body}</a> : <Link to={to} className={cls}>{body}</Link>;
}
