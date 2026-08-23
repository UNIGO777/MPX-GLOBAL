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
    // 🔴 DO NOT pin this to `['websocket']` again. It was, and it made live
    // chat dead in production (2026-08-22).
    //
    // Socket.io's default is polling FIRST, then a silent upgrade to
    // websocket once one is proven to work. Forcing websocket-only removes
    // that fallback: the connection then depends on every hop between the
    // phone and the server honouring an HTTP Upgrade — and the production
    // nginx does not, so the socket never connected at all and every message
    // arrived only on a manual refresh.
    //
    // The web client never set this, defaulted to polling, and worked
    // throughout — which is exactly why the fault went unnoticed for two days.
    //
    // Leaving it at the default also buys resilience we want regardless:
    // corporate proxies and captive Wi-Fi commonly block websockets, and a
    // chat that degrades to polling beats one that silently stops updating.
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
