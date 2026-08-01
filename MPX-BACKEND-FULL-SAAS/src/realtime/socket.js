import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { verifyAccessToken } from '../services/token.service.js';
import { sendMessage } from '../services/message.service.js';
import { markRead, viewerSideFor } from '../services/conversation.service.js';
import { messageView } from '../views/conversation.view.js';

/**
 * M4-G — live delivery only (§7.1).
 *
 * Everything that MATTERS is REST: creating an enquiry, fetching the list,
 * fetching history, marking read, admin moderation. The socket carries new
 * messages and freeze events. If it drops, the application still works — it
 * just stops updating live. Nothing here is the only path to anything.
 */

const ROOM = (conversationId) => `conversation:${conversationId}`;

// G9 — a reconnecting client asks for what it missed. Bounded: a user offline
// for a week must not be handed thousands of messages down a socket. Past the
// cap we tell the client to refetch that thread over REST, which is what the
// socket is explicitly NOT for (§7.1).
const RESYNC_CAP = 100;

let io = null;

export function getIo() {
  return io;
}

/**
 * §7.2 — the socket authenticates with the same JWT as REST.
 *
 * ⚠️ The handshake alone is NOT enough, and the plan says so: an already-open
 * socket keeps working after a `tokenVersion` bump, so a blocked user would go
 * on chatting until they happened to reconnect. Every `message:send` therefore
 * re-verifies against the database — cheap, because the send guard already has
 * to hit the DB for the party and frozen checks anyway.
 */
async function authenticateToken(token) {
  const payload = verifyAccessToken(token);
  const user = await User.findOne({ _id: payload.sub, isActive: true }).select('role orgId tokenVersion');
  if (!user) throw new Error('user not found');
  if (user.tokenVersion !== payload.tv) throw new Error('token version mismatch');
  return {
    userId: String(user._id),
    orgId: user.orgId ? String(user.orgId) : null,
    role: user.role,
  };
}

/**
 * ONE place that decides where the token comes from.
 *
 * The handshake accepts either `auth.token` or an `Authorization` header, so the
 * re-verification below must read it the same way — reading only `auth.token`
 * meant a client that authenticated via the header could CONNECT but never send
 * a single message, because every re-check saw an empty token.
 */
function tokenFromHandshake(socket) {
  return socket.handshake.auth?.token ?? socket.handshake.headers?.authorization?.split(' ')[1] ?? '';
}

/**
 * Re-verify on EVERY event that reads or writes data, not just on send.
 *
 * `conversation:resync` returns message BODIES, so a socket that only checked
 * its token at handshake would keep serving a revoked user their counterparty's
 * conversation for as long as the connection stayed open. Revocation
 * (deactivation, password change, org block) has to bite on the next event of
 * any kind — which is what §7.2's "disconnected immediately" actually requires.
 */
async function currentUser(socket) {
  const fresh = await authenticateToken(tokenFromHandshake(socket));
  if (fresh.userId !== socket.data.user.userId) throw new Error('identity changed');
  return fresh;
}

function partyFilter(user) {
  const side = viewerSideFor(user);
  if (side === 'buyer') return { buyerOrgId: user.orgId };
  if (side === 'exporter') return { exporterOrgId: user.orgId };
  return null; // staff are never a party (M4-2)
}

