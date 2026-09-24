import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notesApi, notesKeys, supportApi, supportKeys } from '../../api/support.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import { CATEGORY_LABEL, TICKET_AUTO_CLOSE_DAYS, autoCloseDate } from '../../lib/support.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { InternalNotes } from '../../components/support/InternalNotes.jsx';
import { ReplyBox } from '../../components/support/ReplyBox.jsx';
import { TicketStatusChip } from '../../components/support/TicketStatusChip.jsx';
import { TicketThread } from '../../components/support/TicketThread.jsx';
import { TopicIcon } from '../../components/support/TopicIcon.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
  InfoIcon,
  LinkIcon,
  LockIcon,
  MailIcon,
  RefreshIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from '../../components/ui/icons.jsx';
import { LogPhrase, logIcon } from './Support.jsx';
import { cp } from '../../lib/consolePath.js';

/**
 * `/admin/support/:id` — one ticket, staff view (Step 1b, `support:manage`).
 *
 * Same shape as the company's ticket page: a header, a conversation panel with
 * the reply box pinned at its foot, and a details column (a drawer below xl).
 * Replies go out as "MPX Global Support"; the first reply takes an unassigned
 * ticket and moves it to In progress; a reply on a closed ticket re-opens it.
 * Every action here writes one row of the ticket log.
 */
