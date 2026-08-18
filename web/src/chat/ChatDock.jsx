import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext.jsx';
import { CompanyAvatar } from '../components/chat/CompanyAvatar.jsx';
import { ConversationRow, ConversationRowSkeleton } from '../components/chat/ConversationRow.jsx';
import { ThreadView } from '../components/chat/ThreadView.jsx';
import { productPageLive } from '../components/chat/productPage.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { BoxIcon, ChatIcon, ChevronLeftIcon, ExpandIcon, ExternalIcon, XIcon } from '../components/ui/icons.jsx';
import { conversationRowsOf, useConversationList } from '../hooks/useConversationList.js';
import { useThread } from '../hooks/useThread.js';
import { useUnreadCount } from '../hooks/useUnreadCount.js';
import { useChatDock } from './ChatDockContext.jsx';
import { useUnreadTitle } from './useUnreadTitle.js';

/**
 * The docked conversation window — chat that follows the user around the site.
 *
 * Why it exists: a buyer compares several suppliers while negotiating with two
 * of them. Sending them to a separate page to reply means losing the product
 * they were looking at. Alibaba and IndiaMART dock chat for the same reason.
 *
 * 🔴 Rendered through a PORTAL to `document.body`, not in place. This codebase
 * has already lost a `fixed z-50` element to an ancestor stacking context once
 * (`ProductDetail.jsx`), and the dock sits on every page — including ones with
 * transformed ancestors.
 *
 * 🔴 Stacking: `z-40`, the same band as the site header and BELOW modals and
 * drawers (`z-50`). A filter drawer or the save-gate dialog must cover the dock,
 * because those are modal and this is not. The dock never locks body scroll.
 *
 * Not for staff: an admin is not a party to any thread and cannot speak in one,
 * and every thread they open is audited — a persistent moderation window would
 * generate audit noise and imply a participation that does not exist.
 */
const HIDDEN_ON = [/^\/signin/, /^\/signup/, /^\/otp/, /^\/forgot/, /^\/reset/, /^\/change-password/];

function DockList({ role, onSelect }) {
  // The SAME hook the inbox page uses — same key, same shape. See
  // `useConversationList` for why a plain `useQuery` here was a bug.
  const list = useConversationList();

  if (list.isLoading) {
    return (
      <ul className="chat-rail min-h-full px-2 py-1">
        {Array.from({ length: 5 }, (_, i) => <ConversationRowSkeleton key={i} />)}
      </ul>
    );
  }

  if (list.error) {
    return <ErrorState title="Couldn't load conversations" onRetry={list.refetch} className="py-8" />;
  }

  const rows = conversationRowsOf(list);
  if (rows.length === 0) {
    return (
      <EmptyState icon={ChatIcon} title="No conversations yet" className="py-10">
        {role === 'exporter'
          ? 'When a buyer enquires about one of your products, it appears here.'
          : 'Enquire about a product and the conversation appears here.'}
      </EmptyState>
    );
  }

  return (
    <ul className="chat-rail min-h-full px-2 py-1">
      {rows.map((conversation) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          onSelect={() => onSelect(conversation.id)}
          compact
        />
      ))}
    </ul>
  );
}

