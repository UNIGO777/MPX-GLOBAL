import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminConversationsApi, conversationKeys } from '../../api/conversations.js';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { FreezeChip } from '../../components/chat/FreezeChip.jsx';
import { ThreadView } from '../../components/chat/ThreadView.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { ChevronLeftIcon, ExternalIcon, InfoIcon, ShieldIcon } from '../../components/ui/icons.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { BlockModal, UnblockModal } from '../../components/chat/ModerationModals.jsx';
import { useThread } from '../../hooks/useThread.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { apiError, formatDate, formatTime } from '../../lib/format.js';

/**
 * M4 screen 6 — the read-only thread plus the enforcement actions.
 *
 * 🔴 THERE IS NO COMPOSER HERE AT ANY PERMISSION LEVEL. Not disabled — absent.
 * Admin can read; admin cannot speak (§7.3), and the server refuses a staff send
 * outright, so a composer could only ever be a lie.
 *
 * 🔴 Staff see what a party never does: both org ids, the raw freeze reason, and
 * WHO blocked the chat and when. The inverse also holds — the block reason is
 * shown to both parties (M4-25) while `blockedBy` never leaves this screen.
 *
 * Opening this page writes an AuditLog entry, for an employee and a superadmin
 * alike (M4-34) — hence the notice in the rail. That is a promise to the two
 * companies whose commercial conversation this is.
 */

function RailRow({ label, children }) {
  return (
    <div className="border-b border-surface-border px-4 py-3 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink-900">{children}</dd>
    </div>
  );
}

