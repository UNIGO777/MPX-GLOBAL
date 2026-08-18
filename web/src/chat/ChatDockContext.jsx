import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { useConversationSocket } from '../hooks/useConversationSocket.js';

/**
 * The docked chat's state, deliberately held ABOVE the router.
 *
 * 🔴 That placement is the whole feature. The point of a dock is that a buyer
 * can keep browsing — open a product, run a search, change category — while a
 * conversation stays open and live. State inside a route would be unmounted by
 * the first navigation, which is exactly the behaviour the dock exists to avoid.
 *
 * Drafts live here for the same reason: half-typed text must survive both a
 * navigation and closing the window, and it is deliberately kept in MEMORY
 * only — never storage. It is another company's commercial conversation, not
 * something to leave on the device.
 */
const ChatDockContext = createContext(null);

export function ChatDockProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const openThread = useCallback((conversationId) => {
    setActiveId(conversationId);
    setOpen(true);
  }, []);

  const openList = useCallback(() => {
    setActiveId(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const backToList = useCallback(() => setActiveId(null), []);

  const setDraft = useCallback((conversationId, value) => {
    setDrafts((prev) => ({ ...prev, [conversationId]: value }));
  }, []);

  // ONE socket for the whole app, opened here because this provider is the only
  // thing that is mounted on every page and outlives every navigation. The dock,
  // the inbox page and the nav badge all read the same connection — two hook
  // call sites would register the handlers twice.
  const { connected } = useConversationSocket();

  const value = useMemo(
    () => ({ open, activeId, drafts, connected, openThread, openList, close, backToList, setDraft }),
    [open, activeId, drafts, connected, openThread, openList, close, backToList, setDraft],
  );

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error('useChatDock must be used inside ChatDockProvider');
  return ctx;
}
