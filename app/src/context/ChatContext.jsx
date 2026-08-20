import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { conversationsApi } from '../api/conversations.js';
import { getSocket, teardownSocket } from '../realtime/socket.js';
import { useAuth } from './AuthContext.jsx';

/**
 * M4 — chat session state (2026-08-20): owns the socket's lifecycle (up while
 * signed in, torn down on logout so the next user never inherits rooms) and
 * the ONE number the tab bar needs: unread THREADS.
 *
 * The badge is the approved in-app signal (brief §0.3 — the web tab-title
 * count's equivalent). It refreshes from the server's derived count — never
 * incremented locally, because the server's definition of "unread" (equal
 * timestamps count as read) is the one the list renders. Socket events just
 * tell us WHEN to re-ask.
 */
const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { isAuthenticated: authed } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      setUnread(await conversationsApi.unreadCount());
    } catch {
      // Badge is best-effort — a failed refresh keeps the previous number.
    }
  }, []);

  useEffect(() => {
    if (!authed) {
      teardownSocket();
      setUnread(0);
      return undefined;
    }
    const socket = getSocket();
    const onDelta = () => refreshUnread();
    socket.on('message:new', onDelta);
    socket.on('conversation:updated', onDelta);
    socket.on('connect', onDelta); // reconnect = re-ask; we may have missed events
    refreshUnread();
    return () => {
      socket.off('message:new', onDelta);
      socket.off('conversation:updated', onDelta);
      socket.off('connect', onDelta);
    };
  }, [authed, refreshUnread]);

  const value = useMemo(() => ({ unread, refreshUnread }), [unread, refreshUnread]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
