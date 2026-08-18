import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useConversationList } from '../../hooks/useConversationList.js';
import { ConversationRow, ConversationRowSkeleton } from '../../components/chat/ConversationRow.jsx';
import { ThreadView } from '../../components/chat/ThreadView.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { ChatIcon, SearchIcon, SearchOffIcon, XIcon } from '../../components/ui/icons.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useChatDock } from '../../chat/ChatDockContext.jsx';
import { useThread } from '../../hooks/useThread.js';
import { useNoIndex } from '../../lib/seo.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { BUYER_NAV } from '../buyer/buyerNav.js';
import { EXPORTER_NAV } from '../exporter/exporterNav.js';

/**
 * M4 screens 3 + 4 — the chat list and the thread, as ONE role-aware page
 * (M4-35: there is no separate enquiry inbox; one list serves everyone).
 *
 * Buyer and exporter get the same layout and differ only in scope and in how
 * the server composes each title — the buyer sees *product × seller company*,
 * the exporter *product × buyer company* (M4-17). Neither ever sees a person's
 * name, because the server does not send one.
 *
 * Routing: `/…/chat` is the list, `/…/chat/:id` is a thread. At `lg` and up
 * both panes are on screen at once; below that the thread REPLACES the list, so
 * a phone shows one full-width surface at a time.
 */
/** Buyer and seller empty states differ, and the difference matters. */
function ListEmptyState({ role, searching, query, onClear }) {
  if (searching) {
    return (
      <EmptyState icon={SearchOffIcon} title="No conversations match" action={
        <Button variant="secondary" size="sm" onClick={onClear}>Clear search</Button>
      }>
        Nothing found for “{query}”. Search matches product and company names — whole words, or the
        start of one.
      </EmptyState>
    );
  }

  // 🔴 A seller CANNOT start a conversation (M4-4): every thread begins with a
  // buyer's enquiry on a product. So the exporter's empty state gets no call to
  // action — offering one would promise a control that does not exist.
  return role === 'exporter' ? (
    <EmptyState icon={ChatIcon} title="No enquiries yet">
      When a buyer enquires about one of your products, the conversation appears here.
    </EmptyState>
  ) : (
    <EmptyState
      icon={ChatIcon}
      title="No conversations yet"
      action={
        // Same link-styled CTA the other portal empty states use — `Button`
        // renders a <button> only, so a navigating action is a styled <Link>.
        <Link
          to="/search"
          className="inline-flex min-h-[44px] items-center rounded-full bg-primary-600 px-6 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Browse products
        </Link>
      }
    >
      When you enquire about a product, the conversation appears here — it is the only place you and
      the supplier can talk.
    </EmptyState>
  );
}

