import { useCallback, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  conversationsApi,
  adminConversationsApi,
  conversationKeys,
} from '../api/conversations.js';

/**
 * One thread's data, for every surface that shows one: the inbox page, the
 * docked window, and the admin viewer.
 *
 * The three differ in exactly two ways — which endpoints they read (party vs
 * staff, and the staff ones are AUDITED on every call) and whether they can
 * send. Everything else is identical, so it lives here once rather than being
 * re-implemented per surface.
 *
 * §7.6 — history is CURSOR paginated, never page numbers: a message arriving
 * mid-scroll shifts every offset, and the reader sees a duplicate or a gap.
 */
const PAGE_SIZE = 30;

// Optimistic rows need a key that is unique even when the same text is sent
// twice in a row — React would otherwise reuse one row for both.
let pendingSeq = 0;
function nextPendingId() {
  pendingSeq += 1;
  return pendingSeq;
}

export function useThread(conversationId, { admin = false, enabled = true, viewerSide } = {}) {
  const queryClient = useQueryClient();
  const api = admin ? adminConversationsApi : conversationsApi;
  const keys = admin ? conversationKeys.admin : conversationKeys;
  const active = Boolean(conversationId) && enabled;

  // Messages the user has sent that the server has not confirmed yet. Held
  // OUTSIDE the query cache so a refetch can never resurrect a failed send or
  // duplicate a confirmed one.
  const [pending, setPending] = useState([]);

  const conversation = useQuery({
    queryKey: keys.detail(conversationId),
    queryFn: () => api.detail(conversationId),
    enabled: active,
  });

  const messages = useInfiniteQuery({
    queryKey: keys.messages(conversationId),
    queryFn: ({ pageParam }) => api.messages(conversationId, { before: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined,
    // `nextBefore` is the oldest id of the page just fetched; absent = start of
    // history. Never a page number.
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: active,
  });

  /**
   * Pages arrive newest-window-first and each page is oldest-first internally,
   * so the render order is the pages reversed, then flattened.
   */
  const confirmed = (messages.data?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((page) => page.messages);

  /**
   * 🔴 The double-message bug (owner-reported, 2026-08-17).
   *
   * A sent line briefly appeared TWICE and then collapsed to one. The optimistic
   * bubble was only removed when the send mutation resolved, but the socket
   * echoes the server's copy back to the sender — and that echo routinely wins
   * the race. Between the two, both were on screen.
   *
   * So the optimistic copy is now hidden the moment its confirmed twin exists,
   * whichever path delivered it. Matching is by body against the sender's OWN
   * recent messages, because the server cannot echo a client id back.
   *
   * Counted, not just "does the body exist": sending the same text twice in a
   * row must still show two bubbles, and only the confirmed ones NEWER than the
   * optimistic row can claim it — otherwise an identical line sent yesterday
   * would swallow today's.
   */
  const visiblePending = (() => {
    if (pending.length === 0) return pending;
    const oldestPendingAt = Math.min(...pending.map((p) => new Date(p.createdAt).getTime()));
    const claimable = new Map();
    for (const m of confirmed) {
      if (m.senderType !== viewerSide) continue;
      if (new Date(m.createdAt).getTime() + 1000 < oldestPendingAt) continue;
      claimable.set(m.body, (claimable.get(m.body) ?? 0) + 1);
    }
    return pending.filter((p) => {
      if (p.failed) return true;
      const left = claimable.get(p.body) ?? 0;
      if (left === 0) return true;
      claimable.set(p.body, left - 1);
      return false;
    });
  })();

  const markRead = useMutation({
    mutationFn: () => conversationsApi.markRead(conversationId),
    onSuccess: () => {
      // The badge is a server-derived COUNT, so it is asked for rather than
      // guessed. The row's own bold state is cleared in place — a whole list
      // refetch to unbolden one row is the flicker this pass exists to remove.
      queryClient.invalidateQueries({ queryKey: conversationKeys.unread() });
      for (const [key, data] of queryClient.getQueriesData({ queryKey: conversationKeys.lists() })) {
        if (!data?.pages) continue;
        queryClient.setQueryData(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((c) =>
              (c.id === conversationId ? { ...c, unread: false } : c)),
          })),
        });
      }
    },
  });

  const send = useMutation({
    mutationFn: (body) => conversationsApi.send(conversationId, body),
    onSuccess: (message, body) => {
      // Drop the optimistic copy and put the SERVER's message in the cache.
      setPending((prev) => prev.filter((p) => p.body !== body));
      queryClient.setQueryData(keys.messages(conversationId), (old) => {
        if (!old) return old;
        // 🔴 The socket echoes this same message back to the sender, so BOTH
        // write paths can reach the cache — and whichever arrives second used
        // to append a second copy with an identical id. Every write is now
        // guarded by the same id check.
        const seen = old.pages.some((page) => page.messages.some((m) => m.id === message.id));
        if (seen) return old;
        const pages = old.pages.slice();
        // Page 0 is the newest window; a new message belongs at its end.
        pages[0] = { ...pages[0], messages: [...pages[0].messages, message] };
        return { ...old, pages };
      });
      // 🔴 No list invalidation. The socket echoes this same message back and
      // `useConversationSocket` patches the row from it — preview, timestamp and
      // order — so refetching here would be a second round-trip for data that
      // has already landed. If the socket is down the row is one refetch behind
      // until it reconnects; the MESSAGE itself is never at risk, because the
      // REST response above is what wrote it.
    },
    onError: (_err, body) => {
      // Keep the text on screen, marked failed, with a retry ON the bubble —
      // never a toast that floats away from the words the sender lost.
      setPending((prev) => prev.map((p) => (p.body === body ? { ...p, failed: true } : p)));
    },
  });

  const sendMessage = useCallback(
    (body) => {
      setPending((prev) => [
        // A previous FAILED attempt at the same text is replaced rather than
        // stacked — otherwise retrying leaves two copies on screen.
        ...prev.filter((p) => !(p.body === body && p.failed)),
        {
          // Unique even when the same line is sent twice in a row.
          id: `pending:${nextPendingId()}`,
          // The sender is always the viewer, so the optimistic bubble sits on
          // the right immediately instead of appearing as the counterparty's.
          senderType: viewerSide,
          body,
          createdAt: new Date().toISOString(),
          pending: true,
        },
      ]);
      send.mutate(body);
    },
    [send, viewerSide],
  );

  const retry = useCallback(
    (body) => {
      setPending((prev) => prev.map((p) => (p.body === body ? { ...p, failed: false, pending: true } : p)));
      send.mutate(body);
    },
    [send],
  );

  return {
    conversation: conversation.data ?? null,
    isLoading: conversation.isLoading || messages.isLoading,
    error: conversation.error ?? messages.error ?? null,
    refetch: () => {
      conversation.refetch();
      messages.refetch();
    },
    messages: confirmed,
    pending: visiblePending,
    hasMore: Boolean(messages.hasNextPage),
    loadOlder: messages.fetchNextPage,
    loadingOlder: messages.isFetchingNextPage,
    sendMessage,
    retry,
    sending: send.isPending,
    markRead: markRead.mutate,
  };
}
