import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supportApi, supportKeys } from '../../api/support.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import { CATEGORY_LABEL, autoClosedDays } from '../../lib/support.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { BUYER_NAV } from '../buyer/buyerNav.js';
import { EXPORTER_NAV } from '../exporter/exporterNav.js';
import { SupportContactCards } from '../../components/public/SupportContact.jsx';
import { ReplyBox } from '../../components/support/ReplyBox.jsx';
import { TicketStatusChip } from '../../components/support/TicketStatusChip.jsx';
import { TicketThread } from '../../components/support/TicketThread.jsx';
import { TopicIcon } from '../../components/support/TopicIcon.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { CheckCircleIcon, ChevronLeftIcon, InfoIcon, LockIcon, PlusIcon } from '../../components/ui/icons.jsx';

/** What each status means for the company — shown beside the thread. */
const STATUS_NOTE = {
  open: 'Waiting for our team to pick it up. We reply here and email you.',
  in_progress: 'Our team is working on it. We reply here and email you.',
  resolved: 'Closed. Need more help? Raise a new ticket.',
};

/** One of the company's own tickets (Step 1b). Polls so a staff reply shows up. */
export function MyTicket() {
  const { id } = useParams();
  const { user } = useAuth();
  const side = user?.role === 'exporter' ? 'exporter' : 'buyer';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: supportKeys.myTicket(id),
    queryFn: () => supportApi.myTicket(id),
    refetchInterval: 30_000,
  });
  const ticket = q.data?.ticket;
  const messages = q.data?.messages ?? [];

  useEffect(() => {
    if (!ticket) return undefined;
    const previous = document.title;
    document.title = `${ticket.ref} · Help & support — MPX Global`;
    // Opening the ticket cleared its "new reply" flag server-side.
    qc.invalidateQueries({ queryKey: supportKeys.mineAll });
    qc.invalidateQueries({ queryKey: supportKeys.myUnread });
    return () => { document.title = previous; };
  }, [ticket, qc]);

  const reply = useMutation({
    mutationFn: (v) => supportApi.reply(id, v),
    onSuccess: (data) => {
      qc.setQueryData(supportKeys.myTicket(id), data);
      qc.invalidateQueries({ queryKey: supportKeys.mineAll });
    },
    // Staff closed it while this page was open: reload so the closed bar
    // replaces a reply box the server will keep refusing.
    onError: (err) => {
      if (apiError(err).code === 'TICKET_CLOSED') q.refetch();
    },
  });

  const resolved = ticket?.status === 'resolved';

  // "Mark as solved" — the company closes its own ticket, after a confirm.
  const [confirmClose, setConfirmClose] = useState(false);
  const close = useMutation({
    mutationFn: () => supportApi.close(id),
    onSuccess: (data) => {
      qc.setQueryData(supportKeys.myTicket(id), data);
      qc.invalidateQueries({ queryKey: supportKeys.mineAll });
      setConfirmClose(false);
    },
  });
  // Below xl the details column would push under the thread; it opens in a drawer instead.
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Chat-style: the thread scrolls inside the panel and opens at the newest
  // message. On phones the panel stops short of the floating chat button.
  const threadRef = useRef(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <PortalLayout nav={side === 'exporter' ? EXPORTER_NAV : BUYER_NAV} wide>
      <Link to={`/${side}/support`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-primary-700">
        <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" /> All tickets
      </Link>

      {q.isLoading && <SkeletonRows rows={5} />}
      {q.error && <ErrorState message={apiError(q.error).message} onRetry={q.refetch} />}

      {ticket && (
        <>
          <header className="mb-5 flex items-start gap-3.5">
            <TopicIcon category={ticket.category} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="min-w-0 break-words text-xl font-bold leading-tight text-ink-900 sm:text-2xl">{ticket.subject}</h1>
                <TicketStatusChip status={ticket.status} />
              </div>
              <p className="mt-1 text-[13px] text-muted">
                <span className="font-mono">{ticket.ref}</span> · {CATEGORY_LABEL[ticket.category] ?? ticket.category}
                {ticket.followUpOf && (
                  <>
                    {' · follow-up to '}
                    <Link to={`/${side}/support/${ticket.followUpOf.id}`} className="font-mono font-semibold text-primary-700 hover:underline">
                      {ticket.followUpOf.ref}
                    </Link>
                  </>
                )}
              </p>
              {/* Phones: the actions sit under the reference, so the title keeps the full width. */}
              <div className="mt-2.5 flex flex-wrap gap-2 sm:hidden">
                <DetailsButton onClick={() => setDetailsOpen(true)} className="inline-flex" />
                {!resolved && <SolvedButton onClick={() => setConfirmClose(true)} />}
              </div>
            </div>
            <div className="hidden shrink-0 gap-2 sm:flex">
              <DetailsButton onClick={() => setDetailsOpen(true)} className="inline-flex xl:hidden" />
              {!resolved && <SolvedButton onClick={() => setConfirmClose(true)} />}
            </div>
          </header>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section
              aria-label="Conversation"
              className="flex h-[calc(100dvh-25rem)] min-h-[24rem] flex-col sm:h-[calc(100dvh-16rem)] sm:min-h-[26rem] overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card"
            >
              <div ref={threadRef} className="flex-1 overflow-y-auto bg-surface-subtle/60 px-4 py-5 sm:px-6">
                <TicketThread messages={messages} viewer="company" />
              </div>
              {reply.error && (
                <div className="shrink-0 border-t border-surface-border px-4 pt-3 sm:px-6">
                  <Alert tone="danger">
                    {apiError(reply.error).code === 'TICKET_CLOSED'
                      ? "Your message wasn't sent — this ticket was closed while you were writing."
                      : apiError(reply.error).message}
                  </Alert>
                </div>
              )}
              {resolved ? (
                // Resolved = closed (owner, 2026-09-24): no composer at all. The
                // server refuses the reply too (TICKET_CLOSED).
                <div className="flex shrink-0 flex-col gap-3 border-t border-surface-border bg-white px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700" aria-hidden="true">
                    <LockIcon className="h-5 w-5" />
                  </span>
                  <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink-700">
                    <span className="block font-semibold text-ink-900">{closedLine(ticket)}</span>
                    Replies are turned off. Still need help? Raise a new ticket.
                  </p>
                  <Link
                    to={`/${side}/support?new=1&from=${ticket.id}&ref=${encodeURIComponent(ticket.ref)}`}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-primary-700"
                  >
                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    Raise a new ticket
                  </Link>
                </div>
              ) : (
                <div className="shrink-0 border-t border-surface-border">
                  <ReplyBox
                    embedded
                    sending={reply.isPending}
                    onSend={(v) => reply.mutateAsync(v)}
                    note="One image, PDF, Word or Excel file · up to 8 MB"
                  />
                </div>
              )}
            </section>

            <aside className="hidden xl:block">
              <TicketDetails ticket={ticket} messageCount={messages.length} />
            </aside>
          </div>

          <Modal
            open={confirmClose}
            onClose={() => !close.isPending && setConfirmClose(false)}
            icon={CheckCircleIcon}
            title="Mark this ticket as solved?"
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmClose(false)} disabled={close.isPending}>
                  Not yet
                </Button>
                <Button loading={close.isPending} onClick={() => close.mutate()}>
                  Yes, it's solved
                </Button>
              </>
            }
          >
            <p className="text-sm leading-relaxed text-ink-700">
              The ticket closes and replies are turned off. If the problem comes back, you can raise a new
              ticket linked to this one.
            </p>
            {close.error && <div className="mt-3"><Alert tone="danger">{apiError(close.error).message}</Alert></div>}
          </Modal>

          <Drawer
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            icon={InfoIcon}
            title="Ticket details"
            subtitle={ticket.ref}
          >
            <TicketDetails ticket={ticket} messageCount={messages.length} framed={false} />
          </Drawer>
        </>
      )}
    </PortalLayout>
  );
}

