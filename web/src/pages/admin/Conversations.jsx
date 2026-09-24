import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { adminConversationsApi, conversationKeys } from '../../api/conversations.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { BlockModal, UnblockModal } from '../../components/chat/ModerationModals.jsx';
import { FreezeChip } from '../../components/chat/FreezeChip.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { ToolbarSearch } from '../../components/ui/ToolbarSearch.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { BoxIcon, ChatIcon, ChevronRightIcon, XIcon } from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { formatDate, formatListTime } from '../../lib/format.js';
import { cp } from '../../lib/consolePath.js';

/**
 * M4 screen 5 — every conversation on the platform (`/admin/conversations`).
 *
 * Gated by `conversation:read`, which is grantable to an employee (owner,
 * 2026-07-31). The sidebar hides the item without it; the server refuses the
 * endpoint regardless — hiding is presentation, never enforcement.
 *
 * 🔴 Browsing this list is deliberately NOT audited (G11) — it is metadata, and
 * a record for every keystroke of a moderator's search would bury the reads
 * that matter. OPENING a thread is what gets recorded, on screen 6.
 *
 * 🔴 CURSOR pagination, never page numbers: this list is sorted by last
 * activity, so every message sent anywhere on the platform reorders it under a
 * moderator who is paging. With `skip` they would see one thread twice and miss
 * another entirely.
 */
const PAGE_LIMIT = 20;

/** The two parties' unread — NOT the moderator's. It is how a moderator spots
 *  a thread the seller never opened. */
function UnreadFlags({ unread, placeholder = false }) {
  const flags = [
    ['Buyer', unread?.buyer],
    ['Exporter', unread?.exporter],
  ].filter(([, value]) => value);

  if (flags.length === 0) return placeholder ? <span className="text-xs text-ink-400">—</span> : null;

  return (
    <span className="flex flex-wrap gap-1">
      {flags.map(([who]) => (
        <span
          key={who}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-800"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-warning-500" aria-hidden="true" />
          {who} unseen
        </span>
      ))}
    </span>
  );
}

/**
 * The two companies' marks, overlapped — a thread is always buyer × seller, so
 * they read as one unit rather than two separate icons. Buyer in front, matching
 * the order the title is written in.
 *
 * The server already sends both logos on the staff projection; until now nothing
 * rendered them, so `loadOrgLogos` ran on every page of this list and its result
 * was thrown away.
 */
function OrgPair({ conversation }) {
  return (
    // 2026-09-24: a diagonal stack instead of a tight side-by-side overlap —
    // the second mark covered the first one's initials ("SC" read as "S(").
    <span className="relative block h-11 w-11 shrink-0" aria-hidden="true">
      <CompanyAvatar
        name={conversation.buyerOrg?.name ?? ''}
        logo={conversation.buyerOrg?.logo}
        size="xs"
        className="absolute left-0 top-0 ring-2 ring-white"
      />
      <CompanyAvatar
        name={conversation.exporterOrg?.name ?? ''}
        logo={conversation.exporterOrg?.logo}
        size="xs"
        className="absolute bottom-0 right-0 ring-2 ring-white"
      />
    </span>
  );
}

const STATE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'open', label: 'Open' },
  { value: 'frozen', label: 'Frozen — any reason' },
  { value: 'blocked', label: 'Blocked by MPX' },
  { value: 'takedown', label: 'Product under review' },
  { value: 'account', label: 'Account paused' },
];

/** A scope that arrived in the URL (org / product) — shown, removable, never a
 *  control of its own. */
