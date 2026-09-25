import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LEAD_STATUS, leadsApi, leadsKeys, notesApi, notesKeys } from '../../api/support.js';
import { catalogueApi } from '../../api/catalogue.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { InternalNotes } from '../../components/support/InternalNotes.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { ToolbarSearch } from '../../components/ui/ToolbarSearch.jsx';
import {
  BoxIcon,
  CalendarIcon,
  ChatIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  EyeIcon,
  GlobeIcon,
  HandshakeIcon,
  InfoIcon,
  LockIcon,
  MailIcon,
  PlusIcon,
  RefreshIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from '../../components/ui/icons.jsx';
import { LeadStatusChip } from './Leads.jsx';
import { cp } from '../../lib/consolePath.js';

/**
 * `/admin/leads/:id` — one supplier request (Step 1d, `lead:manage`).
 *
 * Same shape as the staff ticket page: a header card (info on top, actions in
 * their own place, facts in an icon strip), the work in the main column
 * (connected suppliers, then "Connect a supplier"), and a details column —
 * a tabbed drawer below xl.
 *
 * "Connect a supplier" searches the PUBLIC catalogue (what a buyer could see —
 * the only products an enquiry can be opened on). Connecting opens a normal
 * enquiry + chat in the BUYER's name; the seller is told through the existing
 * new-enquiry notification.
 */
const ACTION = {
  'lead.create': 'raised the request',
  'lead.assign': 'assigned it',
  'lead.status': 'changed the status',
  'lead.route': 'connected a supplier',
};

export function LeadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const lead = useQuery({ queryKey: leadsKeys.one(id), queryFn: () => leadsApi.get(id) });
  const timeline = useQuery({ queryKey: leadsKeys.timeline(id), queryFn: () => leadsApi.timeline(id) });
  // The staff list is only for someone who can hand requests out (2026-09-25).
  const canAssign = can(user, 'lead:assign');
  const staff = useQuery({ queryKey: leadsKeys.assignees, queryFn: leadsApi.assignees, enabled: canAssign });

  const apply = (data) => {
    qc.setQueryData(leadsKeys.one(id), data);
    qc.invalidateQueries({ queryKey: leadsKeys.timeline(id) });
    qc.invalidateQueries({ queryKey: leadsKeys.all });
  };
  const route = useMutation({ mutationFn: (productId) => leadsApi.route(id, productId), onSuccess: apply });
  const assign = useMutation({ mutationFn: (a) => leadsApi.assign(id, a), onSuccess: apply });
  const status = useMutation({ mutationFn: (s) => leadsApi.setStatus(id, s), onSuccess: apply });
  const err = route.error || assign.error || status.error;
  const l = lead.data;

  useEffect(() => {
    if (!l) return undefined;
    const previous = document.title;
    document.title = `${l.ref} · Supplier requests — MPX Global`;
    return () => { document.title = previous; };
  }, [l]);

  const canOrg = can(user, 'organisation:read');
  const canChat = can(user, 'conversation:read');
  const closed = l?.status === 'closed';

  const side = (where) => l && (
    <LeadSide
      where={where}
      l={l}
      id={id}
      user={user}
      staff={staff.data ?? []}
      timeline={timeline}
      onAssign={(v) => v && assign.mutate(v)}
      canOrg={canOrg}
      canAssign={canAssign}
    />
  );
  const actions = (
    <StatusActions l={l} pending={status.isPending} onStatus={(s) => status.mutate(s)} />
  );

  return (
    <AdminLayout>
      <Link to={cp('/admin/leads')} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-primary-700">
        <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" /> Supplier requests
      </Link>
      {lead.isLoading && <SkeletonRows rows={6} />}
      {lead.error && <ErrorState message={apiError(lead.error).message} onRetry={lead.refetch} />}

      {l && (
        <>
          <header className="mb-5 overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            <div className="flex items-center gap-4 px-4 py-3.5 sm:px-6 sm:py-5">
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 sm:flex" aria-hidden="true">
                  <HandshakeIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-lg font-bold leading-tight text-ink-900 sm:text-2xl">{l.what}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <LeadStatusChip status={l.status} />
                    {l.routedTo.length > 0 && l.status !== 'routed' && (
                      <span className="rounded-md bg-success-50 px-2 py-0.5 text-[12px] font-semibold text-success-700 ring-1 ring-inset ring-success-100">
                        {l.routedTo.length} supplier{l.routedTo.length === 1 ? '' : 's'} connected
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                {actions}
                <DetailsButton onClick={() => setDetailsOpen(true)} className="xl:hidden" />
              </div>
            </div>

            {/* Below lg the actions get their own bar under a divider. */}
            <div className="flex gap-2 border-t border-surface-border px-4 py-3 sm:px-6 lg:hidden">
              <div className="grid flex-1 auto-cols-fr grid-flow-col gap-2 sm:flex sm:flex-none">{actions}</div>
              <DetailsButton onClick={() => setDetailsOpen(true)} className="sm:ml-auto" />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-surface-border bg-surface-subtle/50 px-4 py-2.5 text-[12.5px] text-ink-600 sm:px-6 sm:py-3 sm:text-[13px]">
              <Fact Icon={TagIcon} title="Reference"><span className="font-mono font-semibold text-ink-800">{l.ref}</span></Fact>
              <Fact Icon={BoxIcon} title="Quantity">{l.quantity ? `${l.quantity.toLocaleString()} ${l.unit ?? ''}` : 'Any quantity'}</Fact>
              <Fact Icon={GlobeIcon} title="Deliver to">{l.destinationCountry ? countryName(l.destinationCountry) ?? l.destinationCountry : 'No destination given'}</Fact>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <CompanyAvatar name={l.buyer.org} size="xs" />
                {canOrg ? (
                  <Link to={cp(`/admin/organisations/${l.buyer.orgId}`)} className="truncate font-semibold text-primary-700 hover:underline">{l.buyer.org}</Link>
                ) : (
                  <span className="truncate font-semibold text-ink-800">{l.buyer.org}</span>
                )}
              </span>
              <Fact Icon={CalendarIcon} title="Raised" className="hidden sm:inline-flex">Raised {formatDate(l.createdAt)}</Fact>
              <Fact Icon={UsersIcon} title="Assigned to">
                {l.assignedTo ? <span className="font-semibold text-ink-800">{l.assignedTo.name}</span> : <span className="font-semibold text-warning-800">Unassigned</span>}
              </Fact>
            </div>
          </header>

          {err && <div className="mb-4"><Alert tone="danger">{apiError(err).message}</Alert></div>}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="min-w-0 space-y-5">
              {l.note && (
                <section className="rounded-2xl border border-warning-200 bg-warning-50/60 p-4 sm:p-5">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-warning-800">
                    <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Buyer&apos;s note to our team
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-800">{l.note}</p>
                  <p className="mt-2 text-[11.5px] text-warning-800">Never sent to suppliers.</p>
                </section>
              )}

              <ConnectedSuppliers l={l} canChat={canChat} />

              {closed ? (
                <p className="flex items-center gap-2 rounded-2xl border border-surface-border bg-white px-5 py-4 text-[13.5px] text-ink-700 shadow-card">
                  <LockIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                  This request is closed. Re-open it to connect more suppliers.
                </p>
              ) : (
                <ConnectSupplier l={l} route={route} />
              )}
            </div>

            <aside className="hidden xl:block">{side('col')}</aside>
          </div>

          <Drawer open={detailsOpen} onClose={() => setDetailsOpen(false)} icon={InfoIcon} title="Details & notes" subtitle={l.ref}>
            {side('drawer')}
          </Drawer>
        </>
      )}
    </AdminLayout>
  );
}

function Fact({ Icon, title, className = 'inline-flex', children }) {
  return (
    <span className={`items-center gap-1.5 ${className}`} title={title}>
      <Icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      {children}
    </span>
  );
}

function DetailsButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Details and notes"
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-white px-3 text-[13px] font-semibold text-ink-800 shadow-sm transition-colors hover:border-primary-300 hover:text-primary-700 ${className}`}
    >
      <InfoIcon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Details &amp; notes</span>
    </button>
  );
}

function StatusActions({ l, pending, onStatus }) {
  if (!l) return null;
  const btn = 'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-[13px] font-semibold shadow-sm transition-colors disabled:opacity-60';
  return l.status === 'closed' ? (
    <button type="button" disabled={pending} onClick={() => onStatus(l.routedTo.length ? 'routed' : 'in_progress')} className={`${btn} border border-ink-200 bg-white text-ink-800 hover:bg-ink-50`}>
      <RefreshIcon className="h-4 w-4" aria-hidden="true" /> Re-open
    </button>
  ) : (
    <button type="button" disabled={pending} onClick={() => onStatus('closed')} className={`${btn} border border-ink-200 bg-white text-ink-800 hover:bg-ink-50`}>
      <LockIcon className="h-4 w-4" aria-hidden="true" /> Close request
    </button>
  );
}

function ConnectedSuppliers({ l, canChat }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
      <h2 className="flex items-center gap-2 border-b border-surface-border px-5 py-3 text-[15px] font-bold text-ink-900">
        Connected suppliers
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-600">{l.routedTo.length}</span>
      </h2>
      {l.routedTo.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-50 text-ink-400" aria-hidden="true">
            <HandshakeIcon className="h-5 w-5" />
          </span>
          <p className="mt-2 text-[13.5px] font-semibold text-ink-800">No suppliers connected yet</p>
          <p className="mt-0.5 text-[12.5px] text-muted">Search the catalogue below and connect the best matches.</p>
        </div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {l.routedTo.map((r) => (
            <li key={r.conversationId} className="flex items-center gap-3 px-5 py-3.5">
              <CompanyAvatar name={r.exporter} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink-900">{r.exporter}</span>
                <span className="block truncate text-xs text-muted">{r.product}</span>
                <span className="block truncate text-[11.5px] text-muted">
                  Connected by {r.by} · {formatDate(r.at)}{r.created ? '' : ' · linked an existing chat'}
                </span>
              </span>
              {canChat && (
                <Link
                  to={cp(`/admin/conversations/${r.conversationId}`)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-[12.5px] font-semibold text-ink-800 shadow-sm hover:bg-ink-50"
                >
                  <ChatIcon className="h-3.5 w-3.5" aria-hidden="true" /> View chat
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConnectSupplier({ l, route }) {
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(draft.trim()), 350);
    return () => clearTimeout(t);
  }, [draft]);
  const results = useQuery({
    queryKey: ['lead-route-search', q],
    queryFn: () => catalogueApi.search({ q, type: 'product', pageSize: 8 }),
    enabled: q.length >= 2,
  });
  const connected = new Set(l.routedTo.map((r) => r.productId));
  const products = results.data?.products ?? [];

  return (
    <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card">
      <h2 className="text-[15px] font-bold text-ink-900">Connect a supplier</h2>
      <p className="mb-3 mt-0.5 text-[13px] text-muted">
        Live listings only. Connecting opens an enquiry from the buyer to that seller.
      </p>

      {/* Exactly what the seller receives — the request text + quantity/destination (goods). */}
      <div className="mb-4 rounded-xl border border-dashed border-ink-200 bg-surface-subtle p-3.5">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
          <EyeIcon className="h-3.5 w-3.5" aria-hidden="true" /> The supplier will receive
        </p>
        <p className="mt-1.5 break-words text-[13.5px] font-medium text-ink-900">{l.what}</p>
        {(l.quantity || l.destinationCountry) && (
          <p className="mt-0.5 text-[12.5px] text-ink-600">
            {l.quantity ? `${l.quantity.toLocaleString()} ${l.unit ?? ''}`.trim() : ''}
            {l.quantity && l.destinationCountry ? ' · ' : ''}
            {l.destinationCountry ? `to ${countryName(l.destinationCountry) ?? l.destinationCountry}` : ''}
          </p>
        )}
      </div>

      <ToolbarSearch id="lead-product-search" label="Search products" value={draft} onChange={setDraft} onClear={() => setDraft('')} placeholder="Search live products, e.g. basmati rice…" />
      {q.length < 2 ? (
        <p className="mt-3 text-[12.5px] text-muted">Type at least two letters to search the catalogue.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-surface-border">
          {results.isLoading ? (
            <SkeletonRows rows={3} />
          ) : products.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No live products match &ldquo;{q}&rdquo;.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {products.map((p) => {
                const done = connected.has(p.id);
                const busy = route.isPending && route.variables === p.id;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <CompanyAvatar name={p.seller?.name ?? '?'} logo={p.seller?.logo} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink-900">{p.name}</span>
                      <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                        {p.seller?.name ?? '—'}
                        {p.seller?.verified && (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-success-700">
                            <CheckCircleIcon className="h-3 w-3" aria-hidden="true" /> Verified
                          </span>
                        )}
                        {p.moq ? <span>· MOQ {p.moq} {p.unit ?? ''}</span> : null}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={done || route.isPending}
                      onClick={() => route.mutate(p.id)}
                      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold shadow-sm transition-colors ${
                        done ? 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-100' : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60'
                      }`}
                    >
                      {done ? <><CheckCircleIcon className="h-4 w-4" aria-hidden="true" /> Connected</> : busy ? 'Connecting…' : <><PlusIcon className="h-4 w-4" aria-hidden="true" /> Connect</>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Details column (xl) — three cards; below xl the same content in a tabbed drawer. */
function LeadSide({ where, l, id, user, staff, timeline, onAssign, canOrg, canAssign }) {
  const [tab, setTab] = useState('details');
  const notesCount = useQuery({ queryKey: notesKeys.list('lead', id), queryFn: () => notesApi.list('lead', id) }).data?.length ?? 0;
  const details = <DetailsBody where={where} l={l} user={user} staff={staff} onAssign={onAssign} canOrg={canOrg} canAssign={canAssign} />;
  const events = <TimelineList timeline={timeline} />;

  if (where === 'drawer') {
    const tabs = [
      { key: 'details', label: 'Details' },
      { key: 'notes', label: 'Notes', count: notesCount },
      { key: 'timeline', label: 'Timeline', count: timeline.data?.length ?? 0 },
    ];
    return (
      <div>
        <div role="tablist" aria-label="Request panels" className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                tab === x.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {x.label}
              {x.count > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === x.key ? 'bg-primary-50 text-primary-700' : 'bg-white/70 text-ink-600'}`}>{x.count}</span>
              )}
            </button>
          ))}
        </div>
        {tab === 'details' && details}
        {tab === 'notes' && (
          <>
            <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-warning-800">
              <LockIcon className="h-3.5 w-3.5" aria-hidden="true" /> Staff only — never shown to the buyer or suppliers.
            </p>
            <InternalNotes subjectType="lead" subjectId={id} bare />
          </>
        )}
        {tab === 'timeline' && events}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card">
        <h2 className="text-[15px] font-bold text-ink-900">Request details</h2>
        <div className="mt-3">{details}</div>
      </section>
      <InternalNotes subjectType="lead" subjectId={id} />
      <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        <h2 className="flex items-center justify-between border-b border-surface-border bg-ink-50/60 px-4 py-2.5 text-sm font-bold text-ink-900">
          Timeline
          {(timeline.data?.length ?? 0) > 0 && <span className="text-[11.5px] font-medium text-muted">{timeline.data.length} events</span>}
        </h2>
        <ScrollToEnd dep={timeline.data?.length} className="max-h-72 overflow-y-auto px-4 py-3">{events}</ScrollToEnd>
      </section>
    </div>
  );
}

function DetailsBody({ where, l, user, staff, onAssign, canOrg, canAssign }) {
  return (
    <>
      {/* Only people in the list — same rule as tickets: once assigned, a request
          moves to someone else, never back to nobody (server enforces it). */}
      <label htmlFor={`lead-assignee-${where}`} className="mb-1.5 block text-[12px] font-semibold text-ink-500">Assigned to</label>
      {canAssign ? (
        <Combobox
          id={`lead-assignee-${where}`}
          value={l.assignedTo?.id ?? ''}
          placeholder="Unassigned"
          options={staff.map((s) => ({ value: s.id, label: s.id === user?.id ? `${s.name} (you)` : s.name, hint: s.role === 'superadmin' ? 'Super admin' : 'Employee' }))}
          onChange={onAssign}
        />
      ) : (
        // No `lead:assign`: read-only, plus "Take this request" when it is
        // unassigned (only reachable with "See all supplier requests").
        <div id={`lead-assignee-${where}`} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5">
          <span className={`text-[13.5px] font-semibold ${l.assignedTo ? 'text-ink-900' : 'text-warning-800'}`}>
            {l.assignedTo ? (l.assignedTo.id === user?.id ? `${l.assignedTo.name} (you)` : l.assignedTo.name) : 'Unassigned'}
          </span>
          {!l.assignedTo && l.status !== 'closed' && (
            <button
              type="button"
              onClick={() => onAssign(user?.id)}
              className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary-600 px-3 text-[12.5px] font-semibold text-white hover:bg-primary-700"
            >
              Take this request
            </button>
          )}
        </div>
      )}
      <dl className="mt-3 divide-y divide-surface-border text-[13px]">
        <Row label="Reference"><span className="font-mono">{l.ref}</span></Row>
        <Row label="Quantity">{l.quantity ? `${l.quantity.toLocaleString()} ${l.unit ?? ''}` : '—'}</Row>
        <Row label="Deliver to">{l.destinationCountry ? countryName(l.destinationCountry) ?? l.destinationCountry : '—'}</Row>
        <Row label="Buyer">
          {canOrg ? <Link to={cp(`/admin/organisations/${l.buyer.orgId}`)} className="text-primary-700 hover:underline">{l.buyer.org}</Link> : l.buyer.org}
        </Row>
        <Row label="Raised by">{l.buyer.name}</Row>
        <Row label="Raised">{formatDate(l.createdAt)} {formatTime(l.createdAt)}</Row>
        {l.closedAt && <Row label="Closed">{formatDate(l.closedAt)}</Row>}
      </dl>
      {l.buyer.email && (
        <a href={`mailto:${l.buyer.email}`} className="mt-3 flex items-center gap-2 rounded-xl bg-surface-subtle px-3 py-2 text-[12.5px] text-ink-700 hover:text-primary-700">
          <MailIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
          <span className="truncate">{l.buyer.email}</span>
        </a>
      )}
    </>
  );
}

function eventIcon(e) {
  switch (e.action) {
    case 'lead.create':
      return { Icon: PlusIcon, tone: 'bg-sky-50 text-sky-700' };
    case 'lead.assign':
      return { Icon: UserIcon, tone: 'bg-amber-50 text-amber-700' };
    case 'lead.route':
      return { Icon: HandshakeIcon, tone: 'bg-success-50 text-success-700' };
    case 'lead.status':
      return e.to === 'closed' ? { Icon: LockIcon, tone: 'bg-ink-100 text-ink-600' } : { Icon: RefreshIcon, tone: 'bg-violet-50 text-violet-700' };
    default:
      return { Icon: InfoIcon, tone: 'bg-ink-100 text-ink-600' };
  }
}

function TimelineList({ timeline }) {
  if (timeline.isLoading) return <SkeletonRows rows={3} />;
  const events = timeline.data ?? [];
  if (events.length === 0) return <p className="text-[13px] text-muted">Nothing recorded yet.</p>;
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-px before:bg-surface-border">
      {events.map((e) => {
        const { Icon, tone } = eventIcon(e);
        return (
          <li key={e.id} className="relative flex gap-2.5 text-[12.5px] text-ink-700">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ring-white ${tone}`} aria-hidden="true">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-ink-900">{e.actor.name}</span> {ACTION[e.action] ?? e.action}
              {e.action === 'lead.assign' && e.to ? <> to <b>{e.to}</b></> : null}
              {e.action === 'lead.status' && e.to ? <> → <b>{LEAD_STATUS[e.to]?.label ?? e.to}</b></> : null}
              <span className="block text-[11.5px] text-muted">{formatDate(e.at)} {formatTime(e.at)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ScrollToEnd({ dep, className, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return <div ref={ref} className={className}>{children}</div>;
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-ink-900">{children}</dd>
    </div>
  );
}