export function ConversationViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [blockOpen, setBlockOpen] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [outcome, setOutcome] = useState(null);
  // Phone only — at lg+ the rail is on screen and the modal is unreachable.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const thread = useThread(id, { admin: true, viewerSide: 'staff' });
  const conversation = thread.conversation;

  // One permission covers both directions. An employee without it sees NO
  // action buttons — absent, not disabled.
  const mayBlock = can(user, 'conversation:block');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: conversationKeys.admin.detail(id) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.admin.messages(id) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.admin.all });
  };

  const block = useMutation({
    mutationFn: (reason) => adminConversationsApi.block(id, reason),
    onSuccess: () => {
      setBlockOpen(false);
      setOutcome({ tone: 'danger', text: 'Conversation blocked. Both parties can see your reason.' });
      refresh();
    },
  });

  const unblock = useMutation({
    mutationFn: (reason) => adminConversationsApi.unblock(id, reason),
    onSuccess: (updated) => {
      setUnblockOpen(false);
      // BOTH outcomes are real results, not one success and one error: a thread
      // whose product is still down stays shut, and the label switches to the
      // surviving reason. That is correct behaviour and is reported as such.
      setOutcome(
        updated?.frozen
          ? {
              tone: 'warning',
              text: `Block lifted, but this conversation is still frozen — ${
                updated.frozenLabel?.text ?? 'another reason applies'
              }.`,
            }
          : { tone: 'success', text: 'Conversation reopened. Both parties can message again.' },
      );
      refresh();
    },
  });

  const actionButton = mayBlock
    ? (conversation?.blockedReason ? (
        <Button variant="secondary" fullWidth onClick={() => setUnblockOpen(true)}>
          Unblock conversation
        </Button>
      ) : (
        <Button variant="danger" fullWidth onClick={() => setBlockOpen(true)}>
          Block conversation
        </Button>
      ))
    : null;

  /**
   * The facts panel. ONE definition, rendered in the desktop rail and in the
   * phone modal — two copies would drift, and this is the surface where a
   * moderator reads org ids and a block actor before acting.
   */
  const detailsBody = (
    <>
      <dl>
        <RailRow label="Buyer">
          <span className="flex items-center gap-2">
            <CompanyAvatar
              name={conversation?.buyerOrg?.name ?? ''}
              logo={conversation?.buyerOrg?.logo}
              size="sm"
            />
            <span className="min-w-0 flex-1">{conversation?.buyerOrg?.name}</span>
          </span>
          <code className="mt-1 block font-mono text-[11px] text-ink-500">
            {conversation?.buyerOrg?.id}
          </code>
        </RailRow>
        <RailRow label="Exporter">
          <span className="flex items-center gap-2">
            <CompanyAvatar
              name={conversation?.exporterOrg?.name ?? ''}
              logo={conversation?.exporterOrg?.logo}
              size="sm"
            />
            <span className="min-w-0 flex-1">{conversation?.exporterOrg?.name}</span>
          </span>
          <code className="mt-1 block font-mono text-[11px] text-ink-500">
            {conversation?.exporterOrg?.id}
          </code>
        </RailRow>
        <RailRow label="Product">
          {conversation?.product?.slug ? (
            <Link
              to={`/product/${conversation.product.slug}`}
              className="inline-flex items-center gap-1 text-primary-700 hover:underline"
            >
              {conversation.product.name}
              <ExternalIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <>
              {conversation?.product?.name}
              <span className="mt-0.5 block text-xs text-muted">Purged — no page to open</span>
            </>
          )}
        </RailRow>
        <RailRow label="State">
          {conversation?.frozenLabel?.text ? (
            <FreezeChip label={conversation.frozenLabel} wrap />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[12px] font-semibold text-success-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
              Open
            </span>
          )}
          {conversation?.frozenReason && (
            <span className="mt-1 block text-xs text-muted">
              Raw reason: <code className="font-mono">{conversation.frozenReason}</code>
            </span>
          )}
        </RailRow>

        {/* Staff-only, and the reason this rail exists. A party sees the
            reason text and never the actor. */}
        {conversation?.blockedReason && (
          <RailRow label="Block">
            <p className="text-ink-900">{conversation.blockedReason}</p>
            <p className="mt-1 text-xs text-muted">
              {/* The TIME matters on a moderation record: two blocks on one
                  day were indistinguishable with a date alone. */}
              By <code className="font-mono">{conversation.blockedBy}</code> ·{' '}
              {formatDate(conversation.blockedAt)} at {formatTime(conversation.blockedAt)}
            </p>
          </RailRow>
        )}

        <RailRow label="Unread">
          Buyer: {conversation?.unread?.buyer ? 'unseen' : 'seen'} · Exporter:{' '}
          {conversation?.unread?.exporter ? 'unseen' : 'seen'}
        </RailRow>
        <RailRow label="Started">{formatDate(conversation?.createdAt)}</RailRow>
      </dl>

      <p className="flex items-start gap-2 border-t border-surface-border bg-ink-50 px-4 py-3 text-xs text-ink-600">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
        Conversation access is recorded.
      </p>
    </>
  );

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/admin/conversations')}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All conversations
        </button>
      </div>

      {outcome && (
        <Alert tone={outcome.tone} className="mb-4">{outcome.text}</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        {/* The transcript — same components a party sees, rendered read-only. */}
        {/* 🔴 On a phone the transcript is the whole screen. The details are one
            tap away behind the header's info button (below) rather than sharing
            the viewport — and the decision stays pinned at the bottom, so a
            moderator never scrolls a conversation to reach the button that acts
            on it. At lg+ the rail is simply visible and the button is gone. */}
        <div className="h-[calc(100dvh-var(--shell-chrome)-13rem)] min-h-[20rem] overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card lg:h-[calc(100dvh-var(--shell-chrome)-11rem)]">
          <ThreadView
            thread={thread}
            viewerSide="staff"
            readOnly
            headerAction={
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                aria-label="Thread details"
                className="-my-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 lg:hidden"
              >
                <InfoIcon className="h-6 w-6" />
              </button>
            }
          />
        </div>

        <aside className="hidden overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card lg:block">
          <h2 className="border-b border-surface-border px-4 py-3 text-sm font-bold text-ink-900">
            Thread details
          </h2>

          {detailsBody}

          {/* Desktop keeps the action in the rail, under the facts it acts on. */}
          {actionButton && (
            <div className="hidden border-t border-surface-border p-4 lg:block">{actionButton}</div>
          )}
        </aside>
      </div>

      {/* Phone: the decision is pinned, reachable from either tab. */}
      {actionButton && (
        <div className="sticky bottom-0 z-10 -mx-6 mt-4 border-t border-surface-border bg-white/95 px-6 py-3 backdrop-blur lg:hidden">
          {actionButton}
        </div>
      )}

      {/* Phone: the same facts as the desktop rail, one tap from the header. */}
      <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Thread details">
        <div className="-mx-6 -mb-6 max-h-[65vh] overflow-y-auto border-t border-surface-border">
          {detailsBody}
        </div>
      </Modal>

      <BlockModal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        onConfirm={block.mutate}
        pending={block.isPending}
        error={block.isError ? apiError(block.error) : null}
      />
      <UnblockModal
        open={unblockOpen}
        onClose={() => setUnblockOpen(false)}
        onConfirm={unblock.mutate}
        pending={unblock.isPending}
        error={unblock.isError ? apiError(unblock.error) : null}
      />
    </AdminLayout>
  );
}
