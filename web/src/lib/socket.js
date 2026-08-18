import { io } from 'socket.io-client';

import { config } from '../config.js';
import { tokenStore } from '../auth/tokenStore.js';

/**
 * The ONE socket connection, mirroring the ONE api client.
 *
 * §7.1 — the socket carries LIVE DELIVERY ONLY. Creating an enquiry, fetching
 * the list, fetching history, marking read and every moderation action are
 * ordinary requests. If this connection never opens, the application still
 * works; it just stops updating by itself.
 *
 * 🔴 The token comes from the in-memory store on every (re)connect, never from
 * storage, and it is passed in the handshake `auth` — the server re-verifies it
 * against `tokenVersion` on every event, so a revoked session stops working on
 * an already-open connection rather than at next page load.
 */
let socket = null;

/**
 * Where to connect, and on which path.
 *
 * In dev the API base is `/api`, a Vite proxy — so the socket connects to our
 * OWN origin on `/api/socket.io` and the proxy (`ws: true`) forwards the
 * upgrade to the backend's default `/socket.io`. Same-origin in dev is not
 * cosmetic: it is what keeps the refresh cookie first-party, the same reason
 * the XHR calls are proxied rather than pointed at the API host.
 *
 * In production `VITE_API_BASE_URL` is absolute, so it connects there directly
 * on the default path.
 */
function socketTarget() {
  const base = config.api.baseUrl;
  return base.startsWith('/')
    ? { url: window.location.origin, path: `${base}/socket.io` }
    : { url: base.replace(/\/+$/, ''), path: '/socket.io' };
}

export function getSocket() {
  if (socket) return socket;

  const { url, path } = socketTarget();
  socket = io(url, {
    path,
    autoConnect: false,
    // Fresh token per attempt: `auth` as a function is re-evaluated on every
    // reconnect, so a token refreshed while offline is the one that is used.
    auth: (cb) => cb({ token: tokenStore.getAccessToken() ?? '' }),
    withCredentials: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/**
 * Connection status as an EXTERNAL STORE, for `useSyncExternalStore`.
 *
 * The socket's connected/disconnected state is owned by socket.io, not by
 * React. Mirroring it into `useState` inside an effect is what the compiler
 * lint flags — and it is genuinely fragile: a socket that is already open when
 * a component mounts fires no `connect` event, so the mirrored copy starts
 * wrong until the next reconnect.
 */
export function subscribeSocketStatus(onChange) {
  const s = getSocket();
  s.on('connect', onChange);
  s.on('disconnect', onChange);
  return () => {
    s.off('connect', onChange);
    s.off('disconnect', onChange);
  };
}

export function getSocketStatus() {
  return Boolean(socket?.connected);
}

/** Sign-out must not leave a live socket carrying the previous user's rooms. */
export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
