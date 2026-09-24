import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { adminConversationsApi, conversationKeys } from '../../api/conversations.js';
import { LEAD_STATUS, leadsApi, leadsKeys, reportsApi, reportsKeys, supportApi, supportKeys } from '../../api/support.js';
import { TicketStatusChip } from '../../components/support/TicketStatusChip.jsx';
import { config } from '../../config.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { actionDot, actionLabel } from '../../lib/auditFormat.js';
import { countryName } from '../../lib/countries.js';
import { apiError, formatListTime } from '../../lib/format.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { FreezeChip } from '../../components/chat/FreezeChip.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { TrendChart } from '../../components/ui/TrendChart.jsx';
import {
  AlertIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  BoxIcon,
  BuildingIcon,
  ChartIcon,
  ChatIcon,
  ChevronRightIcon,
  ClockIcon,
  HandshakeIcon,
  HelpIcon,
  HomeIcon,
  ListIcon,
  RefreshIcon,
  UsersIcon,
} from '../../components/ui/icons.jsx';
import { cp } from '../../lib/consolePath.js';

/**
 * M5 screen 12 — the dashboard as an OPERATIONS CONSOLE (owner-directed
 * redesign, 2026-08-18, fourth architecture: "the feel of a company dashboard
 * panel").
 *
 * What "company panel" means here, and what each zone does about it:
 *
 *   toolbar    a working surface, not a greeting card — page title, live
 *              "Updated Xs ago" with a REAL refresh (all four queries refetch,
 *              the icon spins while they do), and the primary actions
 *   stat bar   ONE connected panel with hairline-divided cells — the topline
 *              idiom of enterprise consoles — not five floating cards
 *   chart      the 14-day series beside the needs-action worklist
 *   tables     the verification queue and the latest conversations as REAL
 *              TABLES: column headers, aligned cells, row hover, a trailing
 *              Open link — the single strongest "operations panel" signal
 *   timeline   the audit feed, sign-ins filtered out
 *
 * 🔴 The rules that survive every redesign:
 *   · every zone gated by the same `can()` the sidebar uses (D1); the server
 *     re-checks regardless
 *   · every figure is a server count with a clickable path to its list
 *   · no invented numbers — deltas are sums of the server's own 14-day series
 *   · motion (count-ups, chart draw-in, spin, pulse) dies under
 *     prefers-reduced-motion and never carries meaning alone
 */
const PREVIEW = 5;
const FEED_FETCH = 20;
const FEED_SHOW = 8;

// Server link paths (API names) → console pages. Keys are what the SERVER
// sends and must stay exactly as they are; `cp()` is applied when the href is
// built, so the page lands in the viewer's own console (/admin or /staff).
const ROUTE_FOR = {
  '/admin/orgs': '/admin/organisations',
  '/admin/products': '/admin/products',
  '/admin/conversations': '/admin/conversations',
  '/admin/users': '/admin/users',
};

function hrefOf(link) {
  if (!link?.path) return null;
  const base = cp(ROUTE_FOR[link.path] ?? link.path);
  const query = new URLSearchParams(link.query ?? {}).toString();
  return query ? `${base}?${query}` : base;
}

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function sidesLabel(sides) {
  if (sides?.both) return 'Buyer + Exporter';
  if (sides?.exporter) return 'Exporter';
  if (sides?.buyer) return 'Buyer';
  return 'No side';
}

const nf = (value) => (value ?? 0).toLocaleString(config.locale.numbers);

function agoLabel(ms) {
  if (ms < 45_000) return 'just now';
  const mins = Math.round(ms / 60_000);
  return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
}

/* ── motion ──────────────────────────────────────────────────────────────── */

/**
 * A number that counts up on arrival. The REAL value is what matters: under
 * prefers-reduced-motion it renders immediately, and the animation only runs
 * from 0 to the true figure — never through invented intermediate states.
 */
function AnimatedNumber({ value, decimals = 0 }) {
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
    const duration = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - started) / duration);
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduced]);

  return <>{decimals > 0 ? Number(shown).toFixed(decimals) : nf(Math.round(shown))}</>;
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

