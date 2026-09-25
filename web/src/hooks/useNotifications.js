import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsApi, notificationKeys } from '../api/notifications.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { getSocket } from '../lib/socket.js';

/**
 * B8 · the bell's unread number, kept fresh two ways:
 *  - LIVE for buyers/sellers: the server says "notifications:changed" on the
 *    chat socket they already hold (content-free — we refetch our own list).
 *  - A 60 s poll + refetch on tab focus for everyone, which is all staff get:
 *    they hold no socket, and opening one just for a counter isn't worth it.
 */
export function useUnreadNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return undefined;
    const socket = getSocket();
    const onChanged = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    socket.on('notifications:changed', onChanged);
    return () => socket.off('notifications:changed', onChanged);
  }, [user, queryClient]);

  const q = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: notificationsApi.unreadCount,
    enabled: Boolean(user),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
  return q.isSuccess ? (q.data ?? 0) : 0;
}
