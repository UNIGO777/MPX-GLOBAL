import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { conversationKeys } from '../api/conversations.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  getSocketStatus,
  subscribeSocketStatus,
} from '../lib/socket.js';

/**
 * Live delivery — the only thing the socket is for (§7.1).
 *
 * Mounted ONCE, high in the tree, so a single connection serves the dock, the
 * inbox page and the nav badge at the same time. Every handler writes into the
 * SAME react-query cache the REST paths use, so there is one source of truth
 * per thread and no second store to drift.
 *
 * 🔴 PATCH, don't refetch. Every field a list row shows after a new message —
 * the preview, the timestamp, the unread dot, the row's position — is derivable
 * from the message that just arrived, so invalidating the list meant a network
 * round-trip and a full re-render for data we were already holding. The list is
 * rewritten in place instead, and only a thread we have never seen falls back to
 * a refetch (a first message opens a conversation the cache cannot know about).
 *
 * Events handled:
 *   message:new           append to that thread's cache (deduped by id), and
 *                         patch + re-order its row in every cached list
 *   conversation:updated  arrives WITH message:new; only acts on a thread the
 *                         cache does not have
 *   conversation:frozen   the composer swaps to a banner mid-session (§7.4 —
 *                         freeze is PUSHED, not polled)
 *   conversation:unfrozen the reverse
 */
/**
 * The server truncates a list preview at 200 characters
 * (`message.service.js` PREVIEW_LENGTH). Mirrored here because this patch has to
 * produce the same row the next fetch would — a longer preview now and a
 * shorter one after any refetch is a visible jump.
 */
const PREVIEW_LENGTH = 200;

/** Every cached variant of the party list — one per search term (`list(params)`). */
function listQueries(queryClient) {
  return queryClient.getQueriesData({ queryKey: conversationKeys.lists() });
}

function hasConversation(queryClient, conversationId) {
  return listQueries(queryClient).some(([, data]) =>
    (data?.pages ?? []).some((page) => page.conversations.some((c) => c.id === conversationId)),
  );
}

/**
 * Rewrite one row from the message that just arrived, and move it to the top.
 *
 * Returns false when the thread is in no cached list, which is the ONE case
 * that still needs the server: a brand-new conversation, or one that lives past
 * the pages loaded so far. Inventing a row for it would put a thread on screen
 * with no product, no counterparty and no logo.
 *
 * 🔴 `unread` is set only for the OTHER side's messages, and only optimistically
 * — the thread's own `markRead` corrects it the moment it is open. The server
 * derives it by comparing two timestamps (§7.5) and stays the authority; this
 * exists so the dot appears the instant the line does.
 */
function patchListRow(queryClient, conversationId, message, viewerSide) {
  let found = false;

  for (const [key, data] of listQueries(queryClient)) {
    if (!data?.pages) continue;

    let row = null;
    // Pull it out of whichever page holds it — it is about to become the newest
    // thread, so it belongs at the head of the first page regardless.
    const pages = data.pages.map((page) => {
      const hit = page.conversations.find((c) => c.id === conversationId);
      if (!hit) return page;
      row = hit;
      return { ...page, conversations: page.conversations.filter((c) => c.id !== conversationId) };
    });
    if (!row) continue;

    found = true;
    const patched = {
      ...row,
      lastMessagePreview: message.body.slice(0, PREVIEW_LENGTH),
      lastMessageAt: message.createdAt,
      unread: message.senderType === viewerSide ? row.unread : true,
    };
    pages[0] = { ...pages[0], conversations: [patched, ...pages[0].conversations] };
    queryClient.setQueryData(key, { ...data, pages });
  }

  return found;
}

export function useConversationSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isParty = user?.role === 'buyer' || user?.role === 'exporter';
  const viewerSide = user?.role === 'exporter' ? 'exporter' : 'buyer';

  /**
   * Read the connection straight from socket.io instead of mirroring it into
   * React state — no effect, no stale copy, and correct on a remount into an
   * already-open socket (which fires no `connect` event to catch).
   */
  const subscribe = useCallback(
    (onChange) => (isParty ? subscribeSocketStatus(onChange) : () => {}),
    [isParty],
  );
  const connected = useSyncExternalStore(subscribe, getSocketStatus, () => false);

  useEffect(() => {
    // Staff are never a party to a thread (M4-2) and guests have no session, so
    // neither opens a connection at all.
    if (!isParty) {
      disconnectSocket();
      return undefined;
    }

    const socket = connectSocket();

    const onMessage = ({ conversationId, message }) => {
      queryClient.setQueryData(conversationKeys.messages(conversationId), (old) => {
        if (!old) return old;
        // 🔴 De-duplicate by SERVER id. The sender receives their own message
        // back over the socket, and it is already in the cache from the send's
        // response — without this the writer sees every line twice.
        const seen = old.pages.some((page) => page.messages.some((m) => m.id === message.id));
        if (seen) return old;

        const pages = old.pages.slice();
        pages[0] = { ...pages[0], messages: [...pages[0].messages, message] };
        return { ...old, pages };
      });

      // The row's preview, position and unread dot — patched, not refetched.
      const known = patchListRow(queryClient, conversationId, message, viewerSide);
      if (!known) queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });

      // The nav badge stays a refetch on purpose: it is a COUNT of unread
      // threads, derived server-side from two timestamps, and guessing at it
      // here would put a number in the chrome that the server never said. It is
      // a tiny response, and it is the one thing that must not be invented.
      queryClient.invalidateQueries({ queryKey: conversationKeys.unread() });
    };

    // Emitted alongside `message:new` for the same event, so by the time this
    // runs the row is already patched. It only earns a refetch for a thread the
    // cache has never seen.
    const onUpdated = ({ conversationId }) => {
      if (!hasConversation(queryClient, conversationId)) {
        queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      }
    };

    const onFreezeChange = ({ conversationId }) => {
      // Re-read the thread rather than patching a frozen flag by hand: the
      // server decides the label, and after an unblock it may legitimately stay
      // frozen for a DIFFERENT reason (M4-30).
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
      // The row's freeze CHIP comes from the same server-decided label, so the
      // list is refetched here too — narrowed from `all`, which was re-fetching
      // the detail and messages a second time on top of the two lines above.
      // A freeze is a rare, deliberate event; this is not a per-message cost.
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    };

    socket.on('message:new', onMessage);
    socket.on('conversation:updated', onUpdated);
    socket.on('conversation:frozen', onFreezeChange);
    socket.on('conversation:unfrozen', onFreezeChange);

    return () => {
      socket.off('message:new', onMessage);
      socket.off('conversation:updated', onUpdated);
      socket.off('conversation:frozen', onFreezeChange);
      socket.off('conversation:unfrozen', onFreezeChange);
    };
  }, [isParty, queryClient, viewerSide]);

  // Sign-out tears the connection down completely — a live socket must not
  // outlive the session that authorised it.
  useEffect(() => () => disconnectSocket(), []);

  return { connected: isParty ? connected : false, socket: isParty ? getSocket() : null };
}
