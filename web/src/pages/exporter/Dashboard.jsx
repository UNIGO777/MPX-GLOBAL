import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { conversationKeys, conversationsApi } from '../../api/conversations.js';
import { kycApi } from '../../api/kyc.js';
import { organisationApi, organisationKeys } from '../../api/organisation.js';
import { productKeys, productsApi } from '../../api/products.js';
import { initialsOf } from '../../components/chat/CompanyAvatar.jsx';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { countryName } from '../../lib/countries.js';
import { apiError, formatDate, formatMonth } from '../../lib/format.js';
import { ENTITY_LABELS } from '../../lib/kycDocTypes.js';
import { PRODUCT_STATUS_META } from '../../lib/productStatus.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import {
  AlertIcon,
  ArrowRightIcon,
  BoxIcon,
  ChatIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  DocIcon,
  ExternalIcon,
  EyeOffIcon,
  FileIcon,
  PlusIcon,
  RefreshIcon,
  ShieldIcon,
} from '../../components/ui/icons.jsx';

/**
 * Exporter dashboard — the seller's home, at `/exporter/dashboard`.
 *
 * 🔴 SCOPE NOTE (owner-confirmed 2026-09-22, read this before "tidying" it away).
 * The quote's 8 modules name only a **Super admin dashboard** (Module 5) and an
 * **Employee panel** (Module 6) — there is no seller dashboard in
 * `docs/scope-of-work.md`. It was red-alerted and the owner confirmed on the
 * PARITY argument: the mobile app already ships `ExporterHomeScreen` (company,
 * verification prompt, unread enquiries, product counts), the quote covers
 * "web application, mobile application" as one scope, and this needs **no new
 * backend** — every figure comes from an endpoint that already existed. If the
 * client ever queries the line item, that is the answer.
 *
 * WHAT IT IS, AND WHAT IT IS NOT. `/exporter/verification` was previously the
 * exporter's home (`docs/Testing.md` §9 still calls it "Exporter dashboard").
 * It keeps the KYC DETAIL — the four-step journey, the document list, the
 * per-round history. This page is the OVERVIEW that links into it. Nothing is
 * duplicated: verification appears here as a state plus a route, never as a
 * second copy of the journey.
 *
 * FOUR READS, all self-scoped, none new:
 *   organisationApi.mine()      — name, slug, country, entityType, kycStatus,
 *                                 verifiedAt, pendingChanges (PortalLayout has
 *                                 already warmed this exact cache key)
 *   kycApi.myVerification()     — documentRequests, kycRevocation, submittedAt,
 *                                 rejection reason
 *   productsApi.mine()          — products + `counts` + `caps` in ONE call, so
 *                                 the tiles, the mix bar and the cap meters can
 *                                 never disagree with each other
 *   conversationsApi.unreadCount() — unread THREADS (not messages)
 *
 * 🔴 Raw `kycStatus` is legitimate here and only here-ish: `web-design.md` names
 * the owner's OWN status screens as the one place it may be read. This is a
 * self-scoped read of your own organisation. The PUBLIC surfaces still derive
 * `verified` and must never see the raw status or a `rejected` state.
 *
 * NO INVENTED NUMBERS (the admin dashboard's rule, kept). Every figure is a
 * server count with a route to the list it came from. There is deliberately no
 * trend chart: no exporter-scoped time series exists server-side, and a chart
 * is not worth inventing one for.
 *
 * Motion (count-ups, the refresh spin, the mix bar's grow, the banner drift)
 * dies under `prefers-reduced-motion` and never carries meaning on its own.
 */
const RECENT = 5;

const nf = (value) => (value ?? 0).toLocaleString();

