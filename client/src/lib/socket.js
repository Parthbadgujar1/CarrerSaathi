/**
 * Realtime connection (Socket.IO). Optional by design — every feature that
 * uses it also works over REST, so a blocked websocket only means slower updates.
 */
import { io } from 'socket.io-client';
import { getAccessToken } from './http';

let socket = null;

export function connectSocket() {
  if (socket) return socket;
  socket = io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 10_000,
    // Called on every (re)connect so a refreshed access token is always used.
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  return socket;
}

export const getSocket = () => socket;

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