function Panel({ Icon, tone, title, accessory = null, trailing = null, to, toLabel = 'View all', children, className = '', style }) {
  return (
    <section
      style={style}
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-surface-border px-5 py-3.5">
        <IconChip Icon={Icon} tone={tone} />
        <h2 className="flex min-w-0 flex-1 items-center gap-2 truncate text-[15px] font-bold text-ink-900">
          {title}
          {accessory}
        </h2>
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

/** A failed PANEL stays inside its own card — the rest of the page still works. */
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
  if (empty) return <p className="px-5 py-4 text-sm text-muted">{empty}</p>;
  return children;
}

/** One cell of the connected stat bar. */
function StatCell({ Icon, label, value, decimals = 0, unit, delta, hint, warn = false, href, accent }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${accent?.icon ?? 'text-ink-400'}`} aria-hidden="true" />
        <span className={`truncate text-[10.5px] font-semibold uppercase tracking-wider ${accent?.label ?? 'text-ink-500'}`}>
          {label}
        </span>
      </span>
      <span className="mt-1.5 flex items-baseline gap-2">
        <span className={`text-[26px] font-bold leading-none tabular-nums ${warn ? 'text-warning-800' : 'text-ink-900'}`}>
          <AnimatedNumber value={value} decimals={decimals} />
        </span>
        {unit && <span className="text-[11px] font-medium text-muted">{unit}</span>}
        {delta && (
          <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-bold text-success-700">{delta}</span>
        )}
      </span>
      {hint && <span className="mt-auto block truncate pt-1 text-[11px] text-muted">{hint}</span>}
    </>
  );
  const cell = 'flex min-w-0 flex-col bg-white p-4';
  return href ? (
    <Link to={href} className={`${cell} transition-colors hover:bg-primary-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300`}>
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
  );
}

/** One row of the needs-action worklist. */
function ActionRow({ label, count, href, hint, tone }) {
  const danger = tone === 'danger';
  const inner = (
    <>
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${danger ? 'bg-danger-500' : 'bg-warning-400'}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-2 text-base font-bold tabular-nums ring-1 ring-inset ${
          danger ? 'bg-danger-50 text-danger-700 ring-danger-200' : 'bg-warning-50 text-warning-800 ring-warning-200'
        }`}
      >
        <AnimatedNumber value={count} />
      </span>
      <ChevronRightIcon
        className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </>
  );
  return href ? (
    <Link to={href} className="group flex w-full items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50/60">
      {inner}
    </Link>
  ) : (
    <div className="flex w-full items-center gap-3 px-5 py-3.5">{inner}</div>
  );
}

function StatusPill({ waiting, onDark = false }) {
  if (waiting > 0) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ring-inset ${
          onDark ? 'bg-white/10 text-warning-200 ring-white/15' : 'bg-warning-50 text-warning-800 ring-warning-200'
        }`}
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-400 opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-warning-500" />
        </span>
        {nf(waiting)} waiting
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ring-inset ${
        onDark ? 'bg-white/10 text-success-200 ring-white/15' : 'bg-success-50 text-success-700 ring-success-200'
      }`}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success-500" />
      All clear
    </span>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75 motion-reduce:hidden" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
    </span>
  );
}

/** A row of clickable counts — each opens its page already filtered. `warn`
 * tints a non-zero count (something needs someone). */
function CountStrip({ items, last = false }) {
  return (
    <div className={`grid grid-cols-2 gap-px bg-surface-border sm:grid-cols-4 ${last ? '' : 'border-b border-surface-border'}`}>
      {items.map((c) => {
        const hot = c.warn && c.value > 0;
        return (
          <Link key={c.label} to={c.to} className="group bg-white px-5 py-3 transition-colors hover:bg-ink-50">
            <p className={`text-xl font-bold tabular-nums ${hot ? 'text-warning-800' : c.value ? 'text-ink-900' : 'text-ink-400'}`}>{c.value ?? 0}</p>
            <p className="text-[12px] font-medium text-muted group-hover:text-primary-700">{c.label}</p>
          </Link>
        );
      })}
    </div>
  );
}

const TH = 'px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-ink-500';

/* ── the page ────────────────────────────────────────────────────────────── */