function ConversationList({ role, activeId, onSelect }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const list = useConversationList(search);

  const rows = (list.data?.pages ?? []).flatMap((page) => page.conversations);

  const submit = (e) => {
    e.preventDefault();
    setSearch(draft.trim());
  };

  const clear = () => {
    setDraft('');
    setSearch('');
  };

  const unreadRows = rows.filter((c) => c.unread).length;

  return (
    <div className="chat-rail flex h-full min-h-0 flex-col">
      {/* The rail's head is part of the same tinted FIELD as the list, not a
          white bar sitting on top of it — two surfaces meeting at a hairline
          read as a seam, and the column has no reason to be split in two. The
          search box is a white object on the field, exactly like the cards. */}
      <div className="shrink-0 border-b border-surface-border/60 px-3 pb-3 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[16px] font-bold tracking-tight text-ink-900">Messages</h2>
          {unreadRows > 0 && (
            <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {unreadRows} new
            </span>
          )}
          <span className="ml-auto text-[11px] font-medium text-ink-400">
            {rows.length > 0 && `${rows.length} ${rows.length === 1 ? 'thread' : 'threads'}`}
          </span>
        </div>

        {/* ⚠️ Submit-driven, NOT as-you-type. The server matches whole words
            with a word-start fallback and has no typo tolerance — an instant
            dropdown would imply a fuzzy search we cannot deliver. And it never
            searches message content (M4-32), hence the wording. */}
        <form onSubmit={submit} className="relative">
          <label htmlFor="chat-search" className="sr-only">Search conversations</label>
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            id="chat-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by product or company"
            className="h-10 w-full rounded-lg border border-surface-border bg-white pl-9 pr-9 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
          />
          {search && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {list.isLoading ? (
          <ul className="px-2 py-1">
            {Array.from({ length: 6 }, (_, i) => <ConversationRowSkeleton key={i} />)}
          </ul>
        ) : list.error ? (
          <ErrorState
            title="We couldn't load your conversations"
            requestId={list.error?.response?.data?.error?.requestId}
            onRetry={list.refetch}
          />
        ) : rows.length === 0 ? (
          <ListEmptyState role={role} searching={Boolean(search)} query={search} onClear={clear} />
        ) : (
          <>
            <ul className="px-2 py-1">
              {rows.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeId}
                  onSelect={onSelect}
                />
              ))}
            </ul>

            {list.hasNextPage ? (
              <div className="px-3 pb-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => list.fetchNextPage()}
                  disabled={list.isFetchingNextPage}
                >
                  {list.isFetchingNextPage ? <Spinner className="h-4 w-4" /> : 'Load more'}
                </Button>
              </div>
            ) : (
              /* A terminus. A short list used to stop mid-column and leave a
                 tall blank field below it, which reads as content that failed to
                 arrive rather than a list that ended. Only shown once the server
                 says there is no next page — never over a list still loading. */
              <p className="px-3 pb-4 pt-3 text-center text-[11px] font-medium text-ink-400">
                {rows.length === 1 ? 'One conversation' : `All ${rows.length} conversations`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ChatInbox() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  // Drafts live in the DOCK's context, not in this page's state: a message
  // half-typed in the floating window must still be there after "open in full
  // screen", and vice versa. Two stores meant the text silently vanished when
  // you switched surface.
  const dock = useChatDock();

  // A private surface — never in an index (m3-seo.md).
  useNoIndex(true);

  const role = user?.role === 'exporter' ? 'exporter' : 'buyer';
  const base = `/${role}/chat`;
  const nav = role === 'exporter' ? EXPORTER_NAV : BUYER_NAV;

  const thread = useThread(id, { viewerSide: role });

  // A thread the viewer is not a party to is a plain 404 from the server — not
  // a 403, which would confirm it exists. Send them back to the list rather
  // than leaving a dead pane on screen.
  useEffect(() => {
    if (thread.error?.response?.status === 404) navigate(base, { replace: true });
  }, [thread.error, base, navigate]);

  return (
    <PortalLayout nav={nav} wide>
      <h1 className="sr-only">Chat</h1>

      {/* The shell's canvas scrolls; a chat inbox must not. It gets a fixed
          viewport-relative height so the LIST and the TRANSCRIPT scroll
          independently inside it, and the composer stays put.

          The negative margin below sm reclaims the shell's own page padding:
          on a 390px screen those 24px each side are a sixth of the message
          column, and a chat is the one screen that genuinely wants the width. */}
      {/* `-mb-6` on phones swallows the shell's bottom page padding, so the
          composer sits on the viewport edge instead of floating above a strip
          of canvas. */}
      <div className="-mx-6 -mb-6 -mt-6 flex h-[calc(100dvh-var(--shell-chrome))] min-h-[26rem] overflow-hidden rounded-tl-[32px] border-b border-surface-border bg-white sm:mx-0 sm:mb-0 sm:mt-0 sm:h-[calc(100dvh-var(--shell-chrome)-5rem)] sm:rounded-2xl sm:border sm:shadow-card">
        {/* List — hidden on phones once a thread is open. */}
        <div
          className={`w-full min-w-0 border-surface-border md:w-[17rem] md:shrink-0 md:border-r lg:w-[22rem] ${
            id ? 'hidden md:block' : 'block'
          }`}
        >
          <ConversationList
            role={role}
            activeId={id}
            onSelect={(conversation) => navigate(`${base}/${conversation.id}`)}
          />
        </div>

        {/* Thread — full width on phones, the right pane on desktop. */}
        <div className={`min-w-0 flex-1 ${id ? 'block' : 'hidden md:block'}`}>
          {id ? (
            <ThreadView
              thread={thread}
              viewerSide={role}
              connected={dock.connected}
              draft={dock.drafts[id] ?? ''}
              onDraftChange={(value) => dock.setDraft(id, value)}
              onBack={() => navigate(base)}
            />
          ) : (
            <div className="chat-canvas flex h-full items-center justify-center">
              <div className="px-8 text-center">
                <span
                  aria-hidden="true"
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-card ring-1 ring-surface-border"
                >
                  <ChatIcon className="h-7 w-7" />
                </span>
                <h2 className="text-[15px] font-bold text-ink-900">Select a conversation</h2>
                <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted">
                  Choose a thread on the left to read it and reply. Every conversation here is
                  anchored to one product.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
