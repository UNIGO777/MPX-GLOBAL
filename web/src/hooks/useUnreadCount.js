import { useQuery } from '@tanstack/react-query';

import { conversationsApi, conversationKeys } from '../api/conversations.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * The unread badge's number — used by the portal nav and the dock launcher, so
 * both always agree.
 *
 * 🔴 It counts THREADS with unread messages, not messages. The server derives it
 * by comparing `lastMessageAt` against the caller's own `lastReadAt`; no counter
 * is stored anywhere and there is no per-thread message count to be had. A "3
 * new messages" badge cannot be built from this, and must not be faked.
 *
 * Buyer and exporter only. Staff are never a party to a thread (M4-2) — the
 * endpoint returns 0 for them, so the query simply does not run.
 */
export function useUnreadCount() {
  const { user } = useAuth();
  const isParty = user?.role === 'buyer' || user?.role === 'exporter';

  const query = useQuery({
    queryKey: conversationKeys.unread(),
    queryFn: conversationsApi.unreadCount,
    enabled: isParty,
    // Live updates arrive over the socket; this is the floor for a tab that has
    // been sitting idle, not the primary path.
    staleTime: 30_000,
  });

  return isParty && query.isSuccess ? (query.data ?? 0) : 0;
}
