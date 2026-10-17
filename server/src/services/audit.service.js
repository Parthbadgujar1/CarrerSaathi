import { AuditLog } from '../models/index.js';
import { logger } from '../config/logger.js';

/** Records a privileged action. Never throws — auditing must not break the action itself. */
export function audit(req, action, { targetType, targetId, meta } = {}) {
  AuditLog.create({
    actor: req.user?._id,
    actorEmail: req.user?.email,
    action,
    targetType,
    targetId: targetId ? String(targetId) : undefined,
    meta,
    requestId: req.id,
  }).catch((err) => logger.warn('Audit log write failed', { action, message: err.message }));
}