function ScopeChip({ children, onClear, clearLabel }) {
  return (
    <span className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-primary-600 bg-primary-50 pl-3.5 pr-2 text-[13px] font-semibold text-primary-700">
      {children}
      <button type="button" onClick={onClear} aria-label={clearLabel} className="rounded-full p-1 hover:bg-primary-100">
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function Conversations() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  /**
   * The moderation state. `q` cannot express it — search only ever matches the
   * three denormalised names and the two org ids — and it is the split a
   * moderator actually works in: "what is blocked right now" is a different
   * question from "what is paused because a product is under review".
   *
   * The reasons are separated rather than rolled into one "frozen" because they
   * are different jobs: a block is a decision someone made and may need
   * reversing, a takedown clears itself when the product returns, and an account
   * pause is not about this thread at all.
   */
  const [state, setState] = useState('');

  // Search as you type (2026-09-24), same pause as the other admin lists.
  useEffect(() => {
    const t = setTimeout(() => setQuery(draft.trim()), 350);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Conversations — MPX Global';
    return () => { document.title = previous; };
  }, []);

  /**
   * An organisation filter arrives in the URL, from the Organisations list's
   * "View conversations" (§3: cross-links between sections are the paths an
   * investigation actually follows). It is not a control on this screen — there
   * is no org picker here — so it renders as a removable chip rather than a
   * fourth empty dropdown.
   */
  const [params, setParams] = useSearchParams();
  const orgId = params.get('orgId') ?? '';
  // §7 — "as buyer" / "as exporter" for ONE org: what splits a both-sides
  // company into two clean lists. Meaningless alone (the server refuses it),
  // so it is only ever read alongside orgId and clears with it.
  const side = orgId ? (params.get('side') ?? '') : '';
  /**
   * A product scope arrives from the monitoring list's "View chats" (§4). The
   * endpoint has always accepted `productId`; like `orgId` it is not a control
   * on this screen, so it renders as a removable chip.
   */
  const productId = params.get('productId') ?? '';
  const clearParam = (key) => () => {
    const next = new URLSearchParams(params);
    next.delete(key);
    if (key === 'orgId') next.delete('side'); // side cannot outlive its org
    setParams(next, { replace: true });
  };

  const list = useInfiniteQuery({
    queryKey: conversationKeys.admin.list({ q: query, state, orgId, side, productId }),
    queryFn: ({ pageParam }) =>
      adminConversationsApi.list({
        q: query || undefined,
        state: state || undefined,
        orgId: orgId || undefined,
        side: side || undefined,
        productId: productId || undefined,
        cursor: pageParam,
        limit: PAGE_LIMIT,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = (list.data?.pages ?? []).flatMap((page) => page.conversations);

  // ── Row-level moderation (§7 screen 9) — same dialogs as the viewer. ──
  const { user } = useAuth();
  const qc = useQueryClient();
  const mayBlock = can(user, 'conversation:block');
  const [blockTarget, setBlockTarget] = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);

  const closeModeration = () => {
    setBlockTarget(null);
    setUnblockTarget(null);
  };
  const refreshList = () => qc.invalidateQueries({ queryKey: conversationKeys.admin.all });

  const blockRow = useMutation({
    mutationFn: ({ id, reason }) => adminConversationsApi.block(id, reason),
    onSuccess: () => { closeModeration(); refreshList(); },
  });
  const unblockRow = useMutation({
    mutationFn: ({ id, reason }) => adminConversationsApi.unblock(id, reason),
    onSuccess: () => { closeModeration(); refreshList(); },
  });

  return (
    <AdminLayout>
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Conversations</h1>
        <p className="mt-1 text-sm text-muted">
          Every enquiry thread on the platform. Opening one is recorded in the audit log.
        </p>
      </header>

      {/* Toolbar (2026-09-24) — the admin list language: a bordered search and
          FILTER CHIPS. The org / product scopes (they arrive from other
          screens' cross-links and have no control here) sit in the same chip
          row as removable chips instead of banners of their own. */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-md lg:flex-1">
          <ToolbarSearch
            id="admin-chat-search"
            label="Search conversations"
            value={draft}
            onChange={setDraft}
            onSubmit={() => setQuery(draft.trim())}
            onClear={() => { setDraft(''); setQuery(''); }}
            placeholder="Search company, product or org ID…"
          />
        </div>
        <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <FilterChip label="State" value={state} options={STATE_OPTIONS} onChange={setState} />
          {orgId && (
            <ScopeChip onClear={clearParam('orgId')} clearLabel="Show all organisations">
              Organisation{side ? ` · as ${side}` : ''}
              <code className="font-mono text-[11px] font-normal">{orgId.slice(-6)}</code>
              {side && (
                <button
                  type="button"
                  onClick={clearParam('side')}
                  className="font-medium underline decoration-primary-300 underline-offset-2"
                >
                  both sides
                </button>
              )}
            </ScopeChip>
          )}
          {productId && (
            <ScopeChip onClear={clearParam('productId')} clearLabel="Show threads about every product">
              One product
              <code className="font-mono text-[11px] font-normal">{productId.slice(-6)}</code>
            </ScopeChip>
          )}
          {(query || state || orgId || productId) && (
            <button
              type="button"
              onClick={() => {
                setDraft('');
                setQuery('');
                setState('');
                setParams(new URLSearchParams(), { replace: true });
              }}
              className="ml-1 shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] font-semibold text-primary-700 hover:bg-primary-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isLoading ? (
          <SkeletonRows rows={8} />
        ) : list.error ? (
          <ErrorState
            title="We couldn't load conversations"
            requestId={list.error?.response?.data?.error?.requestId}
            onRetry={list.refetch}
          />
        ) : rows.length === 0 ? (
          /* An empty result has to name what produced it. "No conversations yet"
             under an active state filter is a lie — there may be plenty, just
             none in that state — and it sends a moderator looking for a bug. */
          <EmptyState
            icon={ChatIcon}
            title={query || state ? 'No conversations match' : 'No conversations yet'}
            action={
              query || state ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDraft('');
                    setQuery('');
                    setState('');
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          >
            {query
              ? `Nothing found for “${query}”${state ? ' in that state' : ''}. Names match whole words or the start of one; an organisation ID matches exactly.`
              : state
                ? 'No thread is in that state right now.'
                : 'Threads appear here as soon as buyers start enquiring.'}
          </EmptyState>
        ) : (
          <>
            {/* 🔴 The table is xl+ ONLY (2026-09-24; it was md+). At 1024 with
                the sidebar open the sized columns left the Conversation column
                "S1 Co 7504…". Below xl the card list takes over — the same
                pattern the other admin lists use. */}
            <div className="hidden xl:block">
              {/* 🔴 `min-w-[64rem]` is gone. It forced the table wider than the
                  canvas, so the ACTION column — the only way into a thread —
                  was clipped at the right edge and reachable only by
                  horizontal scrolling. The layout is fixed-width now: the
                  conversation cell flexes and truncates, every other column is
                  sized to its content, and View always lands on screen. */}
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  {/* 2026-09-24: the fixed columns were sized for slack, not
                      content — together ~46rem of a ~58rem table, which left the
                      one column that matters (who, about what) cut to "S1 Co …". */}
                  <col />
                  <col className="w-[9rem]" />
                  <col className="w-[8.5rem]" />
                  <col className="w-[5.5rem]" />
                  <col className="hidden w-[7rem] 2xl:table-column" />
                  <col className={mayBlock ? 'w-[10.5rem]' : 'w-[5rem]'} />
                </colgroup>
                <thead className="border-b border-surface-border bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Conversation</th>
                    <th scope="col" className="px-4 py-3 font-semibold">State</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Unread</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Activity</th>
                    <th scope="col" className="hidden px-4 py-3 font-semibold 2xl:table-cell">Started</th>
                    <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((c) => (
                    <tr key={c.id} className={c.frozen ? 'bg-danger-50/40' : 'hover:bg-ink-50/70'}>
                      <td className="px-4 py-3">
                        {/* M4-17 — companies and the product, never a person.
                            Split across two lines: the composed title ran to
                            ~60 characters and was squeezing every other column
                            off the screen. */}
                        <div className="flex items-start gap-3">
                          <OrgPair conversation={c} />
                          <div className="min-w-0 flex-1">
                            {/* Two lines before it truncates: the pair of company
                                names IS the row's identity (2026-09-24). */}
                            <p className="line-clamp-2 break-words font-semibold leading-snug text-ink-900">
                              {c.buyerOrg?.name} <span className="text-ink-400">×</span>{' '}
                              {c.exporterOrg?.name}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-500">
                              <BoxIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                              <span className="truncate">{c.product?.name}</span>
                            </p>
                            <p className="mt-1 truncate text-xs text-muted">
                              {c.lastMessagePreview ?? 'No messages yet'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.frozenLabel?.text ? (
                          <FreezeChip label={c.frozenLabel} short />
                        ) : (
                          /* A chip, not bare grey text — the state column is
                             what a moderator scans down, and it needs a shape
                             to scan rather than a word to read. */
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-50 px-2.5 py-1 text-[12px] font-semibold text-success-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><UnreadFlags unread={c.unread} placeholder /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                        {formatListTime(c.lastMessageAt)}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-ink-500 2xl:table-cell">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <Link
                            to={cp(`/admin/conversations/${c.id}`)}
                            className="inline-flex items-center rounded-full border border-ink-200 px-3.5 py-1.5 text-xs font-semibold text-ink-800 transition-colors hover:border-primary-600 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                          >
                            View
                          </Link>
                          {mayBlock &&
                            (c.blockedReason ? (
                              <button
                                type="button"
                                onClick={() => setUnblockTarget(c)}
                                className="inline-flex items-center rounded-full border border-ink-200 px-3.5 py-1.5 text-xs font-semibold text-ink-800 transition-colors hover:border-primary-600 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                              >
                                Unblock
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setBlockTarget(c)}
                                className="inline-flex items-center rounded-full border border-danger-200 px-3.5 py-1.5 text-xs font-semibold text-danger-700 transition-colors hover:bg-danger-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-300"
                              >
                                Block
                              </button>
                            ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 🔴 Phone: the ROW is the link. The old card carried a full-width
                "View conversation" button under every thread — three of them
                filled the screen, and the row above each one looked inert while
                being the thing a moderator actually reads. One tap target, a
                chevron to say so, and the vertical space goes back to the list.
                Same data as the table; nothing is phone-only. */}
            <ul className="divide-y divide-surface-border xl:hidden">
              {rows.map((c) => (
                <li key={c.id} className={c.frozen ? 'bg-danger-50/40' : ''}>
                  <Link
                    to={cp(`/admin/conversations/${c.id}`)}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-ink-50"
                  >
                    <OrgPair conversation={c} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {/* M4-17 — companies and the product, never a person. */}
                        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-900">
                          {c.buyerOrg?.name} <span className="text-ink-400">×</span>{' '}
                          {c.exporterOrg?.name}
                        </p>
                        <span className="shrink-0 text-[11px] text-ink-400">
                          {formatListTime(c.lastMessageAt)}
                        </span>
                      </div>

                      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-500">
                        <BoxIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                        <span className="truncate">{c.product?.name}</span>
                      </p>

                      {!c.frozenLabel?.text && (
                        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">
                          {c.lastMessagePreview ?? 'No messages yet'}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {c.frozenLabel?.text ? (
                          <FreezeChip label={c.frozenLabel} size="sm" short />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                            Open
                          </span>
                        )}
                        <UnreadFlags unread={c.unread} />
                      </div>
                    </div>

                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-300" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>

            {list.hasNextPage && (
              <div className="border-t border-surface-border p-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => list.fetchNextPage()}
                  disabled={list.isFetchingNextPage}
                >
                  {list.isFetchingNextPage ? <Spinner className="h-4 w-4" /> : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <BlockModal
        key={`block-${blockTarget?.id ?? 'none'}`}
        open={Boolean(blockTarget)}
        onClose={closeModeration}
        pending={blockRow.isPending}
        error={blockRow.error ? 'Could not block this conversation. Try again.' : null}
        onConfirm={(reason) => blockRow.mutate({ id: blockTarget.id, reason })}
      />
      <UnblockModal
        key={`unblock-${unblockTarget?.id ?? 'none'}`}
        open={Boolean(unblockTarget)}
        onClose={closeModeration}
        pending={unblockRow.isPending}
        error={unblockRow.error ? 'Could not unblock this conversation. Try again.' : null}
        onConfirm={(reason) => unblockRow.mutate({ id: unblockTarget.id, reason })}
      />
    </AdminLayout>
  );
}