function TicketDetails({ ticket, messageCount, framed = true }) {
  return (
    <div className="space-y-4">
      {/* In the drawer the drawer's own header titles it, so no card frame. */}
      <div className={framed ? 'rounded-2xl border border-surface-border bg-white p-5 shadow-card' : ''}>
        {framed && <h2 className="text-[15px] font-bold text-ink-900">Ticket details</h2>}
        <div className={`${framed ? 'mt-3' : ''} rounded-xl bg-surface-subtle p-3`}>
          <TicketStatusChip status={ticket.status} />
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink-600">{STATUS_NOTE[ticket.status]}</p>
        </div>
        <dl className="mt-3 divide-y divide-surface-border text-[13px]">
          <Detail label="Reference"><span className="font-mono">{ticket.ref}</span></Detail>
          <Detail label="Topic">{CATEGORY_LABEL[ticket.category] ?? ticket.category}</Detail>
          <Detail label="Opened">{formatDate(ticket.createdAt)}</Detail>
          <Detail label="Last update">
            {formatDate(ticket.lastMessageAt)} {formatTime(ticket.lastMessageAt)}
          </Detail>
          <Detail label="Messages">{messageCount}</Detail>
        </dl>
      </div>
      <div>
        <p className="mb-2 px-1 text-[13px] font-semibold text-ink-600">Prefer email or phone?</p>
        <SupportContactCards stacked />
      </div>
    </div>
  );
}

/** The closed bar's first line — says WHO closed it, so an auto-close is never a surprise. */
function closedLine(ticket) {
  const on = ticket.resolvedAt ? ` on ${formatDate(ticket.resolvedAt)}` : '';
  if (ticket.closedBy === 'company') return `You marked this ticket as solved${on}.`;
  if (ticket.closedBy === 'auto') return `Closed automatically${on} — we had no reply for ${autoClosedDays(ticket)} days.`;
  return `This ticket was resolved${on} and is closed.`;
}

function SolvedButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-success-300 bg-white px-3.5 text-[13px] font-semibold text-success-700 shadow-sm transition-colors hover:bg-success-50"
    >
      <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
      Mark as solved
    </button>
  );
}

function DetailsButton({ onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 items-center gap-1.5 rounded-full border border-surface-border bg-white px-3.5 text-[13px] font-semibold text-ink-800 shadow-sm transition-colors hover:border-primary-300 hover:text-primary-700 ${className}`}
    >
      <InfoIcon className="h-4 w-4" aria-hidden="true" />
      View details
    </button>
  );
}

function Detail({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-ink-900">{children}</dd>
    </div>
  );
}