export function attachSocket(httpServer) {
  // Mirror the HTTP CORS policy exactly (app.js): CORS_ORIGINS is a COMMA-
  // SEPARATED STRING, so handing it to socket.io raw would compare a browser's
  // origin against the whole joined list and match nothing — every browser
  // client blocked, while curl and the mobile app carried on working.
  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        // No Origin header = a non-browser client (mobile app, tests). CORS is a
        // browser control; auth is enforced separately on the handshake.
        if (!origin) return callback(null, true);
        return callback(null, allowedOrigins.includes(origin));
      },
      credentials: true,
    },
    // §7.7: with more than one process an in-memory adapter silently drops
    // messages between them. The adapter is wired by the caller when a Redis URL
    // is configured — see `attachRedisAdapter`.
  });

  io.use(async (socket, next) => {
    try {
      const token = tokenFromHandshake(socket);
      if (!token) return next(new Error('unauthorised'));
      socket.data.user = await authenticateToken(token);
      return next();
    } catch {
      // Never leak WHY — the same posture as the REST auth surface.
      return next(new Error('unauthorised'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;

    /**
     * 🔴 The connection handler must NOT be async, and the listeners below must
     * be registered SYNCHRONOUSLY.
     *
     * socket.io does not buffer events that arrive before a listener exists — it
     * drops them silently, with no ack. This handler used to `await` the
     * room-join query first, which left a window where a client that connected
     * and immediately sent had its first message vanish. It looked like a flaky
     * test; it is a real bug a user would experience as "sometimes my first
     * message just doesn't send".
     *
     * §7.2 — parties join all their threads on connect. Admins join NOTHING by
     * default: there will be thousands of threads and no reason to push all of
     * them at an idle moderator. They join one, read-only, on conversation:open.
     * The join is kicked off here and awaited by any handler that broadcasts, so
     * the sender is reliably in the room by the time their own message goes out.
     */
    const filter = partyFilter(user);
    socket.data.roomsReady = filter
      ? Conversation.find(filter)
          .select('_id')
          .lean()
          .then((rooms) => {
            for (const row of rooms) socket.join(ROOM(row._id));
          })
          .catch((err) => {
            logger.warn({ err: { name: err?.name, message: err?.message } }, 'socket room join failed');
          })
      : Promise.resolve();

    socket.on('message:send', async ({ conversationId, body } = {}, ack) => {
      try {
        const fresh = await currentUser(socket);

        // Trim BEFORE measuring, exactly as the REST validator does (`zString`
        // trims then bounds). Checking the raw length first meant a 200-character
        // message with trailing whitespace was accepted over REST and rejected
        // over the socket — the same input, two answers, depending on transport.
        const trimmed = typeof body === 'string' ? body.trim() : '';
        if (trimmed.length === 0 || trimmed.length > 200) throw new Error('invalid body');

        // The SAME guards as REST — this calls the one send service rather than
        // re-implementing party/frozen/length checks.
        const { message } = await sendMessage({ user: fresh, conversationId, body: trimmed });

        // Make sure this socket has finished joining its rooms before we
        // broadcast, or the sender misses their own message on a fast send.
        await socket.data.roomsReady;

        io.to(ROOM(conversationId)).emit('message:new', {
          conversationId: String(conversationId),
          message: messageView(message),
        });
        io.to(ROOM(conversationId)).emit('conversation:updated', { conversationId: String(conversationId) });
        ack?.({ ok: true, message: messageView(message) });
      } catch (err) {
        logger.warn({ err: { name: err?.name, message: err?.message } }, 'socket message:send rejected');
        ack?.({ ok: false, error: 'Message could not be sent.' });
      }
    });

    socket.on('conversation:read', async ({ conversationId } = {}, ack) => {
      try {
        const fresh = await currentUser(socket);
        await markRead({ user: fresh, id: conversationId });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    // Admin-only: joins ONE room, read-only. There is no admin send path — the
    // send handler routes through `sendMessage`, which refuses staff outright.
    socket.on('conversation:open', async ({ conversationId } = {}, ack) => {
      try {
        const fresh = await currentUser(socket);
        if (viewerSideFor(fresh) !== 'staff') return ack?.({ ok: false });
        const exists = await Conversation.exists({ _id: conversationId });
        if (!exists) return ack?.({ ok: false });
        socket.join(ROOM(conversationId));
        return ack?.({ ok: true });
      } catch {
        return ack?.({ ok: false });
      }
    });

    /**
     * Reconnect recovery (approved deviation from m4.md §13, which left this as
     * "seen on next load"). §11 has no replay event, so this pair is ours.
     */
    socket.on('conversation:resync', async ({ conversationId, lastMessageId } = {}, ack) => {
      try {
        // Re-verified: this hands back message BODIES, so a revoked token must
        // stop working here even on an already-open connection.
        const fresh = await currentUser(socket);
        const conversation = await Conversation.findOne({
          _id: conversationId,
          // Same reasoning as conversation.service's scopeFilter: staff filter on
          // `parties`, never on `_id`, so the spread cannot overwrite the lookup.
          ...(partyFilter(fresh) ?? { parties: null }),
        }).select('_id').lean();
        if (!conversation) return ack?.({ ok: false });

        const filter = { conversationId };
        if (lastMessageId) {
          const anchor = await Message.findOne({ _id: lastMessageId, conversationId }).select('createdAt').lean();
          if (!anchor) return ack?.({ ok: false, truncated: true }); // unknown anchor → refetch over REST
          filter.createdAt = { $gt: anchor.createdAt };
        }

        const rows = await Message.find(filter).sort({ createdAt: 1, _id: 1 }).limit(RESYNC_CAP + 1).lean();
        const truncated = rows.length > RESYNC_CAP;
        return ack?.({
          ok: true,
          truncated,
          messages: (truncated ? [] : rows).map(messageView),
        });
      } catch {
        return ack?.({ ok: false });
      }
    });
  });

  return io;
}

/**
 * §7.7 — wire the Redis adapter when a URL is configured, so rooms survive more
 * than one process. Absent Redis this is a no-op and the server runs
 * single-process, which is correct for dev and for the current VPS deployment.
 * Imported lazily so the package is only required when it is actually used.
 */
export async function attachRedisAdapter() {
  if (!io || !env.REDIS_URL) return false;
  try {
    const [{ createAdapter }, { default: Redis }] = await Promise.all([
      import('@socket.io/redis-adapter'),
      import('ioredis'),
    ]);
    const pub = new Redis(env.REDIS_URL);
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
    logger.info('socket.io redis adapter attached');
    return true;
  } catch (err) {
    // A missing adapter package must not stop the server booting — it only means
    // this deployment is single-process, which is the current assumption anyway.
    logger.warn(
      { err: { name: err?.name, message: err?.message } },
      'socket.io redis adapter not attached — SINGLE PROCESS ONLY (§7.7)',
    );
    return false;
  }
}

/**
 * D-N3 — who currently has a live socket for this thread.
 *
 * ⚠️ Be precise about what this means, because the name flatters it: parties
 * join ALL of their conversation rooms on connect, so "in the room" really means
 * **"has the app open and connected"**, not "is looking at this thread". The
 * effect is that a connected user gets no push for anything — which is defensible
 * (they receive `message:new` live instead) but is broader than D-N3's wording
 * suggests, and on mobile a briefly-backgrounded socket can mean neither a live
 * view nor a push. Flagged to the owner; narrowing it would need the client to
 * announce which thread is on screen.
 *
 * Returns an empty set when there is no socket server (tests, or a REST-only
 * process), which fails SAFE: everyone gets notified rather than nobody.
 */
export async function usersInConversationRoom(conversationId) {
  if (!io) return new Set();
  try {
    const sockets = await io.in(ROOM(conversationId)).fetchSockets();
    return new Set(sockets.map((s) => s.data?.user?.userId).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** §7.4 — freeze is PUSHED, not polled: both composers disable immediately. */
export function emitFreeze(conversationId, reason) {
  io?.to(ROOM(conversationId)).emit('conversation:frozen', { conversationId: String(conversationId), reason });
}

export function emitUnfreeze(conversationId) {
  io?.to(ROOM(conversationId)).emit('conversation:unfrozen', { conversationId: String(conversationId) });
}
