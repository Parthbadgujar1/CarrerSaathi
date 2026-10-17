/**
 * Holds the Socket.IO server instance so services can emit realtime events
 * without importing the HTTP layer. Every emit is a no-op if sockets are down,
 * so realtime failures never break the REST request that triggered them.
 */
let io = null;

export const setIO = (instance) => {
  io = instance;
};

export function emitToUser(userId, event, payload) {
  try {
    io?.to(`user:${userId}`).emit(event, payload);
  } catch {
    /* realtime is best-effort */
  }
}

export function emitToRoom(room, event, payload) {
  try {
    io?.to(room).emit(event, payload);
  } catch {
    /* realtime is best-effort */
  }
}

export const isSocketReady = () => Boolean(io);