function agoLabel(ms) {
  if (ms < 45_000) return 'just now';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.round(mins / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── motion ──────────────────────────────────────────────────────────────── */

/**
 * Counts up to the REAL figure. Under prefers-reduced-motion it renders the
 * value immediately, and it only ever animates from 0 to the true number —
 * never through an invented intermediate state.
 */
function AnimatedNumber({ value }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(() => (reduced ? value : 0));
  const raf = useRef(null);
  const [prev, setPrev] = useState(value);

  if (prev !== value) {
    setPrev(value);
    if (reduced) setShown(value);
  }

  useEffect(() => {
    if (reduced) return undefined;
    const started = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - started) / 900);
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduced]);

  return <>{nf(Math.round(shown))}</>;
}

/* ── primitives ──────────────────────────────────────────────────────────── */

function IconChip({ Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-primary-50 text-primary-700',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
    success: 'bg-success-50 text-success-600',
    ink: 'bg-ink-100 text-ink-600',
  };
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
  );
}

/* ── the banner's own pieces ─────────────────────────────────────────────── */

/**
 * The company mark on the banner. `CompanyAvatar` is built for LIGHT surfaces
 * (white tile, ink ring, primary-50 monogram) and tops out at 44px, so it is
 * not reused here: on the deep-red banner this needs its own glass treatment
 * and a size that can hold its own beside a 30px heading.
 */
function BannerMark({ name, logo }) {
  const box = 'h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-inset ring-white/25';
  if (logo) {
    // `contain`, never `cover` — a wordmark cropped to a square is a smear.
    return <img src={logo} alt="" className={`${box} bg-white object-contain p-1.5`} />;
  }
  return (
    <span className={`${box} flex items-center justify-center bg-white/12 text-[17px] font-bold text-white`}>
      {initialsOf(name)}
    </span>
  );
}

/**
 * Verification state, drawn FOR THE DARK BANNER.
 *
 * 🔴 Why not `VerifiedTick`: that component is the public convention — a bare
 * 16px `text-success` check meant to sit beside a seller name on white. On this
 * banner it reads as a stray green mark rather than a credential, which is
 * exactly how it looked when first shipped. Here the state gets a real pill.
 * `VerifiedTick` is still the right component on the light rail, and remains
 * the ONLY thing public surfaces may use.
 *
 * Every state carries its own WORD, so the colour is never the signal on its
 * own (web-design.md) — which also means "In review" and "Not approved" may
 * share amber without becoming ambiguous.
 *
 * Showing a non-verified state at all is legitimate here and nowhere public:
 * this is the owner's own dashboard, which `web-design.md` names as the one
 * place raw `kycStatus` may be read.
 */
function BannerStatus({ status, verifiedAt, revoked }) {
  const pill =
    'inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[12px] font-semibold text-white ring-1 ring-inset ring-white/20';

  if (revoked) {
    return (
      <span className={pill}>
        <AlertIcon className="h-3.5 w-3.5 text-warning-200" aria-hidden="true" />
        Tick withdrawn
      </span>
    );
  }
  if (status === 'verified') {
    const since = formatMonth(verifiedAt);
    return (
      <span className={pill}>
        <CheckCircleIcon className="h-4 w-4 text-success-300" aria-hidden="true" />
        Verified
        {since && <span className="font-normal text-white/55">since {since}</span>}
      </span>
    );
  }
  if (status === 'submitted') {
    return (
      <span className={pill}>
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-300 opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-warning-300" />
        </span>
        In review
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className={pill}>
        <AlertIcon className="h-3.5 w-3.5 text-warning-200" aria-hidden="true" />
        Not approved
      </span>
    );
  }
  return (
    <span className={pill}>
      <DocIcon className="h-3.5 w-3.5 text-white/70" aria-hidden="true" />
      Documents not sent
    </span>
  );
}

/**
 * The seller's public address, with a copy button — the thing an exporter
 * actually wants off this page to paste into an email or a WhatsApp message.
 *
 * The clipboard can refuse (permissions, an insecure origin, an older browser).
 * On failure the label is left alone rather than flashing a "Copied" that did
 * not happen — a false confirmation is worse than no feedback.
 */