export function SupportTicket() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const q = useQuery({ queryKey: supportKeys.ticket(id), queryFn: () => supportApi.ticket(id), refetchInterval: 30_000 });
  const timeline = useQuery({ queryKey: supportKeys.timeline(id), queryFn: () => supportApi.timeline(id) });
  const staff = useQuery({ queryKey: supportKeys.assignees, queryFn: supportApi.assignees });
  const t = q.data?.ticket;
  const messages = q.data?.messages ?? [];

  useEffect(() => {
    if (!t) return undefined;
    const previous = document.title;
    document.title = `${t.ref} · Support — MPX Global`;
    return () => { document.title = previous; };
  }, [t]);

  // The thread scrolls inside the panel and opens at the newest message.
  const threadRef = useRef(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const apply = (data) => {
    qc.setQueryData(supportKeys.ticket(id), data);
    qc.invalidateQueries({ queryKey: supportKeys.timeline(id) });
    qc.invalidateQueries({ queryKey: supportKeys.staffAll });
  };
  const reply = useMutation({ mutationFn: (v) => supportApi.staffReply(id, v), onSuccess: apply });
  const status = useMutation({ mutationFn: (s) => supportApi.setStatus(id, s), onSuccess: apply });
  const assign = useMutation({ mutationFn: (a) => supportApi.assign(id, a), onSuccess: apply });
  const err = reply.error || status.error || assign.error;

  const canOrg = can(user, 'organisation:read');
  // Split support grants (2026-09-24). The server re-checks every one; these
  // only decide which controls to show.
  const canReply = can(user, 'support:reply');
  const canAssign = can(user, 'support:assign');
  const canStatus = can(user, 'support:status');
  const resolved = t?.status === 'resolved';
  const closes = t && !resolved ? autoCloseDate(t.awaitingCompanySince) : null;

  // Rendered in the xl column AND the drawer (below xl) — the id suffix keeps
  // the assignee field's id unique while both are mounted.
  const side = (where) => t && (
    <TicketSide
      where={where}
      t={t}
      id={id}
      user={user}
      staff={staff.data ?? []}
      timeline={timeline}
      onAssign={(v) => v && assign.mutate(v)}
      canAssign={canAssign}
      canReply={canReply}
      canOrg={canOrg}
    />
  );

  return (
    <AdminLayout>
      <Link to={cp('/admin/support')} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-primary-700">
        <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" /> Support
      </Link>

      {q.isLoading && <SkeletonRows rows={6} />}
      {q.error && <ErrorState message={apiError(q.error).message} onRetry={q.refetch} />}

      {t && (
        <>
          {/* Header card — same pattern as the organisation page: identity + actions
              on top, the facts in an icon strip underneath. */}
          <header className="mb-5 overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            <div className="flex items-center gap-4 px-4 py-3.5 sm:px-6 sm:py-5">
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                <span className="hidden sm:block"><TopicIcon category={t.category} size="lg" /></span>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-lg font-bold leading-tight text-ink-900 sm:text-2xl">{t.subject}</h1>
                  {/* INFO, not controls: the status keeps its chip; topic and side are
                      quiet square tags; the follow-up is a plain link. */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <TicketStatusChip status={t.status} size="sm" />
                    <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[12px] font-medium text-ink-600 ring-1 ring-inset ring-ink-200">
                      {CATEGORY_LABEL[t.category] ?? t.category}
                    </span>
                    <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[12px] font-medium capitalize text-ink-600 ring-1 ring-inset ring-ink-200">
                      {t.side}
                    </span>
                    {t.followUpOf && (
                      <Link
                        to={cp(`/admin/support/${t.followUpOf.id}`)}
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-700 hover:underline"
                      >
                        <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        Follow-up of {t.followUpOf.ref}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              {/* lg+: actions beside the title. */}
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                {canStatus && <StatusActions t={t} pending={status.isPending} onStatus={(s) => status.mutate(s)} />}
                <DetailsButton onClick={() => setDetailsOpen(true)} className="xl:hidden" />
              </div>
            </div>

            {/* Below lg: the actions get their own bar, divided from the info
                above — they used to wrap straight under the chips and read as
                more chips. */}
            <div className="flex gap-2 border-t border-surface-border px-4 py-3 sm:px-6 lg:hidden">
              <div className="grid flex-1 auto-cols-fr grid-flow-col gap-2 sm:flex sm:flex-none">
                {canStatus && <StatusActions t={t} pending={status.isPending} onStatus={(s) => status.mutate(s)} />}
              </div>
              <DetailsButton onClick={() => setDetailsOpen(true)} className="sm:ml-auto" />
            </div>

            {/* The facts, each with its icon. Wraps on phones — never a sideways scroll. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-surface-border bg-surface-subtle/50 px-4 py-2.5 text-[12.5px] text-ink-600 sm:gap-x-5 sm:px-6 sm:py-3 sm:text-[13px]">
              <span className="inline-flex items-center gap-1.5" title="Reference">
                <TagIcon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                <span className="font-mono font-semibold text-ink-800">{t.ref}</span>
              </span>
              <span className="hidden items-center gap-1.5 sm:inline-flex" title="Opened">
                <CalendarIcon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                Opened {formatDate(t.createdAt)}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <CompanyAvatar name={t.org.name} size="xs" />
                {canOrg ? (
                  <Link to={cp(`/admin/organisations/${t.org.id}`)} className="truncate font-semibold text-primary-700 hover:underline">{t.org.name}</Link>
                ) : (
                  <span className="truncate font-semibold text-ink-800">{t.org.name}</span>
                )}
              </span>
              <span className="hidden items-center gap-1.5 sm:inline-flex" title="Raised by">
                <UserIcon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                {t.createdBy.name}
              </span>
              <span className="inline-flex items-center gap-1.5" title="Assigned to">
                <UsersIcon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                {t.assignedTo ? (
                  <span className="font-semibold text-ink-800">{t.assignedTo.name}</span>
                ) : (
                  <span className="font-semibold text-warning-800">Unassigned</span>
                )}
              </span>
            </div>
          </header>

          {err && <div className="mb-4"><Alert tone="danger">{apiError(err).message}</Alert></div>}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <section
              aria-label="Conversation"
              // Phones: the PAGE scrolls and the reply box sticks to the bottom of
              // the screen (a fixed-height box left it below the fold under the
              // taller header). sm+: a screen-height panel that scrolls inside.
              className="flex flex-col rounded-2xl border border-surface-border bg-white shadow-card sm:h-[calc(100dvh-23rem)] sm:min-h-[26rem] sm:overflow-hidden"
            >
              <div ref={threadRef} className="min-h-[10rem] rounded-t-2xl bg-surface-subtle/60 px-4 py-5 sm:flex-1 sm:overflow-y-auto sm:rounded-none sm:px-6">
                <TicketThread messages={messages} viewer="staff" companyName={t.org.name} />
              </div>
              {(resolved || closes) && (
                <div className="flex shrink-0 items-start gap-2.5 border-t border-surface-border bg-white px-4 py-2.5 text-[12.5px] text-ink-700 sm:px-6">
                  {resolved ? (
                    <LockIcon className="mt-px h-4 w-4 shrink-0 text-success-700" aria-hidden="true" />
                  ) : (
                    <ClockIcon className="mt-px h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                  )}
                  <span>
                    {resolved ? (
                      <>
                        <b className="font-semibold text-ink-900">{closedBy(t)}</b> The company can&apos;t reply
                        {canStatus ? '; a reply here moves it back to In progress.' : '.'}
                      </>
                    ) : (
                      <>
                        <b className="font-semibold text-ink-900">Waiting on the company.</b> Closes automatically on{' '}
                        {formatDate(closes)} if they don&apos;t reply.
                      </>
                    )}
                  </span>
                </div>
              )}
              <div className="sticky bottom-0 z-10 shrink-0 overflow-hidden rounded-b-2xl border-t border-surface-border bg-white shadow-[0_-6px_16px_-10px_rgba(0,5,23,0.25)] sm:static sm:rounded-none sm:shadow-none">
                {canReply && resolved && !canStatus ? (
                  // Replying here would re-open the ticket — that needs the re-open grant.
                  <p className="flex items-center gap-2 px-4 py-3.5 text-[13px] text-muted sm:px-6">
                    <LockIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                    This ticket is closed. Replying would re-open it — ask someone with the
                    &ldquo;Resolve / re-open tickets&rdquo; permission.
                  </p>
                ) : canReply ? (
                  <ReplyBox
                    embedded
                    sending={reply.isPending}
                    onSend={(v) => reply.mutateAsync(v)}
                    placeholder="Reply as MPX Global Support…"
                    note="The company sees “MPX Global Support”, not your name."
                  />
                ) : (
                  <p className="flex items-center gap-2 px-4 py-3.5 text-[13px] text-muted sm:px-6">
                    <LockIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                    You can view this ticket. Replying needs the &ldquo;Reply to tickets&rdquo; permission.
                  </p>
                )}
              </div>
            </section>

            <aside className="hidden xl:block">{side('col')}</aside>
          </div>

          <Drawer open={detailsOpen} onClose={() => setDetailsOpen(false)} icon={InfoIcon} title="Details & notes" subtitle={t.ref}>
            {side('drawer')}
          </Drawer>
        </>
      )}
    </AdminLayout>
  );
}

/** "Resolved on …" / "The company marked it solved on …" / "Closed automatically on …". */
function closedBy(t) {
  const on = t.resolvedAt ? ` on ${formatDate(t.resolvedAt)}` : '';
  if (t.closedBy === 'company') return `The company marked it solved${on}.`;
  if (t.closedBy === 'auto') return `Closed automatically${on} — no reply for ${TICKET_AUTO_CLOSE_DAYS} days.`;
  return `Resolved${on}.`;
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

function StatusActions({ t, pending, onStatus }) {
  const pill = 'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-[13px] font-semibold shadow-sm transition-colors disabled:opacity-60';
  if (t.status === 'resolved') {
    return (
      <button type="button" disabled={pending} onClick={() => onStatus('open')} className={`${pill} border border-ink-200 bg-white text-ink-800 hover:bg-ink-50`}>
        <RefreshIcon className="h-4 w-4" aria-hidden="true" /> Re-open
      </button>
    );
  }
  return (
    <>
      {t.status === 'open' && (
        <button type="button" disabled={pending} onClick={() => onStatus('in_progress')} className={`${pill} border border-ink-200 bg-white text-ink-800 hover:bg-ink-50`}>
          Mark in progress
        </button>
      )}
      <button type="button" disabled={pending} onClick={() => onStatus('resolved')} className={`${pill} bg-success-600 text-white hover:bg-success-700`}>
        <CheckCircleIcon className="h-4 w-4" aria-hidden="true" /> Resolve
      </button>
    </>
  );
}

/**
 * The details column (xl) — three cards. In the drawer (below xl) the same
 * content sits under three tabs, laid flat, so the window is not a stack of
 * boxed cards inside a box.
 */
function TicketSide({ where, t, id, user, staff, timeline, onAssign, canOrg, canAssign, canReply }) {
  const [tab, setTab] = useState('details');
  const notesCount = useQuery({ queryKey: notesKeys.list('ticket', id), queryFn: () => notesApi.list('ticket', id) }).data?.length ?? 0;
  const details = <DetailsBody where={where} t={t} user={user} staff={staff} onAssign={onAssign} canOrg={canOrg} canAssign={canAssign} canReply={canReply} />;
  const events = <TimelineList timeline={timeline} />;

  if (where === 'drawer') {
    const tabs = [
      { key: 'details', label: 'Details' },
      { key: 'notes', label: 'Notes', count: notesCount },
      { key: 'timeline', label: 'Timeline', count: timeline.data?.length ?? 0 },
    ];
    return (
      <div>
        <div role="tablist" aria-label="Ticket panels" className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
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
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === x.key ? 'bg-primary-50 text-primary-700' : 'bg-white/70 text-ink-600'}`}>
                  {x.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab === 'details' && details}
        {tab === 'notes' && (
          <>
            <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-warning-800">
              <LockIcon className="h-3.5 w-3.5" aria-hidden="true" /> Staff only — never shown to the company.
            </p>
            <InternalNotes subjectType="ticket" subjectId={id} bare />
          </>
        )}
        {tab === 'timeline' && events}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card">
        <h2 className="text-[15px] font-bold text-ink-900">Ticket details</h2>
        <div className="mt-3">{details}</div>
      </section>

      {/* Step 1c · staff-only notes — never shown to the company. */}
      <InternalNotes subjectType="ticket" subjectId={id} />

      <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        <h2 className="flex items-center justify-between border-b border-surface-border bg-ink-50/60 px-4 py-2.5 text-sm font-bold text-ink-900">
          Timeline
          {(timeline.data?.length ?? 0) > 0 && (
            <span className="text-[11.5px] font-medium text-muted">{timeline.data.length} events</span>
          )}
        </h2>
        {/* Fixed height — a long-running ticket's history used to stretch the
            column (owner, 2026-09-24). Opens scrolled to the newest event. */}
        <ScrollToEnd dep={timeline.data?.length} className="max-h-72 overflow-y-auto px-4 py-3">{events}</ScrollToEnd>
      </section>
    </div>
  );
}

function DetailsBody({ where, t, user, staff, onAssign, canOrg, canAssign, canReply }) {
  return (
    <>
      {/* Only people in the list (owner, 2026-09-24): "Unassigned" is the empty
          field's hint, and an assigned ticket can move to someone else but never
          back to nobody — the server refuses that too. */}
      <label htmlFor={`ticket-assignee-${where}`} className="mb-1.5 block text-[12px] font-semibold text-ink-500">Assigned to</label>
      {canAssign ? (
        <Combobox
          id={`ticket-assignee-${where}`}
          value={t.assignedTo?.id ?? ''}
          placeholder="Unassigned"
          options={staff.map((s) => ({ value: s.id, label: s.id === user?.id ? `${s.name} (you)` : s.name, hint: s.role === 'superadmin' ? 'Super admin' : 'Employee' }))}
          onChange={onAssign}
        />
      ) : (
        // No `support:assign`: read-only, plus "Take this ticket" when it is
        // unassigned and you can reply (the only assignment the server allows).
        <div id={`ticket-assignee-${where}`} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5">
          <span className={`text-[13.5px] font-semibold ${t.assignedTo ? 'text-ink-900' : 'text-warning-800'}`}>
            {t.assignedTo ? (t.assignedTo.id === user?.id ? `${t.assignedTo.name} (you)` : t.assignedTo.name) : 'Unassigned'}
          </span>
          {!t.assignedTo && canReply && t.status !== 'resolved' && (
            <button
              type="button"
              onClick={() => onAssign(user?.id)}
              className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary-600 px-3 text-[12.5px] font-semibold text-white hover:bg-primary-700"
            >
              Take this ticket
            </button>
          )}
        </div>
      )}
      <dl className="mt-3 divide-y divide-surface-border text-[13px]">
        <Row label="Reference"><span className="font-mono">{t.ref}</span></Row>
        <Row label="Topic">{CATEGORY_LABEL[t.category] ?? t.category}</Row>
        <Row label="Company">
          {canOrg ? (
            <Link to={cp(`/admin/organisations/${t.org.id}`)} className="text-primary-700 hover:underline">{t.org.name}</Link>
          ) : t.org.name}
        </Row>
        <Row label="Raised by">{t.createdBy.name}</Row>
        <Row label="Opened">{formatDate(t.createdAt)} {formatTime(t.createdAt)}</Row>
        <Row label="Last activity">{formatDate(t.lastMessageAt)} {formatTime(t.lastMessageAt)}</Row>
      </dl>
      {t.createdBy.email && (
        <a
          href={`mailto:${t.createdBy.email}`}
          className="mt-3 flex items-center gap-2 rounded-xl bg-surface-subtle px-3 py-2 text-[12.5px] text-ink-700 hover:text-primary-700"
        >
          <MailIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
          <span className="truncate">{t.createdBy.email}</span>
        </a>
      )}
    </>
  );
}

function TimelineList({ timeline }) {
  if (timeline.isLoading) return <SkeletonRows rows={3} />;
  const events = timeline.data ?? [];
  if (events.length === 0) return <p className="text-[13px] text-muted">Nothing recorded yet.</p>;
  return (
    // A connecting line behind the icons makes it read as a sequence.
    <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-px before:bg-surface-border">
      {events.map((e) => {
        const { Icon, tone } = logIcon(e);
        return (
          <li key={e.id} className="relative flex gap-2.5 text-[12.5px] text-ink-700">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ring-white ${tone}`} aria-hidden="true">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-ink-900">{e.actor.name}</span> <LogPhrase row={e} />
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
