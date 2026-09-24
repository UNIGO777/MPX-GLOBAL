import { ClockIcon, MailIcon, PhoneIcon } from '../ui/icons.jsx';
import { useSupportContact } from '../../hooks/useSupportContact.js';

/**
 * The published support contact as two cards (email · phone). Step 1a.
 *
 * Only what a superadmin has actually published renders — no invented address,
 * and no invented service promise. Hours appear only when a superadmin has
 * published them in Settings (2026-09-25).
 * When nothing is set yet it says so plainly rather than showing an empty card.
 */
export function SupportContactCards({ stacked = false }) {
  const { email, phone, hours, hasAny, isLoading } = useSupportContact();

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-ink-100" aria-hidden="true" />;
  }
  if (!hasAny) {
    return (
      <p className="rounded-2xl border border-surface-border bg-white p-5 text-sm text-muted">
        Our support contact hasn&apos;t been published yet. Please check back shortly.
      </p>
    );
  }

  const cards = [
    email && { Icon: MailIcon, label: 'Email us', value: email, href: `mailto:${email}` },
    phone && { Icon: PhoneIcon, label: 'Call us', value: phone, href: `tel:${phone.replace(/\s+/g, '')}` },
  ].filter(Boolean);

  return (
    <div>
    <div className={`grid gap-3 ${cards.length > 1 && !stacked ? 'sm:grid-cols-2' : ''}`}>
      {cards.map(({ Icon, label, value, href }) => (
        <a
          key={label}
          href={href}
          className="group flex min-w-0 items-center gap-4 rounded-2xl border border-surface-border bg-white p-4 shadow-card transition-colors hover:border-primary-300"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-muted">{label}</span>
            <span className="mt-0.5 block break-all text-[15px] font-bold text-ink-900 group-hover:text-primary-700">
              {value}
            </span>
          </span>
        </a>
      ))}
    </div>
    {hours && (
      <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-600">
        <ClockIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
        <span><span className="font-semibold text-ink-800">Support hours:</span> {hours}</span>
      </p>
    )}
    </div>
  );
}

/**
 * The contact as one inline sentence — for the privacy/terms pages, where the
 * old text pointed at "the contact address published by MPX Global" and
 * nothing was published anywhere.
 */
export function SupportContactInline({ fallback = 'the contact address published by MPX Global' }) {
  const { email, phone } = useSupportContact();
  if (!email && !phone) return <>{fallback}</>;
  return (
    <>
      {email && (
        <a href={`mailto:${email}`} className="font-semibold text-primary-700 hover:underline">
          {email}
        </a>
      )}
      {email && phone && ' or '}
      {phone && (
        <a href={`tel:${phone.replace(/\s+/g, '')}`} className="font-semibold text-primary-700 hover:underline">
          {phone}
        </a>
      )}
    </>
  );
}