export function Dashboard() {
  const { user: me } = useAuth();

  const canOrgs = can(me, 'organisation:read');
  const canConvs = can(me, 'conversation:read');
  const canAudit = can(me, 'audit:read');
  const canVerify = can(me, 'buyer:approve', 'exporter:verify');
  const canSupport = can(me, 'support:read');
  const canLeads = can(me, 'lead:manage');

  // The chart window (owner, 2026-08-19). Server-allowlisted; the whole
  // dashboard payload rides the same call, so the stat-bar deltas follow the
  // selected window and their labels say so.
  const [rangeDays, setRangeDays] = useState(14);
  const dash = useQuery({
    queryKey: ['admin', 'dashboard', { days: rangeDays }],
    queryFn: () => adminApi.dashboard({ days: rangeDays }),
    placeholderData: (prev) => prev,
  });
  const queue = useQuery({
    queryKey: ['admin', 'orgs', { verification: 'submitted', preview: PREVIEW }],
    queryFn: () => adminApi.listOrgs({ verification: 'submitted', pageSize: PREVIEW }),
    enabled: canOrgs,
  });
  const convs = useQuery({
    queryKey: conversationKeys.admin.list({ preview: PREVIEW }),
    queryFn: () => adminConversationsApi.list({ limit: PREVIEW }),
    enabled: canConvs,
  });
  // Step 1b · the Support section (owner, 2026-09-24): open tickets and who holds each.
  const support = useQuery({
    queryKey: supportKeys.overview,
    queryFn: supportApi.overview,
    enabled: canSupport,
  });
  // Step 1d · supplier requests — the counts, so a new request is never invisible.
  const leads = useQuery({ queryKey: leadsKeys.overview, queryFn: leadsApi.overview, enabled: canLeads });
  // Step 1e · "My work" — what is waiting on me + my last 30 days.
  const mine = useQuery({ queryKey: reportsKeys.myWork, queryFn: reportsApi.myWork });
  const activity = useQuery({
    queryKey: adminCatalogueKeys.audit({ preview: FEED_FETCH }),
    queryFn: () => adminCatalogueApi.audit({ pageSize: FEED_FETCH }),
    enabled: canAudit,
  });

  const anyFetching = dash.isFetching || queue.isFetching || convs.isFetching || activity.isFetching || support.isFetching;
  const refreshAll = () => {
    dash.refetch();
    if (canOrgs) queue.refetch();
    if (canConvs) convs.refetch();
    if (canAudit) activity.refetch();
    if (canSupport) support.refetch();
    if (canLeads) leads.refetch();
    mine.refetch();
  };

  // "Updated Xs ago" — the clock lives in STATE (the compiler rule forbids
  // Date.now() during render), ticking every 30s and on each refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (dash.isLoading) {
    return (
      <AdminLayout>
        <SkeletonRows rows={8} />
      </AdminLayout>
    );
  }
  if (dash.error) {
    const e = apiError(dash.error);
    return (
      <AdminLayout>
        <ErrorState title="We couldn't load the dashboard" message={e.message} requestId={e.requestId} onRetry={dash.refetch} />
      </AdminLayout>
    );
  }

  const { tiles = {}, health = {}, totals = {}, series } = dash.data ?? {};
  const orgs = totals.organisations;
  const bothPending = tiles.bothSidesPending;
  const turnaround = health.verification;

  const ACTIONS = [
    { key: 'pendingBuyerVerifications', label: 'Buyer verifications', hint: 'Submitted, awaiting review' },
    { key: 'pendingExporterVerifications', label: 'Exporter verifications', hint: 'Submitted, awaiting review' },
    { key: 'rejectedAwaitingResubmit', label: 'Rejected, awaiting resubmit', hint: 'Waiting on the company, not on staff' },
    { key: 'blockedProducts', label: 'Products taken down', tone: 'danger', hint: 'Hidden from the public catalogue' },
    {
      key: 'nearingPurge',
      label: 'Nearing purge',
      tone: 'danger',
      hint: (tile) => `Down ${tile.warnFromDays}+ days — deleted at ${tile.afterDays}`,
    },
  ]
    .filter((a) => tiles[a.key])
    .map((a) => ({ ...a, tile: tiles[a.key] }));

  const pressing = ACTIONS.filter((a) => a.tile.count > 0);
  const clear = ACTIONS.filter((a) => !a.tile.count);
  const waiting = pressing.reduce((n, a) => n + a.tile.count, 0);
  const pendingChangeReviews = tiles.pendingChangeReviews?.count ?? 0;
  const pendingReview =
    (tiles.pendingBuyerVerifications?.count ?? 0) +
    (tiles.pendingExporterVerifications?.count ?? 0) +
    pendingChangeReviews;
  const hasVerifyTiles = Boolean(tiles.pendingBuyerVerifications || tiles.pendingExporterVerifications);
  const nothingAtAll = ACTIONS.length === 0 && !turnaround && Object.keys(totals).length === 0;

  const firstName = (me?.name ?? '').trim().split(/\s+/)[0] || 'there';
  const dateLine = new Intl.DateTimeFormat(config.locale.dates, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const orgDelta = series?.organisations?.reduce((a, b) => a + b, 0) ?? 0;
  const enqDelta = series?.enquiries?.reduce((a, b) => a + b, 0) ?? 0;

  const chartSeries = series
    ? [
        series.organisations && {
          key: 'orgs',
          label: 'New companies',
          values: series.organisations,
          colorClass: 'text-primary-600',
          dotClass: 'bg-primary-600',
        },
        // 🔴 Brand red × the LOGO's navy — 124° of hue apart and 2.0:1 in
        // lightness, so the two lines are tellable apart at a glance and for a
        // colour-blind reader (which red × green would not be).
        //
        // ⚠️ This was `warning-500` (amber) until 2026-09-22, chosen when the
        // brand was BLUE: blue × amber sit 166° apart. The red theme collapsed
        // that to 40° — two warm colours — and a chart whose series cannot be
        // separated is a broken chart, not a restyled one. If the brand colour
        // ever moves again, re-measure this pairing; do not assume it survived.
        series.enquiries && {
          key: 'enq',
          label: 'New enquiries',
          values: series.enquiries,
          colorClass: 'text-navy',
          dotClass: 'bg-navy',
        },
      ].filter(Boolean)
    : [];

  const stats = [
    hasVerifyTiles && {
      key: 'pending',
      Icon: BadgeCheckIcon,
      label: 'Pending review',
      value: pendingReview,
      warn: pendingReview > 0,
      // The two kinds are different work: a first look vs a diff check
      // (owner, 2026-08-19 — "one number + hint").
      hint:
        pendingChangeReviews > 0
          ? `${nf(pendingReview - pendingChangeReviews)} new · ${nf(pendingChangeReviews)} changes`
          : turnaround?.averageDaysToVerify != null
            ? `avg ${turnaround.averageDaysToVerify} days to clear`
            : 'submitted & waiting',
      accent: { icon: 'text-warning-500', label: 'text-warning-700' },
      href: canVerify ? cp('/admin/verification') : undefined,
    },
    orgs && {
      key: 'companies',
      Icon: BuildingIcon,
      label: 'Companies',
      value: (orgs.buyerOnly ?? 0) + (orgs.exporterOnly ?? 0) + (orgs.both ?? 0),
      delta: orgDelta > 0 ? `+${nf(orgDelta)}` : undefined,
      hint: orgDelta > 0 ? `in ${rangeDays} days` : `none new in ${rangeDays} days`,
      accent: { icon: 'text-primary-500', label: 'text-primary-700' },
      href: cp('/admin/organisations'),
    },
    totals.activeProducts != null && {
      key: 'products',
      Icon: BoxIcon,
      label: 'Live products',
      value: totals.activeProducts,
      hint: 'in the public catalogue',
      accent: { icon: 'text-success-500', label: 'text-success-700' },
      href: cp('/admin/products?status=active'),
    },
    totals.conversations != null && {
      key: 'conversations',
      Icon: ChatIcon,
      label: 'Conversations',
      value: totals.conversations,
      delta: enqDelta > 0 ? `+${nf(enqDelta)}` : undefined,
      hint: enqDelta > 0 ? `enquiries in ${rangeDays} days` : `no new enquiries in ${rangeDays} days`,
      accent: { icon: 'text-primary-700', label: 'text-primary-700' },
      href: cp('/admin/conversations'),
    },
    totals.users != null && {
      key: 'accounts',
      Icon: UsersIcon,
      label: 'Accounts',
      value: totals.users,
      hint: 'buyers, exporters & staff',
      accent: { icon: 'text-ink-500', label: 'text-ink-700' },
      href: cp('/admin/users'),
    },
    turnaround?.averageDaysToVerify != null && {
      key: 'turnaround',
      Icon: ClockIcon,
      label: 'Average days to verify',
      value: turnaround.averageDaysToVerify,
      decimals: 1,
      hint: `across ${nf(turnaround.sample)} ${turnaround.sample === 1 ? 'company' : 'companies'}`,
      accent: { icon: 'text-warning-600', label: 'text-warning-800' },
    },
  ].filter(Boolean);

  const feedAll = activity.data?.entries ?? [];
  // Sign-ins are noise when real actions exist — but when they are ALL that
  // exists, an empty card is worse than showing them.
  const feedActions = feedAll.filter((r) => !r.action.startsWith('auth.'));
  const feedIsAuthOnly = feedActions.length === 0 && feedAll.length > 0;
  const feed = (feedIsAuthOnly ? feedAll : feedActions).slice(0, FEED_SHOW);
  const queueRows = queue.data?.organisations ?? [];
  // The verification queue panel shows only while it has something (or is loading / failed).
  const showQueue = canOrgs && (queue.isLoading || Boolean(queue.error) || queueRows.length > 0);
  const convRows = convs.data?.conversations ?? [];

  // The panels about MY work — for an employee they come FIRST (their
  // dashboard is their to-do list); a superadmin keeps the platform view on top.
  const isSuper = me?.role === 'superadmin';
  // The platform-growth chart is the super admin's view (owner, 2026-09-24);
  // an employee's dashboard is their work, not platform trends.
  const showChart = isSuper && chartSeries.length > 0;
  const workPanels = (
    <>
    {/* ── My work (Step 1e) ───────────────────────────────────────────── */}
    <Panel Icon={UsersIcon} tone="brand" title="My work" to={cp('/admin/reports')} toLabel="My report" className="rise-in">
      <PanelBody query={mine}>
        {mine.data && (
          <div className="grid gap-px bg-surface-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="bg-white">
              <p className="px-5 pb-1 pt-3 text-[12px] font-semibold text-ink-500">Waiting on me</p>
              {!mine.data.canTickets && !mine.data.canLeads ? (
                <p className="px-5 pb-4 text-sm text-muted">You don&apos;t handle support tickets or supplier requests.</p>
              ) : mine.data.tickets.length + mine.data.leads.length === 0 ? (
                <p className="px-5 pb-4 text-sm text-muted">Nothing assigned to you right now.</p>
              ) : (
                <ul className="divide-y divide-surface-border">
                  {mine.data.tickets.map((t) => (
                    <li key={`t${t.id}`}>
                      <Link to={cp(`/admin/support/${t.id}`)} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50">
                        <HelpIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[13.5px] ${t.unread ? 'font-bold' : 'font-semibold'} text-ink-900`}>{t.subject}</span>
                          <span className="block truncate text-xs text-muted"><span className="font-mono">{t.ref}</span> · {t.org}</span>
                        </span>
                        <TicketStatusChip status={t.status} size="sm" />
                      </Link>
                    </li>
                  ))}
                  {mine.data.leads.map((l) => (
                    <li key={`l${l.id}`}>
                      <Link to={cp(`/admin/leads/${l.id}`)} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50">
                        <HandshakeIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink-900">{l.what}</span>
                          <span className="block truncate text-xs text-muted"><span className="font-mono">{l.ref}</span> · {l.org}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${LEAD_STATUS[l.status]?.cls ?? ''}`}>{LEAD_STATUS[l.status]?.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white">
              <p className="px-5 pb-1 pt-3 text-[12px] font-semibold text-ink-500">My last 30 days</p>
              {mine.data.last30 && mine.data.last30.total > 0 ? (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 pb-4 pt-1">
                  {mine.data.columns
                    .filter((c) => mine.data.last30.counts[c.key] > 0)
                    .map((c) => (
                      <li key={c.key} className="flex items-baseline gap-2">
                        <span className="text-lg font-bold tabular-nums text-ink-900">{mine.data.last30.counts[c.key]}</span>
                        <span className="text-[12px] leading-tight text-muted">{c.label}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="px-5 pb-4 text-sm text-muted">No recorded actions yet.</p>
              )}
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>

    {/* ── Support tickets (Step 1b) ─────────────────────────────────── */}
    {canSupport && (
      <Panel
        Icon={HelpIcon}
        tone="brand"
        title="Support tickets"
        to={cp('/admin/support')}
        toLabel="Open queue"
        className="rise-in"
      >
        <PanelBody query={support}>
          {support.data && (
            <>
              {/* The SAME four counts as the Support page, each opening it on that filter. */}
              <CountStrip
                items={[
                  { label: 'Needs a reply', value: support.data.counts.needsReply, warn: true, to: cp('/admin/support?view=needs_reply') },
                  { label: 'Unassigned', value: support.data.counts.unassigned, warn: true, to: cp('/admin/support?view=unassigned') },
                  { label: 'Waiting on company', value: support.data.counts.waiting, to: cp('/admin/support?view=waiting') },
                  { label: 'Resolved · 7 days', value: support.data.counts.resolved7d, to: cp('/admin/support?view=resolved') },
                ]}
              />
              {support.data.openTickets.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">No open tickets — all caught up.</p>
              ) : (
                <ul className="divide-y divide-surface-border">
                  {support.data.openTickets.map((t) => (
                    <li key={t.id}>
                      <Link to={cp(`/admin/support/${t.id}`)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-label="New from the company" />}
                            <span className={`truncate text-[14px] ${t.unread ? 'font-bold' : 'font-semibold'} text-ink-900`}>{t.subject}</span>
                          </span>
                          <span className="block truncate text-xs text-muted">
                            <span className="font-mono">{t.ref}</span> · {t.org.name} · {formatListTime(t.lastMessageAt)}
                          </span>
                        </span>
                        <span className="hidden shrink-0 sm:block">
                          {t.assignedTo ? (
                            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[12px] font-semibold text-ink-700">{t.assignedTo.name}</span>
                          ) : (
                            <span className="rounded-full bg-warning-50 px-2.5 py-0.5 text-[12px] font-semibold text-warning-800">Unassigned</span>
                          )}
                        </span>
                        <TicketStatusChip status={t.status} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </PanelBody>
      </Panel>
    )}

    {/* ── Supplier requests (Step 1d) — counts only; the page has the list. */}
    {canLeads && (
      <Panel Icon={HandshakeIcon} tone="brand" title="Supplier requests" to={cp('/admin/leads')} toLabel="Open requests" className="rise-in">
        <PanelBody query={leads}>
          {leads.data && (
            <CountStrip
              items={[
                { label: 'New', value: leads.data.counts.new, warn: true, to: cp('/admin/leads?view=new') },
                { label: 'Finding suppliers', value: leads.data.counts.inProgress, to: cp('/admin/leads?view=finding') },
                { label: 'Unassigned', value: leads.data.counts.unassigned, warn: true, to: cp('/admin/leads?view=unassigned') },
                { label: 'Connected · 7 days', value: leads.data.counts.routed7d, to: cp('/admin/leads?view=routed') },
              ]}
              last
            />
          )}
        </PanelBody>
      </Panel>
    )}
    </>
  );

  return (
    <AdminLayout>
      {/* ── The greeting banner — dark, full width (owner, 2026-08-18) ────── */}
      <header className="rise-in relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 via-primary-800 to-primary-900 text-white shadow-lift">
        {/* Layered background: dot grid → breathing glows → engraved rings →
            a diagonal light streak → top edge highlight. All decoration is
            white or brand tokens at low alpha; all motion dies under
            prefers-reduced-motion. */}
        <div aria-hidden="true" className="banner-texture pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="banner-drift pointer-events-none absolute -left-24 -bottom-36 h-80 w-80 rounded-full bg-primary-500/25 blur-3xl" />
        <div aria-hidden="true" className="banner-drift-slow pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl" />
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
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

        <div className="relative flex flex-wrap items-center justify-between gap-5 p-6 sm:p-7">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">{dateLine}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                {greetingFor(new Date().getHours())}, {firstName}
              </h1>
              {ACTIONS.length > 0 && <StatusPill waiting={waiting} onDark />}
            </div>
            <p className="mt-1.5 text-sm text-white/65">Every number below opens the list it counts.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/10 px-4 text-[13px] font-medium text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <RefreshIcon
                className={`h-4 w-4 ${anyFetching ? 'animate-spin motion-reduce:animate-none' : ''}`}
                aria-hidden="true"
              />
              {anyFetching ? 'Refreshing…' : `Updated ${agoLabel(Math.max(0, now - (dash.dataUpdatedAt ?? now)))}`}
            </button>
            {canVerify && (
              <Link
                to={cp('/admin/verification')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-primary-700 shadow-sm transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Review verifications
                {pendingReview > 0 && (
                  <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    {nf(pendingReview)}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      </header>

      {nothingAtAll ? (
        <EmptyState icon={HomeIcon} title="You don't have any access yet">
          Your account has no permissions, so there is nothing to work on here. Ask a super admin to
          grant you access on the Staff page — it takes effect immediately, no need to sign in again.
        </EmptyState>
      ) : (
        <div className="grid gap-5">
          {!isSuper && workPanels}

          {/* ── The stat bar — one connected panel, hairline-divided ──────── */}
          {stats.length > 0 && (
            <div className="rise-in overflow-hidden rounded-2xl border border-surface-border shadow-card" style={{ animationDelay: '60ms' }}>
              {/* Exactly as many columns as THIS person has stats (permissions
                  decide which exist) — a fixed six left grey holes for an
                  employee with one or two. An odd last cell spans on phones. */}
              <div
                className={`grid gap-px bg-surface-border ${stats.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} sm:[grid-template-columns:repeat(var(--stat-cols),minmax(0,1fr))]`}
                style={{ '--stat-cols': Math.min(stats.length, 6) }}
              >
                {stats.map(({ key, ...k }, i) => (
                  <div key={key} className={`flex ${stats.length % 2 === 1 && i === stats.length - 1 && stats.length > 1 ? 'col-span-2 sm:col-span-1' : ''} [&>*]:flex-1`}>
                    <StatCell {...k} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Chart × worklist ─────────────────────────────────────────── */}
          {/* `empty:hidden` — a person who sees neither the chart nor "Needs action" gets no empty row. */}
          <div className="grid items-stretch gap-5 empty:hidden lg:grid-cols-5">
            {showChart && (
              <Panel
                Icon={ChartIcon}
                title="Platform activity"
                accessory={
                  <span className="hidden text-[11px] font-medium normal-case text-ink-400 sm:inline">
                    cumulative · last {rangeDays} days
                  </span>
                }
                trailing={
                  <div className="flex items-center gap-0.5 rounded-lg bg-ink-50 p-0.5 max-sm:w-full" role="group" aria-label="Chart window">
                    {[7, 14, 30, 90].map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={rangeDays === d}
                        onClick={() => setRangeDays(d)}
                        className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 max-sm:min-h-[36px] max-sm:flex-1 ${
                          rangeDays === d ? 'bg-white text-primary-700 shadow-card' : 'text-ink-500 hover:text-ink-800'
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                }
                className={`rise-in ${ACTIONS.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}`}
                style={{ animationDelay: '140ms' }}
              >
                <div className="px-5 pb-5 pt-4">
                  <TrendChart days={series.days} series={chartSeries} />
                </div>
              </Panel>
            )}

            {ACTIONS.length > 0 && (
              <Panel
                Icon={BadgeCheckIcon}
                tone={pressing.length > 0 ? 'warning' : 'success'}
                title="Needs action"
                accessory={
                  pressing.length > 0 ? (
                    <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-800">
                      {nf(waiting)}
                    </span>
                  ) : null
                }
                className={`rise-in ${showChart ? 'lg:col-span-2' : 'lg:col-span-5'}`}
                style={{ animationDelay: '200ms' }}
              >
                {pressing.length === 0 ? (
                  <div className="flex flex-1 items-center gap-3 px-5 py-6">
                    <IconChip Icon={BadgeCheckIcon} tone="success" />
                    <p className="text-sm font-medium text-success-800">
                      Every queue is empty — nothing waiting for review, nothing rejected, nothing taken down.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-1 flex-col divide-y divide-surface-border">
                    {pressing.map((a) => (
                      <li key={a.key} className="flex min-h-0 flex-1 items-stretch">
                        <ActionRow
                          label={a.label}
                          count={a.tile.count}
                          href={hrefOf(a.tile.link)}
                          tone={a.tone}
                          hint={typeof a.hint === 'function' ? a.hint(a.tile) : a.hint}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {bothPending?.count > 0 && (
                  <p className="flex items-start gap-2 border-t border-warning-200 bg-warning-50 px-5 py-2.5 text-xs text-warning-800">
                    <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {nf(bothPending.count)} of these {bothPending.count === 1 ? 'company is' : 'companies are'} both
                      buyer and exporter. {bothPending.note}
                    </span>
                  </p>
                )}

                {pressing.length > 0 && clear.length > 0 && (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-surface-border px-5 py-3 text-xs text-muted">
                    <span className="font-medium">Nothing waiting:</span>
                    {clear.map((a, i) => (
                      <span key={a.key}>
                        {hrefOf(a.tile.link) ? (
                          <Link to={hrefOf(a.tile.link)} className="hover:text-primary-700 hover:underline">
                            {a.label.toLowerCase()}
                          </Link>
                        ) : (
                          a.label.toLowerCase()
                        )}
                        {i < clear.length - 1 ? ' ·' : ''}
                      </span>
                    ))}
                  </p>
                )}
              </Panel>
            )}
          </div>

          {isSuper && workPanels}

          {/* ── Work queues, as real tables ──────────────────────────────── */}
          {(canOrgs || canAudit) && (
            <div className="grid gap-5 lg:grid-cols-3">
              {showQueue && (
                <Panel
                  Icon={BadgeCheckIcon}
                  tone="warning"
                  title="Verification queue"
                  to={cp('/admin/verification')}
                  toLabel="Open queue"
                  className={`rise-in ${canAudit ? 'lg:col-span-2' : 'lg:col-span-3'}`}
                  style={{ animationDelay: '260ms' }}
                >
                  <PanelBody query={queue}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-surface-border bg-ink-50/60">
                          <tr>
                            <th scope="col" className={TH}>Company</th>
                            <th scope="col" className={`${TH} hidden sm:table-cell`}>Country</th>
                            <th scope="col" className={`${TH} hidden md:table-cell`}>Side</th>
                            <th scope="col" className={TH}>Status</th>
                            <th scope="col" className={TH}><span className="sr-only">Open</span></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                          {queueRows.map((org) => (
                            <tr key={org.id} className="transition-colors hover:bg-ink-50/60">
                              <td className="w-full max-w-0 px-4 py-2.5">
                                <span className="flex items-center gap-2.5">
                                  <CompanyAvatar name={org.name} logo={org.logo} size="xs" />
                                  <span className="min-w-0 truncate font-semibold text-ink-900">{org.name}</span>
                                </span>
                              </td>
                              <td className="hidden whitespace-nowrap px-4 py-2.5 text-ink-600 sm:table-cell">
                                {countryName(org.country) ?? org.country ?? '—'}
                              </td>
                              <td className="hidden whitespace-nowrap px-4 py-2.5 text-ink-600 md:table-cell">
                                {sidesLabel(org.sides)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5">
                                <StatusChip status={org.verification} />
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                                <Link
                                  to={cp(`/admin/organisations/${org.id}`)}
                                  className="text-[13px] font-semibold text-primary-700 hover:underline"
                                >
                                  Open
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </PanelBody>
                </Panel>
              )}

              {canAudit && (
                <Panel
                  Icon={ListIcon}
                  tone="ink"
                  title="Recent activity"
                  accessory={<LiveDot />}
                  to={cp('/admin/audit')}
                  toLabel="Open"
                  // Beside the queue it is one column; with no queue to show it takes
                  // the whole row (it used to stay a third wide next to empty space).
                  className={`rise-in ${showQueue ? '' : 'lg:col-span-3'}`}
                  style={{ animationDelay: '320ms' }}
                >
                  <PanelBody query={activity} empty={feed.length === 0 ? 'Nothing recorded yet.' : null}>
                    <div className="relative">
                      {/* The connecting line only reads in a single column. */}
                      <span aria-hidden="true" className={`absolute bottom-4 left-[23px] top-4 w-px bg-ink-100 ${showQueue ? '' : 'lg:hidden'}`} />
                      {/* Wide: two COLUMNS (newest runs down the first, then the second) — a
                          grid would zig-zag left/right and break the time order. */}
                      <ul className={showQueue ? '' : 'lg:columns-2 lg:gap-x-2'}>
                        {feed.map((row) => (
                          <li key={row.id} className="relative flex break-inside-avoid gap-3 px-5 py-2.5">
                            <span
                              aria-hidden="true"
                              className={`z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ring-2 ring-white ${actionDot(row.action)}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-[13px] font-semibold text-ink-900">{actionLabel(row.action)}</p>
                                <time dateTime={row.occurredAt ?? undefined} className="shrink-0 text-[11px] tabular-nums text-ink-400">
                                  {formatListTime(row.occurredAt)}
                                </time>
                              </div>
                              <p className="truncate text-xs text-muted">
                                {row.actor?.name ?? 'System'}
                                {row.target?.name ? ` · ${row.target.name}` : row.target?.type ? ` · ${row.target.type}` : ''}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {feedIsAuthOnly && (
                      <p className="mt-auto border-t border-surface-border px-5 py-2.5 text-[11px] text-muted">
                        Only sign-ins so far — reviews and moderation will appear here as they happen.
                      </p>
                    )}
                  </PanelBody>
                </Panel>
              )}
            </div>
          )}

          {canConvs && (
            <Panel
              Icon={ChatIcon}
              title="Latest conversations"
              to={cp('/admin/conversations')}
              toLabel="View all"
              className="rise-in"
              style={{ animationDelay: '380ms' }}
            >
              <PanelBody query={convs} empty={convRows.length === 0 ? 'No conversations yet.' : null}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-surface-border bg-ink-50/60">
                      <tr>
                        <th scope="col" className={TH}>Parties</th>
                        <th scope="col" className={`${TH} hidden md:table-cell`}>Product</th>
                        <th scope="col" className={TH}>State</th>
                        <th scope="col" className={`${TH} hidden sm:table-cell`}>Last activity</th>
                        <th scope="col" className={TH}><span className="sr-only">Open</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {convRows.map((c) => (
                        <tr key={c.id} className={`transition-colors ${c.frozen ? 'bg-danger-50/40' : 'hover:bg-ink-50/60'}`}>
                          <td className="w-full max-w-0 px-4 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                                <CompanyAvatar name={c.buyerOrg?.name ?? ''} logo={c.buyerOrg?.logo} size="xs" className="outline outline-2 outline-white" />
                                <CompanyAvatar name={c.exporterOrg?.name ?? ''} logo={c.exporterOrg?.logo} size="xs" className="outline outline-2 outline-white" />
                              </span>
                              <span className="min-w-0 truncate font-semibold text-ink-900">
                                {c.buyerOrg?.name} <span className="font-normal text-ink-400">×</span> {c.exporterOrg?.name}
                              </span>
                            </span>
                          </td>
                          <td className="hidden max-w-[16rem] px-4 py-2.5 md:table-cell">
                            <span className="flex min-w-0 items-center gap-1.5 text-ink-600">
                              <BoxIcon className="h-3 w-3 shrink-0 text-ink-400" aria-hidden="true" />
                              <span className="truncate">{c.product?.name}</span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            {c.frozenLabel?.text ? (
                              <FreezeChip label={c.frozenLabel} size="sm" />
                            ) : (
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-50 px-2 py-0.5 text-[11.5px] font-semibold leading-4 text-success-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                                Open
                              </span>
                            )}
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-2.5 text-[13px] tabular-nums text-ink-500 sm:table-cell">
                            {formatListTime(c.lastMessageAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right">
                            <Link
                              to={cp(`/admin/conversations/${c.id}`)}
                              className="text-[13px] font-semibold text-primary-700 hover:underline"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PanelBody>
            </Panel>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
