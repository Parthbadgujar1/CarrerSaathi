import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No API route for ${req.method} ${req.originalUrl.split('?')[0]}`, 'ROUTE_NOT_FOUND'));
}

/** Converts library errors into ApiErrors with friendly messages. */
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Some fields are invalid.', details, 'VALIDATION_ERROR');
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}.`, undefined, 'INVALID_ID');
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    const msg = field === 'email' ? 'An account with this email already exists.' : `This ${field} is already in use.`;
    return ApiError.conflict(msg, 'DUPLICATE');
  }
  if (err?.type === 'entity.too.large') return new ApiError(413, 'Request body is too large.', 'PAYLOAD_TOO_LARGE');
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON in request body.', undefined, 'BAD_JSON');
  if (err?.name === 'JsonWebTokenError') return ApiError.unauthorized('Invalid session token.', 'TOKEN_INVALID');
  if (err?.name === 'TokenExpiredError') return ApiError.unauthorized('Session expired.', 'TOKEN_EXPIRED');
  if (err?.name === 'MongoServerSelectionError' || err?.name === 'MongoNetworkError') {
    return ApiError.unavailable('Database is temporarily unavailable.', 'DB_UNAVAILABLE');
  }
  if (err?.message?.includes('buffering timed out')) {
    return ApiError.unavailable('Database is temporarily unavailable.', 'DB_UNAVAILABLE');
  }
  if (err?.message === 'CORS_NOT_ALLOWED') return ApiError.forbidden('Origin not allowed.', 'CORS');
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const apiErr = normalize(err);

  if (!apiErr) {
    // Unexpected bug — log everything, reveal nothing.
    logger.error('Unhandled error', { requestId: req.id, path: req.originalUrl, message: err?.message, stack: err?.stack });
  } else if (apiErr.status >= 500) {
    logger.warn(apiErr.message, { requestId: req.id, code: apiErr.code, path: req.originalUrl });
  }

  const status = apiErr?.status || 500;
  if (res.headersSent) return;

  res.status(status).json({
    success: false,
    error: {
      code: apiErr?.code || 'INTERNAL_ERROR',
      message: apiErr?.message || 'Something went wrong on our side. Please try again.',
      ...(apiErr?.details ? { details: apiErr.details } : {}),
      requestId: req.id,
      ...(!env.isProd && !apiErr && err?.stack ? { debug: err.message } : {}),
    },
  });
}
