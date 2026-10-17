import { Notification } from '../models/index.js';
import { logger } from '../config/logger.js';
import { emitToUser } from '../sockets/io.js';

/** Creates in-app notifications for one or many users and pushes them in realtime. Best-effort. */
export async function notify(userIds, { type = 'info', title, body = '', link = '' }) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
  if (!ids.length) return;
  try {
    const docs = await Notification.insertMany(
      ids.map((user) => ({ user, type, title, body, link })),
      { ordered: false },
    );
    for (const doc of docs) emitToUser(doc.user, 'notification:new', doc.toJSON());
  } catch (err) {
    logger.warn('Notification delivery failed', { message: err.message, count: ids.length });
  }
}
