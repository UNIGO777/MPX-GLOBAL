import { io } from 'socket.io-client';

import { env } from '../config/env.js';
import { tokenStore } from '../api/tokenStore.js';

/**
 * M4 — the one socket connection (2026-08-20). Live delivery ONLY (§7.1):
 * new messages and freeze events arrive here; every action (send, read,
 * history) has a REST path that works with this thing disconnected.
 *
 * §7.2 — authenticates with the same JWT as REST (`auth.token` in the
 * handshake). `auth` is a FUNCTION so every reconnect attempt reads the
 * CURRENT access token — a fixed value would replay a token that expired
 * during the disconnect and bounce forever.
 *
 * Parties are joined to ALL their thread rooms server-side at connect, so
 * `message:new` arrives globally — the badge listens app-wide and threads
 * filter by conversationId. A conversation created AFTER connect isn't in
 * the room set yet: the thread screen emits `conversation:open` on mount,
 * which joins it (and a reconnect re-joins everything).
 *
 * ONE instance, lazily created, torn down on logout — never per-screen.
 */
let socket = null;

export function getSocket() {
  if (socket) return socket;
  socket = io(env.apiBaseUrl, {
    transports: ['websocket'],
    auth: (cb) => cb({ token: tokenStore.getAccessToken() }),
    reconnection: true,
    reconnectionDelayMax: 10000,
  });
  return socket;
}

/** Logout: drop the connection AND the instance — the next session must not
 *  reuse a socket whose rooms belong to the previous user. */
export function teardownSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
