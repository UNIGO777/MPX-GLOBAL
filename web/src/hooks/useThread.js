import { useCallback, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  conversationsApi,
  adminConversationsApi,
  conversationKeys,
} from '../api/conversations.js';
import { isImageFile } from '../lib/chatFiles.js';

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

// What a confirmed message and an optimistic bubble are matched on.
const claimKey = (body, kind) => `${body ?? ''}\u0000${kind ?? ''}`;

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
   * whichever path delivered it. Matching is by body + attachment kind against
   * the sender's OWN recent messages, because the server cannot echo a client
   * id back. The kind matters since 2026-09-24: a file may now travel with NO
   * text, so two file-only sends (or a photo and a plain "") share a body.
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
      const k = claimKey(m.body, m.attachment ? m.attachment.kind ?? 'image' : null);
      claimable.set(k, (claimable.get(k) ?? 0) + 1);
    }
    return pending.filter((p) => {
      if (p.failed) return true;
      const k = claimKey(p.body, p.file ? (isImageFile(p.file) ? 'image' : 'document') : null);
      const left = claimable.get(k) ?? 0;
      if (left === 0) return true;
      claimable.set(k, left - 1);
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
    /**
     * D9 · one mutation, two transports (2026-09-23). A message with a file goes
     * to the multipart route; without one it takes the JSON route exactly as
     * before. Every optimistic-bubble lookup keys off `pendingId` — it used to
     * be the body, which stopped being unique once a file could be sent with no
     * text at all (owner, 2026-09-24).
     */
    // D10 · a non-image file is a document and takes its own route.
    mutationFn: ({ body, file }) => {
      if (!file) return conversationsApi.send(conversationId, body);
      return isImageFile(file)
        ? conversationsApi.sendImage(conversationId, { body, file })
        : conversationsApi.sendDocument(conversationId, { body, file });
    },
    onSuccess: (message, { pendingId }) => {
      // Drop the optimistic copy and put the SERVER's message in the cache.
      setPending((prev) => prev.filter((p) => p.id !== pendingId));
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
    onError: (_err, { pendingId }) => {
      // Keep the text on screen, marked failed, with a retry ON the bubble —
      // never a toast that floats away from the words the sender lost.
      setPending((prev) => prev.map((p) => (p.id === pendingId ? { ...p, failed: true } : p)));
    },
  });

  const sendMessage = useCallback(
    (body, file = null) => {
      // Unique even when the same line is sent twice in a row.
      const pendingId = `pending:${nextPendingId()}`;
      setPending((prev) => [
        // A previous FAILED attempt at the same text is replaced rather than
        // stacked — otherwise retrying leaves two copies on screen. Text-only:
        // a file-only send has no text to be "the same" as.
        ...prev.filter((p) => !(p.failed && !file && !p.file && p.body === body)),
        {
          id: pendingId,
          // The sender is always the viewer, so the optimistic bubble sits on
          // the right immediately instead of appearing as the counterparty's.
          senderType: viewerSide,
          body,
          createdAt: new Date().toISOString(),
          pending: true,
          /**
           * 🔴 The File is kept ON the pending bubble, not just handed to the
           * mutation. Retry re-reads it from here — without that, retrying a
           * failed image send would quietly deliver the text on its own and the
           * sender would believe the photograph had gone.
           * `previewUrl` is a local object URL so the bubble shows the image
           * while it uploads, instead of a blank space that fills in later.
           */
          file,
          // Images only — a document bubble shows its name and size instead.
          previewUrl: file && isImageFile(file) ? URL.createObjectURL(file) : null,
        },
      ]);
      send.mutate({ pendingId, body, file });
    },
    [send, viewerSide],
  );

  /** Retry ONE failed bubble, by its pending id — with its file, if it had one. */
  const retry = useCallback(
    (pendingId) => {
      const failed = pending.find((p) => p.id === pendingId);
      if (!failed) return;
      setPending((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, failed: false, pending: true } : p)),
      );
      send.mutate({ pendingId, body: failed.body, file: failed.file ?? null });
    },
    [send, pending],
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