function PublicLink({ slug }) {
  const [copied, setCopied] = useState(false);
  const path = `/supplier/${slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-[11.5px] text-white/45">{path}</span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white/75 transition-colors hover:bg-white/10"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-success-300" aria-hidden="true" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}

function Panel({ Icon, tone, title, trailing = null, to, toLabel = 'View all', children, className = '' }) {
  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-surface-border px-5 py-3.5">
        <IconChip Icon={Icon} tone={tone} />
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink-900">{title}</h2>
        {trailing}
        {to && (
          <Link
            to={to}
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary-700 hover:underline"
          >
            {toLabel}
            <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** A failed panel stays inside its own card — the rest of the page still works. */
function PanelBody({ query, empty, children }) {
  if (query.isLoading) return <SkeletonRows rows={3} />;
  if (query.error) {
    return (
      <p className="px-5 py-4 text-sm text-muted">
        {apiError(query.error).message}{' '}
        <button type="button" onClick={() => query.refetch()} className="font-semibold text-primary-700 hover:underline">
          Retry
        </button>
      </p>
    );
  }
  if (empty) return empty;
  return children;
}

/** One cell of the connected stat bar. */
function StatCell({ Icon, label, value, hint, href, accent }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${accent?.icon ?? 'text-ink-400'}`} aria-hidden="true" />
        <span className={`truncate text-[10.5px] font-semibold uppercase tracking-wider ${accent?.label ?? 'text-ink-500'}`}>
          {label}
        </span>
      </span>
      <span className="mt-1.5 block text-[26px] font-bold leading-none tabular-nums text-ink-900">
        <AnimatedNumber value={value} />
      </span>
      {hint && <span className="mt-auto block truncate pt-1 text-[11px] text-muted">{hint}</span>}
    </>
  );
  const cell = 'flex min-w-0 flex-col bg-white p-4';
  return href ? (
    <Link
      to={href}
      className={`${cell} transition-colors hover:bg-primary-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300`}
    >
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
  );
}

/**
 * One row of the needs-attention worklist. `tone` picks the dot and the badge;
 * the LABEL always says what it is, so the colour is never the only signal
 * (web-design.md).
 */
