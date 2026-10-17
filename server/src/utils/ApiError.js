/**
 * Operational error with an HTTP status and a stable machine-readable code.
 * Anything thrown that is NOT an ApiError is treated as an unexpected bug and
 * reported to clients as a generic 500 (details only go to the logs).
 */
export class ApiError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message = 'Bad request', details, code = 'BAD_REQUEST') {
    return new ApiError(400, message, code, details);
  }
  static unauthorized(message = 'Please sign in to continue', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, code);
  }
  static forbidden(message = 'You do not have permission to do that', code = 'FORBIDDEN') {
    return new ApiError(403, message, code);
  }
  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, code);
  }
  static conflict(message = 'Conflict', code = 'CONFLICT') {
    return new ApiError(409, message, code);
  }
  static tooMany(message = 'Too many requests, please slow down', code = 'RATE_LIMITED') {
    return new ApiError(429, message, code);
  }
  static unavailable(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE') {
    return new ApiError(503, message, code);
  }
}
