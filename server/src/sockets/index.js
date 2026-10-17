import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { resolveUserFromToken } from '../middleware/auth.js';
import { assertAccess, sendMessage } from '../modules/chat/chat.service.js';
import { setIO } from './io.js';

/**
 * Realtime layer (chat + notifications). It is optional by design: if it fails
 * to start or a client cannot connect, the REST endpoints still work and the
 * client falls back to polling.
 */
export function initSockets(httpServer) {
  try {
    const io = new Server(httpServer, {
      cors: { origin: env.corsOrigins, credentials: true },
      maxHttpBufferSize: 16 * 1024,
      pingInterval: 25_000,
      pingTimeout: 20_000,
      connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
    });

    io.use(async (socket, next) => {
      try {
        const { user } = await resolveUserFromToken(socket.handshake.auth?.token);
        socket.data.user = { _id: user._id, name: user.name, role: user.role };
        next();
      } catch {
        next(new Error('UNAUTHORIZED'));
      }
    });

    io.on('connection', (socket) => {
      const user = socket.data.user;
      socket.join(`user:${user._id}`);

      // Simple per-socket flood control: max 10 messages per 10 seconds.
      let windowStart = Date.now();
      let sent = 0;
      const allow = () => {
        if (Date.now() - windowStart > 10_000) {
          windowStart = Date.now();
          sent = 0;
        }
        sent += 1;
        return sent <= 10;
      };

      socket.on('chat:join', async ({ conversationId } = {}, ack) => {
        try {
          await assertAccess(user, conversationId);
          socket.join(`conv:${conversationId}`);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err.message });
        }
      });

      socket.on('chat:leave', ({ conversationId } = {}) => socket.leave(`conv:${conversationId}`));

      socket.on('chat:send', async ({ conversationId, text } = {}, ack) => {
        if (!allow()) return ack?.({ ok: false, error: 'You are sending messages too quickly.' });
        try {
          const message = await sendMessage(user, conversationId, text);
          ack?.({ ok: true, message });
        } catch (err) {
          ack?.({ ok: false, error: err.message });
        }
      });

      socket.on('chat:typing', ({ conversationId } = {}) => {
        if (typeof conversationId !== 'string' || !socket.rooms.has(`conv:${conversationId}`)) return;
        socket.to(`conv:${conversationId}`).emit('chat:typing', { conversationId, user: { _id: user._id, name: user.name } });
      });

      socket.on('error', (err) => logger.warn('Socket error', { message: err.message }));
    });

    setIO(io);
    logger.info('Realtime (Socket.IO) ready');
    return io;
  } catch (err) {
    logger.error('Realtime layer failed to start — continuing with REST only', { message: err.message });
    return null;
  }
}