function ActionRow({ label, hint, count, href, tone = 'warning' }) {
  const danger = tone === 'danger';
  const inner = (
    <>
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${danger ? 'bg-danger-500' : 'bg-warning-400'}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      {count != null && (
        <span
          className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-2 text-base font-bold tabular-nums ring-1 ring-inset ${
            danger ? 'bg-danger-50 text-danger-700 ring-danger-200' : 'bg-warning-50 text-warning-800 ring-warning-200'
          }`}
        >
          <AnimatedNumber value={count} />
        </span>
      )}
      <ChevronRightIcon
        className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </>
  );
  return (
    <Link to={href} className="group flex w-full items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50/60">
      {inner}
    </Link>
  );
}

/**
 * The catalogue mix as one bar — Live / Hidden / Drafts in proportion. Derived
 * entirely from the server's own `counts`; nothing here is estimated. Hidden
 * when the catalogue is empty, because an empty bar says nothing.
 */
function MixBar({ counts }) {
  const segments = [
    { key: 'active', label: 'Live', value: counts?.active ?? 0, fill: 'bg-success-500', text: 'text-success-700' },
    { key: 'inactive', label: 'Hidden', value: counts?.inactive ?? 0, fill: 'bg-warning-500', text: 'text-warning-800' },
    { key: 'draft', label: 'Drafts', value: counts?.draft ?? 0, fill: 'bg-ink-300', text: 'text-ink-600' },
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    /* 🔴 `py-4`, not `pb-4 pt-1` (fixed 2026-09-23). The 4px top pinned the bar
       against the header's own bottom border while 16px sat under the legend —
       the block read as if it had slipped upward out of its own space. Equal
       padding top and bottom is the whole fix; the 10px between bar and legend
       is the internal gap and stays.

       The divider moved here as `border-b` and came OFF the list below, which
       fixes a second defect: this component returns null when the seller has no
       products at all, and the list's own `border-t` then landed directly under
       the header's `border-b` — two 1px rules stacked into one 2px line. One
       divider now belongs to one element. */
    <div className="border-b border-surface-border px-5 py-4">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.key}
              className={`${s.fill} h-full transition-[width] duration-700 ease-out motion-reduce:transition-none`}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-[11.5px]">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.fill}`} />
            <span className={`font-semibold ${s.text}`}>{nf(s.value)}</span>
            <span className="text-muted">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The D1 / §A15 cap meter. Rendered ONLY while `caps.verified` is false. */
function CapMeter({ label, used, limit, hint }) {
  const full = used >= limit;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-ink-800">{label}</span>
        <span className={`text-[12.5px] font-bold tabular-nums ${full ? 'text-warning-800' : 'text-ink-700'}`}>
          {nf(used)} / {nf(limit)}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${used} of ${limit} used`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
            full ? 'bg-warning-500' : 'bg-primary-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Thumb({ product }) {
  // Owner views return {url, publicId} refs; public views send bare URLs.
  const first = product.images?.[0];
  const cover = typeof first === 'string' ? first : first?.url;
  if (cover) return <img src={cover} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />;
  return <NoImagePanel ratio="h-11 w-11" className="shrink-0 rounded-lg" />;
}

/* ── the page ────────────────────────────────────────────────────────────── */

export function Dashboard() {
  const org = useQuery({ queryKey: organisationKeys.mine, queryFn: organisationApi.mine });
  const verification = useQuery({ queryKey: ['me', 'verification'], queryFn: kycApi.myVerification });
  const products = useQuery({
    queryKey: productKeys.minePage({ pageSize: RECENT }),
    queryFn: () => productsApi.mine({ pageSize: RECENT }),
    placeholderData: (prev) => prev,
  });
  const unread = useQuery({ queryKey: conversationKeys.unread(), queryFn: conversationsApi.unreadCount });

  const anyFetching =
    org.isFetching || verification.isFetching || products.isFetching || unread.isFetching;
  const refreshAll = () => {
    org.refetch();
    verification.refetch();
    products.refetch();
    unread.refetch();
  };

  // "Updated Xs ago" against the freshest of the four reads, re-rendered on a
  // timer so the label ages while the page sits open.
  const updatedAt = Math.max(
    org.dataUpdatedAt || 0,
    verification.dataUpdatedAt || 0,
    products.dataUpdatedAt || 0,
    unread.dataUpdatedAt || 0,
  );
  // `now` is STATE, not a Date.now() during render — an impure call there gives
  // an unstable result on any incidental re-render (react-hooks/purity). The
  // interval alone is enough: a refetch pushes `updatedAt` PAST `now`, and the
  // Math.max(0, …) below floors that to "just now" until the next tick catches
  // up — so the label is correct on a refresh without setting state in an effect.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const company = org.data;
  const v = verification.data;
  const counts = products.data?.counts;
  const caps = products.data?.caps;
  const rows = products.data?.products ?? [];

  const status = company?.kycStatus ?? v?.kycStatus;
  const isVerified = status === 'verified';
  const unverifiedCaps = caps?.verified === false ? caps : null;

  const openRequests = (v?.documentRequests ?? []).filter((r) => !r.fulfilledAt);
  const pending = company?.pendingChanges ?? v?.pendingChanges ?? null;
  const revocation = v?.kycRevocation ?? null;
  const unreadThreads = unread.data ?? 0;

  /* The worklist. Order is by urgency: things a REVIEWER is waiting on, then
     things a BUYER is waiting on, then housekeeping. */
  const actions = [
    openRequests.length > 0 && {
      key: 'doc-requests',
      tone: 'danger',
      label: openRequests.length === 1 ? 'A document was requested' : `${openRequests.length} documents requested`,
      hint: openRequests[0]?.note || 'Our team needs more from you before verification can finish',
      count: openRequests.length,
      href: '/exporter/verification',
    },
    status === 'rejected' && {
      key: 'rejected',
      tone: 'danger',
      label: 'Verification was not approved',
      hint: v?.kycRejectionReason || 'Open verification to see what to send next',
      href: '/exporter/verification',
    },
    revocation && {
      key: 'revoked',
      tone: 'danger',
      label: 'Your verified tick was withdrawn',
      hint: revocation.reason || 'Open verification to resubmit',
      href: '/exporter/verification',
    },
    pending?.state === 'awaiting_review' && {
      key: 'pending-change',
      tone: 'warning',
      label: 'Company profile change is waiting for review',
      hint: `${pending.changedFields.length} ${pending.changedFields.length === 1 ? 'field' : 'fields'} — your live profile and tick are unchanged until it is approved`,
      href: '/exporter/company',
    },
    pending?.state === 'rejected' && {
      key: 'pending-rejected',
      tone: 'danger',
      label: 'Your profile change was not approved',
      hint: pending.rejectionReason || 'Open your company profile to amend it',
      href: '/exporter/company',
    },
    unreadThreads > 0 && {
      key: 'unread',
      tone: 'warning',
      label: unreadThreads === 1 ? 'An enquiry is waiting for a reply' : `${unreadThreads} enquiries waiting for a reply`,
      hint: 'Buyers see how quickly you answer',
      count: unreadThreads,
      href: '/exporter/chat',
    },
    (counts?.draft ?? 0) > 0 && {
      key: 'drafts',
      tone: 'warning',
      label: `${counts.draft} ${counts.draft === 1 ? 'draft is' : 'drafts are'} not published`,
      hint: 'A draft is invisible to buyers until you publish it',
      count: counts.draft,
      href: '/exporter/products?status=draft',
    },
    status === 'pending' && {
      key: 'start-verification',
      tone: 'warning',
      label: 'You have not sent your documents yet',
      hint: 'Verification adds the tick and removes your product limit',
      href: '/exporter/verification',
    },
  ].filter(Boolean);

  const greeting = greetingFor(new Date(now).getHours());
  const subline = [company?.country ? countryName(company.country) : null, ENTITY_LABELS[company?.entityType]]
    .filter(Boolean)
    .join(' · ');

  // The whole page depends on the org load; everything else degrades in place.
  if (org.isLoading) {
    return (
      <PortalLayout nav={EXPORTER_NAV} wide>
        <SkeletonRows rows={6} />
      </PortalLayout>
    );
  }
  if (org.error) {
    return (
      <PortalLayout nav={EXPORTER_NAV} wide>
        <ErrorState message={apiError(org.error).message} onRetry={() => org.refetch()} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout nav={EXPORTER_NAV} wide>
      {/* ── Hero banner ───────────────────────────────────────────────────── */}
      <header className="rise-in relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 via-primary-800 to-primary-900 text-white shadow-lift">
        <div aria-hidden="true" className="banner-texture pointer-events-none absolute inset-0" />
        <div
          aria-hidden="true"
          className="banner-drift pointer-events-none absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-primary-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="banner-drift-slow pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

        {/* Engraved rings + a diagonal light streak — the admin banner's own
            decoration, so the two consoles read as one product. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -right-16 top-1/2 h-[26rem] w-[26rem] -translate-y-1/2 text-white"
        >
          {[70, 110, 150, 190].map((r, i) => (
            <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeOpacity={0.09 - i * 0.018} strokeWidth="1.5" />
          ))}
          <circle cx="200" cy="130" r="3" fill="currentColor" fillOpacity="0.35" />
          <circle cx="290" cy="230" r="2.5" fill="currentColor" fillOpacity="0.25" />
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-1/2 right-1/4 h-[200%] w-40 rotate-[24deg] bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent"
        />

        <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-start gap-4">
            <BannerMark name={company?.name} logo={company?.logo} />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-white/55">{greeting}</p>
              <h1 className="mt-0.5 min-w-0 break-words text-[26px] font-bold leading-tight sm:text-[30px]">
                {company?.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <BannerStatus status={status} verifiedAt={company?.verifiedAt} revoked={Boolean(revocation)} />
                {subline && <span className="text-[13px] text-white/60">{subline}</span>}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              to="/exporter/products/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-bold text-primary-700 shadow-sm transition-colors hover:bg-primary-50"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Add product
            </Link>
            {company?.slug && (
              <a
                href={`/supplier/${company.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold text-white/85 ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/10"
              >
                View public page
                <ExternalIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/10 px-5 py-2.5 sm:px-7">
          <div className="flex items-center gap-1">
            <p className="text-[12px] text-white/55">
              {updatedAt ? `Updated ${agoLabel(Math.max(0, now - updatedAt))}` : 'Loading…'}
            </p>
            <button
              type="button"
              onClick={refreshAll}
              disabled={anyFetching}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white/75 transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshIcon
                className={`h-3.5 w-3.5 ${anyFetching ? 'animate-spin motion-reduce:animate-none' : ''}`}
                aria-hidden="true"
              />
              {anyFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {company?.slug && <PublicLink slug={company.slug} />}
        </div>
      </header>

      {/* ── Stat bar ──────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-surface-border bg-surface-border shadow-card sm:grid-cols-4">
        <StatCell
          Icon={CheckCircleIcon}
          label="Live"
          value={counts?.active ?? 0}
          hint="visible to buyers"
          href="/exporter/products?status=active"
          accent={{ icon: 'text-success-500', label: 'text-success-700' }}
        />
        <StatCell
          Icon={FileIcon}
          label="Drafts"
          value={counts?.draft ?? 0}
          hint="not published yet"
          href="/exporter/products?status=draft"
          accent={{ icon: 'text-ink-400', label: 'text-ink-600' }}
        />
        <StatCell
          Icon={EyeOffIcon}
          label="Hidden"
          value={counts?.inactive ?? 0}
          hint="unpublished by you"
          href="/exporter/products?status=inactive"
          accent={{ icon: 'text-warning-600', label: 'text-warning-800' }}
        />
        <StatCell
          Icon={ChatIcon}
          label="Unread enquiries"
          value={unreadThreads}
          hint={unreadThreads > 0 ? 'waiting for your reply' : 'nothing waiting'}
          href="/exporter/chat"
          accent={{ icon: 'text-primary-700', label: 'text-primary-700' }}
        />
      </div>

      {/* ── Worklist + rail ───────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Panel
            Icon={AlertIcon}
            tone={actions.length > 0 ? 'warning' : 'success'}
            title="Needs your attention"
            trailing={
              actions.length === 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1 text-[12px] font-semibold text-success-700 ring-1 ring-inset ring-success-200">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success-500" />
                  All clear
                </span>
              ) : null
            }
          >
            <PanelBody
              query={verification}
              empty={
                actions.length === 0 ? (
                  <div className="px-5 py-6">
                    <EmptyState
                      icon={CheckCircleIcon}
                      title="Nothing needs you right now"
                      children="Your documents, your listings and your enquiries are all up to date."
                    />
                  </div>
                ) : null
              }
            >
              <ul className="divide-y divide-surface-border">
                {actions.map((a) => (
                  <li key={a.key}>
                    <ActionRow label={a.label} hint={a.hint} count={a.count} href={a.href} tone={a.tone} />
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>

          <Panel
            Icon={BoxIcon}
            tone="brand"
            title="Recently added"
            to="/exporter/products"
            toLabel={counts?.all ? `All ${nf(counts.all)}` : 'View all'}
          >
            <MixBar counts={counts} />
            <PanelBody
              query={products}
              empty={
                rows.length === 0 ? (
                  <div className="px-5 py-6">
                    <EmptyState
                      icon={BoxIcon}
                      title="No products yet"
                      children="Your first listing is what makes you findable in search."
                      action={
                        <Link
                          to="/exporter/products/new"
                          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-600 px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-700"
                        >
                          <PlusIcon className="h-4 w-4" aria-hidden="true" />
                          Add your first product
                        </Link>
                      }
                    />
                  </div>
                ) : null
              }
            >
              <ul className="divide-y divide-surface-border">
                {rows.slice(0, RECENT).map((p) => (
                  <li key={p.id ?? p._id}>
                    <Link
                      to={`/exporter/products/${p.id ?? p._id}/edit`}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50/60"
                    >
                      <Thumb product={p} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{p.name}</span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                          {p.createdAt ? `Added ${formatDate(p.createdAt)}` : '\u2014'}
                        </span>
                      </span>
                      {/* A takedown never touches `status` (m5-rules §2), so a
                          blocked row is "Live · Taken down" — two chips, exactly
                          as the product table renders it. Dropping the second
                          chip here would have made a moderated listing look
                          healthy on the seller's own home page. */}
                      {p.takedown && <StatusChip label="Taken down" tone="danger" />}
                      <StatusChip
                        label={PRODUCT_STATUS_META[p.status]?.label}
                        tone={PRODUCT_STATUS_META[p.status]?.tone}
                      />
                      <ChevronRightIcon
                        className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        </div>

        {/* ── Rail ────────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel Icon={ShieldIcon} tone={isVerified ? 'success' : 'warning'} title="Verification">
            <div className="flex flex-col gap-3 px-5 py-4">
              {isVerified ? (
                <>
                  <VerifiedTick verified verifiedAt={company?.verifiedAt} />
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    Your tick is live on your public profile and your product limit has been removed.
                  </p>
                </>
              ) : (
                <>
                  <StatusChip status={status} />
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    {status === 'submitted'
                      ? `Your documents are with our team${v?.kycSubmittedAt ? `, sent ${formatDate(v.kycSubmittedAt)}` : ''}. Your profile stays live while we check.`
                      : status === 'rejected'
                        ? 'Send fresh documents and our team will look again. Your profile stays live throughout.'
                        : 'Send your business documents to earn the tick and remove your product limit. Your profile is already public.'}
                  </p>
                </>
              )}
              <Link
                to="/exporter/verification"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 hover:underline"
              >
                {isVerified ? 'View verification' : 'Open verification'}
                <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </Panel>

          {unverifiedCaps && (
            <Panel Icon={ClockIcon} tone="warning" title="Your limits while unverified">
              <div className="flex flex-col gap-4 px-5 py-4">
                <CapMeter
                  label="Live products"
                  used={unverifiedCaps.active.used}
                  limit={unverifiedCaps.active.limit}
                  hint="Taken-down listings do not count against this."
                />
                <CapMeter label="Drafts" used={unverifiedCaps.drafts.used} limit={unverifiedCaps.drafts.limit} />
                <p className="text-[12px] leading-relaxed text-muted">
                  Both limits are removed once your documents are approved. This is a limit on listings, never on your
                  visibility — your profile is public either way.
                </p>
              </div>
            </Panel>
          )}

          <Panel Icon={DocIcon} tone="ink" title="Company profile">
            <div className="flex flex-col gap-3 px-5 py-4">
              <p className="text-[13px] leading-relaxed text-ink-700">
                Your logo, description and company details are what buyers see on your public page.
              </p>
              <Link
                to="/exporter/company"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 hover:underline"
              >
                Edit company profile
                <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </PortalLayout>
  );
}