export function ChatDock() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dock = useChatDock();
  const unread = useUnreadCount();
  const [isPhone, setIsPhone] = useState(false);
  const panelRef = useRef(null);

  useUnreadTitle(unread);

  /**
   * Esc closes the panel — the convention for any dismissible overlay, and the
   * only way to leave it without a mouse.
   *
   * ⚠️ It does NOT trap focus, deliberately. The dock is non-modal: the whole
   * point is that the page behind it stays usable, so trapping the keyboard
   * inside would contradict the feature. Modals (which DO trap) sit above it.
   */
  const { open: dockOpen, close: closeDock, activeId } = dock;
  useEffect(() => {
    if (!dockOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDock();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dockOpen, closeDock]);

  // Opening from the keyboard must land the caret somewhere useful rather than
  // leaving focus on a launcher that is no longer on screen.
  useEffect(() => {
    if (dockOpen) panelRef.current?.focus();
  }, [dockOpen, activeId]);

  // A window is a desktop affordance. Below md the launcher navigates to the
  // full screen instead — a miniature draggable window on a phone is a worse
  // phone experience than a real page.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const role = user?.role === 'exporter' ? 'exporter' : 'buyer';
  const isParty = user?.role === 'buyer' || user?.role === 'exporter';
  const inbox = `/${role}/chat`;

  const thread = useThread(dock.activeId, { viewerSide: role, enabled: Boolean(dock.activeId) });

  // Guests, staff, auth screens — and the full inbox itself, where a floating
  // copy of the same conversation would just be a second place to type.
  const hidden =
    !isParty || HIDDEN_ON.some((re) => re.test(pathname)) || pathname.startsWith(inbox);
  if (hidden) return null;

  const openFull = () => {
    dock.close();
    navigate(dock.activeId ? `${inbox}/${dock.activeId}` : inbox);
  };

  const launcher = (
    <button
      type="button"
      onClick={() => (isPhone ? navigate(inbox) : dock.openList())}
      aria-label={unread > 0 ? `Chat — ${unread} unread conversations` : 'Chat'}
      className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lift transition-transform hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-95 motion-reduce:transition-none"
    >
      <ChatIcon className="h-6 w-6" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-danger px-1 text-[11px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );

  const panel = (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label="Chat"
      className="flex h-[min(32rem,calc(100dvh-8rem))] w-[22rem] flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-lift outline-none"
    >
      {dock.activeId ? (
        <>
          {/* 🔴 ONE header for the dock (owner, 2026-08-18). It used to be a navy
              title bar with a white block under it repeating the product and the
              platform line; the white block is gone and its two facts moved up
              here. M4-1 is why the disclosure came WITH the product rather than
              being dropped: the platform's presence has to stay visible in every
              surface, never tucked behind a control. */}
          <div className="shrink-0 bg-primary-800 px-2 py-2 text-white">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={dock.backToList}
                aria-label="Back to conversations"
                className="-ml-0.5 shrink-0 rounded-lg p-1.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>

              {/* The company's own mark, same one the list row shows — the dock
                  otherwise dropped straight from a logo in the list to a bare
                  name here, and the two read as different threads. */}
              {thread.conversation?.counterparty?.name && (
                <CompanyAvatar
                  name={thread.conversation.counterparty.name}
                  logo={thread.conversation.counterparty.logo}
                  size="sm"
                />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight">
                  {thread.conversation?.counterparty?.name ?? 'Conversation'}
                </span>

                {/* WHO, then what about — the product sits under the company it
                    belongs to rather than competing with it for the same line.
                    M4-22: a link only while that page still exists. */}
                {thread.conversation?.product?.name &&
                  (productPageLive(thread.conversation) ? (
                    <Link
                      to={`/product/${thread.conversation.product.slug}`}
                      className="mt-0.5 inline-flex min-w-0 max-w-full items-center gap-1 text-[10.5px] font-medium text-white/75 hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <BoxIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{thread.conversation.product.name}</span>
                      <ExternalIcon className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10.5px] text-white/60">
                      <BoxIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{thread.conversation.product.name}</span>
                    </span>
                  ))}
              </span>

              <button
                type="button"
                onClick={openFull}
                aria-label="Open in full screen"
                className="shrink-0 rounded-lg p-1.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ExpandIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={dock.close}
                aria-label="Close chat"
                className="shrink-0 rounded-lg p-1.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* 🔴 M4-1 EXCEPTION — the persistent "MPX Global is in this chat"
                line is NOT rendered in the dock (owner, 2026-08-18). M4-1 asks
                for the platform's presence in the thread header or participant
                list "not just in the opening message", and in this surface that
                is now exactly where it lives: the welcome system message opens
                every thread and names MPX Global, and the full page and the
                admin viewer still carry the standing line. A dock is a 352px
                window and the owner judged the line too costly here.
                Do not re-add it without asking — its absence is a decision. */}
          </div>

          {/* The SAME thread component the full page and the admin viewer use —
              one conversation renderer, so a field cannot leak in one surface
              and not another. */}
          <div className="min-h-0 flex-1">
            <ThreadView
              thread={thread}
              viewerSide={role}
              variant="dock"
              connected={dock.connected}
              draft={dock.drafts[dock.activeId] ?? ''}
              onDraftChange={(value) => dock.setDraft(dock.activeId, value)}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 bg-primary-800 px-4 py-3 text-white">
            <h2 className="text-[14px] font-bold">Messages</h2>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={openFull}
                aria-label="Open all conversations"
                className="rounded-lg p-1.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ExpandIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={dock.close}
                aria-label="Close chat"
                className="rounded-lg p-1.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="chat-rail min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <DockList role={role} onSelect={dock.openThread} />
          </div>
        </>
      )}
    </section>
  );

  return createPortal(
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
      {dock.open && !isPhone && panel}
      {(!dock.open || isPhone) && launcher}
    </div>,
    document.body,
  );
}
